"""Public catalog endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_search
from app.core.errors import NotFoundError
from app.db.base import get_db
from app.models import Brand, Category, Product
from app.repositories import products as repo
from app.repositories.products import DIETARY_KEYS, ProductQuery
from app.schemas.common import Page
from app.schemas.product import ProductDetail, ProductListItem
from app.services import serialize

router = APIRouter(prefix="/products", tags=["catalog"])


@router.get("", response_model=Page[ProductListItem])
def list_products(
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_search),
    q: str | None = Query(default=None, max_length=100),
    brand: str | None = None,
    category: str | None = None,
    form: str | None = None,
    price_min: int | None = Query(default=None, ge=0),
    price_max: int | None = Query(default=None, ge=0),
    availability: str | None = None,
    dietary: list[str] | None = Query(default=None),
    featured: bool | None = None,
    bestseller: bool | None = None,
    is_new: bool | None = None,
    on_sale: bool | None = None,
    sort: str = "relevance",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
):
    pq = ProductQuery(
        q=q,
        brand=brand,
        category=category,
        form=form,
        price_min_cents=price_min,
        price_max_cents=price_max,
        availability=availability,
        dietary=[d for d in (dietary or []) if d in DIETARY_KEYS],
        featured=featured,
        bestseller=bestseller,
        is_new=is_new,
        on_sale=on_sale,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    items, total = repo.search_products(db, pq)
    pages = (total + pq.page_size - 1) // pq.page_size if pq.page_size else 0
    return Page[ProductListItem](
        items=[serialize.product_list_item(p) for p in items],
        total=total,
        page=pq.page,
        page_size=pq.page_size,
        pages=pages,
    )


@router.get("/suggestions")
def suggestions(
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_search),
    q: str = Query(default="", max_length=100),
):
    """Lightweight typeahead: names/brands matching the expanded query."""
    q = (q or "").strip()
    if len(q) < 2:
        return {"items": []}
    pq = ProductQuery(q=q, sort="relevance", page=1, page_size=8)
    items, _ = repo.search_products(db, pq)
    return {
        "items": [
            {
                "name": p.name,
                "slug": p.slug,
                "brand_name": p.brand.name if p.brand else "",
                "match_reason": "Matches catalog search",
            }
            for p in items
        ]
    }


@router.get("/filters")
def filter_options(db: Session = Depends(get_db)):
    """Available facet values for building filter UIs (active products only)."""
    active = (Product.is_active.is_(True), Product.is_archived.is_(False))
    brands = db.execute(
        select(Brand.name, Brand.slug, func.count(Product.id))
        .join(Product, Product.brand_id == Brand.id)
        .where(*active)
        .group_by(Brand.id)
        .order_by(Brand.name)
    ).all()
    categories = db.execute(
        select(Category.name, Category.slug, func.count(Product.id))
        .join(Product, Product.category_id == Category.id)
        .where(*active)
        .group_by(Category.id)
        .order_by(Category.display_order, Category.name)
    ).all()
    forms = db.execute(
        select(Product.form, func.count(Product.id))
        .where(*active, Product.form.is_not(None))
        .group_by(Product.form)
        .order_by(Product.form)
    ).all()
    price_row = db.execute(
        select(
            func.min(func.coalesce(Product.sale_price_cents, Product.regular_price_cents)),
            func.max(func.coalesce(Product.sale_price_cents, Product.regular_price_cents)),
        ).where(*active)
    ).one()
    return {
        "brands": [{"name": n, "slug": s, "count": c} for n, s, c in brands],
        "categories": [{"name": n, "slug": s, "count": c} for n, s, c in categories],
        "forms": [{"value": f, "count": c} for f, c in forms],
        "dietary": list(DIETARY_KEYS),
        "price_min_cents": price_row[0] or 0,
        "price_max_cents": price_row[1] or 0,
    }


@router.get("/{slug}", response_model=ProductDetail)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = repo.get_by_slug(db, slug)
    if product is None:
        raise NotFoundError("Product not found.")
    return serialize.product_detail(product)


@router.get("/{slug}/related", response_model=Page[ProductListItem])
def related_products(slug: str, db: Session = Depends(get_db)):
    product = repo.get_by_slug(db, slug)
    if product is None:
        raise NotFoundError("Product not found.")
    items = repo.related_products(db, product, limit=8)
    return Page[ProductListItem](
        items=[serialize.product_list_item(p) for p in items],
        total=len(items),
        page=1,
        page_size=len(items) or 8,
        pages=1,
    )
