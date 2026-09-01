"""Map product names to wellness categories, forms, and audience — no disease claims."""
from __future__ import annotations

import re

from app.catalog.types import ParsedProduct

FORM_PATTERNS: list[tuple[str, str]] = [
    ("softgel", r"soft\s*gels?"),
    ("gummy", r"gummies|gummy"),
    ("capsule", r"capsules?|veggie cap"),
    ("tablet", r"tablets?"),
    ("liquid", r"liquid|drops?\b|tincture"),
    ("powder", r"powder|protein"),
    ("spray", r"spray"),
    ("chewable", r"chewables?"),
    ("lozenge", r"lozenges?"),
    ("cream", r"cream|topical"),
]

# (category, keywords, wellness tags)
CATEGORY_RULES: list[tuple[str, list[str], list[str]]] = [
    ("Multivitamins", ["multivitamin", "multi vitamin", "multi-vitamin", "women's multi", "men's multi"], ["immune support"]),
    ("Vitamin A", ["vitamin a", "beta carotene"], ["immune support"]),
    ("Vitamin D", ["vitamin d", "d3", "cholecalciferol", "k2"], ["bone health", "immune support"]),
    ("Vitamin E", ["vitamin e", "tocopherol"], ["heart wellness"]),
    ("Vitamin K", ["vitamin k", "k2", "mk-7", "menaquinone"], ["bone health"]),
    ("Vitamin C", ["vitamin c", "ascorbic"], ["immune support"]),
    ("Vitamin B & B12", ["b-complex", "b complex", "b12", "b-12", "methylcobalamin", "biotin"], ["energy"]),
    ("Magnesium", ["magnesium"], ["sleep support"]),
    ("Calcium", ["calcium"], ["bone health"]),
    ("Zinc", ["zinc"], ["immune support"]),
    ("Iron", ["iron", "ferrous"], ["energy"]),
    ("Minerals", ["mineral", "selenium", "potassium", "iodine"], ["immune support"]),
    ("Omega Oils", ["omega", "fish oil", "algae oil", "dha", "epa"], ["heart wellness", "brain wellness"]),
    ("Probiotics", ["probiotic", "acidophilus"], ["digestive support"]),
    ("Digestive Support", ["digestive enzyme", "enzyme", "fiber", "psyllium"], ["digestive support"]),
    ("Herbal Supplements", ["turmeric", "curcumin", "ashwagandha", "elderberry", "herbal", "herb"], ["immune support"]),
    ("Joint Support", ["joint", "glucosamine", "chondroitin", "collagen"], ["joint support"]),
    ("Immune Support", ["immune", "elderberry", "echinacea"], ["immune support"]),
    ("Sleep Support", ["sleep", "melatonin", "theanine"], ["sleep support"]),
    ("Heart Wellness", ["coq10", "coenzyme q", "sterol", "heart"], ["heart wellness"]),
    ("Brain Wellness", ["lion's mane", "ginkgo", "omega-3 dha", "focus"], ["brain wellness"]),
    ("Hair, Skin & Nails", ["hair", "skin", "nail", "biotin", "collagen"], ["hair skin nails"]),
    ("Women's Wellness", ["women", "prenatal", "menopause"], ["womens health"]),
    ("Men's Wellness", ["men's", "mens ", "prostate"], ["mens health"]),
    ("Children's Supplements", ["kid", "children", "child", "baby"], []),
    ("Sports Nutrition", ["protein", "creatine", "pre-workout", "whey", "athlete"], ["sports recovery"]),
    ("Natural Foods", ["organic beans", "nut butter", "snack", "chips", "salsa", "pickle", "ketchup", "mustard"], []),
]

FOUNDATIONAL = (
    "multivitamin",
    "vitamin d",
    "d3",
    "b12",
    "magnesium",
    "omega",
    "fish oil",
    "probiotic",
    "turmeric",
    "curcumin",
    "ashwagandha",
    "elderberry",
    "zinc",
    "vitamin c",
)

STRENGTH_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(IU|mcg|µg|mg|g|billion)\b",
    re.I,
)
COUNT_RE = re.compile(
    r"(\d+)\s*(?:count|softgels?|capsules?|tablets?|gummies|chewables?|servings?)\b",
    re.I,
)


def _key_in_name(name: str, key: str) -> bool:
    if len(key) <= 3 or key in {"dha", "epa", "k2", "d3", "b12", "iron"}:
        return re.search(rf"(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])", name) is not None
    return key in name


def classify_name(name: str, *, is_food: bool = False) -> tuple[str, str | None, list[str], str | None, str | None]:
    """Return primary category, form, wellness tags, audience, secondary category."""
    n = name.lower()
    if is_food:
        return "Natural Foods", _form(n) or "other", [], None, None
    form = _form(n)
    audience = None
    if re.search(r"\b(women|woman|prenatal)\b", n):
        audience = "women"
    elif re.search(r"\b(men|man's|mens)\b", n):
        audience = "men"
    elif re.search(r"\b(kid|child|children|baby)\b", n):
        audience = "children"
    matched: list[tuple[str, list[str]]] = []
    for cat, keys, tags in CATEGORY_RULES:
        if any(_key_in_name(n, k) for k in keys):
            matched.append((cat, tags))
    if not matched:
        return "Herbal Supplements" if "herb" in n else "Multivitamins", form, [], audience, None
    primary, tags = matched[0]
    secondary = matched[1][0] if len(matched) > 1 else None
    return primary, form, list(dict.fromkeys(tags)), audience, secondary


def _form(n: str) -> str | None:
    for form, pat in FORM_PATTERNS:
        if re.search(pat, n, re.I):
            return form
    return None


def enrich(parsed: ParsedProduct, *, is_food: bool = False) -> ParsedProduct:
    cat, form, tags, audience, secondary = classify_name(parsed.name, is_food=is_food)
    if not parsed.primary_category:
        parsed.primary_category = cat
    if not parsed.secondary_category:
        parsed.secondary_category = secondary
    if not parsed.form:
        parsed.form = form
    if not parsed.wellness_tags:
        parsed.wellness_tags = tags
    if not parsed.health_interests:
        parsed.health_interests = tags
    if not parsed.intended_audience:
        parsed.intended_audience = audience
    if parsed.strength_value is None:
        m = STRENGTH_RE.search(parsed.name)
        if m:
            parsed.strength_value = float(m.group(1))
            unit = m.group(2).lower()
            parsed.strength_unit = "mcg" if unit in ("µg", "mcg") else ("IU" if unit == "iu" else unit)
    if parsed.count is None:
        m = COUNT_RE.search(parsed.name + " " + (parsed.variant_name or ""))
        if m:
            parsed.count = int(m.group(1))
    aliases = {parsed.name.lower()}
    for token in ("vitamin d", "d3", "b12", "omega 3", "fish oil", "curcumin", "turmeric"):
        if token in parsed.name.lower():
            aliases.add(token)
    parsed.search_aliases = sorted(aliases)
    return parsed


def is_foundational(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in FOUNDATIONAL)
