"""Generate benchmark diagnostics for all distributor economic groups."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from src.analysis.distributor_groups import (
    annotate_distributor_group,
    default_group_label,
    load_group_overrides,
)

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
DIR_OUT = DIR_ANALYSIS / "grupos"


def load_table(name: str, columns: list[str] | None = None) -> pd.DataFrame:
    path = DIR_ANALYSIS / f"{name}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing analysis table: {path}")
    if columns is None:
        return pd.read_parquet(path)
    try:
        return pd.read_parquet(path, columns=columns)
    except Exception:
        return pd.read_parquet(path)


def ensure_group_columns(
    frame: pd.DataFrame,
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
) -> pd.DataFrame:
    if {"group_id", "distributor_id", "group_label"}.issubset(frame.columns):
        out = frame.copy()
        if "nomagente" not in out.columns:
            out["nomagente"] = out["sigagente"]
        out["nomagente"] = out["nomagente"].astype("string").fillna(out["sigagente"].astype("string"))
        return out
    return annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
    )


def add_labels(frame: pd.DataFrame, group_labels: dict[str, str]) -> pd.DataFrame:
    out = frame.copy()
    out["group_label"] = out["group_id"].map(lambda gid: group_labels.get(str(gid), default_group_label(str(gid))))
    out["distributor_label"] = out["nomagente"].astype("string").fillna(out["sigagente"].astype("string"))
    return out


def build_monthly_view(frame: pd.DataFrame) -> pd.DataFrame:
    monthly = frame[frame["ano"].between(2023, 2025, inclusive="both")].copy()
    return monthly.sort_values(["group_id", "distributor_label", "ano", "mes"]).reset_index(drop=True)


def validate_monthly(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    coverage = (
        frame.groupby(["group_id", "group_label", "distributor_id", "distributor_label", "ano"], as_index=False)
        .agg(meses_com_dados=("mes", "nunique"))
        .sort_values(["group_id", "distributor_label", "ano"])
    )

    expected_months = set(range(1, 13))
    missing_rows: list[dict[str, object]] = []
    for (group_id, distributor_id, ano), grp in frame.groupby(["group_id", "distributor_id", "ano"]):
        missing = sorted(expected_months - set(grp["mes"].astype(int).tolist()))
        any_row = grp.iloc[0]
        missing_rows.append(
            {
                "group_id": group_id,
                "group_label": any_row["group_label"],
                "distributor_id": distributor_id,
                "distributor_label": any_row["distributor_label"],
                "ano": int(ano),
                "meses_faltantes": ",".join(str(m) for m in missing) if missing else "",
            }
        )
    coverage = coverage.merge(
        pd.DataFrame(missing_rows),
        on=["group_id", "group_label", "distributor_id", "distributor_label", "ano"],
        how="left",
    )

    num_cols = ["qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs", "uc_ativa_mes", "taxa_fora_prazo"]
    checks: list[dict[str, object]] = []
    for group_id, grp in frame.groupby("group_id"):
        checks.extend(
            [
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "linhas_total",
                    "qtd_linhas": int(len(grp)),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "duplicidades_chave_ano_mes_distribuidora",
                    "qtd_linhas": int(
                        grp.duplicated(subset=["ano", "mes", "group_id", "distributor_id"], keep=False).sum()
                    ),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "fora_prazo_maior_que_servico",
                    "qtd_linhas": int((grp["qtd_fora_prazo"] > grp["qtd_serv_realizado"]).sum()),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "linhas_taxa_fora_prazo_maior_1",
                    "qtd_linhas": int((grp["taxa_fora_prazo"] > 1.0).sum()),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "linhas_uc_ativa_zero_ou_negativa",
                    "qtd_linhas": int((grp["uc_ativa_mes"] <= 0).sum()),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "linhas_compensacao_positiva_sem_fora",
                    "qtd_linhas": int(((grp["compensacao_rs"] > 0) & (grp["qtd_fora_prazo"] <= 0)).sum()),
                },
                {
                    "group_id": group_id,
                    "group_label": grp["group_label"].iloc[0],
                    "checagem": "linhas_valor_negativo",
                    "qtd_linhas": int((grp[num_cols] < 0).any(axis=1).sum()),
                },
            ]
        )

    checks_df = pd.DataFrame(checks).sort_values(["group_id", "checagem"]).reset_index(drop=True)
    return coverage, checks_df


def build_annual_monthly_view(frame: pd.DataFrame) -> pd.DataFrame:
    annual = (
        frame.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "ano"],
            as_index=False,
        )
        .agg(
            meses_com_dados=("mes", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            uc_ativa_media_ano=("uc_ativa_mes", "mean"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["group_id", "distributor_label", "ano"])
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
    return annual.reset_index(drop=True)


def build_trend_table(annual: pd.DataFrame, base_year: int = 2023, last_year: int = 2025) -> pd.DataFrame:
    metrics = [
        "taxa_fora_prazo",
        "fora_prazo_por_100k_uc_mes",
        "compensacao_rs_por_uc_mes",
        "compensacao_media_por_transgressao_rs",
    ]
    rows: list[dict[str, object]] = []
    for (group_id, distributor_id), grp in annual.groupby(["group_id", "distributor_id"]):
        row: dict[str, object] = {
            "group_id": group_id,
            "group_label": grp["group_label"].iloc[0],
            "distributor_id": distributor_id,
            "distributor_label": grp["distributor_label"].iloc[0],
        }
        by_year = grp.set_index("ano")
        for metric in metrics:
            base_val = by_year.at[base_year, metric] if base_year in by_year.index else np.nan
            last_val = by_year.at[last_year, metric] if last_year in by_year.index else np.nan
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
    return pd.DataFrame(rows).sort_values(["group_id", "distributor_label"]).reset_index(drop=True)


def build_class_view(frame: pd.DataFrame) -> pd.DataFrame:
    filtered = frame[frame["ano"].between(2023, 2025, inclusive="both")].copy()
    grouped = (
        filtered.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "classe_local_servico"],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["group_id", "distributor_label", "qtd_fora_prazo"], ascending=[True, True, False])
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

    totals = grouped.groupby(["group_id", "distributor_id"])[["qtd_fora_prazo", "compensacao_rs"]].transform("sum")
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
    return grouped.reset_index(drop=True)


def build_long_run(indicadores: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    filtered = indicadores[indicadores["ano"] <= 2023].copy()
    annual = (
        filtered.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "ano"],
            as_index=False,
        )
        .agg(
            qtd_serv=("qtd_serv", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
        .sort_values(["group_id", "distributor_label", "ano"])
    )
    annual["taxa_fora_prazo"] = np.where(
        annual["qtd_serv"] > 0,
        annual["qtd_fora_prazo"] / annual["qtd_serv"],
        np.nan,
    )

    rows: list[dict[str, object]] = []
    for (group_id, distributor_id), grp in annual.groupby(["group_id", "distributor_id"]):
        grp = grp.sort_values("ano")
        first = grp.iloc[0]
        last = grp.iloc[-1]
        rows.append(
            {
                "group_id": group_id,
                "group_label": first["group_label"],
                "distributor_id": distributor_id,
                "distributor_label": first["distributor_label"],
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
    summary = pd.DataFrame(rows).sort_values(["group_id", "distributor_label"]).reset_index(drop=True)
    return annual.reset_index(drop=True), summary


def build_latest_size_benchmark(annual_monthly: pd.DataFrame) -> pd.DataFrame:
    latest_year = int(annual_monthly["ano"].max())
    latest = annual_monthly[annual_monthly["ano"] == latest_year].copy()
    latest = latest.sort_values(["group_id", "uc_ativa_media_ano"], ascending=[True, False]).reset_index(drop=True)
    latest["rank_porte_grupo"] = (
        latest.groupby("group_id")["uc_ativa_media_ano"].rank(method="dense", ascending=False).astype(int)
    )

    median_fora = latest.groupby("group_id")["fora_prazo_por_100k_uc_mes"].transform("median")
    median_comp = latest.groupby("group_id")["compensacao_rs_por_uc_mes"].transform("median")
    latest["indice_fora_vs_mediana_grupo"] = np.where(
        median_fora > 0,
        latest["fora_prazo_por_100k_uc_mes"] / median_fora,
        np.nan,
    )
    latest["indice_comp_vs_mediana_grupo"] = np.where(
        median_comp > 0,
        latest["compensacao_rs_por_uc_mes"] / median_comp,
        np.nan,
    )
    return latest.reset_index(drop=True)


def build_spike_table(monthly: pd.DataFrame) -> pd.DataFrame:
    frame = monthly.sort_values(["group_id", "distributor_id", "ano", "mes"]).copy()
    frame["taxa_var_abs"] = frame.groupby(["group_id", "distributor_id"])["taxa_fora_prazo"].diff()
    frame["taxa_var_pct"] = frame.groupby(["group_id", "distributor_id"])["taxa_fora_prazo"].pct_change()

    spikes = frame[
        frame["taxa_var_pct"].notna() & (frame["taxa_var_pct"].abs() >= 0.5)
    ].copy()

    return spikes[
        [
            "group_id",
            "group_label",
            "distributor_id",
            "distributor_label",
            "ano",
            "mes",
            "taxa_fora_prazo",
            "taxa_var_abs",
            "taxa_var_pct",
            "qtd_fora_prazo",
            "compensacao_rs",
        ]
    ].sort_values(["group_id", "distributor_label", "ano", "mes"]).reset_index(drop=True)


def build_service_code_share(
    servicos: pd.DataFrame,
    focus_codes: tuple[str, ...] = ("69", "93"),
) -> pd.DataFrame:
    frame = servicos[servicos["ano"].between(2023, 2025, inclusive="both")].copy()
    frame["codtiposervico"] = frame["codtiposervico"].astype("string").str.strip()
    frame["serv_focus"] = np.where(
        frame["codtiposervico"].isin(focus_codes),
        frame["qtd_serv_realizado"],
        0.0,
    )

    share = (
        frame.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "ano"],
            as_index=False,
        )
        .agg(total_serv=("qtd_serv_realizado", "sum"), serv_focus=("serv_focus", "sum"))
        .sort_values(["group_id", "distributor_label", "ano"])
    )
    share["share_serv_focus"] = np.where(
        share["total_serv"] > 0,
        share["serv_focus"] / share["total_serv"],
        np.nan,
    )
    return share.reset_index(drop=True)


def build_comparability_alerts(
    annual_monthly: pd.DataFrame,
    share_codes: pd.DataFrame,
    min_abs_pct_change: float = 0.5,
    min_share_change: float = 0.3,
) -> pd.DataFrame:
    vol = annual_monthly[
        ["group_id", "group_label", "distributor_id", "distributor_label", "ano", "qtd_serv_realizado"]
    ].copy()
    vol = vol.sort_values(["group_id", "distributor_id", "ano"])
    vol["delta_serv_pct"] = vol.groupby(["group_id", "distributor_id"])["qtd_serv_realizado"].pct_change()

    mix = share_codes[
        ["group_id", "distributor_id", "ano", "share_serv_focus"]
    ].copy()
    mix = mix.sort_values(["group_id", "distributor_id", "ano"])
    mix["delta_share_focus_abs"] = mix.groupby(["group_id", "distributor_id"])["share_serv_focus"].diff()

    merged = vol.merge(mix, on=["group_id", "distributor_id", "ano"], how="left")
    merged["alerta_quebra_volume"] = merged["delta_serv_pct"].abs() >= min_abs_pct_change
    merged["alerta_quebra_mix"] = merged["delta_share_focus_abs"].abs() >= min_share_change

    alerts = merged[(merged["alerta_quebra_volume"]) | (merged["alerta_quebra_mix"])].copy()
    return alerts.sort_values(["group_id", "distributor_label", "ano"]).reset_index(drop=True)


def build_annual_excluding_codes(
    servicos: pd.DataFrame,
    monthly: pd.DataFrame,
    excluded_codes: tuple[str, ...] = ("69", "93"),
) -> pd.DataFrame:
    frame = servicos[servicos["ano"].between(2023, 2025, inclusive="both")].copy()
    frame["codtiposervico"] = frame["codtiposervico"].astype("string").str.strip()
    frame = frame[~frame["codtiposervico"].isin(excluded_codes)].copy()

    monthly_agg = (
        frame.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "ano", "mes"],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
        .sort_values(["group_id", "distributor_label", "ano", "mes"])
    )

    uc = monthly[["group_id", "distributor_id", "ano", "mes", "uc_ativa_mes"]].drop_duplicates()
    monthly_agg = monthly_agg.merge(uc, on=["group_id", "distributor_id", "ano", "mes"], how="left")

    annual = (
        monthly_agg.groupby(
            ["group_id", "group_label", "distributor_id", "distributor_label", "ano"],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("uc_ativa_mes", "sum"),
        )
        .sort_values(["group_id", "distributor_label", "ano"])
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
    return annual.reset_index(drop=True)


def write_outputs(outputs: dict[str, pd.DataFrame]) -> None:
    DIR_OUT.mkdir(parents=True, exist_ok=True)
    file_map = {
        "monthly": "grupos_mensal_2023_2025.csv",
        "annual": "grupos_anual_2023_2025.csv",
        "annual_excl_codes": "grupos_anual_sem_cod_69_93.csv",
        "trend": "grupos_tendencia_2023_2025.csv",
        "class_view": "grupos_classe_local_2023_2025.csv",
        "share_codes": "grupos_share_codigos_69_93.csv",
        "comparability_alerts": "grupos_alertas_comparabilidade.csv",
        "long_run": "grupos_longa_2011_2023.csv",
        "long_summary": "grupos_longa_resumo_2011_2023.csv",
        "latest_size": "grupos_benchmark_porte_latest.csv",
        "checks": "grupos_data_quality_checks.csv",
        "coverage": "grupos_cobertura_mensal.csv",
        "spikes": "grupos_outliers_taxa.csv",
    }
    for key, file_name in file_map.items():
        outputs[key].to_csv(DIR_OUT / file_name, index=False)


def run_all_groups() -> dict[str, pd.DataFrame]:
    distributor_to_group, group_labels = load_group_overrides()
    try:
        dim_group = pd.read_parquet(DIR_ANALYSIS / "dim_distributor_group.parquet")
        if "group_id" in dim_group.columns and "group_label" in dim_group.columns:
            group_labels = {
                **group_labels,
                **{
                    str(row["group_id"]): str(row["group_label"])
                    for _, row in dim_group[["group_id", "group_label"]].drop_duplicates().iterrows()
                },
            }
    except Exception:
        pass

    monthly_dist = load_table("fato_transgressao_mensal_distribuidora")
    monthly_porte = load_table("fato_transgressao_mensal_porte")
    indicadores = load_table("fato_indicadores_anuais")
    servicos = load_table("fato_servicos_municipio_mes")

    monthly_dist = add_labels(
        ensure_group_columns(monthly_dist, distributor_to_group, group_labels),
        group_labels,
    )
    monthly_porte = add_labels(
        ensure_group_columns(monthly_porte, distributor_to_group, group_labels),
        group_labels,
    )
    indicadores = add_labels(
        ensure_group_columns(indicadores, distributor_to_group, group_labels),
        group_labels,
    )
    servicos = add_labels(
        ensure_group_columns(servicos, distributor_to_group, group_labels),
        group_labels,
    )

    monthly = build_monthly_view(monthly_dist)
    coverage, checks = validate_monthly(monthly)
    annual = build_annual_monthly_view(monthly)
    annual_excl_codes = build_annual_excluding_codes(servicos, monthly)
    trend = build_trend_table(annual)
    class_view = build_class_view(monthly_porte)
    share_codes = build_service_code_share(servicos)
    comparability_alerts = build_comparability_alerts(annual, share_codes)
    long_run, long_summary = build_long_run(indicadores)
    latest_size = build_latest_size_benchmark(annual)
    spikes = build_spike_table(monthly)

    outputs = {
        "monthly": monthly,
        "annual": annual,
        "annual_excl_codes": annual_excl_codes,
        "trend": trend,
        "class_view": class_view,
        "share_codes": share_codes,
        "comparability_alerts": comparability_alerts,
        "long_run": long_run,
        "long_summary": long_summary,
        "latest_size": latest_size,
        "checks": checks,
        "coverage": coverage,
        "spikes": spikes,
    }
    write_outputs(outputs)
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate diagnostics for all distributor economic groups")
    _ = parser.parse_args()
    outputs = run_all_groups()
    print("Group diagnostics generated:")
    print(f"  - output dir: {DIR_OUT}")
    print(f"  - groups: {outputs['annual']['group_id'].nunique()}")
    print(f"  - distributors: {outputs['annual']['distributor_id'].nunique()}")


if __name__ == "__main__":
    main()
