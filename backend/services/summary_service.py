"""
Summary service for LLM-powered summarization and speaker identification.

This service handles LLM API calls for transcript summarization, speaker identification,
and summary caching.
"""
import json
import logging
from typing import Optional

import aiofiles
import httpx
from config import Settings
from fastapi import HTTPException
from services.gpu_models import release_gpu_models
from services.translation import (
    TARGET_LANGUAGE_NAMES,
    chunk_indexed_lines,
    parse_numbered_translation,
)

logger = logging.getLogger(__name__)

# qwen3.5:9b has 32 layers. Twelve of them use about 2.6 GB on an 8 GB GPU
# and leave the rest of the card free. The model is unloaded when the reply ends.
LLM_GPU_LAYERS = 12
LLM_NUM_CTX = 8192

# Language name mapping for common languages
LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pt': 'Portuguese',
    'ru': 'Russian', 'ar': 'Arabic', 'hi': 'Hindi', 'it': 'Italian',
    'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish', 'vi': 'Vietnamese',
    'sv': 'Swedish', 'id': 'Indonesian', 'th': 'Thai', 'uk': 'Ukrainian'
}


def _completion_text(message: dict) -> str:
    """Return the assistant text, including thinking-model fallbacks.

    Some servers (Ollama with Qwen3) leave ``content`` empty and put the
    answer in ``reasoning`` until the token budget is large enough.
    """
    content = (message.get("content") or "").strip()
    if content:
        return content
    return (message.get("reasoning") or message.get("thinking") or "").strip()


def _extract_speaker_mapping(content: str) -> Optional[dict]:
    """
    Extract a speaker->name mapping from an LLM response.

    LLMs do not reliably return a bare JSON object: the mapping may be fenced in
    a markdown code block, or embedded in surrounding prose. This tolerantly
    recovers the first valid JSON object and validates it is a flat mapping of
    string labels to string names.

    Args:
        content: Raw assistant message content.

    Returns:
        A dict of speaker label -> suggested name, or None if no valid mapping
        could be parsed.
    """
    if not content:
        return None

    candidates = []

    # 1) Fenced code block (```json ... ``` or ``` ... ```), if present.
    if "```" in content:
        fenced = content.split("```", 2)
        if len(fenced) >= 2:
            block = fenced[1]
            if block.lstrip().lower().startswith("json"):
                block = block.lstrip()[len("json"):]
            candidates.append(block.strip())

    # 2) The whole (stripped) string.
    candidates.append(content.strip())

    # 3) Every balanced {...} object found in the text, in order. Scanning all
    #    of them (not just the first) means a leading non-mapping object does
    #    not hide a valid mapping that appears later in the prose.
    depth = 0
    obj_start = -1
    for i, ch in enumerate(content):
        if ch == "{":
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and obj_start != -1:
                candidates.append(content[obj_start:i + 1])

    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        # Only accept a flat mapping of string -> string.
        if isinstance(parsed, dict) and parsed and all(
            isinstance(k, str) and isinstance(v, str) for k, v in parsed.items()
        ):
            return parsed

    return None


