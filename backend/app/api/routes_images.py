"""Product image upload / delete / reorder / primary (dev-only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import rate_limit_upload, require_dev
from app.core.errors import NotFoundError, ValidationError
from app.db.base import get_db
from app.models import Product, ProductImage
from app.schemas.common import OkResponse
from app.schemas.product import ProductImageOut
from app.services import images as image_service
from app.services import serialize

router = APIRouter(
    prefix="/admin/products/{product_id}/images",
    tags=["admin:images"],
    dependencies=[Depends(require_dev)],
)


def _get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    return product


@router.post("", response_model=ProductImageOut, status_code=201)
def upload_image(
    product_id: int,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_upload),
    file: UploadFile = File(...),
    alt_text: str | None = Form(default=None),
):
    product = _get_product(db, product_id)
    content = file.file.read()
    filename, mime, size = image_service.save_image(content, file.content_type)

    existing = db.execute(
        select(ProductImage).where(ProductImage.product_id == product_id)
    ).scalars().all()
    is_primary = len(existing) == 0
    max_order = max((i.display_order for i in existing), default=-1)

    img = ProductImage(
        product_id=product.id,
        filename=filename,
        original_filename=file.filename,
        alt_text=alt_text or product.name,
        display_order=max_order + 1,
        is_primary=is_primary,
        mime_type=mime,
        size_bytes=size,
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return ProductImageOut(
        id=img.id,
        url=serialize.image_url(img),
        alt_text=img.alt_text,
        display_order=img.display_order,
        is_primary=img.is_primary,
    )


@router.delete("/{image_id}", response_model=OkResponse)
def delete_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    img = db.get(ProductImage, image_id)
    if img is None or img.product_id != product_id:
        raise NotFoundError("Image not found.")
    was_primary = img.is_primary
    image_service.delete_image_file(img.filename)
    db.delete(img)
    db.flush()
    if was_primary:
        nxt = db.execute(
            select(ProductImage)
            .where(ProductImage.product_id == product_id)
            .order_by(ProductImage.display_order)
        ).scalars().first()
        if nxt:
            nxt.is_primary = True
    db.commit()
    return OkResponse(message="Image deleted.")


class ReorderBody(BaseModel):
    image_ids: list[int]


@router.patch("/reorder", response_model=list[ProductImageOut])
def reorder_images(product_id: int, body: ReorderBody, db: Session = Depends(get_db)):
    imgs = {
        i.id: i
        for i in db.execute(
            select(ProductImage).where(ProductImage.product_id == product_id)
        ).scalars()
    }
    if set(body.image_ids) != set(imgs.keys()):
        raise ValidationError("Reorder list must include exactly the product's images.")
    for order, image_id in enumerate(body.image_ids):
        imgs[image_id].display_order = order
    db.commit()
    ordered = sorted(imgs.values(), key=lambda x: x.display_order)
    return [
        ProductImageOut(
            id=i.id,
            url=serialize.image_url(i),
            alt_text=i.alt_text,
            display_order=i.display_order,
            is_primary=i.is_primary,
        )
        for i in ordered
    ]


@router.post("/{image_id}/primary", response_model=OkResponse)
def set_primary(product_id: int, image_id: int, db: Session = Depends(get_db)):
    imgs = db.execute(
        select(ProductImage).where(ProductImage.product_id == product_id)
    ).scalars().all()
    found = False
    for i in imgs:
        if i.id == image_id:
            i.is_primary = True
            found = True
        else:
            i.is_primary = False
    if not found:
        raise NotFoundError("Image not found.")
    db.commit()
    return OkResponse(message="Primary image set.")
