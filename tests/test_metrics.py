"""Testes unitários para src/analysis/metrics.py.

Cobre todas as 7 funções de métricas derivadas usadas em todos os KPIs do
dashboard. Garante: divisão por zero → NaN (não crash), boundary do corte
regulatório REN 1000 (2021/2022), e aplicação em bloco via apply_standard_metrics.
"""

import math

import numpy as np
import pandas as pd
import pytest

from src.analysis.config import PER_100K, REN1000_CUTOFF_YEAR, PERIOD_LABELS
from src.analysis.metrics import (
    apply_standard_metrics,
    calc_compensacao_media_por_transgressao,
    calc_compensacao_por_uc,
    calc_fora_prazo_por_100k,
    calc_share,
    calc_taxa_fora_prazo,
    classify_periodo_regulatorio,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _s(*values) -> pd.Series:
    return pd.Series(list(values), dtype=float)


def _nan(v) -> bool:
    return v is np.nan or (isinstance(v, float) and math.isnan(v))


# ---------------------------------------------------------------------------
# calc_taxa_fora_prazo
# ---------------------------------------------------------------------------

class TestCalcTaxaForaPrazo:
    def test_basic_ratio(self):
        result = calc_taxa_fora_prazo(_s(10.0), _s(100.0))
        assert result[0] == pytest.approx(0.1)

    def test_zero_denominator_returns_nan(self):
        result = calc_taxa_fora_prazo(_s(5.0), _s(0.0))
        assert _nan(result[0])

    def test_zero_numerator(self):
        result = calc_taxa_fora_prazo(_s(0.0), _s(50.0))
        assert result[0] == pytest.approx(0.0)

    def test_multiple_rows(self):
        result = calc_taxa_fora_prazo(_s(10.0, 0.0, 5.0), _s(100.0, 0.0, 50.0))
        assert result[0] == pytest.approx(0.1)
        assert _nan(result[1])
        assert result[2] == pytest.approx(0.1)

    def test_full_transgression(self):
        result = calc_taxa_fora_prazo(_s(100.0), _s(100.0))
        assert result[0] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# calc_fora_prazo_por_100k
# ---------------------------------------------------------------------------

class TestCalcForaPrazoPor100k:
    def test_basic(self):
        result = calc_fora_prazo_por_100k(_s(1.0), _s(100_000.0))
        assert result[0] == pytest.approx(1.0)

    def test_scales_by_per_100k_constant(self):
        result = calc_fora_prazo_por_100k(_s(50.0), _s(100_000.0))
        assert result[0] == pytest.approx(50.0)

    def test_zero_uc_returns_nan(self):
        result = calc_fora_prazo_por_100k(_s(10.0), _s(0.0))
        assert _nan(result[0])

    def test_large_values(self):
        result = calc_fora_prazo_por_100k(_s(1_000.0), _s(1_000_000.0))
        assert result[0] == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# calc_compensacao_por_uc
# ---------------------------------------------------------------------------

class TestCalcCompensacaoPorUc:
    def test_basic(self):
        result = calc_compensacao_por_uc(_s(500.0), _s(100.0))
        assert result[0] == pytest.approx(5.0)

    def test_zero_uc_returns_nan(self):
        result = calc_compensacao_por_uc(_s(100.0), _s(0.0))
        assert _nan(result[0])

    def test_zero_compensacao(self):
        result = calc_compensacao_por_uc(_s(0.0), _s(200.0))
        assert result[0] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# calc_compensacao_media_por_transgressao
# ---------------------------------------------------------------------------

class TestCalcCompensacaoMediaPorTransgressao:
    def test_basic(self):
        result = calc_compensacao_media_por_transgressao(_s(1000.0), _s(10.0))
        assert result[0] == pytest.approx(100.0)

    def test_zero_transgressoes_returns_nan(self):
        result = calc_compensacao_media_por_transgressao(_s(500.0), _s(0.0))
        assert _nan(result[0])

    def test_zero_compensacao(self):
        result = calc_compensacao_media_por_transgressao(_s(0.0), _s(5.0))
        assert result[0] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# calc_share
# ---------------------------------------------------------------------------

class TestCalcShare:
    def test_basic(self):
        result = calc_share(_s(25.0), _s(100.0))
        assert result[0] == pytest.approx(0.25)

    def test_zero_total_returns_nan(self):
        result = calc_share(_s(10.0), _s(0.0))
        assert _nan(result[0])

    def test_full_share(self):
        result = calc_share(_s(100.0), _s(100.0))
        assert result[0] == pytest.approx(1.0)

    def test_multiple_rows(self):
        result = calc_share(_s(10.0, 0.0, 50.0), _s(100.0, 0.0, 200.0))
        assert result[0] == pytest.approx(0.1)
        assert _nan(result[1])
        assert result[2] == pytest.approx(0.25)


# ---------------------------------------------------------------------------
# classify_periodo_regulatorio
# ---------------------------------------------------------------------------

class TestClassifyPeriodoRegulatorio:
    """Garante que o corte REN 1000 (ano <= 2021 → pre_2022, >= 2022 → pos_2022)
    está correto. O valor REN1000_CUTOFF_YEAR é 2021."""

    def test_cutoff_year_is_pre(self):
        ano = pd.Series([REN1000_CUTOFF_YEAR])
        result = classify_periodo_regulatorio(ano)
        assert result[0] == PERIOD_LABELS["pre"]

    def test_year_before_cutoff_is_pre(self):
        ano = pd.Series([2011, 2015, 2020])
        result = classify_periodo_regulatorio(ano)
        assert all(r == PERIOD_LABELS["pre"] for r in result)

    def test_year_after_cutoff_is_pos(self):
        ano = pd.Series([2022, 2023, 2025])
        result = classify_periodo_regulatorio(ano)
        assert all(r == PERIOD_LABELS["pos"] for r in result)

    def test_boundary_2022_is_pos(self):
        ano = pd.Series([2022])
        result = classify_periodo_regulatorio(ano)
        assert result[0] == PERIOD_LABELS["pos"]

    def test_mixed(self):
        ano = pd.Series([2020, 2021, 2022, 2023])
        result = classify_periodo_regulatorio(ano)
        assert result[0] == PERIOD_LABELS["pre"]
        assert result[1] == PERIOD_LABELS["pre"]
        assert result[2] == PERIOD_LABELS["pos"]
        assert result[3] == PERIOD_LABELS["pos"]


# ---------------------------------------------------------------------------
# apply_standard_metrics
# ---------------------------------------------------------------------------

class TestApplyStandardMetrics:
    def _base_df(self) -> pd.DataFrame:
        return pd.DataFrame({
            "qtd_fora_prazo": [10.0, 0.0, 5.0],
            "qtd_serv_realizado": [100.0, 50.0, 0.0],
            "compensacao_rs": [1000.0, 0.0, 500.0],
            "uc_ativa_mes": [10_000.0, 5_000.0, 0.0],
        })

    def test_adds_expected_columns(self):
        df = apply_standard_metrics(self._base_df())
        assert "taxa_fora_prazo" in df.columns
        assert "fora_prazo_por_100k_uc_mes" in df.columns
        assert "compensacao_rs_por_uc_mes" in df.columns
        assert "compensacao_media_por_transgressao" in df.columns

    def test_does_not_crash_on_zero_denominators(self):
        df = apply_standard_metrics(self._base_df())
        # row 2: qtd_serv=0 → taxa_fora_prazo NaN; uc=0 → fora_prazo NaN; compensacao NaN
        assert _nan(df["taxa_fora_prazo"].iloc[2])
        assert _nan(df["fora_prazo_por_100k_uc_mes"].iloc[2])
        assert _nan(df["compensacao_rs_por_uc_mes"].iloc[2])

    def test_correct_values_row0(self):
        df = apply_standard_metrics(self._base_df())
        assert df["taxa_fora_prazo"].iloc[0] == pytest.approx(0.1)
        assert df["fora_prazo_por_100k_uc_mes"].iloc[0] == pytest.approx(100.0)
        assert df["compensacao_rs_por_uc_mes"].iloc[0] == pytest.approx(0.1)
        assert df["compensacao_media_por_transgressao"].iloc[0] == pytest.approx(100.0)

    def test_fallback_to_qtd_serv_column(self):
        """Quando não há qtd_serv_realizado, usa qtd_serv como fallback."""
        df = pd.DataFrame({
            "qtd_fora_prazo": [20.0],
            "qtd_serv": [200.0],
            "compensacao_rs": [2000.0],
            "uc_ativa_mes": [20_000.0],
        })
        result = apply_standard_metrics(df)
        assert result["taxa_fora_prazo"].iloc[0] == pytest.approx(0.1)

    def test_missing_uc_col_does_not_crash(self):
        """Quando a coluna de UC não existe, métricas por UC ficam NaN (não crash)."""
        df = pd.DataFrame({
            "qtd_fora_prazo": [10.0],
            "qtd_serv_realizado": [100.0],
            "compensacao_rs": [500.0],
        })
        result = apply_standard_metrics(df)
        assert _nan(result["fora_prazo_por_100k_uc_mes"].iloc[0])
        assert _nan(result["compensacao_rs_por_uc_mes"].iloc[0])
