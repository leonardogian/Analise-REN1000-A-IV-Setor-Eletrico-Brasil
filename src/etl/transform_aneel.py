"""Transform raw ANEEL CSV files into typed processed artifacts.

Inputs:
    data/raw/*.csv

Outputs:
    data/processed/*.parquet
    data/processed/*.csv

The reader is intentionally centralized here so all ANEEL sources share the
same encoding cascade, column normalization and Brazilian numeric parsing.
Dates are preserved as normalized strings; analysis scripts parse them
explicitly when needed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

from src.etl.schema_contracts import (
    CSV_ENCODINGS,
    format_month_period,
    RAW_REQUIRED_COLUMNS,
    RAW_SERVICOS_REQUIRED_COLUMNS,
    missing_required_columns,
    normalize_columns_list,
    validate_indger_periods,
    validate_processed_base_contracts,
    validate_raw_contracts,
)

RAIZ_PROJETO = Path(__file__).resolve().parent.parent.parent
DIR_RAW = RAIZ_PROJETO / "data" / "raw"
DIR_PROCESSED = RAIZ_PROJETO / "data" / "processed"

INDGER_SERVICOS_MONTH_RE = re.compile(r"(20\d{2})-(0[1-9]|1[0-2])\.csv$")

NUMERIC_COLUMNS = {
    "anoindice",
    "numperiodoindice",
    "vlrindiceenviado",
    "qtdservrealizado",
    "qtdservrealizdescprazo",
    "vlrpagocompensacao",
    "qtducativa",
    "vlrpenalidade",
    "qtdreclamacoesrecebidas",
    "qtdreclamacoesimprocedentes",
    "qtdreclamacoesprocedentes",
}

INTEGER_COLUMNS = {
    "anoindice",
    "numperiodoindice",
    "qtdservrealizado",
    "qtdservrealizdescprazo",
    "qtducativa",
    "codmunicipioibge",
    "codmunicipio",
    "qtdreclamacoesrecebidas",
    "qtdreclamacoesimprocedentes",
    "qtdreclamacoesprocedentes",
}

STRING_COLUMNS = {
    "sigagente",
    "nomagente",
    "sigindicador",
    "codmunicipio",
    "codmunicipioibge",
    "codtiposervico",
    "dsctiposervico",
    "dscprazo",
    "numautoinfracao",
    "nomnaturezafiscalizacao",
    "nomagentefiscalizado",
    "numcpfcnpjagentefiscalizado",
    "dsctipopenalidade",
}

DATE_LIKE_COLUMNS = {
    "datreferenciainformada",
    "datreferencia",
    "datlavraturautoinfracao",
    "datgeracaoconjuntodados",
}


def _parse_br_numeric(series: pd.Series) -> pd.Series:
    """Parse Brazilian formatted numbers while tolerating already numeric data."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    text = series.astype("string").str.strip()
    text = text.str.replace(r"[^0-9,\.\-]", "", regex=True)
    text = text.replace({"": pd.NA, "-": pd.NA, ".": pd.NA, ",": pd.NA})

    out = pd.Series(pd.NA, index=series.index, dtype="string")
    has_comma = text.str.contains(",", na=False)

    br_values = text[has_comma].str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    out.loc[has_comma] = br_values

    other = text[~has_comma].copy()
    multi_dot = other.str.count(r"\.") > 1
    other.loc[multi_dot] = other.loc[multi_dot].str.replace(".", "", regex=False)
    out.loc[~has_comma] = other

    return pd.to_numeric(out, errors="coerce")


def _normalizar_tipos(df: pd.DataFrame) -> pd.DataFrame:
    """Apply stable dtype coercions used by the whole ETL."""
    for col in sorted(NUMERIC_COLUMNS & set(df.columns)):
        df[col] = _parse_br_numeric(df[col])
        if col in INTEGER_COLUMNS:
            # Rounding handles cases where float precision might have introduced .000001
            df[col] = df[col].round().astype("Int64")

    for col in sorted(STRING_COLUMNS & set(df.columns)):
        df[col] = df[col].astype("string").str.strip()

    for col in sorted(DATE_LIKE_COLUMNS & set(df.columns)):
        # Attempt to parse dates if they look like dates, else keep as string
        # This helps downstream but keeps safety.
        parsed = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
        if parsed.notna().any():
            df[col] = parsed
        else:
            df[col] = df[col].astype("string").str.strip()

    return df


