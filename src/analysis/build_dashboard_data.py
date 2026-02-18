"""Build JSON data file for the interactive dashboard.

Usage:
    python -m src.analysis.build_dashboard_data
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
DIR_NEO = DIR_ANALYSIS / "neoenergia"
DASHBOARD_DIR = ROOT / "dashboard"
OUTPUT_PATH = DASHBOARD_DIR / "dashboard_data.json"


def _safe(v):
    """Convert numpy/pandas types to JSON-safe Python types."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        if np.isnan(v) or np.isinf(v):
            return None
        return round(float(v), 6)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if pd.isna(v):
        return None
    return v


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to list of dicts with safe types."""
    records = []
    for _, row in df.iterrows():
        records.append({k: _safe(v) for k, v in row.items()})
    return records


def _read(name: str, subdir: str | None = None) -> pd.DataFrame:
    base = DIR_NEO if subdir == "neoenergia" else DIR_ANALYSIS
    path = base / f"{name}.csv"
    if not path.exists():
        print(f"  ⚠ Arquivo não encontrado: {path}")
        return pd.DataFrame()
    return pd.read_csv(path)


def build_kpi_overview(kpi: pd.DataFrame) -> dict:
    """Build KPI summary: pre vs post REN 1000."""
    if kpi.empty:
        return {}

    pre = kpi[kpi["periodo_regulatorio"] == "pre_2022"]
    pos = kpi[kpi["periodo_regulatorio"] == "pos_2022"]

    pre_taxa = pre["taxa_fora_prazo"].mean() if len(pre) > 0 else 0
    pos_taxa = pos["taxa_fora_prazo"].mean() if len(pos) > 0 else 0
    pre_comp = pre["compensacao_rs"].sum() if len(pre) > 0 else 0
    pos_comp = pos["compensacao_rs"].sum() if len(pos) > 0 else 0
    pre_serv = pre["qtd_serv"].sum() if len(pre) > 0 else 0
    pos_serv = pos["qtd_serv"].sum() if len(pos) > 0 else 0
    pre_fora = pre["qtd_fora_prazo"].sum() if len(pre) > 0 else 0
    pos_fora = pos["qtd_fora_prazo"].sum() if len(pos) > 0 else 0

    return {
        "pre_taxa_media": _safe(pre_taxa),
        "pos_taxa_media": _safe(pos_taxa),
        "delta_taxa": _safe(pos_taxa - pre_taxa),
        "pre_compensacao_total": _safe(pre_comp),
        "pos_compensacao_total": _safe(pos_comp),
        "delta_compensacao": _safe(pos_comp - pre_comp),
        "pre_servicos_total": _safe(pre_serv),
        "pos_servicos_total": _safe(pos_serv),
        "pre_fora_prazo_total": _safe(pre_fora),
        "pos_fora_prazo_total": _safe(pos_fora),
        "anos_pre": sorted(pre["ano"].unique().tolist()),
        "anos_pos": sorted(pos["ano"].unique().tolist()),
    }


def build_serie_anual(kpi: pd.DataFrame) -> list[dict]:
    """Annual time series for the main line/bar chart."""
    if kpi.empty:
        return []
    kpi = kpi.sort_values("ano")
    return _df_to_records(kpi)


def build_neo_anual(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    df = df.sort_values(["ano", "neo_distribuidora"])
    return _df_to_records(df)


def build_neo_tendencia(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return _df_to_records(df)


def build_neo_benchmark(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    df = df.sort_values("rank_porte_neo")
    return _df_to_records(df)


def build_neo_classe_local(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return _df_to_records(df)


def build_neo_longa(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return _df_to_records(df)


def build_neo_mensal(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    df = df.sort_values(["ano", "mes", "neo_distribuidora"])
    return _df_to_records(df)


def build_fato_mensal_distribuidora(df: pd.DataFrame) -> list[dict]:
    """Monthly transgression data for all distributors (for the monthly view)."""
    if df.empty:
        return []
    df = df.sort_values(["ano", "mes", "sigagente"])
    # Only keep useful columns to reduce JSON size
    cols = [
        "ano", "mes", "sigagente", "nomagente", "uc_ativa_mes",
        "qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs",
        "taxa_fora_prazo", "fora_prazo_por_100k_uc_mes",
        "compensacao_rs_por_uc_mes", "bucket_porte",
    ]
    available = [c for c in cols if c in df.columns]
    return _df_to_records(df[available])


def main():
    print("🔧 Gerando dados para o dashboard...")

    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)

    # Load CSVs
    kpi = _read("kpi_regulatorio_anual")
    fato_mensal = _read("fato_transgressao_mensal_distribuidora")
    neo_anual = _read("neo_anual_2023_2025", "neoenergia")
    neo_tendencia = _read("neo_tendencia_2023_2025", "neoenergia")
    neo_benchmark = _read("neo_benchmark_porte_latest", "neoenergia")
    neo_classe = _read("neo_classe_local_2023_2025", "neoenergia")
    neo_longa = _read("neo_longa_resumo_2011_2023", "neoenergia")
    neo_mensal = _read("neo_mensal_2023_2025", "neoenergia")

    # Build dashboard JSON
    data = {
        "meta": {
            "generated_at": pd.Timestamp.now().isoformat(),
            "project": "TCC — Análise REN 1000/2021 ANEEL",
        },
        "kpi_overview": build_kpi_overview(kpi),
        "serie_anual": build_serie_anual(kpi),
        "serie_mensal_nacional": build_fato_mensal_distribuidora(fato_mensal),
        "neo_anual": build_neo_anual(neo_anual),
        "neo_tendencia": build_neo_tendencia(neo_tendencia),
        "neo_benchmark": build_neo_benchmark(neo_benchmark),
        "neo_classe_local": build_neo_classe_local(neo_classe),
        "neo_longa_resumo": build_neo_longa(neo_longa),
        "neo_mensal": build_neo_mensal(neo_mensal),
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"✅ Arquivo gerado: {OUTPUT_PATH} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
