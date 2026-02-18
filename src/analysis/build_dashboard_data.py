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
    DIR_ANALYSIS / "dim_distributor_group.csv",
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
]


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
    records = []
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
    cols = [
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "sigagente",
        "nomagente",
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
                "distributor_names": sorted(grp["nomagente"].astype(str).unique().tolist()),
                "years": years_by_group.get(group_id, []),
            }
        )
    return sorted(rows, key=lambda r: (-r["distributor_count"], r["group_label"]))


def _group_records(df: pd.DataFrame, sort_cols: list[str]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    if df.empty:
        return grouped
    for group_id, grp in df.groupby("group_id"):
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


def main():
    print("🔧 Gerando dados para o dashboard...")
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)
    validate_required_inputs()

    kpi = _read("kpi_regulatorio_anual")
    fato_mensal = _read("fato_transgressao_mensal_distribuidora")
    dim_group = _read("dim_distributor_group")
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
    }
    data.update(build_legacy_neo_alias(group_views))
    validate_non_empty_sections(data)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"✅ Arquivo gerado: {OUTPUT_PATH} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
