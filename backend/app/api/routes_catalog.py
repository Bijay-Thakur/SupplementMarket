"""Brand / category / tag endpoints (public reads, dev-only writes)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_dev
from app.core.errors import ConflictError, NotFoundError
from app.core.utils import slugify
from app.db.base import get_db
from app.models import Brand, Category, Product, Tag
from app.schemas.catalog import (
    BrandCreate,
    BrandOut,
    BrandUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    TagCreate,
    TagOut,
    TagUpdate,
)
from app.schemas.common import OkResponse

public = APIRouter(tags=["catalog"])
admin = APIRouter(dependencies=[Depends(require_dev)], tags=["admin:catalog"])


def _unique_slug(db: Session, model, base: str, exclude_id: int | None = None) -> str:
    slug = base
    n = 2
    while True:
        stmt = select(model.id).where(model.slug == slug)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.execute(stmt).first() is None:
            return slug
        slug = f"{base}-{n}"
        n += 1


# ── Brands ────────────────────────────────────────────────────────────────
@public.get("/brands", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    ids = (
        select(Product.brand_id)
        .where(Product.is_active.is_(True), Product.is_archived.is_(False))
        .distinct()
    )
    return list(db.execute(select(Brand).where(Brand.id.in_(ids)).order_by(Brand.name)).scalars())


@public.get("/brands/{slug}", response_model=BrandOut)
def get_brand(slug: str, db: Session = Depends(get_db)):
    brand = db.execute(select(Brand).where(Brand.slug == slug)).scalars().first()
    if brand is None:
        raise NotFoundError("Brand not found.")
    return brand


@admin.post("/admin/brands", response_model=BrandOut, status_code=201)
def create_brand(payload: BrandCreate, db: Session = Depends(get_db)):
    slug = _unique_slug(db, Brand, slugify(payload.name))
    brand = Brand(
        name=payload.name,
        slug=slug,
        description=payload.description,
        logo_url=payload.logo_url,
        is_featured=payload.is_featured,
    )
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@admin.patch("/admin/brands/{brand_id}", response_model=BrandOut)
def update_brand(brand_id: int, payload: BrandUpdate, db: Session = Depends(get_db)):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise NotFoundError("Brand not found.")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        brand.name = data["name"]
        brand.slug = _unique_slug(db, Brand, slugify(data["name"]), exclude_id=brand_id)
    for f in ("description", "logo_url", "is_featured"):
        if f in data:
            setattr(brand, f, data[f])
    db.commit()
    db.refresh(brand)
    return brand


@admin.delete("/admin/brands/{brand_id}", response_model=OkResponse)
def delete_brand(brand_id: int, db: Session = Depends(get_db)):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise NotFoundError("Brand not found.")
    in_use = db.execute(
        select(Product.id).where(Product.brand_id == brand_id).limit(1)
    ).first()
    if in_use:
        raise ConflictError("Cannot delete a brand that still has products.")
    db.delete(brand)
    db.commit()
    return OkResponse(message="Brand deleted.")


# ── Categories ──────────────────────────────────────────────────────────────
@public.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return list(
        db.execute(select(Category).order_by(Category.display_order, Category.name)).scalars()
    )


@public.get("/categories/{slug}", response_model=CategoryOut)
def get_category(slug: str, db: Session = Depends(get_db)):
    cat = db.execute(select(Category).where(Category.slug == slug)).scalars().first()
    if cat is None:
        raise NotFoundError("Category not found.")
    return cat


@admin.post("/admin/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    slug = _unique_slug(db, Category, slugify(payload.name))
    cat = Category(
        name=payload.name,
        slug=slug,
        parent_id=payload.parent_id,
        description=payload.description,
        display_order=payload.display_order,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@admin.patch("/admin/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if cat is None:
        raise NotFoundError("Category not found.")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        cat.name = data["name"]
        cat.slug = _unique_slug(db, Category, slugify(data["name"]), exclude_id=category_id)
    for f in ("parent_id", "description", "display_order"):
        if f in data:
            setattr(cat, f, data[f])
    db.commit()
    db.refresh(cat)
    return cat


@admin.delete("/admin/categories/{category_id}", response_model=OkResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if cat is None:
        raise NotFoundError("Category not found.")
    in_use = db.execute(
        select(Product.id).where(Product.category_id == category_id).limit(1)
    ).first()
    if in_use:
        raise ConflictError("Cannot delete a category that still has products.")
    db.delete(cat)
    db.commit()
    return OkResponse(message="Category deleted.")


# ── Tags ────────────────────────────────────────────────────────────────────
@public.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return list(db.execute(select(Tag).order_by(Tag.name)).scalars())


@admin.post("/admin/tags", response_model=TagOut, status_code=201)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    slug = _unique_slug(db, Tag, slugify(payload.name))
    tag = Tag(name=payload.name, slug=slug, kind=payload.kind)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@admin.patch("/admin/tags/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, payload: TagUpdate, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError("Tag not found.")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        tag.name = data["name"]
        tag.slug = _unique_slug(db, Tag, slugify(data["name"]), exclude_id=tag_id)
    if "kind" in data and data["kind"]:
        tag.kind = data["kind"]
    db.commit()
    db.refresh(tag)
    return tag


@admin.delete("/admin/tags/{tag_id}", response_model=OkResponse)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError("Tag not found.")
    db.delete(tag)
    db.commit()
    return OkResponse(message="Tag deleted.")
