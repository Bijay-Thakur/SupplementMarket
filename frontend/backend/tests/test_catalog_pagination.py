from app.api import routes_admin_csv


def test_live_admin_products_reads_and_pages_past_supabase_cap(monkeypatch):
    rows = [
        {
            "id": str(index),
            "name": f"Product {index:04d}",
            "slug": f"product-{index}",
            "status": "active",
            "updated_at": f"2026-09-16T12:{index % 60:02d}:00Z",
            "product_variants": [
                {
                    "sku": f"SKU-{index}",
                    "upc": str(100_000 + index),
                    "regular_price_cents": 1999,
                    "availability": "in_stock",
                    "is_default": True,
                }
            ],
        }
        for index in range(1434)
    ]
    offsets: list[int] = []

    def fake_select(_table, params):
        offset = int(params["offset"])
        limit = int(params["limit"])
        offsets.append(offset)
        return rows[offset : offset + limit]

    monkeypatch.setattr(routes_admin_csv.sb, "select", fake_select)

    result = routes_admin_csv.list_products(q=None, page=58, page_size=25)

    assert offsets == [0, 1000]
    assert result["total"] == 1434
    assert result["pages"] == 58
    assert result["page"] == 58
    assert len(result["items"]) == 9
