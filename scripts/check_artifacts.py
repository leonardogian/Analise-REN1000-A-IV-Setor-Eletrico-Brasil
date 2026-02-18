"""Check if required pipeline artifacts exist."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

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
    "reports/neoenergia_diagnostico.md",
    "data/processed/analysis/neoenergia/neo_mensal_2023_2025.csv",
    "data/processed/analysis/neoenergia/neo_anual_2023_2025.csv",
    "data/processed/analysis/neoenergia/neo_anual_sem_cod_69_93.csv",
    "data/processed/analysis/neoenergia/neo_tendencia_2023_2025.csv",
    "data/processed/analysis/neoenergia/neo_classe_local_2023_2025.csv",
    "data/processed/analysis/neoenergia/neo_share_codigos_69_93.csv",
    "data/processed/analysis/neoenergia/neo_alertas_comparabilidade.csv",
    "data/processed/analysis/neoenergia/neo_longa_2011_2023.csv",
    "data/processed/analysis/neoenergia/neo_longa_resumo_2011_2023.csv",
    "data/processed/analysis/neoenergia/neo_benchmark_porte_latest.csv",
    "data/processed/analysis/neoenergia/neo_data_quality_checks.csv",
    "data/processed/analysis/neoenergia/neo_cobertura_mensal.csv",
    "data/processed/analysis/neoenergia/neo_outliers_taxa.csv",
    "dashboard/dashboard_data.json",
]

REQUIRED_DASHBOARD_KEYS = {
    "meta",
    "kpi_overview",
    "serie_anual",
    "serie_mensal_nacional",
    "neo_anual",
    "neo_tendencia",
    "neo_benchmark",
    "neo_classe_local",
    "neo_longa_resumo",
    "neo_mensal",
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
