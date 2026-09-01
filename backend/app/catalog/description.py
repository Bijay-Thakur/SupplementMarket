"""Neutral demo copy from factual fields. Never copy marketing prose or amplify claims."""
from __future__ import annotations

import re

from app.catalog.sources import FDA_DISCLAIMER
from app.catalog.types import ParsedProduct

_CLAIM = re.compile(
    r"\b(diagnos\w*|treat(?:ment|s|ing)?|cure[sd]?|prevent(?:s|ion|ing)?|"
    r"guarante\w*|miracle|clinically proven)\b",
    re.I,
)


def strip_claims(text: str) -> str:
    return _CLAIM.sub("", text)


def short_description(p: ParsedProduct) -> str:
    bits = [p.brand, p.name]
    facts: list[str] = []
    if p.form:
        facts.append(p.form)
    if p.strength_value and p.strength_unit:
        val = int(p.strength_value) if float(p.strength_value).is_integer() else p.strength_value
        facts.append(f"{val} {p.strength_unit}")
    if p.count:
        facts.append(f"{p.count} count")
    if p.size:
        facts.append(p.size)
    dietary = [
        label
        for flag, label in (
            (p.vegan, "vegan"),
            (p.vegetarian, "vegetarian"),
            (p.organic, "organic"),
            (p.non_gmo, "non-GMO"),
            (p.gluten_free, "gluten-free"),
        )
        if flag
    ]
    if dietary:
        facts.append(", ".join(dietary))
    body = f"{' '.join(bits[:2])}."
    if facts:
        body += " " + "; ".join(facts) + "."
    body = strip_claims(body)
    body = re.sub(r"\s+", " ", body).strip()
    if len(body) > 320:
        body = body[:317] + "..."
    disclaimer = FDA_DISCLAIMER
    combined = f"{body} {disclaimer}"
    return combined[:400]


def warnings_text(p: ParsedProduct) -> str:
    parts = []
    if p.manufacturer_warnings:
        parts.append(strip_claims(p.manufacturer_warnings)[:800])
    parts.append(FDA_DISCLAIMER)
    return " ".join(parts)
