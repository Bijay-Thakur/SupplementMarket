"""Download the reviewed official brand logos into the storefront bundle."""
from __future__ import annotations

import argparse
import importlib.util
import os
import subprocess
from pathlib import Path

import httpx


REPO_ROOT = Path(__file__).resolve().parents[1]
manifest_path = REPO_ROOT / "scripts" / "audit-brand-logos.py"
manifest_spec = importlib.util.spec_from_file_location("brand_logo_manifest", manifest_path)
if not manifest_spec or not manifest_spec.loader:
    raise RuntimeError("Could not load the brand logo manifest.")
manifest = importlib.util.module_from_spec(manifest_spec)
manifest_spec.loader.exec_module(manifest)
LOGOS = manifest.LOGOS
SITES = manifest.SITES


EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    target = REPO_ROOT / "frontend" / "public" / "brand-logos"
    target.mkdir(parents=True, exist_ok=True)
    with httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    ) as client:
        for slug, url in LOGOS.items():
            request_headers = (
                {"Referer": "https://trademarks.justia.com/753/98/herbs-for-75398644.html"}
                if "trademarks.justia.com" in url
                else None
            )
            response = client.get(url, headers=request_headers)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";", 1)[0]
            extension = EXTENSIONS.get(content_type)
            if not extension:
                raise RuntimeError(f"Unsupported logo type for {slug}: {content_type}")
            destination = target / f"{slug}{extension}"
            content = response.content
            if slug == "reserveage-nutrition" and content_type == "image/svg+xml":
                content = content.replace(
                    b'width="1000" height="1000"',
                    b'width="1000" height="300" viewBox="0 350 1000 300"',
                    1,
                )
            for stale in target.glob(f"{slug}.*"):
                if stale != destination:
                    stale.unlink()
            destination.write_bytes(content)
            print(f"{slug}: {destination.relative_to(REPO_ROOT)} ({len(content)} bytes)")

    subprocess.run(
        ["node", str(REPO_ROOT / "scripts" / "trim-brand-logos.mjs"), str(target)],
        check=True,
    )

    if args.commit:
        env = dict(os.environ)
        for path in (REPO_ROOT / ".env", REPO_ROOT / "frontend" / ".env.local"):
            if not path.exists():
                continue
            for line in path.read_text(encoding="utf-8").splitlines():
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        supabase_url = (env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
        supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SECRET_KEY") or ""
        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase is not configured.")
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        with httpx.Client(timeout=30) as client:
            for slug in LOGOS:
                logo_files = list(target.glob(f"{slug}.*"))
                if len(logo_files) != 1:
                    raise RuntimeError(f"Expected one local logo for {slug}; found {len(logo_files)}.")
                response = client.patch(
                    f"{supabase_url}/rest/v1/brands",
                    params={"slug": f"eq.{slug}"},
                    headers=headers,
                    json={
                        "logo_path": f"/brand-logos/{logo_files[0].name}",
                        "website_url": SITES[slug],
                    },
                )
                response.raise_for_status()
                updated = response.json()
                if len(updated) != 1:
                    raise RuntimeError(f"Expected one brand row for {slug}; updated {len(updated)}.")
        print(f"Updated {len(LOGOS)} live brand records.")


if __name__ == "__main__":
    main()
