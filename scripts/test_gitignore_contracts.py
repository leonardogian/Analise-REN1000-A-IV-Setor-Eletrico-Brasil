"""Regression checks for generated/heavy artifacts ignored by Git."""

from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IGNORED_GENERATED_PATHS = [
    "data/raw/RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.ods",
    "data/raw/RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.xls",
    "data/raw/indger-dados-servicos-comerciais-2026-01.csv",
    "data/raw/nested/source.csv",
    "data/docs/dm-indger-dados-comerciais.pdf",
    "data/_provenance/extract_aneel_20260624_183841.json",
]

TRACKED_CANONICAL_PATHS = [
    "data/processed/analysis/fato_transgressao_mensal_distribuidora.csv",
    "data/processed/dashboard/dashboard_data.json",
]


def check_ignore(path: str) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "--no-index", "--quiet", path],
        cwd=ROOT,
        check=False,
    )
    return result.returncode == 0


def test_generated_paths_are_ignored() -> None:
    not_ignored = [path for path in IGNORED_GENERATED_PATHS if not check_ignore(path)]
    assert not not_ignored, f"generated paths should be ignored: {not_ignored}"


def test_canonical_outputs_are_not_ignored() -> None:
    ignored = [path for path in TRACKED_CANONICAL_PATHS if check_ignore(path)]
    assert not ignored, f"canonical outputs should remain versionable: {ignored}"


def main() -> None:
    test_generated_paths_are_ignored()
    test_canonical_outputs_are_not_ignored()
    print("Gitignore contract tests OK.")


if __name__ == "__main__":
    main()
