"""Orchestrate a catalog import run: robots, discover, parse, stage."""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.adapters import get_adapter
from app.catalog.http import FetchError, PoliteFetcher, RobotsBlocked
from app.catalog.images import try_store_image
from app.catalog.persist import empty_stats, stage_product
from app.catalog.sources import SOURCES, source_by_slug
from app.core.config import settings
from app.core.utils import utcnow
from app.models import CatalogImportError, CatalogImportRun, CatalogSource, CatalogStagedProduct

logger = logging.getLogger("bnm.catalog")


def ensure_sources(db: Session) -> None:
    existing = {s.slug: s for s in db.execute(select(CatalogSource)).scalars()}
    for defn in SOURCES:
        row = existing.get(defn.slug)
        if row is None:
            db.add(
                CatalogSource(
                    slug=defn.slug,
                    name=defn.name,
                    parent_brand=defn.parent_brand,
                    product_line=defn.product_line,
                    official_url=defn.official_url,
                    collection_url=defn.collection_url,
                    domain=defn.domain,
                    terms_url=defn.terms_url,
                    enabled=defn.enabled_default,
                    product_limit=6,
                    policy_status=defn.default_policy,
                    policy_notes=defn.policy_notes,
                    adapter_key=defn.adapter_key,
                )
            )
        else:
            row.official_url = defn.official_url
            row.collection_url = defn.collection_url
            row.policy_notes = defn.policy_notes
            if defn.default_policy == "blocked":
                row.policy_status = "blocked"
                row.enabled = False
            elif row.policy_status == "unclear":
                row.policy_status = defn.default_policy
    db.commit()


def collect_run(db: Session, run_id: str) -> CatalogImportRun:
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise KeyError(run_id)
    run.status = "collecting"
    run.started_at = utcnow().replace(tzinfo=None)
    stats = empty_stats()
    robots_summary: dict = {}
    db.commit()

    slugs = list(run.brand_slugs or [])
    cache_dir = Path(settings.catalog_imports_dir) / "_cache" / run_id
    cache_dir.mkdir(parents=True, exist_ok=True)
    seen_hashes: dict = {}

    with PoliteFetcher(cache_dir=cache_dir, live=True) as fetcher:
        for slug in slugs:
            _collect_brand(db, run, slug, fetcher, stats, robots_summary, seen_hashes)
        stats["pages_requested"] = fetcher.stats.pages_requested
        stats["retries"] = fetcher.stats.retries
        stats["http_status"] = fetcher.stats.http_status
        stats["robots_blocked"] = fetcher.stats.robots_blocked
        stats["cache_hits"] = fetcher.stats.cache_hits

    run.stats = stats
    run.robots_summary = robots_summary
    run.status = "collected"
    run.completed_at = utcnow().replace(tzinfo=None)
    db.commit()
    db.refresh(run)
    return run


def _log_error(db: Session, run_id: str, slug: str, url: str | None, message: str, fatal: bool = False) -> None:
    db.add(
        CatalogImportError(
            run_id=run_id,
            brand_slug=slug,
            url=url,
            fatal=fatal,
            message=message[:4000],
        )
    )


