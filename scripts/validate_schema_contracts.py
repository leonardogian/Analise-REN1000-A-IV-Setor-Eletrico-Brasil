"""Validate raw/processed schema contracts for ANEEL pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.etl.schema_contracts import validate_processed_contracts, validate_raw_contracts

RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate ANEEL data schema contracts")
    parser.add_argument(
        "--raw-only",
        action="store_true",
        help="validate only raw files",
    )
    parser.add_argument(
        "--processed-only",
        action="store_true",
        help="validate only processed files",
    )
    args = parser.parse_args()

    if args.raw_only and args.processed_only:
        raise SystemExit("Use either --raw-only or --processed-only, not both.")

    errors: list[str] = []

    if not args.processed_only:
        errors.extend(validate_raw_contracts(RAW_DIR))

    if not args.raw_only:
        errors.extend(validate_processed_contracts(PROCESSED_DIR))

    if errors:
        print("Schema contract validation failed:")
        for err in errors:
            print(f" - {err}")
        raise SystemExit(1)

    scope = "raw + processed"
    if args.raw_only:
        scope = "raw"
    elif args.processed_only:
        scope = "processed"

    print(f"Schema contracts OK ({scope}).")


if __name__ == "__main__":
    main()
