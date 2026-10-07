import type { Metadata } from "next";
import { DEFAULT_STORE_CONFIG } from "@/lib/config/store";

export const SITE_NAME = DEFAULT_STORE_CONFIG.name;

export const DEFAULT_DESCRIPTION =
  "Shop vitamins, herbs, and natural supplements at Bronxville Natural Market. Browse the catalog, then pick up at 86 Pondfield Rd or ask about local delivery.";

export const SOCIAL_IMAGE_PATH = "/brand/social-preview.png";
export const SOCIAL_IMAGE_ALT =
  "Bronxville Natural Market — vitamins and natural supplements in Bronxville, NY";

export function pageMetadata(title: string, description: string, path = ""): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path || "/" },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path || "/",
      images: [{ url: SOCIAL_IMAGE_PATH, width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT }],
    },
  };
}
