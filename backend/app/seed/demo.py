"""Deterministic demonstration catalog.

Everything created here has `is_demo=True` and uses SYNTHETIC, fictional brands
and neutral descriptions. This is NOT the store's real inventory and must not be
presented as such. No real branded label facts, certifications, or medical
claims are fabricated. The safe reset only removes demo rows.
"""
from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.utils import order_number, public_token, slugify
from app.models import (
    Brand,
    Category,
    IdempotencyKey,
    Order,
    OrderItem,
    Product,
    ProductTag,
    Promotion,
    PromotionProduct,
    StoreSettings,
    Tag,
)

FDA_WARNING = (
    "These statements have not been evaluated by the Food and Drug Administration. "
    "This product is not intended to diagnose, treat, cure, or prevent any disease."
)

BRANDS = [
    ("Verdant Labs", True),
    ("PureHarbor", False),
    ("GreenLeaf Nutrition", False),
    ("NorthField Naturals", True),
    ("SolaVira", False),
    ("BlueSpring Botanicals", False),
    ("VitalRoot", False),
    ("Meadowmark", False),
]

CATEGORIES = [
    "Multivitamins",
    "Vitamin D",
    "Vitamin B & B12",
    "Vitamin C",
    "Minerals",
    "Omega Oils",
    "Probiotics",
    "Herbal Supplements",
    "Joint Support",
    "Digestive Support",
    "Sleep Support",
    "Immune Support",
    "Hair, Skin & Nails",
    "Heart Wellness",
    "Brain Wellness",
    "Sports Nutrition",
]

TAGS = [
    "immune support",
    "bone health",
    "heart",
    "brain",
    "sleep support",
    "digestive support",
    "joint support",
    "energy",
    "hair skin nails",
    "stress",
    "omega support",
    "healthy inflammatory response",
    "occasional discomfort",
    "prenatal",
    "sports recovery",
    "womens health",
    "mens health",
]