class SummaryService:
    """Service for LLM-based summarization and speaker identification."""

    def __init__(self, http_client: httpx.AsyncClient, settings: Settings):
        """
        Initialize SummaryService.

        Args:
            http_client: Async HTTP client for LLM API calls
            settings: Application settings
        """
        self.http_client = http_client
        self.settings = settings

    async def _make_room_for_llm(self) -> None:
        """Free the transcription models and drop a previously loaded Ollama model.

        The next chat request then loads only a slice of the LLM onto the GPU.
        A server that is not Ollama ignores the unload call.
        """
        release_gpu_models()
        base_url = self.settings.llm_api_url.rstrip("/")
        try:
            await self.http_client.post(
                f"{base_url}/api/generate",
                json={"model": self.settings.llm_model_name, "keep_alive": 0},
                timeout=20,
            )
        except httpx.HTTPError:
            logger.info("LLM server did not unload a model; continuing with the summary")

    async def _complete(
        self,
        messages: list,
        temperature: float,
        num_predict: int,
        json_mode: bool = False,
        *,
        prepare: bool = True,
        unload: bool = True,
    ) -> str:
        """Call the LLM with a partial GPU load.

        ``prepare`` frees the transcription models before the first call.
        ``unload`` drops the language model when the reply ends. A multi-part
        translation keeps it loaded between chunks.
        """
        if prepare:
            await self._make_room_for_llm()
        base_url = self.settings.llm_api_url.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if self.settings.llm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.llm_api_key}"

        native = {
            "model": self.settings.llm_model_name,
            "messages": messages,
            "think": False,
            "stream": False,
            "keep_alive": 0 if unload else "5m",
            "options": {
                "temperature": temperature,
                "num_predict": num_predict,
                "num_gpu": LLM_GPU_LAYERS,
                "num_ctx": LLM_NUM_CTX,
            },
        }
        if json_mode:
            native["format"] = "json"

        response = await self.http_client.post(
            f"{base_url}/api/chat",
            headers=headers,
            json=native,
            timeout=self.settings.llm_timeout,
        )
        if response.status_code == 404:
            logger.info("Native LLM chat is unavailable; using the OpenAI-compatible endpoint")
            openai_payload = {
                "model": self.settings.llm_model_name,
                "temperature": temperature,
                "max_tokens": num_predict,
                "think": False,
                "messages": messages,
            }
            if json_mode:
                openai_payload["response_format"] = {"type": "json_object"}
            response = await self.http_client.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=openai_payload,
                timeout=self.settings.llm_timeout,
            )
        elif response.is_success:
            logger.info(
                "LLM generating with %s GPU layers (context %s); the model is unloaded afterwards",
                LLM_GPU_LAYERS,
                LLM_NUM_CTX,
            )
        response.raise_for_status()
        data = response.json()
        message = (
            data["choices"][0]["message"]
            if "choices" in data
            else data.get("message") or {}
        )
        return _completion_text(message)

    async def translate_lines(
        self,
        lines: list[str],
        target_language: str,
        on_progress=None,
    ) -> list[str]:
        """Translate transcript lines into pt, en, or es. Blank lines stay blank."""
        language_name = TARGET_LANGUAGE_NAMES[target_language]
        translated = list(lines)
        indexed = [(index, text) for index, text in enumerate(lines) if text.strip()]
        chunks = chunk_indexed_lines(indexed)
        if not chunks:
            return translated

        for chunk_index, chunk in enumerate(chunks):
            body = "\n".join(f"[{index}] {text}" for index, text in chunk)
            raw = await self._complete(
                [{
                    "role": "user",
                    "content": (
                        f"Translate each numbered line into {language_name}. "
                        "Keep every [n] marker. Do not merge, drop, or add lines. "
                        "Do not add notes or quotation marks. "
                        "Translate only the spoken words.\n\n"
                        f"{body}"
                    ),
                }],
                temperature=0.1,
                num_predict=min(2000, max(400, len(body) // 2)),
                prepare=chunk_index == 0,
                unload=chunk_index == len(chunks) - 1,
            )
            parsed = parse_numbered_translation(raw)
            missing = [index for index, _original in chunk if not parsed.get(index)]
            if len(missing) > len(chunk) / 2:
                raise RuntimeError("A tradução não devolveu o texto completo.")
            for index, _original in chunk:
                if parsed.get(index):
                    translated[index] = parsed[index]
                else:
                    logger.warning("Translation missed line %s; keeping the original", index)
            if on_progress:
                await on_progress(int((chunk_index + 1) / len(chunks) * 100))
        return translated

    async def summarize(  # pylint: disable=too-many-locals
        self,
        transcript: str,
        custom_prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        language: Optional[str] = None
    ) -> str:
        """
        Summarize transcript using LLM.

        Args:
            transcript: The transcript text to summarize
            custom_prompt: Optional custom user prompt
            system_prompt: Optional custom system prompt
            language: ISO 639-1 language code or 'auto' for auto-detection

        Returns:
            Summary text in markdown format

        Raises:
            HTTPException: If LLM service is unavailable
        """
        # Validate transcript content quality
        transcript_text = transcript.strip()
        if not transcript_text:
            return (
                "# No Content Available\n\n"
                "The recording appears to be empty or could not be transcribed."
            )

        # Check for meaningful content
        words = transcript_text.split()
        unique_words = set(word.lower().strip('.,!?;:') for word in words)

        if len(words) < 10 or len(unique_words) < 5:
            spoken_content = ' '.join(words)
            return f"""# Resumo de gravação breve

## Conteúdo
Esta gravação é muito curta e tem pouco conteúdo.

**Conteúdo transcrito:** "{spoken_content}"

## Observação
A gravação foi breve demais para gerar um resumo detalhado da reunião."""

        # Determine language instruction
        language_instruction = ""
        if language and language != 'auto':
            lang_name = LANGUAGE_NAMES.get(language, language)
            language_instruction = (
                f"Generate the summary in {lang_name}, matching the language of the transcript. "
            )
        else:
            language_instruction = "Generate the summary in the same language as the transcript. "

        # Default prompts
        default_system_prompt = (
            "You are a helpful assistant that summarizes meeting transcripts. "
            "You will give a concise summary of the key points, decisions made, "
            "and any action items, outputting it in markdown format. "
            f"{language_instruction}"
            "IMPORTANT: Always use the exact speaker names provided in the transcript. "
            "Never change, substitute, or invent different names for speakers. "
            "CRITICAL: Only summarize what is actually present in the transcript. "
            "Do not invent or hallucinate content, participants, decisions, or action items."
        )

        default_user_prompt = (
            "Analyze the following transcript and provide an appropriate summary. "
            "Use exact speaker names as they appear. "
            "Only include sections that have actual content from the transcript. "
            "Use markdown format without code blocks.\n\n"
        )

        final_system_prompt = system_prompt if system_prompt else default_system_prompt

        if custom_prompt:
            final_user_prompt = custom_prompt + "\n\n" + transcript
        else:
            final_user_prompt = default_user_prompt + transcript

        try:
            return await self._complete(
                [
                    {"role": "system", "content": final_system_prompt},
                    {"role": "user", "content": final_user_prompt},
                ],
                temperature=0.3,
                num_predict=1500,
            )

        except httpx.HTTPError as e:
            logger.error("LLM service error: %s", e)
            raise HTTPException(
                status_code=503,
                detail="O serviço de resumo não respondeu a tempo. Tente de novo."
            ) from e

    async def identify_speakers(  # pylint: disable=too-many-locals
        self,
        transcript: str,
        context: Optional[str] = None
    ) -> dict:
        """
        Identify speakers using LLM based on transcript content.

        Args:
            transcript: Formatted transcript text
            context: Optional meeting context

        Returns:
            Dict with status and speaker name suggestions

        Raises:
            HTTPException: If LLM service is unavailable
        """
        system_prompt = (
            "You are a helpful assistant that identifies speakers in meeting transcripts. "
            "Based on the conversation content, suggest likely names or roles for each speaker. "
            "Return ONLY a JSON object mapping speaker labels to suggested names."
        )

        context_text = f"\nContext: {context}\n\n" if context else "\n\n"
        user_prompt = (
            "Analyze this transcript and suggest names or roles for each speaker. "
            f"{context_text}Transcript:\n{transcript}\n\n"
            "Return a JSON object like: "
            '{\"SPEAKER_00\": \"John (CEO)\", \"SPEAKER_01\": \"Sarah (CTO)\"}'
        )

        try:
            content = await self._complete(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                num_predict=800,
                json_mode=self.settings.llm_json_mode,
            )

            suggestions = _extract_speaker_mapping(content)
            if suggestions is None:
                logger.error(
                    "Speaker identification could not parse a speaker mapping from LLM output"
                )
                logger.debug("Unparseable speaker-identification content: %r", content)
                return {
                    "status": "error",
                    "message": "Could not parse speaker suggestions from the model response."
                }
            return {"status": "success", "suggestions": suggestions}

        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error("Speaker identification failed: %s", e, exc_info=True)
            return {
                "status": "error",
                "message": f"Speaker identification failed: {str(e)}"
            }

    async def get_cached_summary(self, job_uuid: str) -> Optional[str]:
        """
        Get cached summary from filesystem.

        Args:
            job_uuid: Job UUID

        Returns:
            Cached summary text or None if not found
        """
        summary_path = self.settings.summary_path / f"{job_uuid}.txt"

        if await aiofiles.os.path.exists(str(summary_path)):
            async with aiofiles.open(summary_path, "r", encoding="utf-8") as f:
                return await f.read()

        return None

    async def save_summary(self, job_uuid: str, summary: str) -> None:
        """
        Save summary to filesystem cache.

        Args:
            job_uuid: Job UUID
            summary: Summary text to save
        """
        summary_path = self.settings.summary_path / f"{job_uuid}.txt"

        async with aiofiles.open(summary_path, "w", encoding="utf-8") as f:
            await f.write(summary)

    async def delete_summary(self, job_uuid: str) -> bool:
        """
        Delete cached summary.

        Args:
            job_uuid: Job UUID

        Returns:
            True if summary was deleted, False if it didn't exist
        """
        summary_path = self.settings.summary_path / f"{job_uuid}.txt"

        if await aiofiles.os.path.exists(str(summary_path)):
            await aiofiles.os.remove(str(summary_path))
            return True

        return False
