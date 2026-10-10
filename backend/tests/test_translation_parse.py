"""Parser tests for transcript translation. They do not call the language model."""
from services.translation import (
    chunk_indexed_lines,
    normalize_target_language,
    parse_numbered_translation,
    same_language,
)


def test_normalize_accepts_only_pt_en_es():
    assert normalize_target_language("pt") == "pt"
    assert normalize_target_language("ES") == "es"
    assert normalize_target_language("english") == "en"
    assert normalize_target_language("") is None
    assert normalize_target_language("fr") is None


def test_same_language_compares_the_language_code():
    assert same_language("pt", "pt")
    assert same_language("portuguese", "pt") is False
    assert same_language("en", "es") is False
    assert same_language(None, "pt") is False


def test_chunks_keep_indexes_and_respect_the_size_limit():
    lines = [(0, "a" * 20), (1, "b" * 20), (2, "c" * 20)]
    chunks = chunk_indexed_lines(lines, max_chars=40)
    assert chunks[0] == [(0, "a" * 20)]
    assert [item[0] for item in chunks[-1]] == [2]


def test_parse_reads_numbered_lines_and_ignores_notes():
    parsed = parse_numbered_translation("Aqui vai a tradução:\n[0] Olá\n[2] Tudo bem")
    assert parsed == {0: "Olá", 2: "Tudo bem"}
