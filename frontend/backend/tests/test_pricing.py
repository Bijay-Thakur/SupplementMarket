import pytest

from app.services.pricing import (
    PricingError,
    discount_percent,
    effective_price_cents,
    sale_price_from_percent,
    sale_price_from_brand_discount,
    validate_prices,
)


def test_discount_percent_rounds():
    assert discount_percent(1899, 1499) == 21
    assert discount_percent(2000, 1500) == 25
    assert discount_percent(1000, None) is None
    assert discount_percent(1000, 1000) is None


def test_effective_price():
    assert effective_price_cents(2000, 1500) == 1500
    assert effective_price_cents(2000, None) == 2000
    # invalid sale (>= regular) falls back to regular
    assert effective_price_cents(2000, 2500) == 2000


def test_validate_prices():
    validate_prices(1000, 500)  # ok
    with pytest.raises(PricingError):
        validate_prices(-1, None)
    with pytest.raises(PricingError):
        validate_prices(1000, 1000)
    with pytest.raises(PricingError):
        validate_prices(1000, 1200)


def test_sale_from_percent():
    assert sale_price_from_percent(2000, 25) == 1500
    with pytest.raises(PricingError):
        sale_price_from_percent(2000, 0)
    with pytest.raises(PricingError):
        sale_price_from_percent(2000, 100)


def test_sale_from_brand_discount():
    assert sale_price_from_brand_discount(2000, 25) == 1500
    assert sale_price_from_brand_discount(2000, 0) is None
    assert sale_price_from_brand_discount(1, 1) == 0
    with pytest.raises(PricingError):
        sale_price_from_brand_discount(2000, 100)
