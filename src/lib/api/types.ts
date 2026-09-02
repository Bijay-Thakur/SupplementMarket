export type DietaryFlags = {
  vegan: boolean;
  vegetarian: boolean;
  organic: boolean;
  gluten_free: boolean;
  soy_free: boolean;
  dairy_free: boolean;
  alcohol_free: boolean;
  non_gmo: boolean;
};

export type ProductListItem = {
  id: number;
  name: string;
  slug: string;
  brand_name: string;
  brand_slug: string;
  category_name: string;
  category_slug: string;
  form: string | null;
  size: string | null;
  count: number | null;
  strength_value: number | null;
  strength_unit: string | null;
  availability: string;
  regular_price_cents: number;
  sale_price_cents: number | null;
  effective_price_cents: number;
  discount_percent: number | null;
  on_sale: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_demo: boolean;
  short_description: string | null;
  primary_image_url: string | null;
  dietary: DietaryFlags;
};

export type ProductDetail = ProductListItem & {
  long_description: string | null;
  sku: string;
  upc: string | null;
  brand_id?: number | null;
  category_id?: number | null;
  ingredient_highlights: string | null;
  usage_text: string | null;
  warnings: string | null;
  search_aliases: string[];
  wellness_tags: string[];
  images: { id: number; url: string; alt_text: string | null; display_order: number; is_primary: boolean }[];
  is_active: boolean;
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type FilterOptions = {
  brands: { name: string; slug: string; count: number }[];
  categories: { name: string; slug: string; count: number }[];
  forms: { value: string; count: number }[];
  dietary: string[];
  price_min_cents: number;
  price_max_cents: number;
};

export type Brand = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_featured: boolean;
  logo_url?: string | null;
  logo_alt?: string | null;
  official_website_url?: string | null;
  logo_use_status?: "permission_pending" | "approved" | "unavailable" | string | null;
  logo_background?: string | null;
  display_order?: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  display_order: number;
};

export type Tag = { id: number; name: string; slug: string; kind: string };

export type StoreSettings = {
  store_name: string;
  phone: string | null;
  phone_is_placeholder: boolean;
  email: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  hours_note: string | null;
  announcement: string | null;
  pickup_instructions: string | null;
  delivery_note: string | null;
  min_order_cents: number;
  currency: string;
  timezone: string;
};

export type OrderPublic = {
  public_token: string;
  order_number: string;
  status: string;
  fulfillment_type: string;
  payment_method?: string;
  payment_status?: string;
  currency?: string;
  customer_name: string;
  subtotal_cents: number;
  delivery_fee_cents: number | null;
  total_cents: number;
  items: {
    product_name: string;
    brand_name: string | null;
    sku: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }[];
  created_at: string | null;
  persistence?: "session" | "database";
};

export type SuggestionItem = {
  type: "product" | "brand" | "category" | "recent";
  name: string;
  slug?: string;
  href: string;
  brand_name?: string;
};

export type AdminProductRow = {
  id: number;
  name: string;
  slug: string;
  brand_name: string;
  thumbnail_url: string | null;
  regular_price_cents: number;
  sale_price_cents: number | null;
  discount_percent: number | null;
  availability: string;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_active: boolean;
  is_archived: boolean;
  is_demo: boolean;
  price_is_demo?: boolean;
  image_use_status?: string | null;
  source_url?: string | null;
  last_source_verification_at?: string | null;
  updated_at: string | null;
};

export type AdminOrderRow = {
  id: number;
  order_number: string;
  customer_name: string;
  fulfillment_type: string;
  status: string;
  total_cents: number;
  item_count: number;
  is_demo: boolean;
  created_at: string | null;
};

export type AdminOrderDetail = AdminOrderRow & {
  public_token: string;
  user_id?: string | null;
  customer_email: string;
  customer_phone: string;
  delivery_address_line1: string | null;
  delivery_address_line2?: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip: string | null;
  delivery_instructions: string | null;
  payment_method?: string;
  payment_status?: string;
  currency?: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number | null;
  notes: string | null;
  items: OrderPublic["items"];
  placed_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
};

export type ProductQuery = {
  q?: string;
  brand?: string;
  category?: string;
  form?: string;
  price_min?: number;
  price_max?: number;
  availability?: string;
  dietary?: string[];
  featured?: boolean;
  bestseller?: boolean;
  is_new?: boolean;
  on_sale?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
};

export type ApiError = {
  error: string;
  detail: string;
  fields?: Record<string, string>;
};
