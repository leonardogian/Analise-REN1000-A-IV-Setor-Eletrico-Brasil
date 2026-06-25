"""Regression checks for ANEEL/INDGER temporal drift handling."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.analysis.build_analysis_tables import (  # noqa: E402
    build_fato_transgressao_mensal_distribuidora,
    build_indger_servicos_analysis_filters,
)
from src.analysis.build_dashboard_data import safe_mode_label  # noqa: E402
from src.analysis.build_report import fmt_int, fmt_money, fmt_pct  # noqa: E402
from src.analysis.grupos_diagnostico import build_latest_size_benchmark, build_monthly_view  # noqa: E402
from src.etl.schema_contracts import (  # noqa: E402
    ANALYSIS_RANGE_CONTRACTS,
    month_periods_between,
    validate_indger_periods,
)
from src.etl.transform_aneel import _validar_cobertura_indger_servicos_csvs  # noqa: E402


def _periods(start: tuple[int, int], end: tuple[int, int]) -> set[tuple[int, int]]:
    return set(month_periods_between(start, end))


def test_future_contiguous_months_are_allowed() -> None:
    periods = _periods((2023, 1), (2026, 4))
    errors = validate_indger_periods(periods, context="INDGER teste")
    assert errors == []


def test_baseline_still_required_for_service_tables() -> None:
    periods = _periods((2023, 1), (2024, 1))
    errors = validate_indger_periods(periods, context="INDGER incompleto")
    assert errors
    assert "2025-12" in " ".join(errors)


def test_partial_uc_source_can_be_contiguous_without_baseline() -> None:
    periods = _periods((2023, 1), (2024, 1))
    errors = validate_indger_periods(
        periods,
        context="INDGER UC parcial",
        require_baseline=False,
    )
    assert errors == []


def test_missing_month_inside_available_window_is_rejected() -> None:
    periods = _periods((2023, 1), (2026, 4))
    periods.remove((2024, 7))
    errors = validate_indger_periods(periods, context="INDGER com buraco")
    assert errors
    assert "2024-07" in " ".join(errors)


def test_transform_accepts_40_monthly_service_files() -> None:
    files = [
        Path(f"indger-dados-servicos-comerciais-{ano}-{mes:02d}.csv")
        for ano, mes in month_periods_between((2023, 1), (2026, 4))
    ]
    periods = _validar_cobertura_indger_servicos_csvs(files)
    assert len(periods) == 40
    assert periods[0] == (2023, 1)
    assert periods[-1] == (2026, 4)


def test_analysis_detail_keeps_future_service_files_for_operational_dashboard() -> None:
    filters = build_indger_servicos_analysis_filters()
    assert ("_source_file", ">=", "indger-dados-servicos-comerciais-2023-01.csv") in filters
    assert not any(item[1] == "<=" for item in filters)


def test_group_monthly_view_keeps_future_operational_months() -> None:
    frame = pd.DataFrame(
        [
            {"ano": 2025, "mes": 12, "group_id": "g", "distributor_label": "D"},
            {"ano": 2026, "mes": 1, "group_id": "g", "distributor_label": "D"},
        ]
    )
    result = build_monthly_view(frame)
    assert sorted(result["ano"].unique().tolist()) == [2025, 2026]


def test_monthly_distributor_aggregation_keeps_missing_uc_rows() -> None:
    monthly_by_class = pd.DataFrame(
        [
            {
                "ano": 2026,
                "mes": 1,
                "group_id": "grupo_teste",
                "distributor_id": "dist_teste",
                "sigagente": "TST",
                "nomagente": "Distribuidora Teste",
                "distributor_name_sig": "TST",
                "distributor_name_legal": "Distribuidora Teste",
                "distributor_label": "TST — Distribuidora Teste",
                "uc_ativa_mes": pd.NA,
                "bucket_porte": pd.NA,
                "rank_porte_ano": pd.NA,
                "uc_ativa_media_mensal": pd.NA,
                "qtd_serv_realizado": 100.0,
                "qtd_fora_prazo": 5.0,
                "compensacao_rs": 123.45,
            }
        ]
    )
    result = build_fato_transgressao_mensal_distribuidora(monthly_by_class)
    assert len(result) == 1
    assert int(result.loc[0, "ano"]) == 2026
    assert int(result.loc[0, "mes"]) == 1
    assert bool(result.loc[0, "ano_comparavel_principal"])
    assert pd.isna(result.loc[0, "uc_ativa_mes"])


def test_annual_indicator_range_allows_future_source_years() -> None:
    assert ANALYSIS_RANGE_CONTRACTS["fato_indicadores_anuais.csv"]["ano"] == (2011, None)


def test_report_formatters_accept_pandas_na() -> None:
    assert fmt_int(pd.NA) == "-"
    assert fmt_money(pd.NA) == "-"
    assert fmt_pct(pd.NA) == "-"


def test_latest_size_benchmark_accepts_missing_uc_size() -> None:
    annual = pd.DataFrame(
        [
            {
                "ano": 2025,
                "group_id": "grupo_teste",
                "distributor_id": "dist_teste",
                "distributor_label": "Teste",
                "uc_ativa_media_ano": pd.NA,
                "fora_prazo_por_100k_uc_mes": pd.NA,
                "compensacao_rs_por_uc_mes": pd.NA,
            }
        ]
    )
    result = build_latest_size_benchmark(annual)
    assert len(result) == 1
    assert pd.isna(result.loc[0, "rank_porte_grupo"])


def test_dashboard_safe_mode_label_accepts_all_missing_values() -> None:
    assert safe_mode_label(pd.Series([pd.NA, None])) == "N/A"
    assert safe_mode_label(pd.Series(["Grande", pd.NA])) == "Grande"


def main() -> None:
    tests = [
        test_future_contiguous_months_are_allowed,
        test_baseline_still_required_for_service_tables,
        test_partial_uc_source_can_be_contiguous_without_baseline,
        test_missing_month_inside_available_window_is_rejected,
        test_transform_accepts_40_monthly_service_files,
        test_analysis_detail_keeps_future_service_files_for_operational_dashboard,
        test_group_monthly_view_keeps_future_operational_months,
        test_monthly_distributor_aggregation_keeps_missing_uc_rows,
        test_annual_indicator_range_allows_future_source_years,
        test_report_formatters_accept_pandas_na,
        test_latest_size_benchmark_accepts_missing_uc_size,
        test_dashboard_safe_mode_label_accepts_all_missing_values,
    ]
    for test in tests:
        test()
    print("ANEEL temporal contract tests OK.")


if __name__ == "__main__":
    main()