# (category, name, form, strength_value, strength_unit, count, size, regular$, sale$ or None,
#  featured, bestseller, new, availability, [tags], aliases, [dietary keys])
P = tuple
PRODUCTS: list[tuple] = [
    ("Multivitamins", "Daily Multivitamin Complex", "tablet", None, None, 120, None, 24.99, 19.99, True, True, False, "in_stock", ["energy", "immune support"], "multivitamin, multi", ["vegetarian", "gluten_free"]),
    ("Multivitamins", "Women's Daily Multivitamin", "tablet", None, None, 90, None, 27.99, None, False, True, False, "in_stock", ["womens health", "energy"], "multivitamin, womens multi", ["vegetarian"]),
    ("Multivitamins", "Men's Daily Multivitamin", "tablet", None, None, 90, None, 27.99, 22.99, False, False, True, "in_stock", ["mens health", "energy"], "multivitamin, mens multi", ["vegetarian"]),
    ("Multivitamins", "Prenatal Multivitamin", "softgel", None, None, 60, None, 29.99, None, False, False, True, "in_stock", ["prenatal", "womens health"], "prenatal, multi", ["gluten_free"]),
    ("Vitamin D", "Vitamin D3 2000 IU", "softgel", 2000, "IU", 120, None, 14.99, 11.99, True, True, False, "in_stock", ["bone health", "immune support"], "vitamin d, d3, cholecalciferol", ["gluten_free", "soy_free"]),
    ("Vitamin D", "Vitamin D3 5000 IU", "softgel", 5000, "IU", 90, None, 17.99, None, False, True, False, "in_stock", ["bone health", "immune support"], "vitamin d, d3, cholecalciferol", ["gluten_free"]),
    ("Vitamin D", "Vitamin D3 + K2", "capsule", 125, "mcg", 60, None, 22.99, 18.99, False, False, True, "low_stock", ["bone health", "heart"], "vitamin d, d3, k2", ["vegan", "gluten_free"]),
    ("Vitamin B & B12", "Vitamin B12 1000 mcg", "lozenge", 1000, "mcg", 120, None, 12.99, None, False, True, False, "in_stock", ["energy", "brain"], "b12, cobalamin, vitamin b12", ["vegan", "gluten_free"]),
    ("Vitamin B & B12", "B-Complex High Potency", "capsule", None, None, 90, None, 18.99, 14.99, True, False, False, "in_stock", ["energy", "stress"], "b complex, b vitamins", ["vegan"]),
    ("Vitamin B & B12", "Methyl B12 5000 mcg", "lozenge", 5000, "mcg", 60, None, 16.99, None, False, False, True, "in_stock", ["energy", "brain"], "b12, methylcobalamin", ["vegan", "gluten_free"]),
    ("Vitamin C", "Vitamin C 1000 mg", "tablet", 1000, "mg", 100, None, 13.99, 10.99, False, True, False, "in_stock", ["immune support"], "vitamin c, ascorbic acid", ["vegan", "gluten_free"]),
    ("Vitamin C", "Buffered Vitamin C Powder", "powder", None, "g", None, "8 oz", 21.99, None, False, False, True, "in_stock", ["immune support"], "vitamin c, buffered c", ["vegan", "gluten_free", "non_gmo"]),
    ("Vitamin C", "Vitamin C + Zinc Gummies", "gummy", 250, "mg", 60, None, 15.99, 12.99, True, False, False, "in_stock", ["immune support"], "vitamin c, zinc, gummies", ["vegetarian", "gluten_free"]),
    ("Minerals", "Magnesium Glycinate 400 mg", "capsule", 400, "mg", 120, None, 19.99, 16.99, True, True, False, "in_stock", ["sleep support", "stress"], "magnesium, glycinate", ["vegan", "gluten_free"]),
    ("Minerals", "Zinc Picolinate 30 mg", "capsule", 30, "mg", 90, None, 11.99, None, False, False, False, "in_stock", ["immune support"], "zinc", ["vegan", "gluten_free"]),
    ("Minerals", "Iron Bisglycinate 25 mg", "capsule", 25, "mg", 90, None, 13.99, None, False, False, True, "in_stock", ["energy", "womens health"], "iron", ["vegan", "gluten_free"]),
    ("Minerals", "Calcium + Magnesium + D3", "tablet", None, None, 120, None, 17.99, 14.49, False, False, False, "low_stock", ["bone health"], "calcium, magnesium", ["gluten_free"]),
    ("Omega Oils", "Omega-3 Fish Oil 1000 mg", "softgel", 1000, "mg", 120, None, 24.99, 19.99, True, True, False, "in_stock", ["heart", "brain", "omega support"], "omega 3, fish oil, epa, dha", ["gluten_free"]),
    ("Omega Oils", "Triple Strength Omega-3", "softgel", 1400, "mg", 90, None, 32.99, None, False, True, False, "in_stock", ["heart", "omega support"], "omega 3, fish oil", ["gluten_free"]),
    ("Omega Oils", "Vegan Algae Omega-3", "softgel", 500, "mg", 60, None, 29.99, 24.99, False, False, True, "in_stock", ["heart", "brain", "omega support"], "omega 3, algae, dha, vegan omega", ["vegan", "gluten_free"]),
    ("Omega Oils", "Flaxseed Oil 1000 mg", "softgel", 1000, "mg", 100, None, 15.99, None, False, False, False, "in_stock", ["heart", "omega support"], "flaxseed, omega", ["vegan", "gluten_free"]),
    ("Probiotics", "Daily Probiotic 25 Billion", "capsule", 25, "g", 30, None, 26.99, 21.99, True, True, False, "in_stock", ["digestive support"], "probiotic, digestion, gut", ["vegetarian", "gluten_free"]),
    ("Probiotics", "Women's Probiotic 50 Billion", "capsule", 50, "g", 30, None, 32.99, None, False, False, True, "in_stock", ["digestive support", "womens health"], "probiotic, digestion", ["vegetarian"]),
    ("Probiotics", "Kids Chewable Probiotic", "chewable", 5, "g", 60, None, 18.99, 15.99, False, False, False, "in_stock", ["digestive support"], "probiotic, kids", ["vegetarian", "gluten_free"]),
    ("Herbal Supplements", "Turmeric Curcumin Complex", "capsule", 1500, "mg", 90, None, 22.99, 17.99, True, True, False, "in_stock", ["healthy inflammatory response", "joint support", "occasional discomfort"], "turmeric, curcumin, curamin", ["vegan", "gluten_free", "non_gmo"]),
    ("Herbal Supplements", "Ashwagandha Root 600 mg", "capsule", 600, "mg", 90, None, 19.99, None, False, True, True, "in_stock", ["stress", "sleep support"], "ashwagandha, stress", ["vegan", "gluten_free"]),
    ("Herbal Supplements", "Elderberry Extract", "gummy", 100, "mg", 60, None, 16.99, 13.99, False, False, False, "in_stock", ["immune support"], "elderberry, sambucus", ["vegetarian", "gluten_free"]),
    ("Herbal Supplements", "Milk Thistle 500 mg", "capsule", 500, "mg", 120, None, 15.99, None, False, False, False, "coming_soon", ["digestive support"], "milk thistle, silymarin", ["vegan", "gluten_free"]),
    ("Joint Support", "Glucosamine Chondroitin MSM", "tablet", None, None, 120, None, 27.99, 22.99, True, True, False, "in_stock", ["joint support", "occasional discomfort"], "glucosamine, chondroitin, joint", ["gluten_free"]),
    ("Joint Support", "Collagen Joint Formula", "capsule", None, None, 90, None, 24.99, None, False, False, True, "in_stock", ["joint support", "hair skin nails"], "collagen, joint", ["gluten_free"]),
    ("Joint Support", "Boswellia Extract", "capsule", 500, "mg", 60, None, 18.99, 15.49, False, False, False, "low_stock", ["joint support", "healthy inflammatory response"], "boswellia, joint", ["vegan", "gluten_free"]),
    ("Digestive Support", "Digestive Enzymes", "capsule", None, None, 90, None, 21.99, None, False, True, False, "in_stock", ["digestive support"], "enzymes, digestion", ["vegan", "gluten_free"]),
    ("Digestive Support", "Fiber Powder Daily", "powder", None, "g", None, "16 oz", 19.99, 15.99, False, False, False, "in_stock", ["digestive support"], "fiber, psyllium", ["vegan", "gluten_free", "non_gmo"]),
    ("Digestive Support", "Ginger Root 550 mg", "capsule", 550, "mg", 100, None, 12.99, None, False, False, True, "in_stock", ["digestive support"], "ginger, nausea", ["vegan", "gluten_free"]),
    ("Sleep Support", "Melatonin 5 mg", "tablet", 5, "mg", 120, None, 10.99, 8.49, True, True, False, "in_stock", ["sleep support"], "melatonin, sleep", ["vegan", "gluten_free"]),
    ("Sleep Support", "Sleep Support Complex", "capsule", None, None, 60, None, 18.99, None, False, False, True, "in_stock", ["sleep support", "stress"], "sleep, melatonin, valerian", ["vegan", "gluten_free"]),
    ("Sleep Support", "Magnesium + L-Theanine Calm", "capsule", None, None, 90, None, 21.99, 17.99, False, False, False, "in_stock", ["sleep support", "stress"], "l-theanine, calm, sleep", ["vegan"]),
    ("Immune Support", "Zinc + Vitamin C + D3", "capsule", None, None, 90, None, 17.99, 13.99, True, True, False, "in_stock", ["immune support"], "immune, zinc, vitamin c", ["vegan", "gluten_free"]),
    ("Immune Support", "Vitamin C + Elderberry", "gummy", 250, "mg", 60, None, 16.99, None, False, False, True, "in_stock", ["immune support"], "elderberry, vitamin c, immune", ["vegetarian"]),
    ("Immune Support", "Mushroom Immune Blend", "capsule", None, None, 90, None, 26.99, 21.99, False, False, False, "in_stock", ["immune support"], "reishi, mushroom, immune", ["vegan", "gluten_free", "organic"]),
    ("Hair, Skin & Nails", "Biotin 10000 mcg", "softgel", 10000, "mcg", 120, None, 13.99, 10.99, True, True, False, "in_stock", ["hair skin nails"], "biotin, hair", ["gluten_free"]),
    ("Hair, Skin & Nails", "Collagen Peptides Powder", "powder", None, "g", None, "16 oz", 29.99, 24.99, False, True, False, "in_stock", ["hair skin nails", "joint support"], "collagen, peptides", ["gluten_free", "non_gmo"]),
    ("Hair, Skin & Nails", "Hair Skin & Nails Gummies", "gummy", None, None, 90, None, 17.99, None, False, False, True, "in_stock", ["hair skin nails"], "biotin, hair skin nails", ["vegetarian"]),
    ("Heart Wellness", "CoQ10 200 mg", "softgel", 200, "mg", 60, None, 27.99, 22.99, True, True, False, "in_stock", ["heart", "energy"], "coq10, ubiquinone, heart", ["gluten_free"]),
    ("Heart Wellness", "Red Yeast Rice", "capsule", 600, "mg", 120, None, 22.99, None, False, False, False, "in_stock", ["heart"], "red yeast rice, cholesterol support", ["vegan", "gluten_free"]),
    ("Heart Wellness", "Plant Sterols Complex", "softgel", None, None, 90, None, 24.99, 19.99, False, False, True, "low_stock", ["heart"], "plant sterols, cholesterol support", ["gluten_free"]),
    ("Brain Wellness", "Lion's Mane Mushroom", "capsule", 1000, "mg", 60, None, 24.99, None, False, True, True, "in_stock", ["brain"], "lions mane, focus, brain", ["vegan", "gluten_free", "organic"]),
    ("Brain Wellness", "Ginkgo Biloba 120 mg", "capsule", 120, "mg", 120, None, 15.99, 12.99, True, False, False, "in_stock", ["brain"], "ginkgo, memory, brain", ["vegan", "gluten_free"]),
    ("Brain Wellness", "Omega-3 DHA Brain Formula", "softgel", 500, "mg", 60, None, 27.99, None, False, False, False, "in_stock", ["brain", "omega support"], "dha, omega 3, brain", ["gluten_free"]),
    ("Sports Nutrition", "Whey Protein Isolate Vanilla", "powder", None, "g", None, "2 lb", 39.99, 32.99, True, True, False, "in_stock", ["sports recovery", "energy"], "protein, whey, isolate", ["gluten_free"]),
    ("Sports Nutrition", "Plant Protein Chocolate", "powder", None, "g", None, "2 lb", 37.99, None, False, True, True, "in_stock", ["sports recovery"], "protein, plant protein, vegan protein", ["vegan", "gluten_free", "non_gmo"]),
    ("Sports Nutrition", "Creatine Monohydrate", "powder", 5, "g", None, "300 g", 24.99, 19.99, False, False, False, "in_stock", ["sports recovery"], "creatine, strength", ["vegan", "gluten_free"]),
    ("Sports Nutrition", "Electrolyte Hydration Mix", "powder", None, None, 30, None, 22.99, None, False, False, True, "in_stock", ["energy", "sports recovery"], "electrolytes, hydration", ["vegan", "gluten_free"]),
]


