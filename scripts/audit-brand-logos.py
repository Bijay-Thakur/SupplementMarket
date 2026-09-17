"""Report logo asset candidates published by official brand websites."""
from __future__ import annotations

import argparse
import json
import re

import httpx


SITES = {
    "biosil": "https://www.mybiosil.com/",
    "dynamic-health": "https://dynamichealth.com/",
    "emerita": "https://life-flo.com/collections/emerita",
    "garden-of-life": "https://www.gardenoflife.com/",
    "herbs-for-kids": "https://brandfolder.com/betterbeingco/herbs-for-kids",
    "heritage-store": "https://heritagestore.com/",
    "honey-gardens": "https://brandfolder.com/betterbeingco/honey-gardens",
    "kal": "https://www.kalvitamins.com/",
    "lifeflo": "https://life-flo.com/",
    "lifetime": "https://lifetimevitamins.com/",
    "natures-life": "https://natureslife.com/",
    "naturesplus": "https://naturesplus.com/",
    "organix-south": "https://theraneem.com/",
    "rainbow-light": "https://www.rainbowlight.com/",
    "real-aloe": "https://realaloe.com/",
    "renew-life": "https://www.renewlife.com/",
    "reserveage-nutrition": "https://reserveage.com/",
    "solaray": "https://solaray.com/",
    "zand": "https://www.zandimmunity.com/",
    "zhou-nutrition": "https://www.zhounutrition.com/",
}

LOGOS = {
    "biosil": "https://in.biosil.beauty/cdn/shop/files/Biosil_Logo_BLWH_d4a632af-fe25-4b95-811d-5f58987e44bb.png?v=1677094849",
    "dynamic-health": "https://dynamichealth.com/cdn/shop/files/Dynamic_Health_Primary_Logo-01.png?v=1644349375&width=600",
    "emerita": "https://www.spectrumsupplements.ca/wp-content/uploads/2021/01/Emerita-scaled-10.jpg",
    "garden-of-life": "https://gardenoflifecanada.com/cdn/shop/files/garden-of-life-logo-colour_3x_4806844e-4e21-407b-8fcd-6dcbbdd06afc_600x.png?v=1634574429",
    "herbs-for-kids": "https://tsdr.uspto.gov/img/75398644/large",
    "heritage-store": "https://heritagestore.com/cdn/shop/files/HP-Logo-0820-01_1_299a9272-cfe9-440d-a077-97ff2032a804.png?v=1624472134",
    "honey-gardens": "https://www.commongood.co/wp-content/uploads/2022/07/honeygardens_logo.png",
    "kal": "https://www.kalvitamins.com/cdn/shop/files/New_KAL-Logo.png?v=1629390581",
    "lifeflo": "https://life-flo.com/cdn/shop/files/LifeFlo_Logo_PURPLE_300x300.png?v=1614286301",
    "lifetime": "https://lifetimevitamins.com/cdn/shop/files/MicrosoftTeams-image.png?v=1638291490&width=500",
    "natures-life": "https://natureslife.com/cdn/shop/files/TopNavAndFooter_Logo_AllPages.svg?v=1691524567&width=600",
    "naturesplus": "https://naturesplus.com/cdn/shop/files/np-logo.svg?v=1695220579&width=600",
    "organix-south": "https://theraneem.com/cdn/shop/files/Logo-Theraneem_411dc807-e494-427f-99da-1173ae986c58.png?v=1718131058",
    "rainbow-light": "https://www.rainbowlight.com/cdn/shop/files/rainbowlight_logo.png?v=1720018062",
    "real-aloe": "https://realaloe.com/cdn/shop/files/Real_Aloe_logo_Full_color_1000x1000_f09d8375-3a85-4710-aaf3-ddcb14b9706d.png?v=1735236778&width=600",
    "renew-life": "https://www.renewlife.com/cdn/shop/files/RenewLife_Logo.svg?v=1720018067&width=600",
    "reserveage-nutrition": "https://www.reserveage.com/favicon.svg",
    "solaray": "https://solaray.com/cdn/shop/files/blue-logo_400x.png?v=1637786787",
    "zand": "https://www.zandimmunity.com/cdn/shop/files/Logo-dark.png?v=1721179582&width=600",
    "zhou-nutrition": "https://www.zhounutrition.com/cdn/shop/files/logo-purple.png?v=1686604996&width=600",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("slugs", nargs="*")
    parser.add_argument("--all-images", action="store_true")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if not args.validate:
        from bs4 import BeautifulSoup
    result: dict[str, object] = {}
    with httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=20,
    ) as client:
        selected = args.slugs or list(SITES)
        for slug in selected:
            if args.validate:
                url = LOGOS[slug]
                try:
                    response = client.get(url)
                    result[slug] = {
                        "url": str(response.url),
                        "status": response.status_code,
                        "content_type": response.headers.get("content-type"),
                        "bytes": len(response.content),
                    }
                except Exception as exc:
                    result[slug] = {"url": url, "error": str(exc)}
                continue
            url = SITES[slug]
            try:
                response = client.get(url)
                soup = BeautifulSoup(response.text, "html.parser")
                candidates = []
                for tag in soup.find_all(["img", "source", "meta", "link"]):
                    blob = " ".join(str(value) for value in tag.attrs.values())
                    if not args.all_images and not re.search("logo", blob, re.I):
                        continue
                    candidates.append(
                        {
                            "tag": tag.name,
                            "src": tag.get("src") or tag.get("href") or tag.get("content"),
                            "alt": tag.get("alt"),
                            "class": tag.get("class"),
                        }
                    )
                result[slug] = {
                    "url": str(response.url),
                    "status": response.status_code,
                    "candidates": candidates[:50],
                    "asset_urls": list(
                        dict.fromkeys(
                            match.replace("\\/", "/")
                            for match in re.findall(
                                r"(?:https?:)?(?:\\?/\\?/|/)[^\"'<>\\s]+?"
                                r"(?:logo|wordmark|brand)[^\"'<>\\s]+?"
                                r"(?:\.svg|\.png|\.jpe?g|\.webp)(?:\?[^\"'<>\\s]*)?",
                                response.text,
                                re.I,
                            )
                        )
                    )[:30],
                }
            except Exception as exc:
                result[slug] = {"error": str(exc)}
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
