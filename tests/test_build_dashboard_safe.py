"""Testes unitários para funções utilitárias de build_dashboard_data.py.

Foco em:
- _safe(): conversão de tipos numpy para JSON-safe. Um np.nan que passe para o
  JSON como NaN (inválido em JSON) ou um np.inf que vire float('inf') quebraria
  o endpoint /api/dashboard silenciosamente.
- select_featured_group_ids(): seleção dos grupos econômicos destacados no
  dashboard. Garante que grupos obrigatórios (equatorial, cpfl, neoenergia)
  sejam sempre incluídos quando disponíveis, e que ausências sejam tratadas.
"""

import math

import numpy as np
import pandas as pd
import pytest

from src.analysis.build_dashboard_data import _safe, select_featured_group_ids


# ---------------------------------------------------------------------------
# _safe
# ---------------------------------------------------------------------------

class TestSafe:
    # Tipos numpy → Python nativo
    def test_np_integer_to_int(self):
        result = _safe(np.int64(42))
        assert result == 42
        assert isinstance(result, int)

    def test_np_float_to_float(self):
        result = _safe(np.float64(3.14))
        assert result == pytest.approx(3.14)
        assert isinstance(result, float)

    def test_np_bool_true(self):
        assert _safe(np.bool_(True)) is True

    def test_np_bool_false(self):
        assert _safe(np.bool_(False)) is False

    # Valores especiais que devem virar None (JSON null)
    def test_np_nan_returns_none(self):
        assert _safe(np.float64("nan")) is None

    def test_np_inf_returns_none(self):
        assert _safe(np.float64("inf")) is None

    def test_np_neg_inf_returns_none(self):
        assert _safe(np.float64("-inf")) is None

    def test_python_nan_returns_none(self):
        assert _safe(float("nan")) is None

    def test_python_inf_returns_none(self):
        assert _safe(float("inf")) is None

    def test_pd_na_returns_none(self):
        assert _safe(pd.NA) is None

    def test_pd_nat_returns_none(self):
        # pd.NaT é tratado por pd.isna()
        assert _safe(pd.NaT) is None

    # Tipos Python nativos passam sem conversão
    def test_plain_int_passthrough(self):
        assert _safe(7) == 7

    def test_plain_float_passthrough(self):
        assert _safe(1.5) == pytest.approx(1.5)

    def test_string_passthrough(self):
        assert _safe("neoenergia") == "neoenergia"

    def test_none_returns_none(self):
        # None → pd.isna(None) == True → returns None
        assert _safe(None) is None

    def test_zero_int(self):
        assert _safe(np.int64(0)) == 0

    def test_zero_float(self):
        result = _safe(np.float64(0.0))
        assert result == pytest.approx(0.0)

    def test_large_integer(self):
        assert _safe(np.int64(1_000_000)) == 1_000_000

    def test_negative_float(self):
        result = _safe(np.float64(-99.5))
        assert result == pytest.approx(-99.5)


# ---------------------------------------------------------------------------
# select_featured_group_ids
# ---------------------------------------------------------------------------

def _make_groups(ids: list[str], counts: list[int] | None = None) -> list[dict]:
    counts = counts or [2] * len(ids)
    return [{"group_id": gid, "distributor_count": c} for gid, c in zip(ids, counts)]


def _make_benchmark(ids: list[str], ucs: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"group_id": ids, "uc_ativa_media_ano": ucs})


class TestSelectFeaturedGroupIds:
    def test_includes_all_required_groups_when_present(self):
        groups = _make_groups(["neoenergia", "equatorial", "cpfl", "energisa", "enel", "cemig", "copel"])
        bm = _make_benchmark(
            ["neoenergia", "equatorial", "cpfl", "energisa", "enel", "cemig", "copel"],
            [100.0, 90.0, 80.0, 70.0, 60.0, 50.0, 40.0],
        )
        result = select_featured_group_ids(groups, bm)
        for required in ("neoenergia", "equatorial", "cpfl"):
            assert required in result, f"Required group '{required}' missing from result"

    def test_top_n_by_uc_volume(self):
        groups = _make_groups(["a", "b", "c", "d"])
        bm = _make_benchmark(["a", "b", "c", "d"], [1000.0, 500.0, 200.0, 100.0])
        result = select_featured_group_ids(groups, bm, top_n=2)
        assert result[:2] == ["a", "b"]

    def test_missing_required_group_not_in_data(self):
        """Grupos obrigatórios ausentes nos dados não devem causar crash."""
        groups = _make_groups(["energisa", "enel"])
        bm = _make_benchmark(["energisa", "enel"], [200.0, 150.0])
        result = select_featured_group_ids(groups, bm, required_groups=("neoenergia",))
        assert "neoenergia" not in result  # não está em 'available', então não é adicionado

    def test_no_duplicates_in_result(self):
        groups = _make_groups(["neoenergia", "equatorial", "cpfl", "energisa"])
        bm = _make_benchmark(["neoenergia", "equatorial", "cpfl", "energisa"], [100.0, 90.0, 80.0, 70.0])
        result = select_featured_group_ids(groups, bm)
        assert len(result) == len(set(result)), "Resultado contém duplicatas"

    def test_empty_benchmark_falls_back_to_distributor_count(self):
        groups = _make_groups(["a", "b", "c"], [10, 5, 1])
        result = select_featured_group_ids(groups, pd.DataFrame(), top_n=2)
        assert "a" in result
        assert "b" in result

    def test_all_results_are_in_available_groups(self):
        groups = _make_groups(["neoenergia", "cpfl"])
        bm = _make_benchmark(["neoenergia", "cpfl", "fantasma"], [100.0, 90.0, 999.0])
        result = select_featured_group_ids(groups, bm)
        available = {"neoenergia", "cpfl"}
        for gid in result:
            assert gid in available, f"'{gid}' não está nos grupos disponíveis"

    def test_single_group_available(self):
        groups = _make_groups(["neoenergia"])
        bm = _make_benchmark(["neoenergia"], [100.0])
        result = select_featured_group_ids(groups, bm)
        assert "neoenergia" in result
        assert len(result) == 1

    def test_empty_groups_returns_empty(self):
        result = select_featured_group_ids([], pd.DataFrame(), required_groups=())
        assert result == []