def _clear_demo(db: Session) -> None:
    """Delete ONLY demonstration rows. Never touches non-demo data."""
    # Demo orders first (items cascade). Then detach any order items that still
    # reference demo products so product deletion won't violate FKs.
    demo_order_ids = [o.id for o in db.execute(select(Order).where(Order.is_demo.is_(True))).scalars()]
    if demo_order_ids:
        db.execute(delete(IdempotencyKey).where(IdempotencyKey.order_id.in_(demo_order_ids)))
        db.execute(delete(Order).where(Order.id.in_(demo_order_ids)))

    demo_product_ids = [
        p.id
        for p in db.execute(
            select(Product).where(
                Product.is_demo.is_(True),
                Product.source_type.is_distinct_from("official_manufacturer_page"),
            )
        ).scalars()
    ]
    if demo_product_ids:
        db.execute(
            update(OrderItem)
            .where(OrderItem.product_id.in_(demo_product_ids))
            .values(product_id=None)
        )
        db.execute(delete(ProductTag).where(ProductTag.product_id.in_(demo_product_ids)))
        db.execute(delete(PromotionProduct).where(PromotionProduct.product_id.in_(demo_product_ids)))
        db.execute(delete(Product).where(Product.id.in_(demo_product_ids)))

    db.execute(delete(Promotion).where(Promotion.is_demo.is_(True)))
    kept_brands = list(db.execute(select(Product.brand_id).distinct()).scalars())
    kept_cats = list(db.execute(select(Product.category_id).distinct()).scalars())
    kept_tags = list(db.execute(select(ProductTag.tag_id).distinct()).scalars())
    if kept_tags:
        db.execute(delete(Tag).where(Tag.is_demo.is_(True), Tag.id.not_in(kept_tags)))
    else:
        db.execute(delete(Tag).where(Tag.is_demo.is_(True)))
    if kept_cats:
        db.execute(delete(Category).where(Category.is_demo.is_(True), Category.id.not_in(kept_cats)))
    else:
        db.execute(delete(Category).where(Category.is_demo.is_(True)))
    if kept_brands:
        db.execute(delete(Brand).where(Brand.is_demo.is_(True), Brand.id.not_in(kept_brands)))
    else:
        db.execute(delete(Brand).where(Brand.is_demo.is_(True)))
    db.commit()


