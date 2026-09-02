"""Product data-access. Kept behind this repository so the storage engine
(SQLite now, Supabase Postgres later) can change without touching the API."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Brand, Category, Product, ProductTag, Tag
from app.services.search import tokenize_query

DIETARY_KEYS = (
    "vegan",
    "vegetarian",
    "organic",
    "gluten_free",
    "soy_free",
    "dairy_free",
    "alcohol_free",
    "non_gmo",
)

SORTS = ("relevance", "price_asc", "price_desc", "name_asc", "name_desc", "newest", "discount")


@dataclass
class ProductQuery:
    q: str | None = None
    brand: str | None = None  # slug
    category: str | None = None  # slug
    form: str | None = None
    price_min_cents: int | None = None
    price_max_cents: int | None = None
    availability: str | None = None
    dietary: list[str] = field(default_factory=list)
    featured: bool | None = None
    bestseller: bool | None = None
    is_new: bool | None = None
    on_sale: bool | None = None
    sort: str = "relevance"
    page: int = 1
    page_size: int = 24
    include_inactive: bool = False  # admin only


def _eff_price():
    return func.coalesce(Product.sale_price_cents, Product.regular_price_cents)


def _base_select(pq: ProductQuery):
    stmt = (
        select(Product)
        .join(Brand, Product.brand_id == Brand.id)
        .join(Category, Product.category_id == Category.id)
    )
    if not pq.include_inactive:
        stmt = stmt.where(Product.is_active.is_(True), Product.is_archived.is_(False))
    return stmt


def _apply_filters(stmt, pq: ProductQuery):
    if pq.brand:
        stmt = stmt.where(Brand.slug == pq.brand)
    if pq.category:
        stmt = stmt.where(Category.slug == pq.category)
    if pq.form:
        stmt = stmt.where(Product.form == pq.form)
    if pq.availability:
        stmt = stmt.where(Product.availability == pq.availability)
    if pq.featured is not None:
        stmt = stmt.where(Product.is_featured.is_(pq.featured))
    if pq.bestseller is not None:
        stmt = stmt.where(Product.is_bestseller.is_(pq.bestseller))
    if pq.is_new is not None:
        stmt = stmt.where(Product.is_new.is_(pq.is_new))
    if pq.on_sale is not None:
        if pq.on_sale:
            stmt = stmt.where(
                Product.sale_price_cents.is_not(None),
                Product.sale_price_cents < Product.regular_price_cents,
            )
        else:
            stmt = stmt.where(Product.sale_price_cents.is_(None))
    if pq.price_min_cents is not None:
        stmt = stmt.where(_eff_price() >= pq.price_min_cents)
    if pq.price_max_cents is not None:
        stmt = stmt.where(_eff_price() <= pq.price_max_cents)
    for key in pq.dietary:
        if key in DIETARY_KEYS:
            stmt = stmt.where(getattr(Product, key).is_(True))

    if pq.q:
        groups = tokenize_query(pq.q)
        for g in groups:
            terms = [str(t) for t in g["terms"]]
            tag_match = (
                select(ProductTag.product_id)
                .join(Tag, Tag.id == ProductTag.tag_id)
                .where(or_(*[func.lower(Tag.name).like(f"%{t}%") for t in terms]))
            )
            conds = []
            for t in terms:
                like = f"%{t}%"
                conds.extend(
                    [
                        func.lower(Product.name).like(like),
                        func.lower(func.coalesce(Product.short_description, "")).like(like),
                        func.lower(func.coalesce(Product.long_description, "")).like(like),
                        func.lower(func.coalesce(Product.ingredient_highlights, "")).like(like),
                        func.lower(func.coalesce(Product.search_aliases, "")).like(like),
                        func.lower(func.coalesce(Product.form, "")).like(like),
                        func.lower(Product.sku).like(like),
                        func.lower(Brand.name).like(like),
                        func.lower(Category.name).like(like),
                    ]
                )
            conds.append(Product.id.in_(tag_match))
            stmt = stmt.where(or_(*conds))
    return stmt


def _apply_sort(stmt, pq: ProductQuery):
    if pq.sort == "price_asc":
        return stmt.order_by(_eff_price().asc(), Product.name.asc())
    if pq.sort == "price_desc":
        return stmt.order_by(_eff_price().desc(), Product.name.asc())
    if pq.sort == "name_asc":
        return stmt.order_by(Product.name.asc())
    if pq.sort == "name_desc":
        return stmt.order_by(Product.name.desc())
    if pq.sort == "newest":
        return stmt.order_by(Product.created_at.desc(), Product.id.desc())
    if pq.sort == "discount":
        disc = (Product.regular_price_cents - _eff_price())
        return stmt.order_by(disc.desc(), Product.name.asc())
    # relevance: prioritize in-stock, then featured/bestseller, then name
    in_stock_rank = case((Product.availability == "in_stock", 0), else_=1)
    return stmt.order_by(
        in_stock_rank.asc(),
        Product.is_bestseller.desc(),
        Product.is_featured.desc(),
        Product.name.asc(),
    )


def search_products(db: Session, pq: ProductQuery) -> tuple[list[Product], int]:
    stmt = _apply_filters(_base_select(pq), pq).distinct()

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = db.execute(count_stmt).scalar_one()

    stmt = _apply_sort(stmt, pq)
    page = max(1, pq.page)
    page_size = min(max(1, pq.page_size), 100)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size).options(
        selectinload(Product.images),
        selectinload(Product.brand),
        selectinload(Product.category),
        selectinload(Product.tags),
    )
    items = list(db.execute(stmt).scalars().unique().all())
    return items, total


def get_by_slug(db: Session, slug: str, *, include_inactive: bool = False) -> Product | None:
    stmt = select(Product).where(Product.slug == slug).options(
        selectinload(Product.images),
        selectinload(Product.brand),
        selectinload(Product.category),
        selectinload(Product.tags),
        selectinload(Product.variants),
    )
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True), Product.is_archived.is_(False))
    return db.execute(stmt).scalars().unique().one_or_none()


def get_by_id(db: Session, product_id: int) -> Product | None:
    stmt = select(Product).where(Product.id == product_id).options(
        selectinload(Product.images),
        selectinload(Product.brand),
        selectinload(Product.category),
        selectinload(Product.tags),
        selectinload(Product.variants),
    )
    return db.execute(stmt).scalars().unique().one_or_none()


def related_products(db: Session, product: Product, *, limit: int = 8) -> list[Product]:
    """Deterministic overlap on category, then shared wellness tags."""
    tag_ids = [t.id for t in product.tags]
    stmt = (
        select(Product)
        .where(
            Product.id != product.id,
            Product.is_active.is_(True),
            Product.is_archived.is_(False),
        )
        .options(
            selectinload(Product.images),
            selectinload(Product.brand),
            selectinload(Product.category),
            selectinload(Product.tags),
        )
        .limit(limit * 3)
    )
    candidates = list(db.execute(stmt).scalars().unique().all())
    scored: list[tuple[int, Product]] = []
    for p in candidates:
        score = 0
        if p.category_id == product.category_id:
            score += 3
        if p.brand_id == product.brand_id:
            score += 1
        shared = {t.id for t in p.tags}.intersection(tag_ids)
        score += len(shared)
        if score:
            scored.append((score, p))
    scored.sort(key=lambda x: (-x[0], x[1].name))
    return [p for _, p in scored[:limit]]


def sku_exists(db: Session, sku: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(func.count()).select_from(Product).where(Product.sku == sku)
    if exclude_id is not None:
        stmt = stmt.where(Product.id != exclude_id)
    return db.execute(stmt).scalar_one() > 0


def upc_exists(db: Session, upc: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(func.count()).select_from(Product).where(Product.upc == upc)
    if exclude_id is not None:
        stmt = stmt.where(Product.id != exclude_id)
    return db.execute(stmt).scalar_one() > 0


def slug_exists(db: Session, slug: str, *, exclude_id: int | None = None) -> bool:
    stmt = select(func.count()).select_from(Product).where(Product.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Product.id != exclude_id)
    return db.execute(stmt).scalar_one() > 0


def unique_slug(db: Session, base: str, *, exclude_id: int | None = None) -> str:
    slug = base
    n = 2
    while slug_exists(db, slug, exclude_id=exclude_id):
        slug = f"{base}-{n}"
        n += 1
    return slug


def admin_counts(db: Session) -> dict[str, int]:
    active = db.execute(
        select(func.count()).select_from(Product).where(
            Product.is_active.is_(True), Product.is_archived.is_(False)
        )
    ).scalar_one()
    on_sale = db.execute(
        select(func.count()).select_from(Product).where(
            Product.is_archived.is_(False),
            Product.sale_price_cents.is_not(None),
            Product.sale_price_cents < Product.regular_price_cents,
        )
    ).scalar_one()
    out_of_stock = db.execute(
        select(func.count()).select_from(Product).where(
            Product.is_archived.is_(False), Product.availability == "out_of_stock"
        )
    ).scalar_one()
    new_products = db.execute(
        select(func.count()).select_from(Product).where(
            Product.is_archived.is_(False), Product.is_new.is_(True)
        )
    ).scalar_one()
    return {
        "active_products": active,
        "on_sale": on_sale,
        "out_of_stock": out_of_stock,
        "new_products": new_products,
    }
