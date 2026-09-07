"""CLI entry point for seeding/resetting demo data.

Usage (from repository root):
    npm run seed:demo
"""
from __future__ import annotations

from app.db.base import SessionLocal
from app.seed.demo import seed_demo


def main() -> None:
    db = SessionLocal()
    try:
        counts = seed_demo(db, reset=True)
        print(f"Demo data seeded: {counts}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