def seed_demo(db: Session, *, reset: bool = True) -> dict[str, int]:
    if reset:
        _clear_demo(db)

    brands: dict[str, Brand] = {}
    for name, featured in BRANDS:
        b = Brand(name=name, slug=slugify(name), is_featured=featured, is_demo=True,
                  description=f"{name} (demonstration brand).")
        db.add(b)
        brands[name] = b

    cats: dict[str, Category] = {}
    for i, name in enumerate(CATEGORIES):
        c = Category(name=name, slug=slugify(name), display_order=i, is_demo=True)
        db.add(c)
        cats[name] = c

    tags: dict[str, Tag] = {}
    for name in TAGS:
        t = Tag(name=name, slug=slugify(name), kind="wellness", is_demo=True)
        db.add(t)
        tags[name] = t

    db.flush()

    brand_list = list(brands.values())
    count = 0
    for idx, row in enumerate(PRODUCTS):
        (cat, name, form, sval, sunit, cnt, size, reg_d, sale_d, feat, best, new, avail,
         tag_names, aliases, dietary) = row
        brand = brand_list[idx % len(brand_list)]
        reg_c = int(round(reg_d * 100))
        sale_c = int(round(sale_d * 100)) if sale_d is not None else None
        sku = f"BNM-{slugify(name)[:16].upper().replace('-', '')}-{idx:03d}"
        p = Product(
            brand_id=brand.id,
            category_id=cats[cat].id,
            name=name,
            slug=slugify(name),
            short_description=f"{name} — demonstration product.",
            long_description=(
                f"{name} is synthetic demonstration data for the Bronxville Natural Market "
                "demo. It is not the store's real inventory and contains no verified label "
                "facts. Commonly categorized for "
                f"{', '.join(tag_names)}."
            ),
            form=form,
            size=size,
            count=cnt,
            strength_value=sval,
            strength_unit=sunit,
            sku=sku,
            regular_price_cents=reg_c,
            sale_price_cents=sale_c,
            availability=avail,
            is_featured=feat,
            is_bestseller=best,
            is_new=new,
            is_active=True,
            vegan="vegan" in dietary,
            vegetarian=("vegetarian" in dietary or "vegan" in dietary),
            organic="organic" in dietary,
            gluten_free="gluten_free" in dietary,
            soy_free="soy_free" in dietary,
            dairy_free="dairy_free" in dietary,
            alcohol_free=True,
            non_gmo="non_gmo" in dietary,
            search_aliases=aliases,
            ingredient_highlights=", ".join(tag_names),
            usage_text="Follow label directions. Consult a healthcare professional before use.",
            warnings=FDA_WARNING,
            is_demo=True,
            source_type="synthetic_demo",
            verification_status="unverified",
            approval_status="approved",
        )
        p.tags = [tags[t] for t in tag_names if t in tags]
        db.add(p)
        count += 1

    # Store settings (owner-verified contact).
    if db.get(StoreSettings, 1) is None:
        db.add(
            StoreSettings(
                id=1,
                phone="+19147793552",
                phone_is_placeholder=False,
                email="bronxvillenatural@gmail.com",
                address_line1="86 Pondfield Rd",
                hours_note="Monday–Saturday, 9 AM–7 PM. Sunday, 10 AM–6 PM.",
                announcement="Demo storefront — product photos are for demonstration. Prices shown are demo pricing.",
                pickup_instructions="We'll confirm when your order is ready for pickup at 86 Pondfield Rd.",
                delivery_note="Local delivery availability and fees are confirmed by the store.",
            )
        )

    db.flush()

    # A couple of demo orders so the admin order list isn't empty.
    sample = db.execute(select(Product).where(Product.is_demo.is_(True)).limit(2)).scalars().all()
    if sample:
        oi = [
            OrderItem(
                product_id=sample[0].id,
                product_name=sample[0].name,
                brand_name=sample[0].brand.name if sample[0].brand else None,
                sku=sample[0].sku,
                unit_price_cents=sample[0].sale_price_cents or sample[0].regular_price_cents,
                quantity=2,
                line_total_cents=(sample[0].sale_price_cents or sample[0].regular_price_cents) * 2,
            )
        ]
        subtotal = sum(i.line_total_cents for i in oi)
        db.add(
            Order(
                order_number=order_number(),
                public_token=public_token(),
                idempotency_key=None,
                fulfillment_type="pickup",
                status="placed",
                customer_name="Demo Customer",
                customer_email="demo.customer@example.com",
                customer_phone="000-000-0000",
                subtotal_cents=subtotal,
                total_cents=subtotal,
                notes="Seeded demonstration order.",
                is_demo=True,
                items=oi,
            )
        )

    db.commit()
    return {"brands": len(brands), "categories": len(cats), "tags": len(tags), "products": count}
