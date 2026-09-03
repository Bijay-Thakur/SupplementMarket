export const AVAILABILITY_LABELS: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  coming_soon: "Coming soon",
};

export function canAddToCart(availability: string): boolean {
  return availability === "in_stock" || availability === "low_stock";
}

export const FDA_DISCLAIMER =
  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.";

export const DIETARY_LABELS: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  organic: "Organic",
  gluten_free: "Gluten-free",
  soy_free: "Soy-free",
  dairy_free: "Dairy-free",
  alcohol_free: "Alcohol-free",
  non_gmo: "Non-GMO",
};
