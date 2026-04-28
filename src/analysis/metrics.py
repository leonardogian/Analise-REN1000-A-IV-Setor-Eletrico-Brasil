"""Funções de métricas compartilhadas entre os scripts de análise.

Cada função substitui um padrão np.where que aparecia 5-19 vezes
duplicado nos scripts de análise.
"""

import numpy as np
import pandas as pd

from src.analysis.config import PER_100K, REN1000_CUTOFF_YEAR, PERIOD_LABELS


def calc_taxa_fora_prazo(
    qtd_fora_prazo: pd.Series, qtd_serv: pd.Series
) -> pd.Series:
    """Taxa de transgressão: qtd_fora_prazo / qtd_serv (0-1)."""
    taxa = np.where(qtd_serv > 0, qtd_fora_prazo / qtd_serv, np.nan)
    return np.clip(taxa, 0.0, 1.0)


def calc_fora_prazo_por_100k(
    qtd_fora_prazo: pd.Series, uc: pd.Series
) -> pd.Series:
    """Transgressões por 100 mil UCs-mês."""
    return np.where(uc > 0, qtd_fora_prazo / uc * PER_100K, np.nan)


def calc_compensacao_por_uc(
    compensacao_rs: pd.Series, uc: pd.Series
) -> pd.Series:
    """Compensação financeira por UC (R$/UC-mês)."""
    return np.where(uc > 0, compensacao_rs / uc, np.nan)


def calc_compensacao_media_por_transgressao(
    compensacao_rs: pd.Series, qtd_fora_prazo: pd.Series
) -> pd.Series:
    """Compensação média por transgressão (R$/transgressão)."""
    safe_denom = qtd_fora_prazo.replace(0, np.nan)
    return compensacao_rs / safe_denom


def calc_share(parte: pd.Series, total: pd.Series) -> pd.Series:
    """Participação proporcional (0-1)."""
    return np.where(total > 0, parte / total, np.nan)


def classify_periodo_regulatorio(ano: pd.Series) -> pd.Series:
    """Classifica ano em período regulatório (pre_2022 / pos_2022)."""
    return np.where(
        ano <= REN1000_CUTOFF_YEAR,
        PERIOD_LABELS["pre"],
        PERIOD_LABELS["pos"],
    )


def classify_regime_regulatorio(ano: pd.Series) -> pd.Series:
    """Classifica ano no regime normativo auditavel."""
    ano_num = pd.to_numeric(ano, errors="coerce")
    return np.select(
        [
            ano_num <= REN1000_CUTOFF_YEAR,
            ano_num >= REN1000_CUTOFF_YEAR + 1,
        ],
        ["REN_414", "REN_1000"],
        default="TRANSICAO",
    )


def apply_standard_metrics(df: pd.DataFrame, uc_col: str = "uc_ativa_mes") -> pd.DataFrame:
    """Aplica todas as métricas derivadas padrão a um DataFrame.

    Espera colunas: qtd_fora_prazo, qtd_serv_realizado (ou qtd_serv),
    compensacao_rs, e a coluna de UC indicada por uc_col.

    Retorna o DataFrame com colunas adicionadas in-place.
    """
    serv_col = "qtd_serv_realizado" if "qtd_serv_realizado" in df.columns else "qtd_serv"
    uc = df[uc_col] if uc_col in df.columns else pd.Series(np.nan, index=df.index)

    df["taxa_fora_prazo"] = calc_taxa_fora_prazo(df["qtd_fora_prazo"], df[serv_col])
    df["fora_prazo_por_100k_uc_mes"] = calc_fora_prazo_por_100k(df["qtd_fora_prazo"], uc)
    df["compensacao_rs_por_uc_mes"] = calc_compensacao_por_uc(df["compensacao_rs"], uc)
    df["compensacao_media_por_transgressao"] = calc_compensacao_media_por_transgressao(
        df["compensacao_rs"], df["qtd_fora_prazo"]
    )
    return df
