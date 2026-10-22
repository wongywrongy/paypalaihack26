"""Fresh, isolated schema; migrations never alter the retired app's tables."""

from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from psycopg import sql
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


@contextmanager
def connect():
    pooled = _engine(settings.database_url).raw_connection()
    db = pooled.driver_connection
    previous_factory = db.row_factory
    db.row_factory = dict_row
    try:
        db.execute(
            sql.SQL("SET search_path TO {} ").format(
                sql.Identifier(settings.database_schema)
            )
        )
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
        "INSERT INTO jobs(kind,payload,dedupe_key) VALUES(%s,%s,%s) ON CONFLICT(dedupe_key) DO NOTHING",
        (kind, Jsonb(payload), key),
    )


def init_db():
    with connect() as db:
        db.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
            ("rally-migrate:" + settings.database_schema,),
        )
        db.execute(
            sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(
                sql.Identifier(settings.database_schema)
            )
        )
        db.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        for path in sorted((Path(__file__).parent / "migrations").glob("*.sql")):
            if not db.execute(
                "SELECT 1 FROM schema_migrations WHERE name=%s", (path.name,)
            ).fetchone():
                db.execute(path.read_text())
                db.execute(
                    "INSERT INTO schema_migrations(name) VALUES(%s)", (path.name,)
                )


if __name__ == "__main__":
    init_db()
    print("Rally migrations applied in its dedicated schema; existing data preserved.")
