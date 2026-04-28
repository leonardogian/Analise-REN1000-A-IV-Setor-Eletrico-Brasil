"""Build JSON data file for the interactive dashboard of Transgressions & Groups."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.analysis.distributor_groups import to_group_objects, build_group_dimension

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
DIR_OUT = ROOT / "data" / "processed" / "dashboard"
LEGACY_DIR_OUT = ROOT / "app" / "frontend"


def _safe_float(v: object) -> float:
    if pd.isna(v) or np.isinf(v):
        return 0.0
    return float(v)


def _write_dashboard_json(file_name: str, payload: object) -> Path:
    """Write canonical dashboard JSON and mirror it for the legacy static app."""
    DIR_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path = DIR_OUT / file_name
    path.write_text(text, encoding="utf-8")

    if LEGACY_DIR_OUT.exists():
        (LEGACY_DIR_OUT / file_name).write_text(text, encoding="utf-8")

    return path


def load_fato_porte() -> pd.DataFrame:
    """Load the monthly transgressions data segmented by class/location."""
    csv_path = DIR_ANALYSIS / "fato_transgressao_mensal_porte.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)

    parquet_path = DIR_ANALYSIS / "fato_transgressao_mensal_porte.parquet"
    if parquet_path.exists() and parquet_path.stat().st_size > 0:
        return pd.read_parquet(parquet_path)

    raise FileNotFoundError(f"Missing required input table: {csv_path}")


def build_dashboard_data():
    """Build the JSON context for the dashboard."""
    df = load_fato_porte()
    
    # Filter only comparable years (2023, 2024, 2025)
    df = df[df["ano_comparavel_principal"] == True].copy()
    
    # 1. Monthly Time-Series grouped by distributor
    monthly_series = []
    
    # Grouping by Distributor & Month
    # We want to keep track of Rural/Urban context explicitly or implicitly.
    # The requested output structure is:
    # {"mes": "Jan/24", "distribuidora": "X", "holding": "Y", "valor_pago": 50k, "qtd_transgressoes": 120, "is_rural": true}
    
    month_names = {
        1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
        7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
    }

    # First, let's aggregate at the required grain: Ano, Mes, Group, Distributor, Rural/Não-Rural
    df["is_rural"] = df["classe_local_servico"].fillna("").str.lower().str.contains("rural|agro", na=False)
    
    agg = df.groupby(
        ["ano", "mes", "group_id", "distributor_name_sig", "distributor_label", "is_rural"]
    , dropna=False).agg({
        "compensacao_rs": "sum",
        "qtd_fora_prazo": "sum"
    }).reset_index()

    for _, row in agg.iterrows():
        mes_label = f"{month_names.get(int(row['mes']), str(row['mes']))}/{str(row['ano'])[-2:]}"
        monthly_series.append({
            "mes": mes_label,
            "ano": int(row["ano"]),
            "mes_num": int(row["mes"]),
            "holding": str(row["group_id"]),
            "distribuidora": str(row["distributor_name_sig"]),
            "distribuidora_label": str(row["distributor_label"]),
            "valor_pago": _safe_float(row["compensacao_rs"]),
            "qtd_transgressoes": int(row["qtd_fora_prazo"] if not pd.isna(row["qtd_fora_prazo"]) else 0),
            "is_rural": bool(row["is_rural"])
        })

    # Sort the series chronologically
    monthly_series.sort(key=lambda x: (x["ano"], x["mes_num"], x["holding"], x["distribuidora"], x["is_rural"]))

    # We discard ano and mes_num for the final JSON to save space if needed, or keep them for frontend sorting.
    
    # 2. Extract unique distributor dimensions
    # For UI dropdowns and filters
    dim_group = build_group_dimension(df)
    groups = to_group_objects(dim_group)
    
    groups_json = []
    for g in groups:
        groups_json.append({
            "id": g.group_id,
            "label": g.group_label,
            "enabled": g.selector_enabled,
            "distribuidoras": [{"id": d_id, "label": d_name} for d_id, d_name in zip(g.distributor_ids, g.distributor_names)]
        })

    # 3. Insights (Ponto de Inflexão e Comparativo Rural)
    # Ponto de Inflexão (Highest jump in transgressions month over month globally)
    global_monthly = agg.groupby(["ano", "mes"])["qtd_fora_prazo"].sum().reset_index().sort_values(["ano", "mes"])
    global_monthly["diff"] = global_monthly["qtd_fora_prazo"].diff()
    
    inflection_point = None
    if not global_monthly.empty and len(global_monthly) > 1:
        max_jump_idx = global_monthly["diff"].idxmax()
        if not pd.isna(max_jump_idx):
            jump_row = global_monthly.loc[max_jump_idx]
            inflection_point = {
                "mes": f"{month_names.get(int(jump_row['mes']), str(jump_row['mes']))}/{str(jump_row['ano'])[-2:]}",
                "salto_transgressoes": int(jump_row["diff"])
            }

    # Rural Fines insight
    # Groups with highest proportion of rural fines
    rural_totals = agg.groupby("group_id").apply(
        lambda g: g[g["is_rural"]]["compensacao_rs"].sum() / g["compensacao_rs"].sum() if g["compensacao_rs"].sum() > 0 else 0
    ).to_dict()

    top_rural_groups = sorted(rural_totals.items(), key=lambda x: x[1], reverse=True)[:3]
    top_rural_insights = [
        {"holding": g_id, "rural_share": _safe_float(share)} for g_id, share in top_rural_groups
    ]

    output = {
        "series": monthly_series,
        "groups": groups_json,
        "insights": {
            "inflection_point": inflection_point,
            "top_rural_groups": top_rural_insights
        }
    }

    out_path = _write_dashboard_json("dashboard_transgressoes.json", output)
    
    print(f"Generated dashboard data at {out_path}")


def main():
    build_dashboard_data()


if __name__ == "__main__":
    main()
