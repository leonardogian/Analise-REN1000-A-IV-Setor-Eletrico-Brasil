"""Schema contracts for ANEEL ETL raw, processed and analysis datasets."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pandas as pd
from pyarrow import parquet as pq
from pyarrow import types as pa_types

CSV_ENCODINGS = ("utf-16", "utf-8", "latin-1", "cp1252")

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

PROCESSED_DTYPE_CONTRACTS: dict[str, dict[str, str]] = {
    "qualidade_comercial.parquet": {
        "anoindice": "numeric",
        "numperiodoindice": "numeric",
        "vlrindiceenviado": "numeric",
    },
    "indger_servicos_comerciais.parquet": {
        "qtdservrealizado": "numeric",
        "qtdservrealizdescprazo": "numeric",
        "vlrpagocompensacao": "numeric",
    },
    "indger_dados_comerciais.parquet": {
        "qtducativa": "numeric",
    },
}

ANALYSIS_REQUIRED_COLUMNS: dict[str, set[str]] = {
    "dim_indicador_servico.csv": {
        "sigindicador",
        "familia_indicador",
        "codigo_base",
        "servico_nome",
        "classe_local",
    },
    "dim_distribuidora_porte.csv": {
        "ano",
        "group_id",
        "distributor_id",
        "uc_ativa_media_mensal",
        "bucket_porte",
    },
    "dim_distributor_group.csv": {
        "group_id",
        "group_label",
        "distributor_id",
        "distributor_label",
    },
    "fato_uc_ativa_mensal_distribuidora.csv": {
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "uc_ativa_mes",
        "periodo_regulatorio",
        "regime_regulatorio",
    },
    "fato_indicadores_anuais.csv": {
        "ano",
        "group_id",
        "distributor_id",
        "codigo_base",
        "qtd_serv",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
        "periodo_regulatorio",
        "regime_regulatorio",
    },
    "fato_transgressao_mensal_porte.csv": {
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
        "periodo_regulatorio",
        "regime_regulatorio",
    },
    "fato_transgressao_mensal_distribuidora.csv": {
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
        "periodo_regulatorio",
        "regime_regulatorio",
    },
    "kpi_regulatorio_anual.csv": {
        "ano",
        "periodo_regulatorio",
        "regime_regulatorio",
        "qtd_serv",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
    },
    "fato_grupos_algoritmicos.csv": {
        "dimension_id",
        "id",
        "periodo_regulatorio",
        "regime_regulatorio",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "compensacao_anualizada",
    },
}

ANALYSIS_DTYPE_CONTRACTS: dict[str, dict[str, str]] = {
    "fato_indicadores_anuais.csv": {
        "ano": "numeric",
        "qtd_serv": "numeric",
        "qtd_fora_prazo": "numeric",
        "compensacao_rs": "numeric",
        "taxa_fora_prazo": "numeric",
    },
    "fato_transgressao_mensal_porte.csv": {
        "ano": "numeric",
        "mes": "numeric",
        "qtd_serv_realizado": "numeric",
        "qtd_fora_prazo": "numeric",
        "compensacao_rs": "numeric",
        "taxa_fora_prazo": "numeric",
    },
    "fato_transgressao_mensal_distribuidora.csv": {
        "ano": "numeric",
        "mes": "numeric",
        "qtd_serv_realizado": "numeric",
        "qtd_fora_prazo": "numeric",
        "compensacao_rs": "numeric",
        "taxa_fora_prazo": "numeric",
    },
    "fato_grupos_algoritmicos.csv": {
        "qtd_serv_realizado": "numeric",
        "qtd_fora_prazo": "numeric",
        "compensacao_rs": "numeric",
        "compensacao_anualizada": "numeric",
    },
    "kpi_regulatorio_anual.csv": {
        "ano": "numeric",
        "qtd_serv": "numeric",
        "qtd_fora_prazo": "numeric",
        "compensacao_rs": "numeric",
        "taxa_fora_prazo": "numeric",
    },
}

ANALYSIS_RANGE_CONTRACTS: dict[str, dict[str, tuple[float | None, float | None]]] = {
    "fato_indicadores_anuais.csv": {
        "ano": (2011, None),
        "taxa_fora_prazo": (0.0, 1.0),
    },
    "fato_transgressao_mensal_porte.csv": {
        "ano": (2023, None),
        "mes": (1, 12),
        "taxa_fora_prazo": (0.0, 1.0),
    },
    "fato_transgressao_mensal_distribuidora.csv": {
        "ano": (2023, None),
        "mes": (1, 12),
        "taxa_fora_prazo": (0.0, 1.0),
    },
    "fato_grupos_algoritmicos.csv": {
        "compensacao_anualizada": (0.0, None),
    },
    "kpi_regulatorio_anual.csv": {
        "ano": (2011, 2025),
        "taxa_fora_prazo": (0.0, 1.0),
    },
}

EXPECTED_REGIMES = {"REN_414", "REN_1000", "TRANSICAO"}
MonthPeriod = tuple[int, int]
INDGER_BASE_START: MonthPeriod = (2023, 1)
INDGER_BASE_END: MonthPeriod = (2025, 12)


def _month_index(period: MonthPeriod) -> int:
    ano, mes = int(period[0]), int(period[1])
    if mes < 1 or mes > 12:
        raise ValueError(f"mes invalido: {period}")
    return ano * 12 + mes - 1


def _period_from_month_index(index: int) -> MonthPeriod:
    ano, zero_based_month = divmod(index, 12)
    return ano, zero_based_month + 1


def month_periods_between(start: MonthPeriod, end: MonthPeriod) -> list[MonthPeriod]:
    """Return all monthly periods between start and end, inclusive."""
    start_index = _month_index(start)
    end_index = _month_index(end)
    if end_index < start_index:
        return []
    return [_period_from_month_index(index) for index in range(start_index, end_index + 1)]


def format_month_period(period: MonthPeriod) -> str:
    return f"{int(period[0])}-{int(period[1]):02d}"


EXPECTED_INDGER_PERIODS = set(month_periods_between(INDGER_BASE_START, INDGER_BASE_END))
INDGER_BASE_LABEL = f"{format_month_period(INDGER_BASE_START)} a {format_month_period(INDGER_BASE_END)}"


def validate_indger_periods(
    periods: Iterable[MonthPeriod],
    *,
    context: str,
    require_baseline: bool = True,
) -> list[str]:
    """Validate INDGER monthly coverage while allowing future contiguous months.

    The thesis baseline remains 2023-01..2025-12. New ANEEL monthly service
    files after 2025-12 are expected to appear over time, so they must not break
    the pipeline when they form a contiguous extension. Sources that may lag
    (notably UC active counts) can opt out of the full-baseline requirement but
    still must start at 2023-01 and have no holes inside their available window.
    """
    normalized: set[MonthPeriod] = set()
    invalid: list[object] = []

    for period in periods:
        try:
            ano, mes = int(period[0]), int(period[1])
            if mes < 1 or mes > 12:
                raise ValueError
            normalized.add((ano, mes))
        except Exception:
            invalid.append(period)

    errors: list[str] = []
    if invalid:
        errors.append(f"{context}: periodos mensais invalidos: {invalid[:6]}")
    if not normalized:
        errors.append(f"{context}: nenhum periodo mensal INDGER encontrado")
        return errors

    first = min(normalized, key=_month_index)
    last = max(normalized, key=_month_index)
    if first != INDGER_BASE_START:
        errors.append(
            f"{context}: cobertura mensal INDGER deve iniciar em "
            f"{format_month_period(INDGER_BASE_START)}, mas inicia em {format_month_period(first)}"
        )

    expected_available = set(month_periods_between(first, last))
    missing_inside = sorted(expected_available - normalized, key=_month_index)
    if missing_inside:
        errors.append(
            f"{context}: cobertura mensal INDGER nao contigua de "
            f"{format_month_period(first)} a {format_month_period(last)}; "
            f"faltantes={[format_month_period(item) for item in missing_inside[:8]]}"
        )

    missing_baseline = sorted(EXPECTED_INDGER_PERIODS - normalized, key=_month_index)
    if require_baseline and missing_baseline:
        errors.append(
            f"{context}: baseline mensal INDGER incompleto ({INDGER_BASE_LABEL}); "
            f"faltantes={[format_month_period(item) for item in missing_baseline[:8]]}"
        )

    return errors


ANALYSIS_MONTHLY_PERIOD_CONTRACTS = {
    "fato_uc_ativa_mensal_distribuidora.csv": {"require_baseline": False},
    "fato_transgressao_mensal_porte.csv": {"require_baseline": True},
    "fato_transgressao_mensal_distribuidora.csv": {"require_baseline": True},
}


def normalize_column_name(column: object) -> str:
    """Normalize a single column for robust contract checks."""
    return str(column).strip().lstrip("\ufeff").lower()


def normalize_columns_list(columns: list[str] | pd.Index) -> list[str]:
    """Normalize columns preserving order."""
    return [normalize_column_name(col) for col in columns]


def normalize_columns(columns: list[str] | pd.Index) -> set[str]:
    """Normalize columns for robust contract checks."""
    return set(normalize_columns_list(columns))


def missing_required_columns(columns: list[str] | pd.Index, required: set[str]) -> list[str]:
    """Return sorted missing required columns."""
    present = normalize_columns(columns)
    return sorted(required - present)


def read_csv_header(path: Path, sep: str = ";") -> list[str]:
    """Read only CSV header with encoding fallback."""
    last_error: Exception | None = None
    for encoding in CSV_ENCODINGS:
        try:
            frame = pd.read_csv(path, sep=sep, encoding=encoding, nrows=0, low_memory=False)
            return [str(col) for col in frame.columns]
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            continue

    # Last attempt with comma separator.
    for encoding in CSV_ENCODINGS:
        try:
            frame = pd.read_csv(path, sep=",", encoding=encoding, nrows=0, low_memory=False)
            return [str(col) for col in frame.columns]
        except Exception as exc:
            last_error = exc
            continue

    raise RuntimeError(f"Could not read header: {path}") from last_error


def read_parquet_columns(path: Path) -> list[str]:
    """Read parquet schema columns without loading full data."""
    return list(pq.read_schema(path).names)


def _is_pa_numeric(field_type: object) -> bool:
    return (
        pa_types.is_integer(field_type)
        or pa_types.is_floating(field_type)
        or pa_types.is_decimal(field_type)
    )


def _validate_parquet_dtypes(path: Path, expected: dict[str, str]) -> list[str]:
    errors: list[str] = []
    schema = pq.read_schema(path)
    fields = {normalize_column_name(name): schema.field(name).type for name in schema.names}
    for col, dtype in expected.items():
        field_type = fields.get(normalize_column_name(col))
        if field_type is None:
            continue
        if dtype == "numeric" and not _is_pa_numeric(field_type):
            errors.append(f"processed dtype mismatch: {path} column {col} expected numeric, got {field_type}")
    return errors


def _validate_csv_dtypes(frame: pd.DataFrame, path: Path, expected: dict[str, str]) -> list[str]:
    errors: list[str] = []
    for col, dtype in expected.items():
        if col not in frame.columns:
            continue
        if dtype == "numeric":
            numeric = pd.to_numeric(frame[col], errors="coerce")
            if numeric.notna().sum() == 0 and frame[col].notna().sum() > 0:
                errors.append(f"analysis dtype mismatch: {path} column {col} expected numeric")
    return errors


def _validate_csv_ranges(
    frame: pd.DataFrame,
    path: Path,
    expected: dict[str, tuple[float | None, float | None]],
) -> list[str]:
    errors: list[str] = []
    for col, (min_value, max_value) in expected.items():
        if col not in frame.columns:
            continue
        values = pd.to_numeric(frame[col], errors="coerce").dropna()
        if values.empty:
            continue
        if min_value is not None and (values < min_value).any():
            errors.append(f"analysis range mismatch: {path} column {col} has values below {min_value}")
        if max_value is not None and (values > max_value).any():
            errors.append(f"analysis range mismatch: {path} column {col} has values above {max_value}")
    return errors


def _validate_regime_values(frame: pd.DataFrame, path: Path) -> list[str]:
    if "regime_regulatorio" not in frame.columns:
        return []
    values = set(frame["regime_regulatorio"].dropna().astype(str).str.strip())
    invalid = sorted(values - EXPECTED_REGIMES)
    if invalid:
        return [f"analysis regime mismatch: {path} invalid values {', '.join(invalid)}"]
    return []


def _validate_monthly_periods(frame: pd.DataFrame, path: Path) -> list[str]:
    contract = ANALYSIS_MONTHLY_PERIOD_CONTRACTS.get(path.name)
    if contract is None:
        return []
    if not {"ano", "mes"}.issubset(frame.columns):
        return []
    periods = {
        (int(row.ano), int(row.mes))
        for row in frame[["ano", "mes"]].dropna().drop_duplicates().itertuples(index=False)
    }
    return validate_indger_periods(
        periods,
        context=f"analysis monthly coverage mismatch: {path}",
        require_baseline=bool(contract.get("require_baseline", True)),
    )


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

    servicos_files = sorted({path.resolve(): path for path in raw_dir.rglob("*servico*comercia*.csv")}.values())

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


def validate_processed_base_contracts(processed_dir: Path) -> list[str]:
    """Validate expected base processed parquet files and required columns."""
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
        errors.extend(_validate_parquet_dtypes(path, PROCESSED_DTYPE_CONTRACTS.get(file_name, {})))

    return errors


def validate_processed_contracts(processed_dir: Path) -> list[str]:
    """Validate base processed parquet files and analysis CSV contracts."""
    errors = validate_processed_base_contracts(processed_dir)

    analysis_dir = processed_dir / "analysis"
    errors.extend(validate_analysis_contracts(analysis_dir))

    return errors


def validate_analysis_contracts(analysis_dir: Path) -> list[str]:
    """Validate generated analysis CSV contracts."""
    errors: list[str] = []
    for file_name, required in ANALYSIS_REQUIRED_COLUMNS.items():
        path = analysis_dir / file_name
        if not path.exists():
            errors.append(
                f"analysis missing file: {path}. Run `make analysis` after `make transform`."
            )
            continue

        try:
            frame = pd.read_csv(path)
            frame.columns = normalize_columns_list(frame.columns)
        except Exception as exc:
            errors.append(f"analysis unreadable file: {path} ({exc})")
            continue

        missing = missing_required_columns(frame.columns, required)
        if missing:
            errors.append(
                f"analysis schema mismatch: {path} missing columns {', '.join(missing)}"
            )

        errors.extend(_validate_csv_dtypes(frame, path, ANALYSIS_DTYPE_CONTRACTS.get(file_name, {})))
        errors.extend(_validate_csv_ranges(frame, path, ANALYSIS_RANGE_CONTRACTS.get(file_name, {})))
        errors.extend(_validate_regime_values(frame, path))
        errors.extend(_validate_monthly_periods(frame, path))

    return errors
