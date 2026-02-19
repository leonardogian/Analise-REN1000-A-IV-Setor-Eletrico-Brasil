"""Build JSON data file for the interactive dashboard."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
DIR_GROUPS = DIR_ANALYSIS / "grupos"
DASHBOARD_DIR = ROOT / "dashboard"
OUTPUT_PATH = DASHBOARD_DIR / "dashboard_data.json"

REQUIRED_INPUT_FILES = [
    DIR_ANALYSIS / "kpi_regulatorio_anual.csv",
    DIR_ANALYSIS / "fato_transgressao_mensal_distribuidora.csv",
    DIR_ANALYSIS / "fato_transgressao_mensal_porte.csv",
    DIR_ANALYSIS / "fato_indicadores_anuais.csv",
    DIR_ANALYSIS / "dim_distributor_group.csv",
    DIR_ANALYSIS / "dim_distribuidora_porte.csv",
    DIR_GROUPS / "grupos_anual_2023_2025.csv",
    DIR_GROUPS / "grupos_tendencia_2023_2025.csv",
    DIR_GROUPS / "grupos_benchmark_porte_latest.csv",
    DIR_GROUPS / "grupos_classe_local_2023_2025.csv",
    DIR_GROUPS / "grupos_longa_resumo_2011_2023.csv",
    DIR_GROUPS / "grupos_mensal_2023_2025.csv",
]

REQUIRED_NON_EMPTY_SECTIONS = [
    "serie_anual",
    "serie_mensal_nacional",
    "distributor_groups",
    "group_views",
    "regulatory_groups",
    "regulatory_views",
    "top20_distributors",
]

REGULATORY_ORDER = ["grupo_a", "grupo_b", "rural", "urbana", "nao_classificado"]
REGULATORY_LABELS = {
    "grupo_a": "Grupo A",
    "grupo_b": "Grupo B",
    "rural": "Rural",
    "urbana": "Urbana",
    "nao_classificado": "Não classificado",
}
FEATURED_TOP_N = 6
FEATURED_REQUIRED_GROUPS = ("equatorial", "cpfl", "neoenergia")


def _safe(v):
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
    records: list[dict] = []
    for _, row in df.iterrows():
        records.append({k: _safe(v) for k, v in row.items()})
    return records


def _read(name: str, subdir: str | None = None) -> pd.DataFrame:
    base = DIR_GROUPS if subdir == "grupos" else DIR_ANALYSIS
    path = base / f"{name}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Arquivo obrigatório não encontrado: {path}")
    return pd.read_csv(path)


def validate_required_inputs() -> None:
    missing = [str(path) for path in REQUIRED_INPUT_FILES if not path.exists()]
    if missing:
        msg = "Entradas obrigatórias ausentes para gerar o dashboard:\n"
        msg += "\n".join(f" - {path}" for path in missing)
        raise FileNotFoundError(msg)


def validate_non_empty_sections(data: dict) -> None:
    empty_sections = []
    for key in REQUIRED_NON_EMPTY_SECTIONS:
        if key not in data:
            empty_sections.append(key)
            continue
        value = data[key]
        if isinstance(value, dict) and len(value) == 0:
            empty_sections.append(key)
        if isinstance(value, list) and len(value) == 0:
            empty_sections.append(key)
    if empty_sections:
        msg = "Seções obrigatórias do dashboard vazias:\n"
        msg += "\n".join(f" - {section}" for section in empty_sections)
        raise RuntimeError(msg)


def compose_distributor_label(sig: object, legal: object) -> str:
    sig_text = str(sig or "").strip()
    legal_text = str(legal or "").strip()
    if not sig_text:
        return legal_text
    if not legal_text or sig_text == legal_text:
        return sig_text
    return f"{sig_text} — {legal_text}"


def ensure_label_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "distributor_name_sig" not in out.columns:
        if "sigagente" in out.columns:
            out["distributor_name_sig"] = out["sigagente"].astype("string").fillna("")
        else:
            out["distributor_name_sig"] = ""
    if "distributor_name_legal" not in out.columns:
        if "nomagente" in out.columns:
            out["distributor_name_legal"] = out["nomagente"].astype("string").fillna(out["distributor_name_sig"])
        else:
            out["distributor_name_legal"] = out["distributor_name_sig"]
    if "distributor_label" not in out.columns:
        out["distributor_label"] = [
            compose_distributor_label(sig, legal)
            for sig, legal in zip(out["distributor_name_sig"].tolist(), out["distributor_name_legal"].tolist())
        ]
    return out


def build_kpi_overview(kpi: pd.DataFrame) -> dict:
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
    if kpi.empty:
        return []
    return _df_to_records(kpi.sort_values("ano"))


def build_fato_mensal_distribuidora(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    df = ensure_label_columns(df)
    cols = [
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "sigagente",
        "nomagente",
        "distributor_name_sig",
        "distributor_name_legal",
        "distributor_label",
        "uc_ativa_mes",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
        "fora_prazo_por_100k_uc_mes",
        "compensacao_rs_por_uc_mes",
        "bucket_porte",
    ]
    available = [c for c in cols if c in df.columns]
    return _df_to_records(df.sort_values(["ano", "mes", "group_id", "distributor_id"])[available])


def build_distributor_groups(dim_group: pd.DataFrame, annual: pd.DataFrame) -> list[dict]:
    dim_group = ensure_label_columns(dim_group)
    years_by_group = (
        annual.groupby("group_id")["ano"]
        .apply(lambda s: sorted(int(v) for v in s.dropna().unique().tolist()))
        .to_dict()
    )
    rows: list[dict] = []
    for (_, group_label, selector_enabled), grp in dim_group.groupby(
        ["group_id", "group_label", "selector_enabled"],
        dropna=False,
    ):
        group_id = str(grp["group_id"].iloc[0])
        rows.append(
            {
                "group_id": group_id,
                "group_label": str(group_label),
                "distributor_count": int(grp["distributor_id"].nunique()),
                "selector_enabled": bool(selector_enabled),
                "distributor_ids": sorted(grp["distributor_id"].astype(str).unique().tolist()),
                "distributor_names": sorted(grp["distributor_label"].astype(str).unique().tolist()),
                "years": years_by_group.get(group_id, []),
            }
        )
    return sorted(rows, key=lambda r: (-r["distributor_count"], r["group_label"]))


def _group_records(df: pd.DataFrame, sort_cols: list[str]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    if df.empty:
        return grouped
    frame = ensure_label_columns(df)
    for group_id, grp in frame.groupby("group_id"):
        cols = [c for c in sort_cols if c in grp.columns]
        view = grp.sort_values(cols).drop(columns=["group_id"], errors="ignore")
        grouped[str(group_id)] = _df_to_records(view)
    return grouped


def build_group_views(
    annual: pd.DataFrame,
    trend: pd.DataFrame,
    benchmark: pd.DataFrame,
    classe: pd.DataFrame,
    longa: pd.DataFrame,
    mensal: pd.DataFrame,
) -> dict[str, dict]:
    annual_map = _group_records(annual, ["distributor_label", "ano"])
    trend_map = _group_records(trend, ["distributor_label"])
    bench_map = _group_records(benchmark, ["rank_porte_grupo"])
    classe_map = _group_records(classe, ["distributor_label", "qtd_fora_prazo"])
    longa_map = _group_records(longa, ["distributor_label"])
    mensal_map = _group_records(mensal, ["ano", "mes", "distributor_label"])

    group_ids = sorted(
        set(annual_map.keys())
        | set(trend_map.keys())
        | set(bench_map.keys())
        | set(classe_map.keys())
        | set(longa_map.keys())
        | set(mensal_map.keys())
    )

    views: dict[str, dict] = {}
    for group_id in group_ids:
        views[group_id] = {
            "anual": annual_map.get(group_id, []),
            "tendencia": trend_map.get(group_id, []),
            "benchmark": bench_map.get(group_id, []),
            "classe_local": classe_map.get(group_id, []),
            "longa_resumo": longa_map.get(group_id, []),
            "mensal": mensal_map.get(group_id, []),
        }
    return views


def choose_default_group_id(
    distributor_groups: list[dict],
    benchmark: pd.DataFrame,
) -> str | None:
    if not distributor_groups:
        return None
    if not benchmark.empty and "uc_ativa_media_ano" in benchmark.columns:
        by_uc = (
            benchmark.groupby("group_id", as_index=False)["uc_ativa_media_ano"]
            .sum()
            .sort_values("uc_ativa_media_ano", ascending=False)
        )
        if not by_uc.empty:
            return str(by_uc.iloc[0]["group_id"])

    group_ids = [str(item["group_id"]) for item in distributor_groups]
    if "neoenergia" in group_ids:
        return "neoenergia"
    return sorted(group_ids)[0]


def select_featured_group_ids(
    distributor_groups: list[dict],
    benchmark: pd.DataFrame,
    *,
    top_n: int = FEATURED_TOP_N,
    required_groups: tuple[str, ...] = FEATURED_REQUIRED_GROUPS,
) -> list[str]:
    available = {str(item.get("group_id")) for item in distributor_groups}
    selected: list[str] = []

    if not benchmark.empty and "uc_ativa_media_ano" in benchmark.columns:
        by_uc = (
            benchmark.groupby("group_id", as_index=False)["uc_ativa_media_ano"]
            .sum()
            .sort_values("uc_ativa_media_ano", ascending=False)
        )
        selected.extend(
            str(gid)
            for gid in by_uc["group_id"].head(top_n).tolist()
            if str(gid) in available
        )

    if not selected:
        selected.extend(
            str(item["group_id"])
            for item in sorted(distributor_groups, key=lambda row: row.get("distributor_count", 0), reverse=True)[:top_n]
        )

    for gid in required_groups:
        if gid in available and gid not in selected:
            selected.append(gid)

    deduped: list[str] = []
    for gid in selected:
        if gid in available and gid not in deduped:
            deduped.append(gid)
    return deduped


def build_featured_groups(distributor_groups: list[dict], featured_ids: list[str]) -> list[dict]:
    lookup = {str(item.get("group_id")): item for item in distributor_groups}
    return [lookup[gid] for gid in featured_ids if gid in lookup]


def build_featured_group_compare_anual(
    annual: pd.DataFrame,
    featured_ids: list[str],
    distributor_groups: list[dict],
) -> list[dict]:
    if annual.empty or not featured_ids:
        return []

    frame = annual[annual["group_id"].astype(str).isin(featured_ids)].copy()
    if frame.empty:
        return []

    grouped = (
        frame.groupby(["group_id", "ano"], as_index=False)
        .agg(
            distributor_count=("distributor_id", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("exposicao_uc_mes", "sum"),
            uc_ativa_media_ano=("uc_ativa_media_ano", "sum"),
        )
    )
    grouped["taxa_fora_prazo"] = np.where(
        grouped["qtd_serv_realizado"] > 0,
        grouped["qtd_fora_prazo"] / grouped["qtd_serv_realizado"],
        np.nan,
    )
    grouped["fora_prazo_por_100k_uc_mes"] = np.where(
        grouped["exposicao_uc_mes"] > 0,
        grouped["qtd_fora_prazo"] / grouped["exposicao_uc_mes"] * 100000.0,
        np.nan,
    )
    grouped["compensacao_rs_por_uc_mes"] = np.where(
        grouped["exposicao_uc_mes"] > 0,
        grouped["compensacao_rs"] / grouped["exposicao_uc_mes"],
        np.nan,
    )

    label_lookup = {str(item.get("group_id")): str(item.get("group_label", item.get("group_id"))) for item in distributor_groups}
    grouped["group_label"] = grouped["group_id"].map(lambda gid: label_lookup.get(str(gid), str(gid)))
    grouped["group_id"] = grouped["group_id"].astype(str)
    grouped["group_order"] = grouped["group_id"].map(lambda gid: featured_ids.index(gid) if gid in featured_ids else 999)
    grouped = grouped.sort_values(["group_order", "ano"]).drop(columns=["group_order"])
    return _df_to_records(grouped)


def build_featured_group_compare_latest(featured_anual: list[dict]) -> list[dict]:
    if not featured_anual:
        return []
    frame = pd.DataFrame(featured_anual)
    if frame.empty or "ano" not in frame.columns:
        return []
    latest_year = int(pd.to_numeric(frame["ano"], errors="coerce").dropna().max())
    latest = frame[pd.to_numeric(frame["ano"], errors="coerce") == latest_year].copy()
    if latest.empty:
        return []
    latest["rank_fora_100k"] = latest["fora_prazo_por_100k_uc_mes"].rank(method="min", ascending=True)
    latest["rank_comp_uc"] = latest["compensacao_rs_por_uc_mes"].rank(method="min", ascending=True)
    latest = latest.sort_values("fora_prazo_por_100k_uc_mes", ascending=True)
    return _df_to_records(latest)


def build_legacy_neo_alias(group_views: dict[str, dict]) -> dict[str, list[dict]]:
    empty = {
        "neo_anual": [],
        "neo_tendencia": [],
        "neo_benchmark": [],
        "neo_classe_local": [],
        "neo_longa_resumo": [],
        "neo_mensal": [],
    }
    neo = group_views.get("neoenergia")
    if not neo:
        return empty

    def rename(records: list[dict], rename_map: dict[str, str], drop: set[str]) -> list[dict]:
        out: list[dict] = []
        for record in records:
            row = {k: v for k, v in record.items() if k not in drop}
            for old, new in rename_map.items():
                if old in row:
                    row[new] = row.pop(old)
            out.append(row)
        return out

    return {
        "neo_anual": rename(
            neo.get("anual", []),
            {"distributor_label": "neo_distribuidora"},
            {"group_label", "distributor_id"},
        ),
        "neo_tendencia": rename(
            neo.get("tendencia", []),
            {"distributor_label": "neo_distribuidora"},
            {"group_label", "distributor_id"},
        ),
        "neo_benchmark": rename(
            neo.get("benchmark", []),
            {
                "distributor_label": "neo_distribuidora",
                "rank_porte_grupo": "rank_porte_neo",
                "indice_fora_vs_mediana_grupo": "indice_fora_vs_mediana_neo",
                "indice_comp_vs_mediana_grupo": "indice_comp_vs_mediana_neo",
            },
            {"group_label", "distributor_id"},
        ),
        "neo_classe_local": rename(
            neo.get("classe_local", []),
            {"distributor_label": "neo_distribuidora"},
            {"group_label", "distributor_id"},
        ),
        "neo_longa_resumo": rename(
            neo.get("longa_resumo", []),
            {"distributor_label": "neo_distribuidora"},
            {"group_label", "distributor_id"},
        ),
        "neo_mensal": rename(
            neo.get("mensal", []),
            {"distributor_label": "neo_distribuidora"},
            {"group_label", "distributor_id"},
        ),
    }


def normalize_regulatory_class(value: object) -> str:
    key = str(value or "").strip().lower()
    if key in {"grupo_b", "grupo_b_rural", "grupo_b_urbana"}:
        return "grupo_b"
    if key in REGULATORY_LABELS:
        return key
    return "nao_classificado"


def aggregate_regulatory_monthly(frame: pd.DataFrame, class_id: str) -> pd.DataFrame:
    monthly = frame[frame["regulatory_class"] == class_id].copy()
    if monthly.empty:
        return monthly
    keys = [
        "ano",
        "mes",
        "distributor_id",
        "sigagente",
        "nomagente",
        "distributor_name_sig",
        "distributor_name_legal",
        "distributor_label",
    ]
    grouped = (
        monthly.groupby(keys, as_index=False)
        .agg(
            uc_ativa_mes=("uc_ativa_mes", "sum"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            uc_ativa_media_mensal=("uc_ativa_media_mensal", "mean"),
        )
    )
    grouped["taxa_fora_prazo"] = np.where(
        grouped["qtd_serv_realizado"] > 0,
        grouped["qtd_fora_prazo"] / grouped["qtd_serv_realizado"],
        np.nan,
    )
    grouped["fora_prazo_por_100k_uc_mes"] = np.where(
        grouped["uc_ativa_mes"] > 0,
        grouped["qtd_fora_prazo"] / grouped["uc_ativa_mes"] * 100000.0,
        np.nan,
    )
    grouped["compensacao_rs_por_uc_mes"] = np.where(
        grouped["uc_ativa_mes"] > 0,
        grouped["compensacao_rs"] / grouped["uc_ativa_mes"],
        np.nan,
    )
    return grouped.sort_values(["distributor_label", "ano", "mes"]).reset_index(drop=True)


def aggregate_regulatory_annual(monthly: pd.DataFrame) -> pd.DataFrame:
    if monthly.empty:
        return monthly
    annual = (
        monthly.groupby(
            [
                "distributor_id",
                "sigagente",
                "nomagente",
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
                "ano",
            ],
            as_index=False,
        )
        .agg(
            meses_com_dados=("mes", "nunique"),
            uc_ativa_media_ano=("uc_ativa_mes", "mean"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    annual["taxa_fora_prazo"] = np.where(
        annual["qtd_serv_realizado"] > 0,
        annual["qtd_fora_prazo"] / annual["qtd_serv_realizado"],
        np.nan,
    )
    annual["fora_prazo_por_100k_uc_mes"] = np.where(
        annual["exposicao_uc_mes"] > 0,
        annual["qtd_fora_prazo"] / annual["exposicao_uc_mes"] * 100000.0,
        np.nan,
    )
    annual["compensacao_rs_por_uc_mes"] = np.where(
        annual["exposicao_uc_mes"] > 0,
        annual["compensacao_rs"] / annual["exposicao_uc_mes"],
        np.nan,
    )
    return annual.sort_values(["distributor_label", "ano"]).reset_index(drop=True)


def build_regulatory_trend(annual: pd.DataFrame, base_year: int = 2023, last_year: int = 2025) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if annual.empty:
        return pd.DataFrame(rows)
    for distributor_id, grp in annual.groupby("distributor_id"):
        by_year = grp.set_index("ano")
        first = grp.iloc[0]
        r: dict[str, object] = {
            "distributor_id": distributor_id,
            "distributor_label": first["distributor_label"],
            "distributor_name_sig": first["distributor_name_sig"],
            "distributor_name_legal": first["distributor_name_legal"],
            "sigagente": first["sigagente"],
            "nomagente": first["nomagente"],
        }
        for metric in ["taxa_fora_prazo", "fora_prazo_por_100k_uc_mes", "compensacao_rs_por_uc_mes"]:
            base_val = by_year.at[base_year, metric] if base_year in by_year.index else np.nan
            last_val = by_year.at[last_year, metric] if last_year in by_year.index else np.nan
            r[f"{metric}_{base_year}"] = base_val
            r[f"{metric}_{last_year}"] = last_val
            r[f"delta_{metric}_abs"] = last_val - base_val if pd.notna(base_val) and pd.notna(last_val) else np.nan
            r[f"delta_{metric}_pct"] = (
                (last_val / base_val - 1.0)
                if pd.notna(base_val) and pd.notna(last_val) and base_val != 0
                else np.nan
            )
        rows.append(r)
    return pd.DataFrame(rows).sort_values("distributor_label").reset_index(drop=True)


def build_regulatory_benchmark(annual: pd.DataFrame) -> pd.DataFrame:
    if annual.empty:
        return annual
    latest_year = int(annual["ano"].max())
    latest = annual[annual["ano"] == latest_year].copy()
    latest = latest.sort_values("uc_ativa_media_ano", ascending=False).reset_index(drop=True)
    latest["rank_porte_grupo"] = latest.index + 1
    med_fora = latest["fora_prazo_por_100k_uc_mes"].median()
    med_comp = latest["compensacao_rs_por_uc_mes"].median()
    latest["indice_fora_vs_mediana_grupo"] = np.where(
        med_fora > 0,
        latest["fora_prazo_por_100k_uc_mes"] / med_fora,
        np.nan,
    )
    latest["indice_comp_vs_mediana_grupo"] = np.where(
        med_comp > 0,
        latest["compensacao_rs_por_uc_mes"] / med_comp,
        np.nan,
    )
    return latest


def build_regulatory_class_distribution(frame: pd.DataFrame, selected_class: str) -> pd.DataFrame:
    monthly = frame[frame["regulatory_class"] == selected_class]
    if monthly.empty:
        return pd.DataFrame()
    selected_distributors = set(monthly["distributor_id"].astype(str).tolist())
    subset = frame[frame["distributor_id"].astype(str).isin(selected_distributors)].copy()
    grouped = (
        subset.groupby(
            [
                "distributor_id",
                "distributor_label",
                "distributor_name_sig",
                "distributor_name_legal",
                "regulatory_class",
            ],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
    )
    grouped["taxa_fora_prazo"] = np.where(
        grouped["qtd_serv_realizado"] > 0,
        grouped["qtd_fora_prazo"] / grouped["qtd_serv_realizado"],
        np.nan,
    )
    grouped["fora_prazo_por_100k_uc_mes"] = np.where(
        grouped["exposicao_uc_mes"] > 0,
        grouped["qtd_fora_prazo"] / grouped["exposicao_uc_mes"] * 100000.0,
        np.nan,
    )
    grouped["compensacao_rs_por_uc_mes"] = np.where(
        grouped["exposicao_uc_mes"] > 0,
        grouped["compensacao_rs"] / grouped["exposicao_uc_mes"],
        np.nan,
    )
    totals = grouped.groupby("distributor_id")[["qtd_fora_prazo", "compensacao_rs"]].transform("sum")
    grouped["share_fora_prazo"] = np.where(
        totals["qtd_fora_prazo"] > 0,
        grouped["qtd_fora_prazo"] / totals["qtd_fora_prazo"],
        np.nan,
    )
    grouped["share_compensacao"] = np.where(
        totals["compensacao_rs"] > 0,
        grouped["compensacao_rs"] / totals["compensacao_rs"],
        np.nan,
    )
    grouped["classe_local_servico"] = grouped["regulatory_class"].map(
        lambda x: REGULATORY_LABELS.get(str(x), str(x))
    )
    return grouped.sort_values(["distributor_label", "qtd_fora_prazo"], ascending=[True, False]).reset_index(drop=True)


def build_regulatory_long_summary(indicadores: pd.DataFrame, class_id: str) -> pd.DataFrame:
    if indicadores.empty:
        return pd.DataFrame()
    long_base = indicadores.copy()
    long_base["regulatory_class"] = long_base["classe_local"].map(normalize_regulatory_class)
    long_base = long_base[(long_base["regulatory_class"] == class_id) & (long_base["ano"] <= 2023)].copy()
    if long_base.empty:
        return pd.DataFrame()

    annual = (
        long_base.groupby(
            [
                "distributor_id",
                "distributor_label",
                "distributor_name_sig",
                "distributor_name_legal",
                "ano",
            ],
            as_index=False,
        )
        .agg(
            qtd_serv=("qtd_serv", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    annual["taxa_fora_prazo"] = np.where(
        annual["qtd_serv"] > 0,
        annual["qtd_fora_prazo"] / annual["qtd_serv"],
        np.nan,
    )

    rows: list[dict[str, object]] = []
    for distributor_id, grp in annual.groupby("distributor_id"):
        if grp.empty:
            continue
        grp = grp.sort_values("ano")
        start = grp.iloc[0]
        end = grp.iloc[-1]
        if pd.isna(start["taxa_fora_prazo"]) or pd.isna(end["taxa_fora_prazo"]):
            continue
        rows.append(
            {
                "distributor_id": distributor_id,
                "distributor_label": start["distributor_label"],
                "distributor_name_sig": start["distributor_name_sig"],
                "distributor_name_legal": start["distributor_name_legal"],
                "ano_inicio": int(start["ano"]),
                "ano_fim": int(end["ano"]),
                "taxa_inicio": float(start["taxa_fora_prazo"]),
                "taxa_fim": float(end["taxa_fora_prazo"]),
                "delta_taxa_abs": float(end["taxa_fora_prazo"] - start["taxa_fora_prazo"]),
                "delta_taxa_pct": (
                    float(end["taxa_fora_prazo"] / start["taxa_fora_prazo"] - 1.0)
                    if start["taxa_fora_prazo"] != 0
                    else np.nan
                ),
                "compensacao_inicio": float(start["compensacao_rs"]),
                "compensacao_fim": float(end["compensacao_rs"]),
                "delta_comp_abs": float(end["compensacao_rs"] - start["compensacao_rs"]),
                "delta_comp_pct": (
                    float(end["compensacao_rs"] / start["compensacao_rs"] - 1.0)
                    if start["compensacao_rs"] != 0
                    else np.nan
                ),
            }
        )
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values("distributor_label").reset_index(drop=True)


def build_regulatory_views(monthly_porte: pd.DataFrame, indicadores: pd.DataFrame) -> tuple[list[dict], dict[str, dict], str | None]:
    monthly_porte = ensure_label_columns(monthly_porte)
    indicadores = ensure_label_columns(indicadores)
    base = monthly_porte.copy()
    base["regulatory_class"] = base["classe_local_servico"].map(normalize_regulatory_class)
    indicadores_base = indicadores.copy()
    indicadores_base["regulatory_class"] = indicadores_base["classe_local"].map(normalize_regulatory_class)

    groups: list[dict] = []
    views: dict[str, dict] = {}

    for class_id in REGULATORY_ORDER:
        mensal = aggregate_regulatory_monthly(base, class_id)
        anual = aggregate_regulatory_annual(mensal)
        tendencia = build_regulatory_trend(anual)
        benchmark = build_regulatory_benchmark(anual)
        classe_local = build_regulatory_class_distribution(base, class_id)
        longa_resumo = build_regulatory_long_summary(indicadores, class_id)
        historical = indicadores_base[indicadores_base["regulatory_class"] == class_id].copy()
        annual_coverage = not historical.empty
        has_any_data = any(
            [
                not mensal.empty,
                not anual.empty,
                not tendencia.empty,
                not benchmark.empty,
                not classe_local.empty,
                not longa_resumo.empty,
                annual_coverage,
            ]
        )

        views[class_id] = {
            "anual": _df_to_records(anual),
            "tendencia": _df_to_records(tendencia),
            "benchmark": _df_to_records(benchmark),
            "classe_local": _df_to_records(classe_local),
            "longa_resumo": _df_to_records(longa_resumo),
            "mensal": _df_to_records(mensal),
        }

        years = sorted(int(v) for v in anual["ano"].dropna().unique().tolist()) if not anual.empty else []
        historical_years = (
            sorted(int(v) for v in historical["ano"].dropna().unique().tolist()) if annual_coverage and "ano" in historical.columns else []
        )
        groups.append(
            {
                "class_id": class_id,
                "class_label": REGULATORY_LABELS[class_id],
                "distributor_count": int(mensal["distributor_id"].nunique()) if not mensal.empty else 0,
                "monthly_coverage": not mensal.empty,
                "annual_coverage": annual_coverage,
                "selector_enabled": has_any_data,
                "years": years,
                "historical_years": historical_years,
            }
        )

    default_regulatory_id = None
    for preferred in ["urbana", "grupo_a", "grupo_b", "rural", "nao_classificado"]:
        if any(item["class_id"] == preferred and item["selector_enabled"] for item in groups):
            default_regulatory_id = preferred
            break
    if default_regulatory_id is None and groups:
        default_regulatory_id = groups[0]["class_id"]

    return groups, views, default_regulatory_id


def build_top20_distributors(dim_porte: pd.DataFrame) -> list[dict]:
    dim_porte = ensure_label_columns(dim_porte)
    if dim_porte.empty or "uc_ativa_media_mensal" not in dim_porte.columns:
        return []
    latest_year = int(dim_porte["ano"].max())
    latest = dim_porte[dim_porte["ano"] == latest_year].copy()
    latest = latest.sort_values("uc_ativa_media_mensal", ascending=False).head(20).reset_index(drop=True)
    latest["rank_top20"] = latest.index + 1
    cols = [
        "rank_top20",
        "ano",
        "distributor_id",
        "sigagente",
        "nomagente",
        "distributor_name_sig",
        "distributor_name_legal",
        "distributor_label",
        "uc_ativa_media_mensal",
        "bucket_porte",
        "rank_porte_ano",
    ]
    cols = [c for c in cols if c in latest.columns]
    return _df_to_records(latest[cols])


def build_data_availability() -> dict[str, dict[str, object]]:
    return {
        "tensao_nivel": {
            "available": False,
            "reason": "Nível de tensão não está disponível como coluna estruturada nesta base consolidada.",
        },
        "beneficio_social_bolsa": {
            "available": False,
            "reason": "Tarifa social/bolsa não está disponível como coluna estruturada nesta base consolidada.",
        },
    }


def main() -> None:
    print("🔧 Gerando dados para o dashboard...")
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)
    validate_required_inputs()

    kpi = _read("kpi_regulatorio_anual")
    fato_mensal = _read("fato_transgressao_mensal_distribuidora")
    fato_mensal_porte = _read("fato_transgressao_mensal_porte")
    fato_indicadores = _read("fato_indicadores_anuais")
    dim_group = _read("dim_distributor_group")
    dim_porte = _read("dim_distribuidora_porte")
    grupos_anual = _read("grupos_anual_2023_2025", "grupos")
    grupos_tendencia = _read("grupos_tendencia_2023_2025", "grupos")
    grupos_benchmark = _read("grupos_benchmark_porte_latest", "grupos")
    grupos_classe = _read("grupos_classe_local_2023_2025", "grupos")
    grupos_longa = _read("grupos_longa_resumo_2011_2023", "grupos")
    grupos_mensal = _read("grupos_mensal_2023_2025", "grupos")

    distributor_groups = build_distributor_groups(dim_group, grupos_anual)
    group_views = build_group_views(
        annual=grupos_anual,
        trend=grupos_tendencia,
        benchmark=grupos_benchmark,
        classe=grupos_classe,
        longa=grupos_longa,
        mensal=grupos_mensal,
    )
    default_group_id = choose_default_group_id(distributor_groups, grupos_benchmark)
    featured_group_ids = select_featured_group_ids(distributor_groups, grupos_benchmark)
    featured_groups = build_featured_groups(distributor_groups, featured_group_ids)
    featured_group_compare_anual = build_featured_group_compare_anual(
        annual=grupos_anual,
        featured_ids=featured_group_ids,
        distributor_groups=distributor_groups,
    )
    featured_group_compare_latest = build_featured_group_compare_latest(featured_group_compare_anual)

    regulatory_groups, regulatory_views, default_regulatory_id = build_regulatory_views(
        monthly_porte=fato_mensal_porte,
        indicadores=fato_indicadores,
    )

    data = {
        "meta": {
            "generated_at": pd.Timestamp.now().isoformat(),
            "project": "TCC — Análise REN 1000/2021 ANEEL",
        },
        "kpi_overview": build_kpi_overview(kpi),
        "serie_anual": build_serie_anual(kpi),
        "serie_mensal_nacional": build_fato_mensal_distribuidora(fato_mensal),
        "distributor_groups": distributor_groups,
        "group_views": group_views,
        "default_group_id": default_group_id,
        "featured_group_ids": featured_group_ids,
        "featured_groups": featured_groups,
        "featured_group_compare_anual": featured_group_compare_anual,
        "featured_group_compare_latest": featured_group_compare_latest,
        "regulatory_groups": regulatory_groups,
        "regulatory_views": regulatory_views,
        "default_regulatory_id": default_regulatory_id,
        "top20_distributors": build_top20_distributors(dim_porte),
        "data_availability": build_data_availability(),
    }
    data.update(build_legacy_neo_alias(group_views))
    validate_non_empty_sections(data)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"✅ Arquivo gerado: {OUTPUT_PATH} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
