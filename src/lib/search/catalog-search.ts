/**
 * Shared catalog search contract.
 *
 * Concept groups are ANDed. Synonyms inside a group are ORed.
 * Symptom-style language maps only to wellness-support tags — never to
 * diagnosis, treatment, prevention, or cure claims.
 */

export type SearchDocument = {
  id: number;
  slug: string;
  name: string;
  brandName: string;
  productLine?: string | null;
  sku: string;
  upc: string | null;
  category: string;
  subcategory?: string | null;
  form: string | null;
  strengthValue: number | null;
  strengthUnit: string | null;
  size: string | null;
  count: number | null;
  flavor?: string | null;
  ingredientHighlights: string | null;
  searchAliases: string[];
  wellnessTags: string[];
  dietary: string[];
  certifications?: string | null;
  description: string | null;
};

export type SearchFilters = {
  brand?: string;
  category?: string;
  form?: string;
};

export type RankedHit = {
  id: number;
  score: number;
  reasons: string[];
};

export type ConceptGroup = {
  key: string;
  terms: string[];
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "and",
  "with",
  "plus",
  "from",
  "to",
  "in",
  "on",
  "by",
]);

const IRREGULAR: Record<string, string> = {
  women: "woman",
  woman: "woman",
  gummies: "gummy",
  gummy: "gummy",
  capsules: "capsule",
  capsule: "capsule",
  caps: "capsule",
  tablets: "tablet",
  tablet: "tablet",
  softgels: "softgel",
  softgel: "softgel",
  probiotics: "probiotic",
  probiotic: "probiotic",
  kids: "kid",
  children: "kid",
};

/** Symptom / alias expansions. Wellness-support only. */
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  d3: ["d3", "vitamin d", "vitamin d3", "cholecalciferol", "d 3"],
  omega3: ["omega3", "omega 3", "omega-3", "fish oil", "epa", "dha", "omegas"],
  turmeric: ["turmeric", "curcumin", "curcuma"],
  multivitamin: ["multivitamin", "multi vitamin", "multi", "multivitamins"],
  probiotic: ["probiotic", "probiotics", "flora", "acidophilus"],
  magnesium: ["magnesium"],
  zinc: ["zinc"],
  maryruth: ["maryruth", "mary ruth", "maryruths", "mary ruths"],
  pain: ["joint support", "occasional discomfort", "healthy inflammatory response"],
  inflammation: ["healthy inflammatory response", "turmeric", "curcumin", "joint support"],
  sleep: ["sleep support", "sleep", "melatonin"],
  immune: ["immune support", "immunity", "immune"],
  digestion: ["digestive support", "digestion", "probiotic", "gut"],
  hair: ["hair skin nails", "biotin", "collagen", "hair"],
  b12: ["b12", "cobalamin", "vitamin b12"],
};

const PHRASE_KEYS: { re: RegExp; key: string }[] = [
  { re: /\bvita?min\s*d\s*3\b/g, key: "d3" },
  { re: /\bvita?min\s*d\b/g, key: "d3" },
  { re: /\bcholecalciferol\b/g, key: "d3" },
  { re: /\bd\s*3\b/g, key: "d3" },
  { re: /\bfish\s*oil\b/g, key: "omega3" },
  { re: /\bomega\s*3\b/g, key: "omega3" },
  { re: /\bmary\s*ruths?\b/g, key: "maryruth" },
  { re: /\bmulti\s*vitamins?\b/g, key: "multivitamin" },
  { re: /\bcurcumin\b/g, key: "turmeric" },
  { re: /\bturmeric\b/g, key: "turmeric" },
  { re: /\bprobiotics?\b/g, key: "probiotic" },
  { re: /\bpain\s*relief\b/g, key: "pain" },
  { re: /\binflammation\b/g, key: "inflammation" },
];

