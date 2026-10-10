"""Process-wide cache for the transcription models.

An 8 GB GPU cannot keep Whisper, PyAnnote and a local 9B model resident at
the same time. The summary path releases this cache so Ollama can load on
the GPU; the next transcription loads the models again.
"""
import gc
import logging

logger = logging.getLogger(__name__)

_whisper_models: dict = {}
_diarization_pipeline = None


def get_whisper_model(model_name: str, device: str, compute_type: str):
    """Return a cached faster-whisper model, loading it on first use."""
    if model_name not in _whisper_models:
        from faster_whisper import WhisperModel

        logger.info("Loading faster-whisper model: %s", model_name)
        if "cpu" in device and compute_type == "float16":
            logger.warning(
                "compute_type 'float16' not supported on CPU. Falling back to 'int8'."
            )
            compute_type = "int8"
        model = WhisperModel(
            model_name,
            device=device.split(":")[0],
            compute_type=compute_type,
        )
        _whisper_models[model_name] = model
        logger.info(
            "faster-whisper model %s loaded successfully on %s with %s precision",
            model_name,
            device,
            compute_type,
        )
    return _whisper_models[model_name]


def get_diarization_pipeline(model_name: str, token: str, device: str):
    """Return a cached PyAnnote pipeline, loading it on first use."""
    global _diarization_pipeline  # pylint: disable=global-statement
    if _diarization_pipeline is None:
        import torch
        from pyannote.audio import Pipeline

        logger.info("Loading PyAnnote speaker diarization pipeline")
        pipeline = Pipeline.from_pretrained(model_name, token=token)
        _diarization_pipeline = pipeline.to(torch.device(device))
        logger.info("PyAnnote pipeline loaded successfully")
    return _diarization_pipeline


def release_gpu_models() -> None:
    """Drop transcription models and return their VRAM to the driver."""
    global _diarization_pipeline  # pylint: disable=global-statement
    held = bool(_whisper_models) or _diarization_pipeline is not None
    _whisper_models.clear()
    _diarization_pipeline = None
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:  # pylint: disable=broad-exception-caught
        logger.debug("CUDA cache was not cleared", exc_info=True)
    if held:
        logger.info("Released GPU transcription models so the LLM can use the GPU")
