from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
    description: str | None = None
    logo_url: str | None = None
    logo_alt: str | None = None
    official_website_url: str | None = None
    logo_use_status: str = "permission_pending"
    logo_background: str = "cream"
    is_featured: bool = False
    display_order: int = 0
    is_demo: bool = False


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    logo_url: str | None = None
    logo_alt: str | None = None
    official_website_url: str | None = None
    logo_use_status: str | None = None
    is_featured: bool = False


class BrandUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    logo_url: str | None = None
    logo_alt: str | None = None
    official_website_url: str | None = None
    logo_use_status: str | None = None
    is_featured: bool | None = None
    display_order: int | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
    parent_id: int | None = None
    description: str | None = None
    display_order: int = 0
    is_demo: bool = False


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    parent_id: int | None = None
    description: str | None = None
    display_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    parent_id: int | None = None
    description: str | None = None
    display_order: int | None = None


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
    kind: str = "wellness"
    is_demo: bool = False


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: str = "wellness"


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: str | None = None