def validar_colunas_obrigatorias(
    df: pd.DataFrame,
    obrigatorias: set[str],
    contexto: str,
) -> bool:
    """Validate minimum schema contract for a dataframe."""
    faltantes = missing_required_columns(df.columns, obrigatorias)
    if faltantes:
        print(f"  ERRO: contrato de schema invalido em {contexto}.")
        print(f"        Colunas faltantes: {', '.join(faltantes)}")
        return False
    return True


def _ler_csv_com_fallback(path: Path, **kwargs) -> tuple[pd.DataFrame, str]:
    last_error: Exception | None = None
    for encoding in CSV_ENCODINGS:
        try:
            params = {
                "sep": ";",
                "encoding": encoding,
                "low_memory": False,
                "decimal": ",",
                "thousands": ".",
                "na_values": ["-", "n/a", "N/A", ""],
            }
            params.update(kwargs)
            frame = pd.read_csv(path, **params)
            if len(frame.columns) <= 1:
                raise ValueError("CSV lido com uma coluna; separador provavelmente incorreto")
            return frame, encoding
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            continue

    raise RuntimeError(f"Nao foi possivel ler CSV: {path}") from last_error


def _carregar_csv_aneel(
    path: Path,
    required_columns: set[str],
    contexto: str,
    *,
    add_source_file: bool = False,
) -> pd.DataFrame:
    """Read, normalize and validate an ANEEL CSV."""
    df, encoding = _ler_csv_com_fallback(path)
    linhas_brutas = len(df)
    df.columns = normalize_columns_list(df.columns)
    df = df.dropna(how="all")
    df = _normalizar_tipos(df)

    before = len(df)
    df = df.drop_duplicates()
    removidas = before - len(df)

    if add_source_file:
        df["_source_file"] = path.name

    if not validar_colunas_obrigatorias(df, required_columns, contexto):
        raise RuntimeError(f"Contrato de schema invalido em {contexto}")

    print(
        f"  {path.name}: {linhas_brutas:,} linhas brutas -> {len(df):,} "
        f"linhas ({encoding}; duplicatas removidas={removidas:,})"
    )
    return df


def _salvar_dataframe(df: pd.DataFrame, base_name: str, *, parquet: bool = True, csv: bool = True) -> None:
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)
    if parquet:
        parquet_path = DIR_PROCESSED / f"{base_name}.parquet"
        df.to_parquet(parquet_path, index=False)
        print(f"  Salvo: {parquet_path.relative_to(RAIZ_PROJETO)}")
    if csv:
        csv_path = DIR_PROCESSED / f"{base_name}.csv"
        df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
        print(f"  Salvo: {csv_path.relative_to(RAIZ_PROJETO)}")


def _buscar_indger_servicos_csvs() -> list[Path]:
    """Return unique INDGER monthly service CSVs in deterministic order."""
    candidates: dict[Path, Path] = {}
    for pattern in ("*servico*comercia*.csv", "*servicos*comercia*.csv"):
        for path in DIR_RAW.rglob(pattern):
            resolved = path.resolve()
            candidates[resolved] = path

    files = sorted(candidates.values(), key=lambda p: p.name)
    if not files:
        return files

    _validar_cobertura_indger_servicos_csvs(files)
    return files


