"""Normalize CSV catalog values. Prices are integer cents. UPCs stay text."""
from __future__ import annotations

import math
import re
from typing import Any

FORM_MAP: tuple[tuple[str, str], ...] = (
    ("delayed release vegcap", "capsule"),
    ("acid resistant cap", "capsule"),
    ("vegetable capsule", "capsule"),
    ("organic capsule", "capsule"),
    ("vegcap", "capsule"),
    ("capsules", "capsule"),
    ("capsule", "capsule"),
    ("soft gel", "softgel"),
    ("softgel", "softgel"),
    ("enteric coated fish gel", "softgel"),
    ("fish gel", "softgel"),
    ("chewable tablet", "tablet"),
    ("chewable", "tablet"),
    ("tablet", "tablet"),
    ("soft chew", "other"),
    ("powder", "powder"),
    ("liquid", "liquid"),
    ("gummy", "gummy"),
    ("lozenge", "lozenge"),
    ("spray", "spray"),
    ("packet", "packet"),
)

STRENGTH_RE = re.compile(
    r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>mcg|mg|iu|cfu)\b",
    re.I,
)
BILLION_RE = re.compile(
    r"(?P<value>\d+(?:\.\d+)?)\s*(?:b\b|billion)\b",
    re.I,
)
COUNT_RE = re.compile(r"^(?P<n>\d+)\s*(?:ct|count|cap|caps)\b", re.I)
SIZE_RE = re.compile(
    r"^(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>oz|ml|g|kg|l)\b",
    re.I,
)


def trim(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\ufeff", "").strip()


def dollars_to_cents(raw: Any) -> int | None:
    """Parse currency text to integer cents. None when blank or invalid."""
    text = trim(raw)
    if not text or text in {".", "-", "—"}:
        return None
    neg = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace("$", "").replace(",", "").replace("USD", "").strip()
    if not text:
        return None
    try:
        amount = float(text)
    except ValueError:
        return None
    if not math.isfinite(amount):
        return None
    cents = int(round(amount * 100))
    return -cents if neg else cents


def normalize_upc(raw: Any) -> tuple[str | None, list[str]]:
    """Return (upc_text, warnings). Never coerce to int."""
    warnings: list[str] = []
    text = trim(raw)
    if not text:
        return None, warnings
    compact = re.sub(r"[\s\-]", "", text)
    if not compact.isdigit():
        warnings.append("UPC contains non-digit characters after cleanup.")
        compact = re.sub(r"\D", "", compact)
        if not compact:
            return None, warnings
    if len(compact) not in {8, 12, 13, 14}:
        warnings.append(f"Unexpected UPC length {len(compact)}.")
    return compact, warnings


def normalize_form(raw: Any) -> tuple[str | None, str | None, list[str]]:
    original = trim(raw)
    if not original:
        return None, None, []
    key = original.lower()
    for needle, canonical in FORM_MAP:
        if needle in key:
            return canonical, original, []
    return "other", original, ["Form kept as original label; mapped to other."]


def parse_size(raw: Any) -> dict[str, Any]:
    original = trim(raw)
    out: dict[str, Any] = {
        "original": original or None,
        "unit_count": None,
        "size_value": None,
        "size_unit": None,
        "warnings": [],
    }
    if not original:
        return out
    count = COUNT_RE.match(original.replace(" ", ""))
    if count is None:
        count = COUNT_RE.match(original)
    if count:
        out["unit_count"] = int(count.group("n"))
        return out
    size = SIZE_RE.match(original.replace(" ", "")) or SIZE_RE.match(original)
    if size:
        out["size_value"] = float(size.group("value"))
        out["size_unit"] = size.group("unit").lower()
        return out
    out["warnings"].append("Size kept as original; not auto-parsed.")
    return out


def parse_strength(name: str, explicit: str = "") -> dict[str, Any]:
    warnings: list[str] = []
    haystack = f"{explicit} {name}".strip()
    match = STRENGTH_RE.search(haystack)
    if match:
        unit = match.group("unit").lower()
        if unit == "iu":
            unit = "IU"
        return {
            "strength_value": float(match.group("value")),
            "strength_unit": unit,
            "warnings": warnings,
        }
    billion = BILLION_RE.search(haystack)
    if billion:
        return {
            "strength_value": float(billion.group("value")),
            "strength_unit": "Billion CFU",
            "warnings": warnings,
        }
    return {"strength_value": None, "strength_unit": None, "warnings": warnings}


def sale_from_discount(regular_cents: int, percent: int) -> int:
    return int(round(regular_cents * (1 - percent / 100)))


def slugify(value: str) -> str:
    text = trim(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80] or "item"
