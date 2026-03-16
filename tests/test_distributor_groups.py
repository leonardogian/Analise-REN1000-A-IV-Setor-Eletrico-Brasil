"""Testes unitários para src/analysis/distributor_groups.py.

Uma atribuição incorreta de group_id corrompe TODOS os gráficos de grupos
econômicos do dashboard. Estes testes verificam: normalização de texto,
slugificação, inferência de grupo por heurísticas e anotação de DataFrames.
"""

import pandas as pd
import pytest

from src.analysis.distributor_groups import (
    annotate_distributor_group,
    build_distributor_id,
    default_group_label,
    infer_group_id,
    normalize_group_key,
    resolve_group_id,
    slugify,
)


# ---------------------------------------------------------------------------
# normalize_group_key
# ---------------------------------------------------------------------------

class TestNormalizeGroupKey:
    def test_uppercase(self):
        assert normalize_group_key("neoenergia") == "NEOENERGIA"

    def test_strips_accents(self):
        # CELPE has an accent-free name in ANEEL but the function should strip accents
        assert normalize_group_key("Çéntro") == "CENTRO"

    def test_collapses_whitespace(self):
        assert normalize_group_key("CPFL   Energia") == "CPFL ENERGIA"

    def test_strips_leading_trailing(self):
        assert normalize_group_key("  ENEL  ") == "ENEL"

    def test_none_returns_empty(self):
        assert normalize_group_key(None) == ""

    def test_nan_returns_empty(self):
        import numpy as np
        assert normalize_group_key(float("nan")) == ""

    def test_numeric_string(self):
        assert normalize_group_key("123") == "123"


# ---------------------------------------------------------------------------
# slugify
# ---------------------------------------------------------------------------

class TestSlugify:
    def test_basic(self):
        assert slugify("NEOENERGIA") == "neoenergia"

    def test_spaces_become_underscores(self):
        assert slugify("CPFL Energia") == "cpfl_energia"

    def test_special_chars_removed(self):
        assert slugify("EDP - São Paulo") == "edp_sao_paulo"

    def test_empty_uses_fallback(self):
        assert slugify("") == "desconhecido"
        assert slugify("!!!") == "desconhecido"

    def test_custom_fallback(self):
        assert slugify("", fallback="outros") == "outros"

    def test_none_uses_fallback(self):
        assert slugify(None) == "desconhecido"


# ---------------------------------------------------------------------------
# build_distributor_id
# ---------------------------------------------------------------------------

class TestBuildDistributorId:
    def test_uses_sigagente(self):
        result = build_distributor_id("CELPE", "Companhia Energética de Pernambuco")
        assert result == "celpe"

    def test_falls_back_to_nomagente_when_sig_empty(self):
        result = build_distributor_id("", "Neoenergia Pernambuco")
        assert "neoenergia" in result

    def test_falls_back_to_nomagente_when_sig_none(self):
        result = build_distributor_id(None, "Equatorial Maranhão")
        assert "equatorial" in result

    def test_deterministic(self):
        a = build_distributor_id("CPFL", "CPFL Energia")
        b = build_distributor_id("CPFL", "CPFL Energia")
        assert a == b


# ---------------------------------------------------------------------------
# infer_group_id
# ---------------------------------------------------------------------------

class TestInferGroupId:
    @pytest.mark.parametrize("name,expected", [
        ("NEOENERGIA PERNAMBUCO", "neoenergia"),
        ("Neoenergia Brasília", "neoenergia"),
        ("EQUATORIAL MARANHÃO", "equatorial"),
        ("Equatorial Pará", "equatorial"),
        ("CPFL Energia", "cpfl"),
        ("CPFL Piratininga", "cpfl"),
        ("ENEL SP", "enel"),
        ("ENEL-CE", "enel"),
        ("ENERGISA MT", "energisa"),
        ("Energisa Minas Gerais", "energisa"),
        ("EDP São Paulo", "edp"),
        ("CEMIG Distribuição", "cemig"),
        ("COPEL Distribuição", "copel"),
        ("CELESC Distribuição", "celesc"),
        ("ELETROBRAS Distribuição Alagoas", "eletrobras"),
        ("CHESF", "eletrobras"),
        ("ELETRONORTE", "eletrobras"),
    ])
    def test_known_groups(self, name, expected):
        assert infer_group_id(name) == expected

    def test_unknown_uses_first_token(self):
        result = infer_group_id("LIGEIRINHA Distribuidora")
        assert result == "ligeirinha"

    def test_empty_returns_outros(self):
        assert infer_group_id("") == "outros"

    def test_none_returns_outros(self):
        assert infer_group_id(None) == "outros"


