"""Deterministic local search helpers.

Controlled synonyms map common phrasings and symptom-style queries onto
wellness-support terminology. IMPORTANT (health-safety): symptom queries are
mapped to configured wellness-support tags only. We never assert that a
supplement diagnoses, treats, cures, or prevents a disease.
"""
from __future__ import annotations

import re

# Each key (a normalized phrase) expands to additional search terms that are
# matched against product name/aliases/tags/ingredients. Symptom-like keys map
# to *wellness-support* categories, not medical claims.
SYNONYMS: dict[str, list[str]] = {
    "multivitamin": ["multivitamin", "multi vitamin", "multi"],
    "multi vitamin": ["multivitamin", "multi vitamin", "multi"],
    "b12": ["b12", "cobalamin", "vitamin b12"],
    "cobalamin": ["b12", "cobalamin"],
    "d3": ["d3", "cholecalciferol", "vitamin d3", "vitamin d"],
    "cholecalciferol": ["d3", "cholecalciferol"],
    "omega 3": ["omega 3", "omega-3", "fish oil", "epa", "dha"],
    "omega3": ["omega 3", "omega-3", "fish oil"],
    "fish oil": ["fish oil", "omega 3", "omega-3"],
    "joint support": ["joint support", "joint", "mobility"],
    "joint": ["joint support", "joint", "mobility"],
    "sleep support": ["sleep support", "sleep", "melatonin"],
    "sleep": ["sleep support", "sleep", "melatonin"],
    "digestive support": ["digestive support", "digestion", "probiotic", "gut"],
    "digestion": ["digestive support", "digestion", "probiotic"],
    "immune support": ["immune support", "immunity", "immune"],
    "immunity": ["immune support", "immunity", "immune"],
    "hair skin nails": ["hair skin nails", "biotin", "collagen", "hair", "skin", "nails"],
    "hair": ["hair skin nails", "biotin", "collagen"],
    # Symptom-style query mapped ONLY to wellness-support categories.
    "pain": ["joint support", "occasional discomfort", "healthy inflammatory response"],
    "pain relief": ["joint support", "occasional discomfort", "healthy inflammatory response"],
    "inflammation": ["healthy inflammatory response", "turmeric", "curcumin", "joint support"],
    # Curamin-style demonstration alias (matches product name / configured alias).
    "curamin": ["curamin", "curcumin", "healthy inflammatory response"],
}

_token_re = re.compile(r"[a-z0-9]+")
MAX_QUERY_LEN = 100


def normalize_query(q: str) -> str:
    return (q or "").strip().lower()[:MAX_QUERY_LEN]


def expand_terms(q: str) -> list[str]:
    """Return a de-duplicated list of search terms including synonym expansions."""
    norm = normalize_query(q)
    if not norm:
        return []
    terms: list[str] = [norm]

    # Whole-phrase synonym match first.
    if norm in SYNONYMS:
        terms.extend(SYNONYMS[norm])

    # Then per-token expansion.
    for tok in _token_re.findall(norm):
        terms.append(tok)
        if tok in SYNONYMS:
            terms.extend(SYNONYMS[tok])

    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        t = t.strip()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out
