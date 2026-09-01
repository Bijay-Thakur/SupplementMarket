"""CLI: collect, validate, export catalog import runs."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.catalog.pipeline import collect_run, ensure_sources
from app.catalog.sources import SOURCES
from app.core.utils import public_token, utcnow
from app.db.base import Base, SessionLocal, engine
from app.models import CatalogImportError, CatalogImportRun, CatalogStagedProduct


def _session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    ensure_sources(db)
    return db


def _new_run(db, slugs: list[str], limit: int, download_images: bool, dry_run: bool) -> CatalogImportRun:
    run = CatalogImportRun(
        id=public_token()[:22],
        status="pending",
        brand_slugs=slugs,
        per_brand_limit=limit,
        download_images=download_images and not dry_run,
        dry_run=dry_run,
        stats={},
    )
    db.add(run)
    db.commit()
    return run


def cmd_collect(args: argparse.Namespace) -> int:
    db = _session()
    try:
        slugs = [args.brand] if args.brand else [s.slug for s in SOURCES]
        run = _new_run(db, slugs, args.limit, not args.skip_images, args.dry_run)
        print(f"run_id={run.id} brands={','.join(slugs)} dry_run={args.dry_run}")
        collect_run(db, run.id)
        db.refresh(run)
        print(json.dumps(run.stats or {}, indent=2))
        print(f"status={run.status}")
        return 0
    finally:
        db.close()


def cmd_collect_all(args: argparse.Namespace) -> int:
    args.brand = None
    args.limit = args.per_brand
    return cmd_collect(args)


def cmd_validate(args: argparse.Namespace) -> int:
    db = _session()
    try:
        run_id = args.run_id
        if not run_id:
            run = db.execute(select(CatalogImportRun).order_by(CatalogImportRun.created_at.desc())).scalars().first()
            if run is None:
                print("No import runs.", file=sys.stderr)
                return 1
            run_id = run.id
        rows = list(
            db.execute(select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == run_id)).scalars()
        )
        failed = [r for r in rows if r.validation_errors]
        print(f"run={run_id} products={len(rows)} validation_failures={len(failed)}")
        for r in failed[:20]:
            print(f"  {r.brand} {r.name}: {r.validation_errors}")
        return 0 if not failed else 2
    finally:
        db.close()


def cmd_export(args: argparse.Namespace) -> int:
    db = _session()
    try:
        dest = Path(args.out or f"catalog-run-{args.run_id}.csv")
        rows = list(
            db.execute(select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == args.run_id)).scalars()
        )
        fields = [
            "id",
            "brand",
            "name",
            "variant_name",
            "primary_category",
            "form",
            "sku",
            "upc",
            "canonical_url",
            "source_price_cents",
            "regular_price_cents",
            "discount_percent",
            "sale_price_cents",
            "image_status",
            "status",
            "duplicate_key",
        ]
        with dest.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in rows:
                w.writerow({k: getattr(r, k) for k in fields})
        print(f"wrote {dest} ({len(rows)} rows)")
        return 0
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="app.catalog.cli")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("collect")
    c.add_argument("--brand", required=True)
    c.add_argument("--limit", type=int, default=6)
    c.add_argument("--dry-run", action="store_true")
    c.add_argument("--skip-images", action="store_true")
    c.set_defaults(func=cmd_collect)

    a = sub.add_parser("collect-all")
    a.add_argument("--per-brand", type=int, default=6)
    a.add_argument("--dry-run", action="store_true")
    a.add_argument("--skip-images", action="store_true")
    a.set_defaults(func=cmd_collect_all, brand=None)

    v = sub.add_parser("validate")
    v.add_argument("--run-id")
    v.set_defaults(func=cmd_validate)

    e = sub.add_parser("export")
    e.add_argument("--run-id", required=True)
    e.add_argument("--out")
    e.set_defaults(func=cmd_export)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
