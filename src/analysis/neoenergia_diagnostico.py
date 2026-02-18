"""Generate focused benchmark report for the 5 Neoenergia distributors.

Usage:
    python -m src.analysis.neoenergia_diagnostico
"""

from __future__ import annotations

import argparse
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
DIR_OUT = DIR_ANALYSIS / "neoenergia"
REPORT_PATH = ROOT / "reports" / "neoenergia_diagnostico.md"

NEO_ALIASES: dict[str, list[str]] = {
    "Neoenergia Coelba": ["Neoenergia Coelba", "COELBA"],
    "Neoenergia Pernambuco": ["Neoenergia Pernambuco", "Neoenergia PE", "CELPE"],
    "Neoenergia Cosern": ["Neoenergia Cosern", "COSERN"],
    "Neoenergia Elektro": ["Neoenergia Elektro", "ELEKTRO"],
    "Neoenergia Brasilia": ["Neoenergia Brasilia", "Neoenergia Brasília"],
}


def normalize_key(text: object) -> str:
    if text is None or pd.isna(text):
        return ""
    folded = unicodedata.normalize("NFKD", str(text))
    no_marks = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return " ".join(no_marks.upper().split())


def fmt_int(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"{int(round(float(value))):,}".replace(",", ".")


def fmt_num(value: float | int | None, decimals: int = 2) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"{float(value):,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_pct(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"{float(value) * 100:.2f}%"


def fmt_money(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def frame_to_markdown(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "(sem dados)"
    cols = list(frame.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for _, row in frame.iterrows():
        values = [str(row[col]) if pd.notna(row[col]) else "-" for col in cols]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def build_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for canonical, aliases in NEO_ALIASES.items():
        for alias in aliases:
            lookup[normalize_key(alias)] = canonical
    return lookup


def add_neo_distribuidora(frame: pd.DataFrame, lookup: dict[str, str]) -> pd.DataFrame:
    out = frame.copy()
    out["neo_distribuidora"] = out["sigagente"].map(lambda v: lookup.get(normalize_key(v)))
    return out[out["neo_distribuidora"].notna()].copy()


def load_table(name: str, columns: list[str] | None = None) -> pd.DataFrame:
    path = DIR_ANALYSIS / f"{name}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing analysis table: {path}")
    return pd.read_parquet(path, columns=columns)


def validate_monthly(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    coverage = (
        frame.groupby(["neo_distribuidora", "ano"], as_index=False)
        .agg(meses_com_dados=("mes", "nunique"))
        .sort_values(["neo_distribuidora", "ano"])
    )

    expected_months = set(range(1, 13))
    missing_rows: list[dict[str, object]] = []
    for (dist, ano), group in frame.groupby(["neo_distribuidora", "ano"]):
        missing = sorted(expected_months - set(group["mes"].astype(int).tolist()))
        missing_rows.append(
            {
                "neo_distribuidora": dist,
                "ano": int(ano),
                "meses_faltantes": ",".join(str(m) for m in missing) if missing else "",
            }
        )
    missing_df = pd.DataFrame(missing_rows)
    coverage = coverage.merge(missing_df, on=["neo_distribuidora", "ano"], how="left")

    num_cols = ["qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs", "uc_ativa_mes", "taxa_fora_prazo"]

    checks = {
        "linhas_total": int(len(frame)),
        "duplicidades_chave_ano_mes_dist": int(
            frame.duplicated(subset=["ano", "mes", "neo_distribuidora"], keep=False).sum()
        ),
        "fora_prazo_maior_que_servico": int((frame["qtd_fora_prazo"] > frame["qtd_serv_realizado"]).sum()),
        "linhas_taxa_fora_prazo_maior_1": int((frame["taxa_fora_prazo"] > 1.0).sum()),
        "linhas_uc_ativa_zero_ou_negativa": int((frame["uc_ativa_mes"] <= 0).sum()),
        "linhas_compensacao_positiva_sem_fora": int(
            ((frame["compensacao_rs"] > 0) & (frame["qtd_fora_prazo"] <= 0)).sum()
        ),
        "linhas_valor_negativo": int((frame[num_cols] < 0).any(axis=1).sum()),
    }

    checks_df = pd.DataFrame(
        [{"checagem": key, "qtd_linhas": value} for key, value in checks.items()]
    ).sort_values("checagem")

    return coverage, checks_df


def build_annual_monthly_view(frame: pd.DataFrame) -> pd.DataFrame:
    annual = (
        frame.groupby(["ano", "neo_distribuidora"], as_index=False)
        .agg(
            meses_com_dados=("mes", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            uc_ativa_media_ano=("uc_ativa_mes", "mean"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["ano", "neo_distribuidora"])
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
    annual["compensacao_media_por_transgressao_rs"] = np.where(
        annual["qtd_fora_prazo"] > 0,
        annual["compensacao_rs"] / annual["qtd_fora_prazo"],
        np.nan,
    )

    return annual


def build_trend_table(annual: pd.DataFrame, base_year: int = 2023, last_year: int = 2025) -> pd.DataFrame:
    metrics = [
        "taxa_fora_prazo",
        "fora_prazo_por_100k_uc_mes",
        "compensacao_rs_por_uc_mes",
        "compensacao_media_por_transgressao_rs",
    ]
    rows: list[dict[str, object]] = []
    for dist in sorted(annual["neo_distribuidora"].unique()):
        row: dict[str, object] = {"neo_distribuidora": dist}
        sub = annual[annual["neo_distribuidora"] == dist].set_index("ano")
        for metric in metrics:
            base_val = sub.at[base_year, metric] if base_year in sub.index else np.nan
            last_val = sub.at[last_year, metric] if last_year in sub.index else np.nan
            row[f"{metric}_{base_year}"] = base_val
            row[f"{metric}_{last_year}"] = last_val
            row[f"delta_{metric}_abs"] = (
                last_val - base_val if pd.notna(last_val) and pd.notna(base_val) else np.nan
            )
            row[f"delta_{metric}_pct"] = (
                (last_val / base_val - 1.0)
                if pd.notna(last_val) and pd.notna(base_val) and base_val != 0
                else np.nan
            )
        rows.append(row)

    return pd.DataFrame(rows)


def build_class_view(frame: pd.DataFrame, lookup: dict[str, str]) -> pd.DataFrame:
    neo = add_neo_distribuidora(frame, lookup)

    grouped = (
        neo.groupby(["neo_distribuidora", "classe_local_servico"], as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["neo_distribuidora", "qtd_fora_prazo"], ascending=[True, False])
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

    totals = grouped.groupby("neo_distribuidora")[["qtd_fora_prazo", "compensacao_rs"]].transform("sum")
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

    return grouped


def build_long_run(indicadores: pd.DataFrame, lookup: dict[str, str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    neo = add_neo_distribuidora(indicadores, lookup)

    annual = (
        neo.groupby(["ano", "neo_distribuidora"], as_index=False)
        .agg(
            qtd_serv=("qtd_serv", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
        .sort_values(["ano", "neo_distribuidora"])
    )
    annual["taxa_fora_prazo"] = np.where(
        annual["qtd_serv"] > 0,
        annual["qtd_fora_prazo"] / annual["qtd_serv"],
        np.nan,
    )

    rows: list[dict[str, object]] = []
    for dist, group in annual.groupby("neo_distribuidora"):
        group = group.sort_values("ano")
        first = group.iloc[0]
        last = group.iloc[-1]
        rows.append(
            {
                "neo_distribuidora": dist,
                "ano_inicio": int(first["ano"]),
                "ano_fim": int(last["ano"]),
                "taxa_inicio": first["taxa_fora_prazo"],
                "taxa_fim": last["taxa_fora_prazo"],
                "delta_taxa_abs": last["taxa_fora_prazo"] - first["taxa_fora_prazo"],
                "delta_taxa_pct": (
                    (last["taxa_fora_prazo"] / first["taxa_fora_prazo"] - 1.0)
                    if pd.notna(first["taxa_fora_prazo"]) and first["taxa_fora_prazo"] != 0
                    else np.nan
                ),
                "compensacao_inicio": first["compensacao_rs"],
                "compensacao_fim": last["compensacao_rs"],
                "delta_comp_abs": last["compensacao_rs"] - first["compensacao_rs"],
                "delta_comp_pct": (
                    (last["compensacao_rs"] / first["compensacao_rs"] - 1.0)
                    if pd.notna(first["compensacao_rs"]) and first["compensacao_rs"] != 0
                    else np.nan
                ),
            }
        )

    summary = pd.DataFrame(rows).sort_values("neo_distribuidora")
    return annual, summary


def build_latest_size_benchmark(annual_monthly: pd.DataFrame) -> pd.DataFrame:
    latest_year = int(annual_monthly["ano"].max())
    latest = annual_monthly[annual_monthly["ano"] == latest_year].copy()

    latest = latest.sort_values("uc_ativa_media_ano", ascending=False).reset_index(drop=True)
    latest["rank_porte_neo"] = latest["uc_ativa_media_ano"].rank(method="dense", ascending=False).astype(int)

    median_fora = latest["fora_prazo_por_100k_uc_mes"].median()
    median_comp = latest["compensacao_rs_por_uc_mes"].median()

    latest["indice_fora_vs_mediana_neo"] = np.where(
        median_fora > 0,
        latest["fora_prazo_por_100k_uc_mes"] / median_fora,
        np.nan,
    )
    latest["indice_comp_vs_mediana_neo"] = np.where(
        median_comp > 0,
        latest["compensacao_rs_por_uc_mes"] / median_comp,
        np.nan,
    )

    return latest


def build_spike_table(monthly: pd.DataFrame) -> pd.DataFrame:
    frame = monthly.sort_values(["neo_distribuidora", "ano", "mes"]).copy()
    frame["taxa_var_abs"] = frame.groupby("neo_distribuidora")["taxa_fora_prazo"].diff()
    frame["taxa_var_pct"] = frame.groupby("neo_distribuidora")["taxa_fora_prazo"].pct_change()

    spikes = frame[
        frame["taxa_var_pct"].notna() & (frame["taxa_var_pct"].abs() >= 0.5)
    ].copy()

    return spikes[
        [
            "ano",
            "mes",
            "neo_distribuidora",
            "taxa_fora_prazo",
            "taxa_var_abs",
            "taxa_var_pct",
            "qtd_fora_prazo",
            "compensacao_rs",
        ]
    ].sort_values(["neo_distribuidora", "ano", "mes"])


def build_service_code_share(
    servicos: pd.DataFrame,
    lookup: dict[str, str],
    focus_codes: tuple[str, ...] = ("69", "93"),
) -> pd.DataFrame:
    neo = add_neo_distribuidora(servicos, lookup)
    neo = neo.copy()
    neo["codtiposervico"] = neo["codtiposervico"].astype("string").str.strip()
    neo["serv_focus"] = np.where(
        neo["codtiposervico"].isin(focus_codes),
        neo["qtd_serv_realizado"],
        0.0,
    )

    share = (
        neo.groupby(["neo_distribuidora", "ano"], as_index=False)
        .agg(total_serv=("qtd_serv_realizado", "sum"), serv_focus=("serv_focus", "sum"))
        .sort_values(["neo_distribuidora", "ano"])
    )
    share["share_serv_focus"] = np.where(
        share["total_serv"] > 0,
        share["serv_focus"] / share["total_serv"],
        np.nan,
    )
    return share


def build_comparability_alerts(
    annual_monthly: pd.DataFrame,
    share_codes: pd.DataFrame,
    min_abs_pct_change: float = 0.5,
    min_share_change: float = 0.3,
) -> pd.DataFrame:
    vol = annual_monthly[["neo_distribuidora", "ano", "qtd_serv_realizado"]].copy()
    vol = vol.sort_values(["neo_distribuidora", "ano"])
    vol["delta_serv_pct"] = vol.groupby("neo_distribuidora")["qtd_serv_realizado"].pct_change()

    mix = share_codes[["neo_distribuidora", "ano", "share_serv_focus"]].copy()
    mix = mix.sort_values(["neo_distribuidora", "ano"])
    mix["delta_share_focus_abs"] = mix.groupby("neo_distribuidora")["share_serv_focus"].diff()

    merged = vol.merge(mix, on=["neo_distribuidora", "ano"], how="left")
    merged["alerta_quebra_volume"] = merged["delta_serv_pct"].abs() >= min_abs_pct_change
    merged["alerta_quebra_mix"] = merged["delta_share_focus_abs"].abs() >= min_share_change

    alerts = merged[(merged["alerta_quebra_volume"]) | (merged["alerta_quebra_mix"])].copy()
    return alerts.sort_values(["neo_distribuidora", "ano"]).reset_index(drop=True)


def build_annual_excluding_codes(
    servicos: pd.DataFrame,
    monthly_neo: pd.DataFrame,
    lookup: dict[str, str],
    excluded_codes: tuple[str, ...] = ("69", "93"),
) -> pd.DataFrame:
    neo = add_neo_distribuidora(servicos, lookup).copy()
    neo["codtiposervico"] = neo["codtiposervico"].astype("string").str.strip()
    neo = neo[~neo["codtiposervico"].isin(excluded_codes)].copy()

    monthly = (
        neo.groupby(["ano", "mes", "neo_distribuidora"], as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
        .sort_values(["neo_distribuidora", "ano", "mes"])
    )

    uc = monthly_neo[["ano", "mes", "neo_distribuidora", "uc_ativa_mes"]].drop_duplicates()
    monthly = monthly.merge(uc, on=["ano", "mes", "neo_distribuidora"], how="left")

    annual = (
        monthly.groupby(["ano", "neo_distribuidora"], as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["ano", "neo_distribuidora"])
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
    annual["escopo_servico"] = "sem_cod_69_93"

    return annual


def add_pretty_columns_for_markdown(
    annual_monthly: pd.DataFrame,
    annual_excl_codes: pd.DataFrame,
    trend: pd.DataFrame,
    class_view: pd.DataFrame,
    long_summary: pd.DataFrame,
    latest_size: pd.DataFrame,
    checks: pd.DataFrame,
    coverage: pd.DataFrame,
    share_codes: pd.DataFrame,
    comparability_alerts: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    annual_md = annual_monthly.copy()
    annual_md["qtd_serv_realizado"] = annual_md["qtd_serv_realizado"].map(fmt_int)
    annual_md["qtd_fora_prazo"] = annual_md["qtd_fora_prazo"].map(fmt_int)
    annual_md["compensacao_rs"] = annual_md["compensacao_rs"].map(fmt_money)
    annual_md["taxa_fora_prazo"] = annual_md["taxa_fora_prazo"].map(fmt_pct)
    annual_md["fora_prazo_por_100k_uc_mes"] = annual_md["fora_prazo_por_100k_uc_mes"].map(lambda v: fmt_num(v, 2))
    annual_md["compensacao_rs_por_uc_mes"] = annual_md["compensacao_rs_por_uc_mes"].map(fmt_money)

    annual_excl_md = annual_excl_codes.copy()
    annual_excl_md["qtd_fora_prazo"] = annual_excl_md["qtd_fora_prazo"].map(fmt_int)
    annual_excl_md["taxa_fora_prazo"] = annual_excl_md["taxa_fora_prazo"].map(fmt_pct)
    annual_excl_md["fora_prazo_por_100k_uc_mes"] = annual_excl_md["fora_prazo_por_100k_uc_mes"].map(
        lambda v: fmt_num(v, 2)
    )
    annual_excl_md["compensacao_rs"] = annual_excl_md["compensacao_rs"].map(fmt_money)
    annual_excl_md["compensacao_rs_por_uc_mes"] = annual_excl_md["compensacao_rs_por_uc_mes"].map(fmt_money)

    trend_md = trend.copy()
    for col in trend_md.columns:
        if col.startswith("taxa_fora_prazo_") or col.startswith("delta_taxa_fora_prazo_abs"):
            trend_md[col] = trend_md[col].map(fmt_pct)
        elif col.startswith("delta_taxa_fora_prazo_pct"):
            trend_md[col] = trend_md[col].map(fmt_pct)
        elif "fora_prazo_por_100k_uc_mes" in col and ("delta_" not in col or col.endswith("abs")):
            trend_md[col] = trend_md[col].map(lambda v: fmt_num(v, 2))
        elif col.startswith("delta_fora_prazo_por_100k_uc_mes_pct"):
            trend_md[col] = trend_md[col].map(fmt_pct)
        elif "compensacao_rs_por_uc_mes" in col and ("delta_" not in col or col.endswith("abs")):
            trend_md[col] = trend_md[col].map(fmt_money)
        elif col.startswith("delta_compensacao_rs_por_uc_mes_pct"):
            trend_md[col] = trend_md[col].map(fmt_pct)
        elif "compensacao_media_por_transgressao_rs" in col and ("delta_" not in col or col.endswith("abs")):
            trend_md[col] = trend_md[col].map(fmt_money)
        elif col.startswith("delta_compensacao_media_por_transgressao_rs_pct"):
            trend_md[col] = trend_md[col].map(fmt_pct)

    class_md = class_view.copy()
    class_md["qtd_fora_prazo"] = class_md["qtd_fora_prazo"].map(fmt_int)
    class_md["compensacao_rs"] = class_md["compensacao_rs"].map(fmt_money)
    class_md["taxa_fora_prazo"] = class_md["taxa_fora_prazo"].map(fmt_pct)
    class_md["share_fora_prazo"] = class_md["share_fora_prazo"].map(fmt_pct)
    class_md["share_compensacao"] = class_md["share_compensacao"].map(fmt_pct)

    long_md = long_summary.copy()
    long_md["taxa_inicio"] = long_md["taxa_inicio"].map(fmt_pct)
    long_md["taxa_fim"] = long_md["taxa_fim"].map(fmt_pct)
    long_md["delta_taxa_abs"] = long_md["delta_taxa_abs"].map(fmt_pct)
    long_md["delta_taxa_pct"] = long_md["delta_taxa_pct"].map(fmt_pct)
    long_md["compensacao_inicio"] = long_md["compensacao_inicio"].map(fmt_money)
    long_md["compensacao_fim"] = long_md["compensacao_fim"].map(fmt_money)
    long_md["delta_comp_abs"] = long_md["delta_comp_abs"].map(fmt_money)
    long_md["delta_comp_pct"] = long_md["delta_comp_pct"].map(fmt_pct)

    latest_md = latest_size.copy()
    latest_md["uc_ativa_media_ano"] = latest_md["uc_ativa_media_ano"].map(fmt_int)
    latest_md["taxa_fora_prazo"] = latest_md["taxa_fora_prazo"].map(fmt_pct)
    latest_md["fora_prazo_por_100k_uc_mes"] = latest_md["fora_prazo_por_100k_uc_mes"].map(lambda v: fmt_num(v, 2))
    latest_md["compensacao_rs_por_uc_mes"] = latest_md["compensacao_rs_por_uc_mes"].map(fmt_money)
    latest_md["indice_fora_vs_mediana_neo"] = latest_md["indice_fora_vs_mediana_neo"].map(lambda v: fmt_num(v, 2))
    latest_md["indice_comp_vs_mediana_neo"] = latest_md["indice_comp_vs_mediana_neo"].map(lambda v: fmt_num(v, 2))

    checks_md = checks.copy()
    checks_md["qtd_linhas"] = checks_md["qtd_linhas"].map(fmt_int)

    coverage_md = coverage.copy()
    coverage_md["meses_com_dados"] = coverage_md["meses_com_dados"].map(fmt_int)

    share_md = share_codes.copy()
    share_md["total_serv"] = share_md["total_serv"].map(fmt_int)
    share_md["serv_focus"] = share_md["serv_focus"].map(fmt_int)
    share_md["share_serv_focus"] = share_md["share_serv_focus"].map(fmt_pct)

    comp_md = comparability_alerts.copy()
    if not comp_md.empty:
        comp_md["qtd_serv_realizado"] = comp_md["qtd_serv_realizado"].map(fmt_int)
        comp_md["delta_serv_pct"] = comp_md["delta_serv_pct"].map(fmt_pct)
        comp_md["share_serv_focus"] = comp_md["share_serv_focus"].map(fmt_pct)
        comp_md["delta_share_focus_abs"] = comp_md["delta_share_focus_abs"].map(fmt_pct)

    return {
        "annual": annual_md,
        "annual_excl_codes": annual_excl_md,
        "trend": trend_md,
        "class": class_md,
        "long": long_md,
        "latest": latest_md,
        "checks": checks_md,
        "coverage": coverage_md,
        "share_codes": share_md,
        "comparability_alerts": comp_md,
    }


def write_outputs(
    monthly_neo: pd.DataFrame,
    annual_monthly: pd.DataFrame,
    annual_excl_codes: pd.DataFrame,
    trend: pd.DataFrame,
    class_view: pd.DataFrame,
    share_codes: pd.DataFrame,
    comparability_alerts: pd.DataFrame,
    long_run: pd.DataFrame,
    long_summary: pd.DataFrame,
    latest_size: pd.DataFrame,
    checks: pd.DataFrame,
    coverage: pd.DataFrame,
    spikes: pd.DataFrame,
) -> None:
    DIR_OUT.mkdir(parents=True, exist_ok=True)

    monthly_neo.to_csv(DIR_OUT / "neo_mensal_2023_2025.csv", index=False)
    annual_monthly.to_csv(DIR_OUT / "neo_anual_2023_2025.csv", index=False)
    annual_excl_codes.to_csv(DIR_OUT / "neo_anual_sem_cod_69_93.csv", index=False)
    trend.to_csv(DIR_OUT / "neo_tendencia_2023_2025.csv", index=False)
    class_view.to_csv(DIR_OUT / "neo_classe_local_2023_2025.csv", index=False)
    share_codes.to_csv(DIR_OUT / "neo_share_codigos_69_93.csv", index=False)
    comparability_alerts.to_csv(DIR_OUT / "neo_alertas_comparabilidade.csv", index=False)
    long_run.to_csv(DIR_OUT / "neo_longa_2011_2023.csv", index=False)
    long_summary.to_csv(DIR_OUT / "neo_longa_resumo_2011_2023.csv", index=False)
    latest_size.to_csv(DIR_OUT / "neo_benchmark_porte_latest.csv", index=False)
    checks.to_csv(DIR_OUT / "neo_data_quality_checks.csv", index=False)
    coverage.to_csv(DIR_OUT / "neo_cobertura_mensal.csv", index=False)
    spikes.to_csv(DIR_OUT / "neo_outliers_taxa.csv", index=False)


def build_report(
    annual_monthly: pd.DataFrame,
    annual_excl_codes: pd.DataFrame,
    trend: pd.DataFrame,
    class_view: pd.DataFrame,
    share_codes: pd.DataFrame,
    comparability_alerts: pd.DataFrame,
    long_summary: pd.DataFrame,
    latest_size: pd.DataFrame,
    checks: pd.DataFrame,
    coverage: pd.DataFrame,
    spikes: pd.DataFrame,
) -> str:
    prepared = add_pretty_columns_for_markdown(
        annual_monthly=annual_monthly,
        annual_excl_codes=annual_excl_codes,
        trend=trend,
        class_view=class_view,
        long_summary=long_summary,
        latest_size=latest_size,
        checks=checks,
        coverage=coverage,
        share_codes=share_codes,
        comparability_alerts=comparability_alerts,
    )

    worst_latest = latest_size.sort_values("fora_prazo_por_100k_uc_mes", ascending=False).head(2)
    best_latest = latest_size.sort_values("fora_prazo_por_100k_uc_mes", ascending=True).head(2)

    spikes_count = len(spikes)
    checks_total_issues = int(checks[checks["checagem"] != "linhas_total"]["qtd_linhas"].sum())
    comparability_count = len(comparability_alerts)

    lines: list[str] = []
    lines.append("# Diagnostico Neoenergia (5 distribuidoras)")
    lines.append("")
    lines.append("## Escopo")
    lines.append("- Distribuidoras: Neoenergia Coelba, Pernambuco, Cosern, Elektro e Brasilia.")
    lines.append("- Fontes: `fato_transgressao_mensal_distribuidora`, `fato_transgressao_mensal_porte`, `fato_indicadores_anuais`.")
    lines.append("- Periodos: mensal detalhado 2023-2025; serie longa anual 2011-2023.")
    lines.append("")

    lines.append("## Validacao de dados")
    lines.append(f"- Total de alertas nas checagens estruturais: **{checks_total_issues}**")
    lines.append(f"- Alertas de comparabilidade (quebra de volume/mix entre anos): **{comparability_count}**")
    lines.append(f"- Total de spikes mensais (variacao >= 50% da taxa fora prazo): **{spikes_count}**")
    lines.append("")
    lines.append("### Checagens")
    lines.append(frame_to_markdown(prepared["checks"]))
    lines.append("")
    lines.append("### Cobertura mensal")
    lines.append(frame_to_markdown(prepared["coverage"]))
    lines.append("")

    lines.append("### Alertas de comparabilidade")
    if prepared["comparability_alerts"].empty:
        lines.append("- Nenhum alerta relevante de quebra anual de volume/mix foi detectado.")
    else:
        comp_table = prepared["comparability_alerts"][
            [
                "neo_distribuidora",
                "ano",
                "qtd_serv_realizado",
                "delta_serv_pct",
                "share_serv_focus",
                "delta_share_focus_abs",
                "alerta_quebra_volume",
                "alerta_quebra_mix",
            ]
        ]
        lines.append(frame_to_markdown(comp_table))
    lines.append("")

    lines.append("## Visao 1: Anual 2023-2025 (absoluto + normalizado)")
    annual_table = prepared["annual"][
        [
            "ano",
            "neo_distribuidora",
            "qtd_fora_prazo",
            "taxa_fora_prazo",
            "fora_prazo_por_100k_uc_mes",
            "compensacao_rs",
            "compensacao_rs_por_uc_mes",
        ]
    ]
    lines.append(frame_to_markdown(annual_table))
    lines.append("")

    lines.append("### Visao 1B: Anual sem codigos 69/93 (robustez)")
    annual_excl_table = prepared["annual_excl_codes"][
        [
            "ano",
            "neo_distribuidora",
            "qtd_fora_prazo",
            "taxa_fora_prazo",
            "fora_prazo_por_100k_uc_mes",
            "compensacao_rs",
            "compensacao_rs_por_uc_mes",
        ]
    ]
    lines.append(frame_to_markdown(annual_excl_table))
    lines.append("")

    lines.append("## Visao 2: Tendencia 2023 -> 2025")
    trend_cols = [
        "neo_distribuidora",
        "taxa_fora_prazo_2023",
        "taxa_fora_prazo_2025",
        "delta_taxa_fora_prazo_abs",
        "delta_taxa_fora_prazo_pct",
        "fora_prazo_por_100k_uc_mes_2023",
        "fora_prazo_por_100k_uc_mes_2025",
        "delta_fora_prazo_por_100k_uc_mes_pct",
    ]
    trend_table = prepared["trend"][trend_cols]
    lines.append(frame_to_markdown(trend_table))
    lines.append("")

    lines.append("## Visao 3: Mix por classe/localizacao (2023-2025)")
    class_top = (
        class_view.sort_values(["neo_distribuidora", "qtd_fora_prazo"], ascending=[True, False])
        .groupby("neo_distribuidora", as_index=False)
        .head(2)
    )
    class_top_pretty = prepared["class"].merge(
        class_top[["neo_distribuidora", "classe_local_servico"]],
        on=["neo_distribuidora", "classe_local_servico"],
        how="inner",
    )[
        [
            "neo_distribuidora",
            "classe_local_servico",
            "qtd_fora_prazo",
            "share_fora_prazo",
            "compensacao_rs",
            "share_compensacao",
            "taxa_fora_prazo",
        ]
    ]
    lines.append(frame_to_markdown(class_top_pretty))
    lines.append("")

    lines.append("### Mix codigos 69/93 no volume total")
    share_table = prepared["share_codes"][
        ["neo_distribuidora", "ano", "total_serv", "serv_focus", "share_serv_focus"]
    ]
    lines.append(frame_to_markdown(share_table))
    lines.append("")

    lines.append("## Visao 4: Serie longa 2011-2023")
    long_table = prepared["long"][
        [
            "neo_distribuidora",
            "ano_inicio",
            "ano_fim",
            "taxa_inicio",
            "taxa_fim",
            "delta_taxa_abs",
            "delta_taxa_pct",
        ]
    ]
    lines.append(frame_to_markdown(long_table))
    lines.append("")

    lines.append("## Visao 5: Porte (ultimo ano disponivel)")
    latest_table = prepared["latest"][
        [
            "rank_porte_neo",
            "neo_distribuidora",
            "uc_ativa_media_ano",
            "taxa_fora_prazo",
            "fora_prazo_por_100k_uc_mes",
            "indice_fora_vs_mediana_neo",
            "compensacao_rs_por_uc_mes",
            "indice_comp_vs_mediana_neo",
        ]
    ]
    lines.append(frame_to_markdown(latest_table))
    lines.append("")

    lines.append("## Leituras rapidas")
    if not worst_latest.empty:
        worst_name = worst_latest.iloc[0]["neo_distribuidora"]
        worst_val = worst_latest.iloc[0]["fora_prazo_por_100k_uc_mes"]
        lines.append(
            f"- Maior pressao normalizada no ultimo ano: **{worst_name}** ({fmt_num(worst_val, 2)} fora prazo por 100k UC-mes)."
        )
    if not best_latest.empty:
        best_name = best_latest.iloc[0]["neo_distribuidora"]
        best_val = best_latest.iloc[0]["fora_prazo_por_100k_uc_mes"]
        lines.append(
            f"- Menor pressao normalizada no ultimo ano: **{best_name}** ({fmt_num(best_val, 2)} fora prazo por 100k UC-mes)."
        )
    lines.append("- Se o objetivo for comparacao justa entre distribuidoras, priorize metricas normalizadas por UC-mes.")
    lines.append("- Se o objetivo for impacto financeiro, acompanhe `compensacao_rs_por_uc_mes` e `compensacao_media_por_transgressao_rs`.")
    lines.append("")

    lines.append("## Arquivos gerados")
    lines.append("- `data/processed/analysis/neoenergia/neo_mensal_2023_2025.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_anual_2023_2025.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_anual_sem_cod_69_93.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_tendencia_2023_2025.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_classe_local_2023_2025.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_share_codigos_69_93.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_alertas_comparabilidade.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_longa_2011_2023.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_longa_resumo_2011_2023.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_benchmark_porte_latest.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_data_quality_checks.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_cobertura_mensal.csv`")
    lines.append("- `data/processed/analysis/neoenergia/neo_outliers_taxa.csv`")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate focused Neoenergia benchmark report")
    _ = parser.parse_args()

    lookup = build_lookup()

    monthly_dist = load_table(
        "fato_transgressao_mensal_distribuidora",
        columns=[
            "ano",
            "mes",
            "sigagente",
            "nomagente",
            "uc_ativa_mes",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
            "taxa_fora_prazo",
        ],
    )
    monthly_porte = load_table(
        "fato_transgressao_mensal_porte",
        columns=[
            "ano",
            "sigagente",
            "classe_local_servico",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
            "uc_ativa_mes",
        ],
    )
    indicadores = load_table(
        "fato_indicadores_anuais",
        columns=["ano", "sigagente", "qtd_serv", "qtd_fora_prazo", "compensacao_rs"],
    )
    servicos = load_table(
        "fato_servicos_municipio_mes",
        columns=[
            "ano",
            "mes",
            "sigagente",
            "codtiposervico",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
        ],
    )

    neo_monthly = add_neo_distribuidora(monthly_dist, lookup)
    neo_monthly = neo_monthly.sort_values(["neo_distribuidora", "ano", "mes"]).reset_index(drop=True)

    coverage, checks = validate_monthly(neo_monthly)
    annual_monthly = build_annual_monthly_view(neo_monthly)
    annual_excl_codes = build_annual_excluding_codes(servicos, neo_monthly, lookup)
    trend = build_trend_table(annual_monthly)
    class_view = build_class_view(monthly_porte, lookup)
    share_codes = build_service_code_share(servicos, lookup)
    comparability_alerts = build_comparability_alerts(annual_monthly, share_codes)
    long_run, long_summary = build_long_run(indicadores, lookup)
    latest_size = build_latest_size_benchmark(annual_monthly)
    spikes = build_spike_table(neo_monthly)

    write_outputs(
        monthly_neo=neo_monthly,
        annual_monthly=annual_monthly,
        annual_excl_codes=annual_excl_codes,
        trend=trend,
        class_view=class_view,
        share_codes=share_codes,
        comparability_alerts=comparability_alerts,
        long_run=long_run,
        long_summary=long_summary,
        latest_size=latest_size,
        checks=checks,
        coverage=coverage,
        spikes=spikes,
    )

    report = build_report(
        annual_monthly=annual_monthly,
        annual_excl_codes=annual_excl_codes,
        trend=trend,
        class_view=class_view,
        share_codes=share_codes,
        comparability_alerts=comparability_alerts,
        long_summary=long_summary,
        latest_size=latest_size,
        checks=checks,
        coverage=coverage,
        spikes=spikes,
    )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report, encoding="utf-8")

    print("Neoenergia diagnostic generated:")
    print(f"  - report: {REPORT_PATH}")
    print(f"  - outputs: {DIR_OUT}")


if __name__ == "__main__":
    main()
