"""Audit distributor naming/grouping consistency for ANEEL artifacts."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

DIM_GROUP_PATH = Path("data/processed/analysis/dim_distributor_group.csv")


def run_audit() -> int:
    if not DIM_GROUP_PATH.exists():
        print(f"missing file: {DIM_GROUP_PATH}")
        return 1

    dim = pd.read_csv(DIM_GROUP_PATH)
    issues: list[str] = []

    required_cols = {"distributor_name_sig", "distributor_name_legal", "distributor_label", "group_id"}
    missing = sorted(required_cols - set(dim.columns))
    if missing:
        issues.append(f"missing columns in {DIM_GROUP_PATH}: {', '.join(missing)}")
        print_report(issues)
        return 1

    normalized = dim.copy()
    normalized["distributor_name_sig"] = normalized["distributor_name_sig"].fillna("").astype(str).str.strip()
    normalized["distributor_name_legal"] = normalized["distributor_name_legal"].fillna("").astype(str).str.strip()
    normalized["distributor_label"] = normalized["distributor_label"].fillna("").astype(str).str.strip()
    normalized["expected_label"] = normalized.apply(
        lambda row: row["distributor_name_sig"]
        if not row["distributor_name_legal"] or row["distributor_name_legal"] == row["distributor_name_sig"]
        else f"{row['distributor_name_sig']} — {row['distributor_name_legal']}",
        axis=1,
    )
    broken_labels = normalized[normalized["distributor_label"] != normalized["expected_label"]]
    if not broken_labels.empty:
        issues.append(f"invalid distributor_label composition rows: {len(broken_labels)}")

    patterns = ("neoenergia", "cpfl", "enel")
    wrong_group = dim[
        dim["distributor_name_sig"].fillna("").astype(str).str.lower().str.startswith(patterns)
        & (dim["group_id"].fillna("").astype(str).str.lower() == "companhia")
    ]
    if not wrong_group.empty:
        offenders = sorted(wrong_group["distributor_name_sig"].astype(str).unique().tolist())
        issues.append(
            "unexpected group_id=companhia for sigagente prefixes Neoenergia/CPFL/Enel: "
            + ", ".join(offenders[:10])
        )

    print_report(issues)
    return 1 if issues else 0


def print_report(issues: list[str]) -> None:
    if not issues:
        print("naming audit OK")
        return
    print("naming audit failed:")
    for issue in issues:
        print(f" - {issue}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit distributor naming consistency")
    _ = parser.parse_args()
    raise SystemExit(run_audit())


if __name__ == "__main__":
    main()
