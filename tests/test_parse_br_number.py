"""Testes unitários para parse_br_number em src/analysis/build_analysis_tables.py.

Esta função é responsável por interpretar valores numéricos dos dados ANEEL que
podem vir em formato brasileiro (1.234,56) ou americano (1,234.56). Uma falha
silenciosa aqui corrompe todos os valores financeiros (compensacao_rs) e de
serviços (qtd_serv_realizado) do pipeline.
"""

import math

import numpy as np
import pandas as pd
import pytest

from src.analysis.build_analysis_tables import parse_br_number


def _parse(value) -> float | None:
    """Helper: aplica parse_br_number em uma Series de 1 elemento."""
    result = parse_br_number(pd.Series([value]))
    v = result.iloc[0]
    if v is pd.NA or (isinstance(v, float) and math.isnan(v)):
        return None
    return float(v)


class TestParseBrNumberFormatoBrasileiro:
    def test_br_com_milhar_e_decimal(self):
        assert _parse("1.234,56") == pytest.approx(1234.56)

    def test_br_apenas_decimal(self):
        assert _parse("1234,56") == pytest.approx(1234.56)

    def test_br_milhar_sem_decimal(self):
        # NOTA: "1.000" com ponto único é ambíguo. O algoritmo trata como decimal
        # americano (1.000 = 1.0). Para representar 1000 em BR, use "1.000,00"
        # (com vírgula decimal) ou "1.000.000" (múltiplos pontos → BR milhar).
        # Esse comportamento é intencional e documentado no código.
        assert _parse("1.000") == pytest.approx(1.0)

    def test_br_multiplos_milhares(self):
        assert _parse("1.000.000") == pytest.approx(1_000_000.0)

    def test_br_valor_grande_com_decimal(self):
        assert _parse("10.543,78") == pytest.approx(10543.78)


class TestParseBrNumberFormatoAmericano:
    def test_us_com_milhar_e_decimal(self):
        assert _parse("1,234.56") == pytest.approx(1234.56)

    def test_us_apenas_decimal(self):
        assert _parse("1234.56") == pytest.approx(1234.56)

    def test_us_apenas_inteiro_com_ponto(self):
        # Ponto único sem vírgula → ponto decimal americano
        assert _parse("500.0") == pytest.approx(500.0)


class TestParseBrNumberValoresEspeciais:
    def test_inteiro_sem_separador(self):
        assert _parse("42") == pytest.approx(42.0)

    def test_zero_string(self):
        assert _parse("0") == pytest.approx(0.0)

    def test_zero_br_decimal(self):
        assert _parse("0,00") == pytest.approx(0.0)

    def test_negativo_br(self):
        assert _parse("-1.234,56") == pytest.approx(-1234.56)

    def test_negativo_us(self):
        assert _parse("-1,234.56") == pytest.approx(-1234.56)


class TestParseBrNumberEntradaInvalida:
    def test_string_vazia_retorna_none(self):
        assert _parse("") is None

    def test_none_retorna_none(self):
        assert _parse(None) is None

    def test_nan_retorna_none(self):
        assert _parse(float("nan")) is None

    def test_apenas_traco_retorna_none(self):
        assert _parse("-") is None

    def test_apenas_ponto_retorna_none(self):
        assert _parse(".") is None

    def test_apenas_virgula_retorna_none(self):
        assert _parse(",") is None

    def test_texto_nao_numerico_retorna_none(self):
        assert _parse("N/A") is None

    def test_texto_com_prefixo_alfabetico_extrai_numero(self):
        # re.sub remove chars não-numéricos, então "abc123" → "123" → 123.0
        # NOTA: isso é uma limitação do parser — não detecta valores nonsense.
        # O dado real do ANEEL não contém tais strings, mas é bom ter documentado.
        assert _parse("abc123") == pytest.approx(123.0)


class TestParseBrNumberSerie:
    def test_serie_mista_preserva_indices(self):
        s = pd.Series(["1.234,56", "100", None, "0,50"], index=[10, 20, 30, 40])
        result = parse_br_number(s)
        assert result[10] == pytest.approx(1234.56)
        assert result[20] == pytest.approx(100.0)
        assert result[30] is pd.NA or (isinstance(result[30], float) and math.isnan(result[30]))
        assert result[40] == pytest.approx(0.50)

    def test_serie_ja_numerica_passa_diretamente(self):
        """Se a série já é float, deve retornar sem transformação."""
        s = pd.Series([1.5, 2.5, float("nan")])
        result = parse_br_number(s)
        assert result[0] == pytest.approx(1.5)
        assert result[1] == pytest.approx(2.5)
        assert math.isnan(result[2])