export function normalizeText(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B'`´]/g, "")
    .replace(/[\u2010-\u2015]/g, " ")
    .replace(/[®™©]/g, " ")
    .toLowerCase()
    .replace(/(\d)\s*[-/]?\s*(mg|mcg|iu|ml|oz)\b/g, "$1 $2")
    .replace(/\bfl\s*oz\b/g, "oz")
    .replace(/\bomega[\s-]*3\b/g, " omega3 ")
    .replace(/\bmary\s*ruths?\b/g, " maryruth ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactCode(input: string): string {
  return (input || "").replace(/[\s-]/g, "").toLowerCase();
}

function stem(token: string): string {
  if (IRREGULAR[token]) return IRREGULAR[token];
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[cols - 1];
}

export function tokenizeQuery(raw: string): ConceptGroup[] {
  let text = normalizeText(raw).slice(0, 120);
  if (!text) return [];
  const groups: ConceptGroup[] = [];
  const used = new Set<string>();

  for (const phrase of PHRASE_KEYS) {
    phrase.re.lastIndex = 0;
    if (phrase.re.test(text)) {
      phrase.re.lastIndex = 0;
      text = text.replace(phrase.re, " ");
      if (!used.has(phrase.key)) {
        used.add(phrase.key);
        groups.push({
          key: phrase.key,
          terms: uniqueTerms([phrase.key, ...(CONCEPT_SYNONYMS[phrase.key] ?? [])]),
        });
      }
    }
  }

  for (const rawTok of text.split(" ")) {
    const tok = rawTok.trim();
    if (!tok || STOP.has(tok) || tok.length === 1 && !/\d/.test(tok)) continue;
    const key = stem(tok);
    if (used.has(key) || used.has(tok)) continue;
    if (CONCEPT_SYNONYMS[key] && !used.has(key)) {
      used.add(key);
      groups.push({ key, terms: uniqueTerms([key, ...CONCEPT_SYNONYMS[key]]) });
      continue;
    }
    used.add(key);
    const extras = [tok, key];
    if (tok !== key) extras.push(tok);
    groups.push({ key, terms: uniqueTerms(extras) });
  }
  return groups;
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const n = normalizeText(t);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export type SearchFields = {
  sku: string;
  upc: string;
  name: string;
  brand: string;
  line: string;
  ingredients: string;
  category: string;
  form: string;
  strength: string;
  aliases: string;
  tags: string;
  description: string;
  hay: string;
  tokens: string[];
};

export function buildSearchFields(doc: SearchDocument): SearchFields {
  const dietary = doc.dietary.join(" ");
  const sku = compactCode(doc.sku);
  const upc = compactCode(doc.upc ?? "");
  const name = normalizeText(doc.name);
  const brand = normalizeText(doc.brandName);
  const line = normalizeText(doc.productLine ?? "");
  const ingredients = normalizeText(doc.ingredientHighlights ?? "");
  const category = normalizeText([doc.category, doc.subcategory].filter(Boolean).join(" "));
  const form = normalizeText(doc.form ?? "");
  const strength = normalizeText(
    [doc.strengthValue != null ? String(doc.strengthValue) : "", doc.strengthUnit ?? "", doc.size ?? "", doc.count != null ? String(doc.count) : "", doc.flavor ?? ""].join(" "),
  );
  const aliases = normalizeText((doc.searchAliases ?? []).join(" "));
  const tags = normalizeText((doc.wellnessTags ?? []).join(" "));
  const description = normalizeText([doc.description ?? "", dietary, doc.certifications ?? ""].join(" "));
  const hay = [name, brand, line, sku, upc, category, form, strength, ingredients, aliases, tags, description].join(" ");
  const tokens = hay.split(" ").filter(Boolean).map(stem);
  return { sku, upc, name, brand, line, ingredients, category, form, strength, aliases, tags, description, hay, tokens };
}

function groupMatches(fields: SearchFields, group: ConceptGroup): { ok: boolean; where: string | null; typo: boolean } {
  for (const term of group.terms) {
    if (!term) continue;
    if (fields.sku === compactCode(term) || fields.upc === compactCode(term)) {
      return { ok: true, where: "sku", typo: false };
    }
    if (fields.hay.includes(term)) {
      const where = locate(fields, term);
      return { ok: true, where, typo: false };
    }
    const stemmed = stem(term);
    if (stemmed !== term && fields.hay.includes(stemmed)) {
      return { ok: true, where: locate(fields, stemmed), typo: false };
    }
  }

  const primary = group.terms[0] ?? group.key;
  if (primary.length >= 5) {
    for (const tok of fields.tokens) {
      if (Math.abs(tok.length - primary.length) > 1) continue;
      if (levenshtein(primary, tok) === 1) {
        return { ok: true, where: "typo", typo: true };
      }
    }
  }
  return { ok: false, where: null, typo: false };
}

function locate(fields: SearchFields, term: string): string {
  if (fields.name.includes(term)) return "name";
  if (fields.brand.includes(term)) return "brand";
  if (fields.line.includes(term)) return "line";
  if (fields.ingredients.includes(term)) return "ingredient";
  if (fields.category.includes(term) || fields.form.includes(term) || fields.strength.includes(term)) {
    return "facet";
  }
  if (fields.aliases.includes(term)) return "alias";
  if (fields.tags.includes(term)) return "tag";
  return "description";
}

function scoreHit(fields: SearchFields, rawQuery: string, locations: string[], exactCode: boolean): number {
  const q = normalizeText(rawQuery);
  let score = 0;
  if (exactCode) score += 10000;
  if (fields.name === q) score += 8000;
  if (q && fields.name.startsWith(q)) score += 600;
  if (fields.brand && q.includes(fields.brand) && fields.name) score += 500;
  const weights: Record<string, number> = {
    sku: 1000,
    name: 800,
    brand: 500,
    line: 450,
    ingredient: 300,
    facet: 200,
    alias: 180,
    tag: 120,
    description: 40,
    typo: 20,
  };
  for (const loc of locations) score += weights[loc] ?? 10;
  return score;
}

export function searchDocuments(
  docs: SearchDocument[],
  query: string,
  filters: SearchFilters = {},
): RankedHit[] {
  const q = (query || "").trim();
  const compact = compactCode(q);
  const groups = tokenizeQuery(q);
  const hits: RankedHit[] = [];

  for (const doc of docs) {
    if (filters.form && (doc.form ?? "") !== filters.form) continue;
    if (filters.category && normalizeText(doc.category) !== normalizeText(filters.category)) continue;
    if (filters.brand) {
      const want = normalizeText(filters.brand);
      if (normalizeText(doc.brandName) !== want && !normalizeText(doc.brandName).includes(want)) continue;
    }
    const fields = buildSearchFields(doc);
    const exactSku = Boolean(compact && (fields.sku === compact || fields.upc === compact));
    if (!q) {
      hits.push({ id: doc.id, score: 1, reasons: [] });
      continue;
    }
    if (exactSku) {
      hits.push({ id: doc.id, score: scoreHit(fields, q, ["sku"], true), reasons: ["exact-code"] });
      continue;
    }
    if (!groups.length) continue;
    const locations: string[] = [];
    let miss = false;
    for (const group of groups) {
      const m = groupMatches(fields, group);
      if (!m.ok) {
        miss = true;
        break;
      }
      if (m.where) locations.push(m.where);
    }
    if (miss) continue;
    hits.push({
      id: doc.id,
      score: scoreHit(fields, q, locations, false),
      reasons: locations,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.id - b.id);
  return hits;
}

export function documentFromProduct(p: {
  id: number;
  slug: string;
  name: string;
  brand_name: string;
  sku: string;
  upc?: string | null;
  category_name: string;
  form?: string | null;
  strength_value?: number | null;
  strength_unit?: string | null;
  size?: string | null;
  count?: number | null;
  ingredient_highlights?: string | null;
  search_aliases?: string[];
  wellness_tags?: string[];
  dietary?: Record<string, boolean>;
  short_description?: string | null;
  long_description?: string | null;
  product_line?: string | null;
  certifications?: string | null;
}): SearchDocument {
  const dietary = p.dietary
    ? Object.entries(p.dietary)
        .filter(([, v]) => v)
        .map(([k]) => k.replaceAll("_", " "))
    : [];
  const flavor = p.name.includes(" / ") ? p.name.split(" / ").pop() ?? null : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: p.brand_name,
    productLine: p.product_line ?? null,
    sku: p.sku,
    upc: p.upc ?? null,
    category: p.category_name,
    form: p.form ?? null,
    strengthValue: p.strength_value ?? null,
    strengthUnit: p.strength_unit ?? null,
    size: p.size ?? null,
    count: p.count ?? null,
    flavor,
    ingredientHighlights: p.ingredient_highlights ?? null,
    searchAliases: p.search_aliases ?? [],
    wellnessTags: p.wellness_tags ?? [],
    dietary,
    certifications: p.certifications ?? null,
    description: [p.short_description, p.long_description].filter(Boolean).join(" "),
  };
}
