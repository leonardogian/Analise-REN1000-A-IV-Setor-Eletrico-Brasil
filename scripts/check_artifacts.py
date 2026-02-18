"""Check if required pipeline artifacts exist."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import csv

CORE_REQUIRED = [
    "data/processed/analysis/dim_indicador_servico.parquet",
    "data/processed/analysis/dim_distribuidora_porte.parquet",
    "data/processed/analysis/fato_uc_ativa_mensal_distribuidora.parquet",
    "data/processed/analysis/fato_indicadores_anuais.parquet",
    "data/processed/analysis/fato_servicos_municipio_mes.parquet",
    "data/processed/analysis/fato_transgressao_mensal_porte.parquet",
    "data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet",
    "data/processed/analysis/kpi_regulatorio_anual.parquet",
    "reports/relatorio_aneel.md",
]

FULL_REQUIRED = CORE_REQUIRED + [
    "data/processed/analysis/dim_distributor_group.parquet",
    "data/processed/analysis/grupos/grupos_mensal_2023_2025.csv",
    "data/processed/analysis/grupos/grupos_anual_2023_2025.csv",
    "data/processed/analysis/grupos/grupos_anual_sem_cod_69_93.csv",
    "data/processed/analysis/grupos/grupos_tendencia_2023_2025.csv",
    "data/processed/analysis/grupos/grupos_classe_local_2023_2025.csv",
    "data/processed/analysis/grupos/grupos_share_codigos_69_93.csv",
    "data/processed/analysis/grupos/grupos_alertas_comparabilidade.csv",
    "data/processed/analysis/grupos/grupos_longa_2011_2023.csv",
    "data/processed/analysis/grupos/grupos_longa_resumo_2011_2023.csv",
    "data/processed/analysis/grupos/grupos_benchmark_porte_latest.csv",
    "data/processed/analysis/grupos/grupos_data_quality_checks.csv",
    "data/processed/analysis/grupos/grupos_cobertura_mensal.csv",
    "data/processed/analysis/grupos/grupos_outliers_taxa.csv",
    "reports/neoenergia_diagnostico.md",
    "dashboard/dashboard_data.json",
]

REQUIRED_DASHBOARD_KEYS = {
    "meta",
    "kpi_overview",
    "serie_anual",
    "serie_mensal_nacional",
    "distributor_groups",
    "group_views",
    "default_group_id",
    "regulatory_groups",
    "regulatory_views",
    "default_regulatory_id",
    "top20_distributors",
    "data_availability",
}


def check_dashboard_json() -> list[str]:
    """Validate dashboard JSON has expected top-level keys."""
    errors: list[str] = []
    path = Path("dashboard/dashboard_data.json")
    if not path.exists():
        return [f"missing dashboard JSON: {path}"]

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"invalid dashboard JSON: {path} ({exc})"]

    if not isinstance(payload, dict):
        return [f"invalid dashboard JSON root type: {path}"]

    missing = sorted(REQUIRED_DASHBOARD_KEYS - set(payload.keys()))
    if missing:
        errors.append(
            "dashboard JSON missing keys: " + ", ".join(missing)
        )

    if isinstance(payload.get("group_views"), dict) and "neoenergia" in payload["group_views"]:
        legacy_required = {
            "neo_anual",
            "neo_tendencia",
            "neo_benchmark",
            "neo_classe_local",
            "neo_longa_resumo",
            "neo_mensal",
        }
        missing_legacy = sorted(legacy_required - set(payload.keys()))
        if missing_legacy:
            errors.append(
                "dashboard JSON missing legacy neo keys: " + ", ".join(missing_legacy)
            )

    regulatory_groups = payload.get("regulatory_groups")
    regulatory_views = payload.get("regulatory_views")
    if not isinstance(regulatory_groups, list):
        errors.append("dashboard JSON invalid type: regulatory_groups must be list")
    if not isinstance(regulatory_views, dict):
        errors.append("dashboard JSON invalid type: regulatory_views must be object")

    top20 = payload.get("top20_distributors")
    if not isinstance(top20, list):
        errors.append("dashboard JSON invalid type: top20_distributors must be list")
    else:
        if len(top20) > 20:
            errors.append("dashboard JSON invalid top20_distributors: more than 20 records")
        required_name_fields = {"distributor_id", "distributor_name_sig", "distributor_name_legal", "distributor_label"}
        for idx, row in enumerate(top20):
            if not isinstance(row, dict):
                errors.append(f"dashboard JSON invalid top20_distributors[{idx}]: expected object")
                continue
            missing_row_fields = sorted(required_name_fields - set(row.keys()))
            if missing_row_fields:
                errors.append(
                    f"dashboard JSON invalid top20_distributors[{idx}]: missing fields {', '.join(missing_row_fields)}"
                )
                break

    availability = payload.get("data_availability")
    required_availability = {"tensao_nivel", "beneficio_social_bolsa"}
    if not isinstance(availability, dict):
        errors.append("dashboard JSON invalid type: data_availability must be object")
    else:
        missing_availability = sorted(required_availability - set(availability.keys()))
        if missing_availability:
            errors.append(
                "dashboard JSON missing data_availability keys: " + ", ".join(missing_availability)
            )

    expected_regulatory = {"grupo_a", "grupo_b", "rural", "urbana", "nao_classificado"}
    if isinstance(regulatory_groups, list):
        found = {str(item.get("class_id")) for item in regulatory_groups if isinstance(item, dict)}
        missing_classes = sorted(expected_regulatory - found)
        if missing_classes:
            errors.append("dashboard JSON missing regulatory classes: " + ", ".join(missing_classes))

    if isinstance(regulatory_views, dict):
        missing_views = sorted(expected_regulatory - set(regulatory_views.keys()))
        if missing_views:
            errors.append("dashboard JSON missing regulatory views: " + ", ".join(missing_views))

    errors.extend(check_grouping_regression())

    return errors


def check_grouping_regression() -> list[str]:
    errors: list[str] = []
    dim_csv = Path("data/processed/analysis/dim_distributor_group.csv")
    if not dim_csv.exists():
        return errors

    prefixes = ("neoenergia", "cpfl", "enel")
    offenders: list[str] = []
    with dim_csv.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            group_id = str(row.get("group_id", "")).strip().lower()
            sig = str(row.get("distributor_name_sig", row.get("sigagente", ""))).strip()
            sig_lower = sig.lower()
            if any(sig_lower.startswith(prefix) for prefix in prefixes) and group_id == "companhia":
                offenders.append(sig)

    if offenders:
        uniq = sorted(set(offenders))
        errors.append(
            "grouping regression: distributors with sigagente Neoenergia/CPFL/Enel mapped to companhia: "
            + ", ".join(uniq[:10])
        )
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Check generated artifacts")
    parser.add_argument(
        "--profile",
        choices=["core", "full"],
        default="core",
        help="core checks base analysis/report artifacts, full adds neo + dashboard",
    )
    args = parser.parse_args()

    required = CORE_REQUIRED if args.profile == "core" else FULL_REQUIRED

    missing = [path for path in required if not Path(path).exists()]
    errors: list[str] = []

    if args.profile == "full":
        errors.extend(check_dashboard_json())

    if missing or errors:
        print("Artifact checks failed:")
        for path in missing:
            print(" - missing:", path)
        for err in errors:
            print(" - invalid:", err)
        raise SystemExit(1)

    print(f"Artifacts OK (profile={args.profile}).")


if __name__ == "__main__":
    main()
