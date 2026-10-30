"""Keep the existing paid worker's launch command while running Rally only."""

from runpy import run_module

from rally.db import init_db


def main():
    init_db()
    run_module("rally.worker", run_name="__main__")


if __name__ == "__main__":
    main()
