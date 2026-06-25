"""Regression checks for optional PostgreSQL-backed dashboard paths."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.backend import main as backend_main
from scripts import load_to_postgres


def test_v2_timeseries_falls_back_to_json_without_postgres() -> None:
    """The Postgres path must be additive: JSON remains available if DB is down."""

    async def run() -> dict:
        original_pool = backend_main.db_manager.pool
        backend_main.db_manager.pool = None
        try:
            return await backend_main.api_v2_timeseries_tendencia()
        finally:
            backend_main.db_manager.pool = original_pool

    payload = asyncio.run(run())

    assert payload["source"] == "json"
    assert isinstance(payload["data"], list)
    assert payload["data"], "fallback should return the canonical dashboard_timeseries.json data"


def test_postgres_loader_discovers_versioned_analysis_csvs(tmp_path: Path) -> None:
    """Replicators should be able to load the versioned analysis CSVs, not only local Parquets."""
    analysis_dir = tmp_path / "data" / "processed" / "analysis"
    groups_dir = analysis_dir / "grupos"
    groups_dir.mkdir(parents=True, exist_ok=True)

    root_csv = analysis_dir / "fato_transgressao_mensal_distribuidora.csv"
    nested_csv = groups_dir / "grupos_mensal_2023_plus.csv"
    root_csv.write_text("ano,mes\n2023,1\n", encoding="utf-8")
    nested_csv.write_text("ano,mes\n2023,1\n", encoding="utf-8")

    sources = load_to_postgres.discover_data_sources(tmp_path)
    discovered = {source.path.relative_to(tmp_path).as_posix() for source in sources}

    assert "data/processed/analysis/fato_transgressao_mensal_distribuidora.csv" in discovered
    assert "data/processed/analysis/grupos/grupos_mensal_2023_plus.csv" in discovered


def test_postgres_loader_builds_core_indexes_for_filtering() -> None:
    statements = load_to_postgres.build_index_statements(
        {"fato_transgressao_mensal_distribuidora", "fato_servicos_classe_mes"}
    )

    joined = "\n".join(statements)
    assert "idx_fato_transgressao_mensal_distribuidora_ano_mes" in joined
    assert "idx_fato_transgressao_mensal_distribuidora_group" in joined
    assert "idx_fato_servicos_classe_mes_classe" in joined


def test_postgres_loader_can_filter_sources_for_quick_smoke(tmp_path: Path) -> None:
    analysis_dir = tmp_path / "data" / "processed" / "analysis"
    groups_dir = analysis_dir / "grupos"
    groups_dir.mkdir(parents=True, exist_ok=True)
    (analysis_dir / "fato_transgressao_mensal_distribuidora.csv").write_text(
        "ano,mes\n2023,1\n", encoding="utf-8"
    )
    (groups_dir / "grupos_mensal_2023_plus.csv").write_text(
        "ano,mes\n2023,1\n", encoding="utf-8"
    )

    sources = load_to_postgres.discover_data_sources(tmp_path)
    filtered = load_to_postgres.filter_sources(sources, {"grupos_mensal_2023_plus"})

    assert [source.table_name for source in filtered] == ["grupos_mensal_2023_plus"]


def main() -> None:
    test_v2_timeseries_falls_back_to_json_without_postgres()
    test_postgres_loader_discovers_versioned_analysis_csvs(Path("/tmp/postgres-loader-test"))
    test_postgres_loader_builds_core_indexes_for_filtering()
    test_postgres_loader_can_filter_sources_for_quick_smoke(Path("/tmp/postgres-loader-filter-test"))
    print("Postgres dashboard contract tests OK.")


if __name__ == "__main__":
    main()