def _extrair_periodo_indger_servicos_csv(path: Path) -> tuple[int, int] | None:
    match = INDGER_SERVICOS_MONTH_RE.search(path.name)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def _validar_cobertura_indger_servicos_csvs(files: list[Path]) -> list[tuple[int, int]]:
    """Validate monthly INDGER service filenames and return sorted periods."""
    period_to_file: dict[tuple[int, int], Path] = {}
    invalid_files: list[str] = []
    duplicates: list[str] = []

    for path in files:
        period = _extrair_periodo_indger_servicos_csv(path)
        if period is None:
            invalid_files.append(path.name)
            continue
        previous = period_to_file.get(period)
        if previous is not None:
            duplicates.append(f"{format_month_period(period)} ({previous.name}, {path.name})")
            continue
        period_to_file[period] = path

    if invalid_files:
        raise RuntimeError(
            "Arquivos INDGER Servicos Comerciais sem periodo YYYY-MM no nome: "
            + ", ".join(invalid_files[:8])
        )
    if duplicates:
        raise RuntimeError(
            "Arquivos INDGER Servicos Comerciais duplicados por periodo: "
            + ", ".join(duplicates[:8])
        )

    periods = sorted(period_to_file.keys())
    errors = validate_indger_periods(
        periods,
        context="INDGER Servicos Comerciais bruto",
        require_baseline=True,
    )
    if errors:
        raise RuntimeError("; ".join(errors))
    return periods


def transformar_qualidade_comercial() -> pd.DataFrame | None:
    arquivo = DIR_RAW / "qualidade-atendimento-comercial.csv"
    if not arquivo.exists():
        print(f"Arquivo nao encontrado: {arquivo.name}. Rode: python3 -m src.etl.extract_aneel")
        return None

    print(f"\n[1/5] Qualidade Comercial: {arquivo.name}")
    try:
        df = _carregar_csv_aneel(
            arquivo,
            RAW_REQUIRED_COLUMNS["qualidade-atendimento-comercial.csv"],
            arquivo.name,
        )
    except Exception as exc:
        print(f"  ERRO: {exc}")
        return None

    _salvar_dataframe(df, "qualidade_comercial")
    return df


def transformar_indger_servicos() -> pd.DataFrame | None:
    print("\n[2/5] INDGER Servicos Comerciais")
    try:
        csvs = _buscar_indger_servicos_csvs()
    except Exception as exc:
        print(f"  ERRO: {exc}")
        return None

    if not csvs:
        print(f"  Nenhum CSV de servicos comerciais encontrado em {DIR_RAW}")
        return None

    periodos = _validar_cobertura_indger_servicos_csvs(csvs)
    print(f"  Arquivos mensais unicos: {len(csvs)}")
    print(
        "  Cobertura mensal: "
        f"{format_month_period(periodos[0])} -> {format_month_period(periodos[-1])} "
        f"({len(periodos)} periodos)"
    )
    print(f"  Primeiro: {csvs[0].name} | Ultimo: {csvs[-1].name}")

    dfs: list[pd.DataFrame] = []
    for csv_file in csvs:
        try:
            dfs.append(
                _carregar_csv_aneel(
                    csv_file,
                    RAW_SERVICOS_REQUIRED_COLUMNS,
                    f"INDGER servicos comerciais ({csv_file.name})",
                    add_source_file=True,
                )
            )
        except Exception as exc:
            print(f"  ERRO em {csv_file.name}: {exc}")
            return None

    df = pd.concat(dfs, ignore_index=True)
    before = len(df)
    df = df.drop_duplicates()
    print(f"  Linhas totais: {len(df):,} (duplicatas globais removidas={before - len(df):,})")

    if df["_source_file"].nunique() != len(csvs):
        print("  ERRO: rastreabilidade _source_file nao cobre todos os CSVs mensais.")
        return None

    _salvar_dataframe(df, "indger_servicos_comerciais")
    return df


def transformar_indger_comercial() -> pd.DataFrame | None:
    arquivo = DIR_RAW / "indger-dados-comerciais.csv"
    if not arquivo.exists():
        print(f"\nArquivo nao encontrado: {arquivo.name}")
        return None

    print(f"\n[3/5] INDGER Dados Comerciais: {arquivo.name}")
    try:
        df = _carregar_csv_aneel(
            arquivo,
            RAW_REQUIRED_COLUMNS["indger-dados-comerciais.csv"],
            arquivo.name,
        )
    except Exception as exc:
        print(f"  ERRO: {exc}")
        return None

    _salvar_dataframe(df, "indger_dados_comerciais")
    return df


