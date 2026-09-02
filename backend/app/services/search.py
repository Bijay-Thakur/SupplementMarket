"""Deterministic local search helpers — concept groups, not unrestricted some().

Symptom-style queries map to wellness-support tags only. We never assert that a
supplement diagnoses, treats, cures, or prevents a disease.
"""
from __future__ import annotations

import re
import unicodedata

STOP = {"a", "an", "the", "of", "for", "and", "with", "plus", "from", "to", "in", "on", "by"}
IRREGULAR = {
    "women": "woman",
    "gummies": "gummy",
    "capsules": "capsule",
    "caps": "capsule",
    "tablets": "tablet",
    "softgels": "softgel",
    "probiotics": "probiotic",
}
SYNONYMS: dict[str, list[str]] = {
    "d3": ["d3", "vitamin d", "vitamin d3", "cholecalciferol"],
    "omega3": ["omega3", "omega 3", "omega-3", "fish oil", "epa", "dha"],
    "turmeric": ["turmeric", "curcumin"],
    "multivitamin": ["multivitamin", "multi vitamin", "multi"],
    "probiotic": ["probiotic", "probiotics", "flora"],
    "maryruth": ["maryruth", "mary ruth", "maryruths"],
    "pain": ["joint support", "occasional discomfort", "healthy inflammatory response"],
    "inflammation": ["healthy inflammatory response", "turmeric", "curcumin", "joint support"],
}
PHRASES = [
    (re.compile(r"vitamin\s*d\s*3"), "d3"),
    (re.compile(r"vitamin\s*d"), "d3"),
    (re.compile(r"fish\s*oil"), "omega3"),
    (re.compile(r"omega\s*3"), "omega3"),
    (re.compile(r"mary\s*ruths?"), "maryruth"),
    (re.compile(r"multi\s*vitamins?"), "multivitamin"),
    (re.compile(r"curcumin"), "turmeric"),
    (re.compile(r"turmeric"), "turmeric"),
    (re.compile(r"probiotics?"), "probiotic"),
]
MAX_QUERY_LEN = 100


def normalize_query(q: str) -> str:
    text = unicodedata.normalize("NFKD", q or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("’", "").replace("'", "").replace("–", " ").replace("—", " ")
    text = text.lower()
    text = re.sub(r"(\d)\s*(mg|mcg|iu|ml|oz)\b", r"\1 \2", text)
    text = re.sub(r"\bomega[\s-]*3\b", " omega3 ", text)
    text = re.sub(r"\bmary\s*ruths?\b", " maryruth ", text)
    return re.sub(r"\s+", " ", text).strip()[:MAX_QUERY_LEN]


def stem(token: str) -> str:
    if token in IRREGULAR:
        return IRREGULAR[token]
    if token.endswith("s") and not token.endswith("ss") and len(token) > 3:
        return token[:-1]
    return token


def tokenize_query(q: str) -> list[dict[str, list[str] | str]]:
    text = normalize_query(q)
    if not text:
        return []
    groups: list[dict[str, list[str] | str]] = []
    used: set[str] = set()
    for cre, key in PHRASES:
        if cre.search(text):
            text = cre.sub(" ", text)
            if key not in used:
                used.add(key)
                groups.append({"key": key, "terms": [key, *SYNONYMS.get(key, [])]})
    for raw in text.split():
        tok = raw.strip()
        if not tok or tok in STOP or (len(tok) == 1 and not tok.isdigit()):
            continue
        key = stem(tok)
        if key in used or tok in used:
            continue
        used.add(key)
        terms = SYNONYMS.get(key, [tok, key])
        groups.append({"key": key, "terms": terms})
    return groups


def expand_terms(q: str) -> list[str]:
    """Backward-compatible list of all synonyms; matching should use tokenize_query."""
    groups = tokenize_query(q)
    out: list[str] = []
    seen: set[str] = set()
    for g in groups:
        for t in g["terms"]:
            n = normalize_query(str(t))
            if n and n not in seen:
                seen.add(n)
                out.append(n)
    return out


def document_matches(hay: str, q: str) -> bool:
    """AND across concept groups, OR within synonyms."""
    groups = tokenize_query(q)
    if not groups:
        return True
    hay_n = normalize_query(hay)
    for g in groups:
        if not any(normalize_query(str(t)) in hay_n for t in g["terms"]):
            return False
    return True