# ---------------------------------------------------------------------------
# default_group_label
# ---------------------------------------------------------------------------

class TestDefaultGroupLabel:
    def test_neoenergia(self):
        label = default_group_label("neoenergia")
        assert "Neoenergia" in label

    def test_underscore_replaced(self):
        label = default_group_label("grupo_a")
        assert "_" not in label

    def test_short_words_uppercased(self):
        # "edp" has 3 chars → uppercased
        label = default_group_label("edp")
        assert "EDP" in label


# ---------------------------------------------------------------------------
# resolve_group_id
# ---------------------------------------------------------------------------

class TestResolveGroupId:
    def test_override_takes_precedence(self):
        overrides = {"custom_dist": "energisa"}
        result = resolve_group_id("QUALQUER NOME", "custom_dist", overrides)
        assert result == "energisa"

    def test_prefix_neoenergia(self):
        result = resolve_group_id("", "neoenergia_pernambuco")
        assert result == "neoenergia"

    def test_prefix_cpfl(self):
        result = resolve_group_id("", "cpfl_paulista")
        assert result == "cpfl"

    def test_falls_back_to_infer(self):
        result = resolve_group_id("EQUATORIAL MARANHÃO", "equatorial_maranhao")
        assert result == "equatorial"

    def test_unknown_falls_back_to_infer(self):
        result = resolve_group_id("CEMIG DISTRIBUICAO", "cemig_d")
        assert result == "cemig"


# ---------------------------------------------------------------------------
# annotate_distributor_group
# ---------------------------------------------------------------------------

class TestAnnotateDistributorGroup:
    def _df(self):
        return pd.DataFrame({
            "sigagente": ["CELPE", "CPFL"],
            "nomagente": ["Neoenergia Pernambuco", "CPFL Energia"],
        })

    def test_adds_distributor_id(self):
        result = annotate_distributor_group(self._df())
        assert "distributor_id" in result.columns

    def test_adds_group_id(self):
        result = annotate_distributor_group(self._df())
        assert "group_id" in result.columns

    def test_celpe_gets_celpe_group_without_overrides(self):
        # Sem override JSON, CELPE → group_id "celpe" (primeiro token do sigagente).
        # A associação CELPE → neoenergia é configurada via distributor_groups_overrides.json.
        result = annotate_distributor_group(self._df())
        celpe_row = result[result["sigagente"] == "CELPE"]
        assert celpe_row["group_id"].iloc[0] == "celpe"

    def test_cpfl_gets_cpfl_group(self):
        result = annotate_distributor_group(self._df())
        cpfl_row = result[result["sigagente"] == "CPFL"]
        assert cpfl_row["group_id"].iloc[0] == "cpfl"

    def test_missing_sig_col_raises(self):
        df = pd.DataFrame({"nomagente": ["CEMIG"]})
        with pytest.raises(KeyError):
            annotate_distributor_group(df)

    def test_distributor_label_column_created(self):
        result = annotate_distributor_group(self._df())
        assert "distributor_label" in result.columns

    def test_group_label_column_created(self):
        result = annotate_distributor_group(self._df())
        assert "group_label" in result.columns

    def test_does_not_mutate_original(self):
        df = self._df()
        original_cols = list(df.columns)
        annotate_distributor_group(df)
        assert list(df.columns) == original_cols
