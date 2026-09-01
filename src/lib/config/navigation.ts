export type NavItem = { label: string; href: string };

/** Primary storefront navigation. */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Products", href: "/products" },
  { label: "Brands", href: "/brands" },
  { label: "Sales", href: "/sales" },
  { label: "New", href: "/new" },
  { label: "About", href: "/about" },
];

/** Footer link groups. */
export const FOOTER_NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Shop",
    items: [
      { label: "All Products", href: "/products" },
      { label: "Brands", href: "/brands" },
      { label: "Sales", href: "/sales" },
      { label: "New Arrivals", href: "/new" },
    ],
  },
  {
    heading: "About",
    items: [
      { label: "Our Store", href: "/about" },
      { label: "Store Pickup & Delivery", href: "/shipping-pickup" },
      { label: "Returns", href: "/returns" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
  {
    heading: "Policies",
    items: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];
