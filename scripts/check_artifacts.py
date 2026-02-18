from pathlib import Path

REQUIRED = [
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


def main() -> None:
    missing = [p for p in REQUIRED if not Path(p).exists()]
    if missing:
        print("Missing artifacts:")
        for path in missing:
            print(" -", path)
        raise SystemExit(1)
    print("Core artifacts OK.")


if __name__ == "__main__":
    main()
