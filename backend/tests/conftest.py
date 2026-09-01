from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base, get_db
from app.main import app
from app.models import Brand, Category, Product


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db_session):
    def _override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def brand(db_session) -> Brand:
    b = Brand(name="Demo Brand Co", slug="demo-brand-co", is_demo=True)
    db_session.add(b)
    db_session.commit()
    return b


@pytest.fixture()
def category(db_session) -> Category:
    c = Category(name="Vitamin D", slug="vitamin-d", is_demo=True)
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture()
def product(db_session, brand, category) -> Product:
    p = Product(
        brand_id=brand.id,
        category_id=category.id,
        name="Vitamin D3 2000 IU",
        slug="vitamin-d3-2000-iu",
        sku="DEMO-D3-2000",
        regular_price_cents=1899,
        sale_price_cents=1499,
        availability="in_stock",
        is_active=True,
        is_demo=True,
        search_aliases="vitamin d, d3, cholecalciferol",
    )
    db_session.add(p)
    db_session.commit()
    return p