def _collect_brand(
    db: Session,
    run: CatalogImportRun,
    slug: str,
    fetcher: PoliteFetcher,
    stats: dict,
    robots_summary: dict,
    seen_hashes: dict,
) -> None:
    src_row = db.execute(select(CatalogSource).where(CatalogSource.slug == slug)).scalar_one_or_none()
    defn = source_by_slug(slug)
    limit = run.per_brand_limit or (src_row.product_limit if src_row else 6)
    if src_row and not src_row.enabled:
        robots_summary[slug] = {"status": "skipped", "reason": "source disabled"}
        stats["products_skipped"] += 1
        _log_error(db, run.id, slug, defn.official_url, "Source disabled.", fatal=False)
        src_row.last_result = "skipped"
        src_row.last_run_id = run.id
        db.commit()
        return
    if defn.default_policy == "blocked":
        robots_summary[slug] = {"status": "blocked", "reason": defn.policy_notes}
        if src_row:
            src_row.policy_status = "blocked"
            src_row.robots_status = "blocked"
            src_row.last_result = "source_blocked"
            src_row.last_run_id = run.id
            src_row.last_checked_at = utcnow().replace(tzinfo=None)
        stats["products_skipped"] += 1
        _log_error(db, run.id, slug, defn.official_url, defn.policy_notes, fatal=False)
        db.commit()
        return

    adapter = get_adapter(slug)
    try:
        fetcher.ensure_robots(defn.official_url)
        decision = fetcher.robots.decision_for("https://" + defn.domain)
        # origin may include www
        if decision is None:
            from app.catalog.robots import origin_of

            decision = fetcher.robots.decision_for(origin_of(defn.official_url))
        if decision and decision.status == "blocked":
            robots_summary[slug] = {"status": "blocked", "notes": decision.notes}
            if src_row:
                src_row.policy_status = "blocked"
                src_row.robots_status = "blocked"
                src_row.last_result = "source_blocked"
            _log_error(db, run.id, slug, defn.official_url, decision.notes, fatal=False)
            db.commit()
            return
        robots_summary[slug] = {
            "status": decision.status if decision else "unclear",
            "notes": decision.notes if decision else "",
            "crawl_delay": decision.crawl_delay if decision else None,
        }
        if src_row and decision:
            src_row.robots_status = decision.status
            src_row.policy_status = decision.status
            src_row.last_checked_at = utcnow().replace(tzinfo=None)

        discovered = adapter.discover_product_urls(fetcher)
        stats["products_discovered"] += len(discovered)
        selected = adapter.select_candidate_products(
            discovered, limit, run.prioritize_categories
        )
        stats["products_selected"] += len(selected)

        already = {
            r.canonical_url
            for r in db.execute(
                select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == run.id)
            ).scalars()
        }
        for item in selected:
            if item.url in already:
                continue
            try:
                parsed = adapter.parse_product(fetcher, item.url)
            except RobotsBlocked as e:
                stats["products_skipped"] += 1
                _log_error(db, run.id, slug, item.url, str(e))
                continue
            except FetchError as e:
                stats["products_skipped"] += 1
                _log_error(db, run.id, slug, item.url, str(e))
                continue
            parsed.official_bestseller = "bestseller" in item.badges
            parsed.official_featured = "featured" in item.badges
            parsed.official_new = "new" in item.badges
            errors = adapter.validate_product(parsed)
            if errors:
                stats["validation_failures"] += 1
            image_rel = image_hash = original = mime = None
            size_bytes = None
            image_status = "missing_or_permission_required"
            img_url = None
            alt = f"{parsed.brand} {parsed.name} package"
            if run.download_images and not run.dry_run:
                candidates = adapter.collect_image_candidates(parsed)
                if not candidates and item.listing_image_url:
                    from app.catalog.types import ImageCandidate

                    candidates = [ImageCandidate(url=item.listing_image_url)]
                for cand in candidates[:3]:
                    stored = try_store_image(
                        fetcher,
                        cand.url,
                        brand_slug=slug,
                        run_id=run.id,
                        name=parsed.name,
                        form=parsed.form,
                        count=parsed.count,
                        seen_hashes=seen_hashes,
                    )
                    if stored:
                        image_rel = stored.optimized_rel
                        image_hash = stored.sha256
                        original = stored.original_path
                        mime = stored.mime_type
                        size_bytes = stored.size_bytes
                        img_url = cand.url
                        image_status = "stored_demo_review_only"
                        stats["images_downloaded"] += 1
                        if stored.width and max(stored.width, stored.height or 0) < 600:
                            errors = list(errors) + ["Image longest side under 600px (kept)."]
                        break
                    stats["images_rejected"] += 1
            staged = stage_product(
                db,
                run_id=run.id,
                source_id=src_row.id if src_row else None,
                parsed=parsed,
                errors=errors,
                policy_status=robots_summary[slug]["status"],
                image_rel=image_rel,
                image_hash=image_hash,
                image_status=image_status,
                original_path=original,
                source_url=img_url,
                mime=mime,
                size_bytes=size_bytes,
                alt_text=alt,
            )
            if staged.duplicate_key:
                stats["duplicate_matches"] += 1
            stats["products_parsed"] += 1
            already.add(parsed.canonical_url)
        if src_row:
            src_row.last_run_id = run.id
            src_row.last_result = "collected"
        db.commit()
    except RobotsBlocked as e:
        robots_summary[slug] = {"status": "blocked", "notes": str(e)}
        _log_error(db, run.id, slug, defn.official_url, str(e), fatal=False)
        if src_row:
            src_row.policy_status = "blocked"
            src_row.last_result = "source_blocked"
        db.commit()
    except Exception as e:
        logger.exception("collect brand %s failed", slug)
        _log_error(db, run.id, slug, defn.official_url, str(e), fatal=True)
        if src_row:
            src_row.last_result = "failed"
        db.commit()
