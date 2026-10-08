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
    from .catalog import PRODUCTS

    with connect() as db:
        policies = {
            "commuter-v2": {"floors": [8900, 8500], "inventory": 60},
            "value-v2": {"floors": [6700, 6300], "inventory": 20},
            "studio-v2": {"floors": [10800, 10000], "inventory": 24},
            "commuter-real-v1": {"floors": [8900, 8500], "inventory": 60},
            "value-real-v1": {"floors": [6700, 6300], "inventory": 20},
            "studio-real-v1": {"floors": [28500, 26500], "inventory": 24},
        }
        for product in PRODUCTS:
            db.execute(
                "INSERT INTO products VALUES(%s,%s) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
                (product["id"], Jsonb(product)),
            )
            if product["category"] == "Headphones":
                db.execute(
                    "INSERT INTO catalog_stock VALUES(%s,%s) ON CONFLICT DO NOTHING",
                    (
                        product["id"],
                        policies[product["policy_id"]]["inventory"],
                    ),
                )
        policies = {
            p["policy_id"]: {
                **p["public_policy"],
                **policies[p["policy_id"]],
                "variants": sorted(
                    {
                        v
                        for other in PRODUCTS
                        if other.get("policy_id") == p["policy_id"]
                        for v in other["variants"]
                    }
                ),
            }
            for p in PRODUCTS
            if p["category"] == "Headphones"
        }
        for policy_id, policy in policies.items():
            db.execute(
                "INSERT INTO merchant_policies VALUES(%s,2,%s) ON CONFLICT DO NOTHING",
                (policy_id, Jsonb(policy)),
            )


if __name__ == "__main__":
    init_db()
    seed()
    print(
        "Migrations applied; headphone catalog seeded. Open the storefront or operator controls."
    )
