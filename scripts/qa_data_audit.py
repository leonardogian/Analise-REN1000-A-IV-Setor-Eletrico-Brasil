"""Auditoria numerica e estrutural dos artefatos analiticos ANEEL.

Este script e deliberadamente read-only: ele nao corrige nem regenera dados.
Use para detectar problemas que contratos de schema por coluna nao pegam.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DIR_PROCESSED = ROOT / "data" / "processed"
DIR_ANALYSIS = DIR_PROCESSED / "analysis"


@dataclass(frozen=True)
class Finding:
    level: str
    code: str
    message: str


def _read_csv(path: Path, **kwargs) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path, **kwargs)


def _add(findings: list[Finding], level: str, code: str, message: str) -> None:
    findings.append(Finding(level=level, code=code, message=message))


def check_csv_parquet_drift(findings: list[Finding], max_seconds: int = 60) -> None:
    for csv_path in sorted(DIR_ANALYSIS.glob("*.csv")):
        parquet_path = csv_path.with_suffix(".parquet")
        if not parquet_path.exists():
            continue
        drift = abs(csv_path.stat().st_mtime - parquet_path.stat().st_mtime)
        if drift > max_seconds:
            _add(
                findings,
                "ERROR",
                "ARTIFACT_DRIFT",
                (
                    f"{csv_path.relative_to(ROOT)} e {parquet_path.relative_to(ROOT)} "
                    f"estao defasados em {drift / 86400:.1f} dias"
                ),
            )


def check_raw_identity_collisions(findings: list[Finding]) -> None:
    path = DIR_PROCESSED / "qualidade_comercial.parquet"
    if not path.exists():
        _add(findings, "WARN", "IDENTITY_SOURCE_MISSING", f"arquivo ausente: {path.relative_to(ROOT)}")
        return

    from src.analysis.distributor_groups import build_distributor_id

    frame = pd.read_parquet(path, columns=["sigagente", "numcnpj", "anoindice"])
    frame = frame.dropna(subset=["sigagente", "anoindice"])
    frame["ano"] = pd.to_numeric(frame["anoindice"], errors="coerce").astype("Int64")
    frame["distributor_id"] = [
        build_distributor_id(sig, None)
        for sig in frame["sigagente"].astype("string").tolist()
    ]
    frame["numcnpj"] = frame["numcnpj"].astype("string").str.replace(r"\.0$", "", regex=True)

    grouped = (
        frame.dropna(subset=["ano"])
        .groupby(["ano", "distributor_id"], dropna=False)
        .agg(
            n_sigagente=("sigagente", "nunique"),
            n_cnpj=("numcnpj", "nunique"),
            sigagentes=("sigagente", lambda s: ", ".join(sorted(set(map(str, s.dropna())))[:5])),
        )
        .reset_index()
    )
    bad = grouped[(grouped["n_sigagente"] > 1) | (grouped["n_cnpj"] > 1)]
    if not bad.empty:
        examples = "; ".join(
            f"{int(row.ano)} {row.distributor_id}: {row.sigagentes}"
            for row in bad.head(8).itertuples(index=False)
        )
        _add(
            findings,
            "ERROR",
            "IDENTITY_COLLISION",
            f"distributor_id com multiplas siglas/CNPJs no mesmo ano: {examples}",
        )


def check_unique_keys(findings: list[Finding]) -> None:
    checks = {
        "fato_indicadores_anuais.csv": ["ano", "distributor_id", "codigo_base", "classe_local"],
        "fato_transgressao_mensal_distribuidora.csv": ["ano", "mes", "distributor_id"],
        "fato_transgressao_mensal_porte.csv": ["ano", "mes", "distributor_id", "classe_local_servico"],
        "fato_uc_ativa_mensal_distribuidora.csv": ["ano", "mes", "distributor_id"],
        "dim_distribuidora_porte.csv": ["ano", "distributor_id"],
        "kpi_regulatorio_anual.csv": ["ano"],
    }
    for file_name, keys in checks.items():
        path = DIR_ANALYSIS / file_name
        if not path.exists():
            _add(findings, "ERROR", "MISSING_TABLE", f"tabela ausente: {path.relative_to(ROOT)}")
            continue
        frame = _read_csv(path, usecols=lambda col: col in set(keys))
        missing = [col for col in keys if col not in frame.columns]
        if missing:
            _add(findings, "ERROR", "KEY_COLUMNS_MISSING", f"{file_name}: faltam colunas {missing}")
            continue
        duplicate_count = int(frame.duplicated(keys).sum())
        if duplicate_count:
            _add(
                findings,
                "ERROR",
                "DUPLICATE_KEY",
                f"{file_name}: {duplicate_count} linhas duplicam a chave logica {keys}",
            )


def check_rates_and_denominators(findings: list[Finding]) -> None:
    checks = [
        ("fato_indicadores_anuais.csv", "taxa_fora_prazo", "qtd_serv", "qtd_fora_prazo"),
        ("fato_transgressao_mensal_distribuidora.csv", "taxa_fora_prazo", "qtd_serv_realizado", "qtd_fora_prazo"),
        ("fato_transgressao_mensal_porte.csv", "taxa_fora_prazo", "qtd_serv_realizado", "qtd_fora_prazo"),
        ("fato_servicos_municipio_mes.csv", "taxa_fora_prazo", "qtd_serv_realizado", "qtd_fora_prazo"),
        ("kpi_regulatorio_anual.csv", "taxa_fora_prazo", "qtd_serv", "qtd_fora_prazo"),
    ]
    for file_name, rate_col, denom_col, numer_col in checks:
        path = DIR_ANALYSIS / file_name
        if not path.exists():
            continue
        cols = {rate_col, denom_col, numer_col}
        frame = _read_csv(path, usecols=lambda col: col in cols)
        missing = cols - set(frame.columns)
        if missing:
            _add(findings, "ERROR", "METRIC_COLUMNS_MISSING", f"{file_name}: faltam colunas {sorted(missing)}")
            continue
        rate = pd.to_numeric(frame[rate_col], errors="coerce")
        too_low = int((rate < 0).sum())
        too_high = int((rate > 1).sum())
        if too_low or too_high:
            _add(
                findings,
                "ERROR",
                "RATE_OUT_OF_RANGE",
                f"{file_name}: {too_low} taxas < 0 e {too_high} taxas > 1 em {rate_col}",
            )
        denom = pd.to_numeric(frame[denom_col], errors="coerce")
        numer = pd.to_numeric(frame[numer_col], errors="coerce")
        bad_denom = int(((denom <= 0) & (numer > 0)).sum())
        if bad_denom:
            _add(
                findings,
                "WARN",
                "INVALID_DENOMINATOR",
                f"{file_name}: {bad_denom} linhas tem {numer_col} > 0 com {denom_col} <= 0",
            )
        overruns = int(((denom > 0) & (numer > denom)).sum())
        if overruns:
            _add(
                findings,
                "WARN",
                "NUMERATOR_EXCEEDS_DENOMINATOR",
                f"{file_name}: {overruns} linhas tem {numer_col} > {denom_col}; taxa deve ser tratada com cautela",
            )


def check_required_labels(findings: list[Finding]) -> None:
    for file_name in [
        "fato_indicadores_anuais.csv",
        "fato_transgressao_mensal_distribuidora.csv",
        "dim_distributor_group.csv",
    ]:
        path = DIR_ANALYSIS / file_name
        if not path.exists():
            continue
        frame = _read_csv(path, usecols=lambda col: col in {"distributor_id", "group_id", "distributor_label"})
        for col in ["distributor_id", "group_id", "distributor_label"]:
            if col not in frame.columns:
                _add(findings, "ERROR", "LABEL_COLUMN_MISSING", f"{file_name}: coluna ausente {col}")
                continue
            missing = int((frame[col].astype("string").fillna("").str.strip() == "").sum())
            if missing:
                _add(findings, "ERROR", "MISSING_LABEL", f"{file_name}: {missing} valores vazios em {col}")


def check_temporal_coverage(findings: list[Finding]) -> None:
    annual_path = DIR_ANALYSIS / "kpi_regulatorio_anual.csv"
    if annual_path.exists():
        annual = _read_csv(annual_path, usecols=["ano"])
        years = set(pd.to_numeric(annual["ano"], errors="coerce").dropna().astype(int).tolist())
        expected = set(range(2011, 2024))
        missing = sorted(expected - years)
        if missing:
            _add(findings, "ERROR", "ANNUAL_COVERAGE", f"kpi_regulatorio_anual sem anos esperados: {missing}")

    for file_name in [
        "fato_uc_ativa_mensal_distribuidora.csv",
        "fato_transgressao_mensal_porte.csv",
        "fato_transgressao_mensal_distribuidora.csv",
    ]:
        monthly_path = DIR_ANALYSIS / file_name
        if not monthly_path.exists():
            continue
        monthly = _read_csv(monthly_path, usecols=["ano", "mes"])
        coverage = monthly.groupby("ano")["mes"].nunique().to_dict()
        for year in [2023, 2024, 2025]:
            months = int(coverage.get(year, 0))
            if months != 12:
                _add(
                    findings,
                    "ERROR",
                    "MONTHLY_COVERAGE",
                    f"{file_name}: ano {year} tem {months} meses, esperado 12",
                )


def run_audit() -> list[Finding]:
    findings: list[Finding] = []
    if not DIR_ANALYSIS.exists():
        return [Finding("ERROR", "ANALYSIS_DIR_MISSING", f"diretorio ausente: {DIR_ANALYSIS}")]

    check_csv_parquet_drift(findings)
    check_raw_identity_collisions(findings)
    check_unique_keys(findings)
    check_rates_and_denominators(findings)
    check_required_labels(findings)
    check_temporal_coverage(findings)
    return findings


def main() -> None:
    findings = run_audit()
    errors = [item for item in findings if item.level == "ERROR"]
    warnings = [item for item in findings if item.level == "WARN"]

    if not findings:
        print("QA data audit OK.")
        return

    print("QA data audit findings:")
    for item in findings:
        print(f" - [{item.level}] {item.code}: {item.message}")

    print(f"\nResumo: {len(errors)} erro(s), {len(warnings)} alerta(s).")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    main()
