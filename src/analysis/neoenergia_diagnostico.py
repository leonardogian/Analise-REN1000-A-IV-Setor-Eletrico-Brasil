"""Compatibility wrapper for legacy Neoenergia diagnostic artifacts."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from src.analysis.grupos_diagnostico import run_all_groups

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_GROUPS = ROOT / "data" / "processed" / "analysis" / "grupos"
DIR_OUT = ROOT / "data" / "processed" / "analysis" / "neoenergia"
REPORT_PATH = ROOT / "reports" / "neoenergia_diagnostico.md"
TARGET_GROUP_ID = "neoenergia"


def _neo(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[frame["group_id"] == TARGET_GROUP_ID].copy()


def _frame_to_markdown(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "(sem dados)"
    cols = list(frame.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for _, row in frame.iterrows():
        values = [str(row[col]) if pd.notna(row[col]) else "-" for col in cols]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def export_legacy(outputs: dict[str, pd.DataFrame]) -> bool:
    annual = _neo(outputs["annual"])
    if annual.empty:
        return False

    DIR_OUT.mkdir(parents=True, exist_ok=True)
    monthly = _neo(outputs["monthly"])
    annual_excl = _neo(outputs["annual_excl_codes"])
    trend = _neo(outputs["trend"])
    class_view = _neo(outputs["class_view"])
    share_codes = _neo(outputs["share_codes"])
    alerts = _neo(outputs["comparability_alerts"])
    long_run = _neo(outputs["long_run"])
    long_summary = _neo(outputs["long_summary"])
    latest = _neo(outputs["latest_size"])
    checks = _neo(outputs["checks"])
    coverage = _neo(outputs["coverage"])
    spikes = _neo(outputs["spikes"])

    monthly_legacy = monthly.rename(columns={"distributor_label": "neo_distribuidora"})[
        [
            "ano",
            "mes",
            "sigagente",
            "nomagente",
            "uc_ativa_mes",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
            "taxa_fora_prazo",
            "neo_distribuidora",
        ]
    ]
    annual_legacy = annual.rename(columns={"distributor_label": "neo_distribuidora"})[
        [
            "ano",
            "neo_distribuidora",
            "meses_com_dados",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
            "uc_ativa_media_ano",
            "exposicao_uc_mes",
            "taxa_fora_prazo",
            "fora_prazo_por_100k_uc_mes",
            "compensacao_rs_por_uc_mes",
            "compensacao_media_por_transgressao_rs",
        ]
    ]
    annual_excl_legacy = annual_excl.rename(columns={"distributor_label": "neo_distribuidora"})[
        [
            "ano",
            "neo_distribuidora",
            "qtd_serv_realizado",
            "qtd_fora_prazo",
            "compensacao_rs",
            "exposicao_uc_mes",
            "taxa_fora_prazo",
            "fora_prazo_por_100k_uc_mes",
            "compensacao_rs_por_uc_mes",
            "escopo_servico",
        ]
    ]
    trend_legacy = trend.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    class_legacy = class_view.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    share_legacy = share_codes.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    alerts_legacy = alerts.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    long_run_legacy = long_run.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    long_summary_legacy = long_summary.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )
    latest_legacy = latest.rename(
        columns={
            "distributor_label": "neo_distribuidora",
            "rank_porte_grupo": "rank_porte_neo",
            "indice_fora_vs_mediana_grupo": "indice_fora_vs_mediana_neo",
            "indice_comp_vs_mediana_grupo": "indice_comp_vs_mediana_neo",
        }
    ).drop(columns=["group_id", "group_label", "distributor_id"], errors="ignore")
    checks_legacy = checks[["checagem", "qtd_linhas"]]
    coverage_legacy = coverage.rename(columns={"distributor_label": "neo_distribuidora"})[
        ["neo_distribuidora", "ano", "meses_com_dados", "meses_faltantes"]
    ]
    spikes_legacy = spikes.rename(columns={"distributor_label": "neo_distribuidora"}).drop(
        columns=["group_id", "group_label", "distributor_id"],
        errors="ignore",
    )

    monthly_legacy.to_csv(DIR_OUT / "neo_mensal_2023_2025.csv", index=False)
    annual_legacy.to_csv(DIR_OUT / "neo_anual_2023_2025.csv", index=False)
    annual_excl_legacy.to_csv(DIR_OUT / "neo_anual_sem_cod_69_93.csv", index=False)
    trend_legacy.to_csv(DIR_OUT / "neo_tendencia_2023_2025.csv", index=False)
    class_legacy.to_csv(DIR_OUT / "neo_classe_local_2023_2025.csv", index=False)
    share_legacy.to_csv(DIR_OUT / "neo_share_codigos_69_93.csv", index=False)
    alerts_legacy.to_csv(DIR_OUT / "neo_alertas_comparabilidade.csv", index=False)
    long_run_legacy.to_csv(DIR_OUT / "neo_longa_2011_2023.csv", index=False)
    long_summary_legacy.to_csv(DIR_OUT / "neo_longa_resumo_2011_2023.csv", index=False)
    latest_legacy.to_csv(DIR_OUT / "neo_benchmark_porte_latest.csv", index=False)
    checks_legacy.to_csv(DIR_OUT / "neo_data_quality_checks.csv", index=False)
    coverage_legacy.to_csv(DIR_OUT / "neo_cobertura_mensal.csv", index=False)
    spikes_legacy.to_csv(DIR_OUT / "neo_outliers_taxa.csv", index=False)

    report_lines = [
        "# Diagnóstico Neoenergia (compatibilidade)",
        "",
        "Este relatório é derivado de `src.analysis.grupos_diagnostico` para manter artefatos legados.",
        "",
        "## Resumo anual 2023-2025",
        _frame_to_markdown(
            annual_legacy[
                [
                    "ano",
                    "neo_distribuidora",
                    "qtd_fora_prazo",
                    "taxa_fora_prazo",
                    "fora_prazo_por_100k_uc_mes",
                    "compensacao_rs",
                ]
            ]
        ),
        "",
        "## Tendência 2023 -> 2025",
        _frame_to_markdown(
            trend_legacy[
                [
                    "neo_distribuidora",
                    "fora_prazo_por_100k_uc_mes_2023",
                    "fora_prazo_por_100k_uc_mes_2025",
                    "delta_fora_prazo_por_100k_uc_mes_pct",
                ]
            ]
        ),
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(report_lines), encoding="utf-8")
    return True


def load_existing_group_outputs() -> dict[str, pd.DataFrame] | None:
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
    paths = {key: DIR_GROUPS / name for key, name in file_map.items()}
    if not all(path.exists() for path in paths.values()):
        return None
    return {key: pd.read_csv(path) for key, path in paths.items()}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export legacy Neoenergia artifacts from group diagnostics"
    )
    parser.add_argument(
        "--refresh-groups",
        action="store_true",
        help="recompute group diagnostics before exporting legacy artifacts",
    )
    args = parser.parse_args()

    outputs = None if args.refresh_groups else load_existing_group_outputs()
    if outputs is None:
        outputs = run_all_groups()
    has_neo = export_legacy(outputs)
    if has_neo:
        print("Neoenergia compatibility artifacts generated:")
        print(f"  - report: {REPORT_PATH}")
        print(f"  - outputs: {DIR_OUT}")
    else:
        print("Neoenergia group not found in diagnostics. Legacy artifacts were not generated.")


if __name__ == "__main__":
    main()