def transformar_autos_infracao() -> pd.DataFrame | None:
    arquivo = DIR_RAW / "auto-infracao.csv"
    if not arquivo.exists():
        print(f"\n[4/5] Autos de Infracao: {arquivo.name} ausente (complementar)")
        return None

    print(f"\n[4/5] Autos de Infracao: {arquivo.name}")
    try:
        df = _carregar_csv_aneel(
            arquivo,
            RAW_REQUIRED_COLUMNS["auto-infracao.csv"],
            arquivo.name,
        )
    except Exception as exc:
        print(f"  ERRO: {exc}")
        return None

    _salvar_dataframe(df, "autos_infracao", parquet=False, csv=True)
    return df


def transformar_reclamacoes() -> pd.DataFrame | None:
    csvs = sorted(DIR_RAW.glob("reclamacoes-n1e2-distribuidoras-*.csv"))
    if not csvs:
        print("\n[5/5] Reclamacoes: arquivos ausentes (complementar)")
        return None

    print(f"\n[5/5] Reclamacoes ({len(csvs)} arquivos)")
    dfs: list[pd.DataFrame] = []
    for csv_file in csvs:
        required = RAW_REQUIRED_COLUMNS.get(
            csv_file.name,
            RAW_REQUIRED_COLUMNS["reclamacoes-n1e2-distribuidoras-2023.csv"],
        )
        try:
            dfs.append(
                _carregar_csv_aneel(
                    csv_file,
                    required,
                    f"reclamacoes ({csv_file.name})",
                    add_source_file=True,
                )
            )
        except Exception as exc:
            print(f"  ERRO em {csv_file.name}: {exc}")
            return None

    df = pd.concat(dfs, ignore_index=True)
    before = len(df)
    df = df.drop_duplicates()
    print(f"  Linhas totais: {len(df):,} (duplicatas globais removidas={before - len(df):,})")

    _salvar_dataframe(df, "reclamacoes", parquet=False, csv=True)
    return df


def executar_transformacao() -> bool:
    from datetime import datetime

    print("=" * 70)
    print("TRANSFORMACAO DE DADOS - ANEEL")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    erros_raw = validate_raw_contracts(DIR_RAW)
    if erros_raw:
        print("\nFalha de contrato nos dados brutos. Corrija antes da transformacao:")
        for erro in erros_raw:
            print(f"  - {erro}")
        return False

    resultados: dict[str, str] = {}
    resultados["Qualidade Comercial"] = "OK" if transformar_qualidade_comercial() is not None else "ERRO"
    resultados["INDGER Servicos Comerciais"] = "OK" if transformar_indger_servicos() is not None else "ERRO"
    resultados["INDGER Dados Comerciais"] = "OK" if transformar_indger_comercial() is not None else "ERRO"
    resultados["Autos de Infracao"] = "OK" if transformar_autos_infracao() is not None else "OPCIONAL_AUSENTE"
    resultados["Reclamacoes"] = "OK" if transformar_reclamacoes() is not None else "OPCIONAL_AUSENTE"

    print("\n" + "=" * 70)
    print("RESUMO DA TRANSFORMACAO")
    print("=" * 70)
    for nome, status in resultados.items():
        print(f"  {status:16s} {nome}")

    sucesso = all(status != "ERRO" for status in resultados.values())
    if not sucesso:
        print("\nTransformacao interrompida: datasets obrigatorios falharam.")
        return False

    erros_processed = validate_processed_base_contracts(DIR_PROCESSED)
    if erros_processed:
        print("\nFalha de contrato nos dados processados:")
        for erro in erros_processed:
            print(f"  - {erro}")
        return False

    print(f"\nArquivos processados em: {DIR_PROCESSED}")
    print("Proximo passo: python3 -m src.analysis.build_analysis_tables")
    return True


if __name__ == "__main__":
    ok = executar_transformacao()
    sys.exit(0 if ok else 1)
