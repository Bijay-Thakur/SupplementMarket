/** Local search term expansion. Symptom-style queries map to wellness-support tags only. */

const SYNONYMS: Record<string, string[]> = {
  multivitamin: ["multivitamin", "multi vitamin", "multi"],
  "multi vitamin": ["multivitamin", "multi vitamin", "multi"],
  b12: ["b12", "cobalamin", "vitamin b12"],
  cobalamin: ["b12", "cobalamin"],
  d3: ["d3", "cholecalciferol", "vitamin d3", "vitamin d"],
  cholecalciferol: ["d3", "cholecalciferol"],
  "omega 3": ["omega 3", "omega-3", "fish oil", "epa", "dha"],
  omega3: ["omega 3", "omega-3", "fish oil"],
  "fish oil": ["fish oil", "omega 3", "omega-3"],
  "joint support": ["joint support", "joint", "mobility"],
  joint: ["joint support", "joint", "mobility"],
  "sleep support": ["sleep support", "sleep", "melatonin"],
  sleep: ["sleep support", "sleep", "melatonin"],
  "digestive support": ["digestive support", "digestion", "probiotic", "gut"],
  digestion: ["digestive support", "digestion", "probiotic"],
  "immune support": ["immune support", "immunity", "immune"],
  immunity: ["immune support", "immunity", "immune"],
  "hair skin nails": ["hair skin nails", "biotin", "collagen", "hair", "skin", "nails"],
  hair: ["hair skin nails", "biotin", "collagen"],
  pain: ["joint support", "occasional discomfort", "healthy inflammatory response"],
  "pain relief": ["joint support", "occasional discomfort", "healthy inflammatory response"],
  inflammation: ["healthy inflammatory response", "turmeric", "curcumin", "joint support"],
  curamin: ["curamin", "curcumin", "healthy inflammatory response"],
};

const TOKEN_RE = /[a-z0-9]+/g;

export function expandTerms(q: string): string[] {
  const norm = (q || "").trim().toLowerCase().slice(0, 100);
  if (!norm) return [];
  const terms = [norm];
  if (SYNONYMS[norm]) terms.push(...SYNONYMS[norm]);
  for (const tok of norm.match(TOKEN_RE) ?? []) {
    terms.push(tok);
    if (SYNONYMS[tok]) terms.push(...SYNONYMS[tok]);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const s = t.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
