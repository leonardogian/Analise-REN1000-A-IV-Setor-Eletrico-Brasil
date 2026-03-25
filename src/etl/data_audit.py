"""
===============================================================================
🔎 AUDITORIA DE DADOS — Cobertura, Qualidade e Gaps
===============================================================================
OBJETIVO:
    Audita todos os datasets do pipeline (raw e processed), gera métricas
    de cobertura temporal, qualidade e gaps, e exporta JSON para o frontend.

SAÍDA:
    app/frontend/dashboard_audit.json

COMO RODAR:
    python -m src.etl.data_audit
===============================================================================
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

from src.analysis.config import ANOS_COMPARAVEIS, SERIES_HISTORICA

# ==============================================================================
# CONFIGURAÇÃO
# ==============================================================================

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_RAW = ROOT / "data" / "raw"
DIR_PROCESSED = ROOT / "data" / "processed"
DIR_ANALYSIS = DIR_PROCESSED / "analysis"
DASHBOARD_DIR = ROOT / "app" / "frontend"
OUTPUT_PATH = DASHBOARD_DIR / "dashboard_audit.json"

# Registro de datasets para auditoria.
# Cada entrada define: path, source label, granularity, temporal_col,
# distributor_col, expected_range (start_year, end_year), file_type.
DATASET_REGISTRY = [
    {
        "name": "qualidade-atendimento-comercial",
        "source": "ANEEL Qualidade Comercial",
        "path": DIR_RAW / "qualidade-atendimento-comercial.csv",
        "file_type": "csv",
        "granularity": "annual",
        "temporal_col": "anoindice",
        "distributor_col": "sigagente",
        "expected_range": SERIES_HISTORICA,
    },
    {
        "name": "qualidade_comercial (processado)",
        "source": "ANEEL Qualidade Comercial",
        "path": DIR_PROCESSED / "qualidade_comercial.parquet",
        "file_type": "parquet",
        "granularity": "annual",
        "temporal_col": "anoindice",
        "distributor_col": "sigagente",
        "expected_range": SERIES_HISTORICA,
    },
    {
        "name": "indger_servicos_comerciais (processado)",
        "source": "ANEEL INDGER Serviços Comerciais",
        "path": DIR_PROCESSED / "indger_servicos_comerciais.parquet",
        "file_type": "parquet",
        "granularity": "monthly",
        "temporal_col": "datreferenciainformada",
        "distributor_col": "sigagente",
        "expected_range": ANOS_COMPARAVEIS,
    },
    {
        "name": "indger_dados_comerciais (processado)",
        "source": "ANEEL INDGER Dados Comerciais",
        "path": DIR_PROCESSED / "indger_dados_comerciais.parquet",
        "file_type": "parquet",
        "granularity": "monthly",
        "temporal_col": "datreferenciainformada",
        "distributor_col": "sigagente",
        "expected_range": ANOS_COMPARAVEIS,
    },
    {
        "name": "fato_indicadores_anuais",
        "source": "Pipeline Analítico",
        "path": DIR_ANALYSIS / "fato_indicadores_anuais.csv",
        "file_type": "csv",
        "granularity": "annual",
        "temporal_col": "ano",
        "distributor_col": "sigagente",
        "expected_range": SERIES_HISTORICA,
    },
    {
        "name": "fato_transgressao_mensal_distribuidora",
        "source": "Pipeline Analítico",
        "path": DIR_ANALYSIS / "fato_transgressao_mensal_distribuidora.csv",
        "file_type": "csv",
        "granularity": "monthly",
        "temporal_col": "ano_mes",
        "distributor_col": "sigagente",
        "expected_range": ANOS_COMPARAVEIS,
    },
    {
        "name": "autos_infracao",
        "source": "ANEEL Autos de Infração",
        "path": DIR_PROCESSED / "autos_infracao.csv",
        "file_type": "csv",
        "granularity": "event",
        "temporal_col": "datlavraturautoinfracao",
        "distributor_col": "nomagentefiscalizado",
        "expected_range": None,
    },
    {
        "name": "reclamacoes",
        "source": "ANEEL Reclamações 1º/2º Nível",
        "path": DIR_PROCESSED / "reclamacoes.csv",
        "file_type": "csv",
        "granularity": "monthly",
        "temporal_col": "datreferencia",
        "distributor_col": "sigagente",
        "expected_range": (2010, 2025),
    },
]


# ==============================================================================
# FUNÇÕES DE AUDITORIA
# ==============================================================================

def _read_dataset(config: dict) -> pd.DataFrame | None:
    """Read a dataset file, returning None if not found."""
    path = config["path"]
    if not path.exists():
        return None

    if config["file_type"] == "parquet":
        return pd.read_parquet(path)

    # CSV with encoding fallback
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            return pd.read_csv(path, sep=";", encoding=encoding, low_memory=False)
        except UnicodeDecodeError:
            continue

    # Fallback comma separator
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            return pd.read_csv(path, sep=",", encoding=encoding, low_memory=False)
        except UnicodeDecodeError:
            continue

    return None


def _extract_years(series: pd.Series, granularity: str) -> pd.Series:
    """Extract year values from a temporal column."""
    if granularity == "annual":
        return pd.to_numeric(series, errors="coerce").dropna().astype(int)

    # Monthly or event: parse dates and extract year
    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)
    return parsed.dropna().dt.year.astype(int)


def _extract_year_months(series: pd.Series, granularity: str) -> list[str]:
    """Extract unique YYYY-MM strings for monthly datasets."""
    if granularity != "monthly":
        return []

    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)
    valid = parsed.dropna()
    if valid.empty:
        return []

    ym = valid.dt.to_period("M").unique()
    return sorted(str(p) for p in ym)


def _detect_missing_periods(
    series: pd.Series, granularity: str, expected_range: tuple[int, int] | None
) -> list[str]:
    """Detect missing years or months vs expected range."""
    if expected_range is None:
        return []

    start_year, end_year = expected_range

    if granularity == "annual":
        years = _extract_years(series, granularity)
        if years.empty:
            return [str(y) for y in range(start_year, end_year + 1)]

        present = set(years.unique())
        expected = set(range(start_year, end_year + 1))
        return sorted(str(y) for y in (expected - present))

    if granularity == "monthly":
        expected_periods = pd.period_range(
            start=f"{start_year}-01", end=f"{end_year}-12", freq="M"
        )
        present = set(_extract_year_months(series, granularity))
        expected_set = {str(p) for p in expected_periods}
        return sorted(expected_set - present)

    return []


def audit_dataset(config: dict) -> dict:
    """Audit a single dataset and return metrics."""
    result = {
        "name": config["name"],
        "source": config["source"],
        "granularity": config["granularity"],
        "exists": False,
        "rows": 0,
        "columns": [],
        "temporal_range": {"min": None, "max": None},
        "missing_periods": [],
        "null_pct": {},
        "duplicates": 0,
        "n_distributors": 0,
        "coverage_pct": 0.0,
    }

    df = _read_dataset(config)
    if df is None:
        return result

    result["exists"] = True

    # Normalize columns
    df.columns = df.columns.str.strip().str.lower()
    result["columns"] = list(df.columns)
    result["rows"] = len(df)

    # Duplicates
    result["duplicates"] = int(df.duplicated().sum())

    # Null percentages (top-level columns only)
    null_pct = (df.isnull().sum() / max(len(df), 1) * 100).round(1)
    result["null_pct"] = {col: float(v) for col, v in null_pct.items() if v > 0}

    # Temporal range
    tcol = config["temporal_col"]
    if tcol and tcol.lower() in {c.lower() for c in df.columns}:
        # Find actual column name (case-insensitive match)
        actual_col = next(c for c in df.columns if c.lower() == tcol.lower())
        years = _extract_years(df[actual_col], config["granularity"])
        if not years.empty:
            result["temporal_range"] = {
                "min": int(years.min()),
                "max": int(years.max()),
            }

        # Missing periods
        result["missing_periods"] = _detect_missing_periods(
            df[actual_col], config["granularity"], config["expected_range"]
        )

        # Coverage percentage
        if config["expected_range"]:
            start, end = config["expected_range"]
            if config["granularity"] == "annual":
                total_expected = end - start + 1
            else:
                total_expected = (end - start + 1) * 12
            n_missing = len(result["missing_periods"])
            result["coverage_pct"] = round(
                (total_expected - n_missing) / max(total_expected, 1) * 100, 1
            )
        else:
            result["coverage_pct"] = 100.0 if not years.empty else 0.0

    # Distributors
    dcol = config["distributor_col"]
    if dcol and dcol.lower() in {c.lower() for c in df.columns}:
        actual_col = next(c for c in df.columns if c.lower() == dcol.lower())
        result["n_distributors"] = int(df[actual_col].nunique())

    return result


# ==============================================================================
# ORQUESTRADOR
# ==============================================================================

def _build_complementary_json(
    path: Path, name: str, date_col: str, agent_col: str, value_col: str | None = None
) -> dict | None:
    """Build a lightweight summary JSON for a complementary dataset."""
    if not path.exists():
        return None

    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(path, sep=";", encoding=encoding, low_memory=False)
            break
        except UnicodeDecodeError:
            continue
    else:
        return None

    df.columns = df.columns.str.strip().str.lower()
    date_col = date_col.lower()
    agent_col = agent_col.lower()

    result: dict = {
        "generated_at": datetime.now().isoformat(),
        "name": name,
        "total": len(df),
        "temporal_range": {},
        "by_year": [],
        "top_distributors": [],
    }

    # Temporal range
    if date_col in df.columns:
        parsed = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
        valid = parsed.dropna()
        if not valid.empty:
            result["temporal_range"] = {
                "min": str(valid.min().date()),
                "max": str(valid.max().date()),
            }
            # By year
            year_counts = valid.dt.year.value_counts().sort_index()
            result["by_year"] = [
                {"year": int(y), "count": int(c)} for y, c in year_counts.items()
            ]

    # Top distributors
    if agent_col in df.columns:
        top = df[agent_col].value_counts().head(15)
        result["top_distributors"] = [
            {"name": str(n), "count": int(c)} for n, c in top.items()
        ]

    # Value summary (e.g., total fines)
    if value_col:
        vcol = value_col.lower()
        if vcol in df.columns:
            vals = pd.to_numeric(
                df[vcol].astype(str).str.replace(",", "."), errors="coerce"
            )
            result["value_summary"] = {
                "column": vcol,
                "total": float(vals.sum()) if not vals.isna().all() else 0,
                "mean": float(vals.mean()) if not vals.isna().all() else 0,
                "count_nonzero": int((vals > 0).sum()),
            }

    return result


def run_audit() -> dict:
    """Run audit on all registered datasets."""
    datasets = []
    for config in DATASET_REGISTRY:
        datasets.append(audit_dataset(config))

    return {
        "generated_at": datetime.now().isoformat(),
        "datasets": datasets,
    }


def main() -> None:
    """Execute audit, write JSON, print summary."""
    print("=" * 70)
    print("🔎 AUDITORIA DE DADOS — Cobertura e Qualidade")
    print(f"   Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    result = run_audit()

    # Write JSON
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n💾 JSON salvo: {OUTPUT_PATH}")

    # Generate complementary dataset JSONs
    ai_json = _build_complementary_json(
        DIR_PROCESSED / "autos_infracao.csv",
        "Autos de Infração",
        "datlavraturautoinfracao",
        "nomagentefiscalizado",
        value_col="vlrpenalidade",
    )
    if ai_json:
        ai_path = DASHBOARD_DIR / "dashboard_infractions.json"
        with open(ai_path, "w", encoding="utf-8") as f:
            json.dump(ai_json, f, ensure_ascii=False, indent=2)
        print(f"💾 JSON salvo: {ai_path}")

    rec_json = _build_complementary_json(
        DIR_PROCESSED / "reclamacoes.csv",
        "Reclamações 1º/2º Nível",
        "datreferencia",
        "sigagente",
    )
    if rec_json:
        rec_path = DASHBOARD_DIR / "dashboard_reclamacoes.json"
        with open(rec_path, "w", encoding="utf-8") as f:
            json.dump(rec_json, f, ensure_ascii=False, indent=2)
        print(f"💾 JSON salvo: {rec_path}")

    # Console summary
    print("\n" + "-" * 70)
    print(f"{'Dataset':<45} {'Linhas':>10} {'Cobertura':>10} {'Distrib':>8}")
    print("-" * 70)

    total_rows = 0
    for ds in result["datasets"]:
        status = "✅" if ds["exists"] else "❌"
        rows_str = f"{ds['rows']:,}" if ds["exists"] else "—"
        cov_str = f"{ds['coverage_pct']:.0f}%" if ds["exists"] else "—"
        dist_str = str(ds["n_distributors"]) if ds["n_distributors"] > 0 else "—"
        total_rows += ds["rows"]

        print(f"  {status} {ds['name']:<43} {rows_str:>10} {cov_str:>10} {dist_str:>8}")

        if ds["missing_periods"]:
            n_miss = len(ds["missing_periods"])
            sample = ds["missing_periods"][:5]
            extra = f" (+{n_miss - 5} mais)" if n_miss > 5 else ""
            print(f"     ⚠️  {n_miss} períodos ausentes: {', '.join(sample)}{extra}")

    print("-" * 70)
    print(f"  Total de linhas: {total_rows:,}")
    print(f"  Datasets encontrados: {sum(1 for d in result['datasets'] if d['exists'])}/{len(result['datasets'])}")
    print("=" * 70)

    return None


if __name__ == "__main__":
    main()
    sys.exit(0)
