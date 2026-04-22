"""Schema contracts for ANEEL ETL raw and processed datasets."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from pyarrow import parquet as pq

# Fontes nucleares: obrigatórias. Ausência quebra o pipeline.
RAW_REQUIRED_COLUMNS_NUCLEAR: dict[str, set[str]] = {
    "qualidade-atendimento-comercial.csv": {
        "sigagente",
        "sigindicador",
        "anoindice",
        "numperiodoindice",
        "vlrindiceenviado",
    },
    "dominio-indicadores.csv": {
        "sigindicador",
        "dscindicador",
    },
    "indger-dados-comerciais.csv": {
        "datreferenciainformada",
        "sigagente",
        "nomagente",
        "qtducativa",
    },
}

# Fontes complementares: validadas apenas se arquivo existir. Silencioso se ausente.
RAW_REQUIRED_COLUMNS_COMPLEMENTAR: dict[str, set[str]] = {
    "auto-infracao.csv": {
        "numautoinfracao",
        "datlavraturautoinfracao",
        "nomnaturezafiscalizacao",
        "nomagentefiscalizado",
        "numcpfcnpjagentefiscalizado",
        "dsctipopenalidade",
        "vlrpenalidade",
    },
    "reclamacoes-n1e2-distribuidoras-2023.csv": {
        "datreferencia",
        "sigagente",
        "codmunicipio",
        "codtiporeclamacao",
        "qtdreclamacoesrecebidas",
        "qtdreclamacoesimprocedentes",
        "qtdreclamacoesprocedentes",
    },
}

# Retrocompatibilidade: código antigo pode importar RAW_REQUIRED_COLUMNS.
RAW_REQUIRED_COLUMNS: dict[str, set[str]] = {
    **RAW_REQUIRED_COLUMNS_NUCLEAR,
    **RAW_REQUIRED_COLUMNS_COMPLEMENTAR,
}

RAW_SERVICOS_REQUIRED_COLUMNS: set[str] = {
    "datreferenciainformada",
    "sigagente",
    "nomagente",
    "codmunicipioibge",
    "codtiposervico",
    "dsctiposervico",
    "dscprazo",
    "qtdservrealizado",
    "qtdservrealizdescprazo",
    "vlrpagocompensacao",
}

PROCESSED_REQUIRED_COLUMNS: dict[str, set[str]] = {
    "qualidade_comercial.parquet": {
        "sigagente",
        "sigindicador",
        "anoindice",
        "numperiodoindice",
        "vlrindiceenviado",
    },
    "indger_servicos_comerciais.parquet": RAW_SERVICOS_REQUIRED_COLUMNS,
    "indger_dados_comerciais.parquet": {
        "datreferenciainformada",
        "sigagente",
        "nomagente",
        "qtducativa",
    },
}


def normalize_columns(columns: list[str] | pd.Index) -> set[str]:
    """Normalize columns for robust contract checks."""
    return {str(col).strip().lower() for col in columns}


def missing_required_columns(columns: list[str] | pd.Index, required: set[str]) -> list[str]:
    """Return sorted missing required columns."""
    present = normalize_columns(columns)
    return sorted(required - present)


def read_csv_header(path: Path, sep: str = ";") -> list[str]:
    """Read only CSV header with encoding fallback."""
    encodings = ("utf-16", "utf-8", "latin-1", "cp1252")
    for encoding in encodings:
        try:
            frame = pd.read_csv(path, sep=sep, encoding=encoding, nrows=0, low_memory=False)
            return [str(col) for col in frame.columns]
        except UnicodeDecodeError:
            continue
        except Exception:
            continue

    # Last attempt with comma separator.
    for encoding in encodings:
        try:
            frame = pd.read_csv(path, sep=",", encoding=encoding, nrows=0, low_memory=False)
            return [str(col) for col in frame.columns]
        except Exception:
            continue

    raise RuntimeError(f"Could not read header: {path}")


def read_parquet_columns(path: Path) -> list[str]:
    """Read parquet schema columns without loading full data."""
    return list(pq.read_schema(path).names)


def validate_raw_contracts(raw_dir: Path, incluir_complementares: bool = False) -> list[str]:
    """Validate expected raw CSV files and required columns.

    Nuclear sources are always required; their absence or schema drift is an error.
    Complementar sources are optional: if the file does not exist, it is silently
    skipped. When `incluir_complementares=True`, complementar files are required
    to validate schema if present (but missing files still do not error out).
    """
    errors: list[str] = []

    # Nuclear: obrigatório.
    for file_name, required in RAW_REQUIRED_COLUMNS_NUCLEAR.items():
        path = raw_dir / file_name
        if not path.exists():
            errors.append(f"raw missing file (nuclear): {path}")
            continue

        try:
            missing = missing_required_columns(read_csv_header(path), required)
        except Exception as exc:
            errors.append(f"raw unreadable file: {path} ({exc})")
            continue

        if missing:
            errors.append(
                f"raw schema mismatch: {path} missing columns {', '.join(missing)}"
            )

    # Complementar: valida schema apenas se arquivo existir.
    for file_name, required in RAW_REQUIRED_COLUMNS_COMPLEMENTAR.items():
        path = raw_dir / file_name
        if not path.exists():
            continue

        try:
            missing = missing_required_columns(read_csv_header(path), required)
        except Exception as exc:
            errors.append(f"raw unreadable file: {path} ({exc})")
            continue

        if missing:
            errors.append(
                f"raw schema mismatch: {path} missing columns {', '.join(missing)}"
            )

    servicos_files = sorted(raw_dir.glob("*servico*comercia*.csv"))
    if not servicos_files:
        servicos_files = sorted(raw_dir.rglob("*servico*comercia*.csv"))

    if not servicos_files:
        errors.append(
            f"raw missing file pattern: {raw_dir}/**/*servico*comercia*.csv"
        )
        return errors

    for path in servicos_files:
        try:
            missing = missing_required_columns(read_csv_header(path), RAW_SERVICOS_REQUIRED_COLUMNS)
        except Exception as exc:
            errors.append(f"raw unreadable file: {path} ({exc})")
            continue

        if missing:
            errors.append(
                f"raw schema mismatch: {path} missing columns {', '.join(missing)}"
            )

    return errors


def validate_processed_contracts(processed_dir: Path) -> list[str]:
    """Validate expected processed parquet files and required columns."""
    errors: list[str] = []

    for file_name, required in PROCESSED_REQUIRED_COLUMNS.items():
        path = processed_dir / file_name
        if not path.exists():
            errors.append(f"processed missing file: {path}")
            continue

        try:
            missing = missing_required_columns(read_parquet_columns(path), required)
        except Exception as exc:
            errors.append(f"processed unreadable file: {path} ({exc})")
            continue

        if missing:
            errors.append(
                f"processed schema mismatch: {path} missing columns {', '.join(missing)}"
            )

    return errors
