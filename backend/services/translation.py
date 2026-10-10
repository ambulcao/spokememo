"""Split a transcript into numbered lines and read the translated lines back."""
import re

TARGET_LANGUAGE_NAMES = {
    "pt": "português do Brasil",
    "en": "English",
    "es": "español",
}

_NUMBERED_LINE = re.compile(r"^\[(\d+)\]\s?(.*)$")


def normalize_target_language(value: str | None) -> str | None:
    """Return pt, en, or es, or None when no translation was requested."""
    if not value:
        return None
    code = value.strip().lower()[:2]
    if code in TARGET_LANGUAGE_NAMES:
        return code
    return None


def same_language(source: str | None, target: str | None) -> bool:
    """True when the spoken language is already the requested translation."""
    if not source or not target:
        return False
    return source.strip().lower()[:2] == target


def chunk_indexed_lines(
    lines: list[tuple[int, str]],
    max_chars: int = 2800,
) -> list[list[tuple[int, str]]]:
    """Group numbered lines so each model call stays inside the context window."""
    chunks: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    size = 0
    for item in lines:
        piece = len(item[1]) + 8
        if current and size + piece > max_chars:
            chunks.append(current)
            current = []
            size = 0
        current.append(item)
        size += piece
    if current:
        chunks.append(current)
    return chunks


def parse_numbered_translation(text: str) -> dict[int, str]:
    """Map [n] markers from a model reply back to translated lines."""
    found: dict[int, str] = {}
    for raw in text.splitlines():
        match = _NUMBERED_LINE.match(raw.strip())
        if match:
            found[int(match.group(1))] = match.group(2).strip()
    return found
