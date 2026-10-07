"""SQLAlchemy owns connections; existing explicit PostgreSQL queries remain readable."""

from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from sqlalchemy import create_engine

from .config import settings


@lru_cache(maxsize=4)
def _engine(url):
    url = url.replace("postgres://", "postgresql://", 1).replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
    return create_engine(url, pool_pre_ping=True)


def engine():
    return _engine(settings.database_url)


@contextmanager
def connect():
    pooled = engine().raw_connection()
    db = pooled.driver_connection
    previous_factory = db.row_factory
    db.row_factory = dict_row
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.row_factory = previous_factory
        pooled.close()


def enqueue(db, kind, payload, key):
    db.execute(
        "INSERT INTO jobs(mode,kind,payload,dedupe_key) VALUES(%s,%s,%s,%s) ON CONFLICT(dedupe_key) DO NOTHING",
        (settings.mode, kind, Jsonb(payload), key),
    )


def init_db():
    from alembic import command
    from alembic.config import Config

    command.upgrade(
        Config(str(Path(__file__).resolve().parents[2] / "alembic.ini")), "head"
    )


def seed():
    from .catalog import PRODUCTS, TERMS

    with connect() as db:
        for product in PRODUCTS:
            db.execute(
                "INSERT INTO products VALUES(%s,%s) ON CONFLICT DO NOTHING",
                (product["id"], Jsonb(product)),
            )
            if product["category"] == "Headphones":
                db.execute(
                    "INSERT INTO catalog_stock VALUES(%s,60) ON CONFLICT DO NOTHING",
                    (product["id"],),
                )
        db.execute(
            "INSERT INTO merchant_policies VALUES('headphones-v1',1,%s) ON CONFLICT DO NOTHING",
            (
                Jsonb(
                    {
                        "base": [9200, 8800],
                        "ranges": [[8900, 9200], [8500, 8800]],
                        "floors": [8900, 8500],
                        "variants": ["Graphite"],
                        "currency": "USD",
                        "delivery_concessions": False,
                    }
                ),
            ),
        )
        db.execute(
            "INSERT INTO offers(id,product_id,terms,price_minor,currency,minimum,capacity,inventory) VALUES(%s,%s,%s,6500,'USD',5,5,5) ON CONFLICT DO NOTHING",
            (TERMS["offer_id"], TERMS["product_id"], Jsonb(TERMS)),
        )


if __name__ == "__main__":
    init_db()
    seed()
    print(
        "Migrations applied; six headphone offers and three legacy products seeded. Prepare a run in operator controls."
    )
