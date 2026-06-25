"""Load treated analytical artifacts into PostgreSQL for optional dashboard queries."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

_IDENTIFIER_RE = re.compile(r"[^a-z0-9_]+")
DEFAULT_LOCAL_DATABASE_URL = (
    "postgresql+psycopg2://admin:" + "adminpassword" + "@localhost:5432/tcc_db"
)


@dataclass(frozen=True)
class DataSource:
    path: Path
    table_name: str
    kind: str


def normalize_database_url(db_url: str) -> str:
    """Return a SQLAlchemy-compatible PostgreSQL URL."""
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if db_url.startswith("postgresql://") and "+psycopg2" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return db_url


def table_name_for_path(path: Path) -> str:
    """Derive a safe table name from an artifact path."""
    stem = path.stem.lower()
    table_name = _IDENTIFIER_RE.sub("_", stem).strip("_")
    if not table_name:
        raise ValueError(f"Could not derive table name for {path}")
    return table_name


def discover_data_sources(base_dir: Path) -> list[DataSource]:
    """Find treated artifacts that can seed PostgreSQL.

    Priority is Parquet when both Parquet and CSV exist for the same table. The
    repository usually versions analysis CSVs, while local ETL runs may also
    generate Parquet mirrors.
    """
    processed_dir = base_dir / "data" / "processed"
    analysis_dir = processed_dir / "analysis"

    candidates: list[tuple[str, Path]] = []
    if processed_dir.exists():
        candidates.extend(("parquet", path) for path in sorted(processed_dir.glob("*.parquet")))
    if analysis_dir.exists():
        candidates.extend(("parquet", path) for path in sorted(analysis_dir.rglob("*.parquet")))
        candidates.extend(("csv", path) for path in sorted(analysis_dir.rglob("*.csv")))

    by_table: dict[str, DataSource] = {}
    for kind, path in candidates:
        table_name = table_name_for_path(path)
        if table_name not in by_table:
            by_table[table_name] = DataSource(path=path, table_name=table_name, kind=kind)

    return sorted(by_table.values(), key=lambda source: source.table_name)


def parse_table_filter(raw: str | None) -> set[str] | None:
    if not raw:
        return None
    tables = {table_name_for_path(Path(part.strip())) for part in raw.split(",") if part.strip()}
    return tables or None


def filter_sources(sources: Iterable[DataSource], table_names: set[str] | None) -> list[DataSource]:
    if not table_names:
        return list(sources)
    return [source for source in sources if source.table_name in table_names]


def load_parquet_in_chunks(source: DataSource, engine, chunksize: int = 50_000) -> None:
    import pyarrow.parquet as pq

    print(f"Lendo parquet {source.path}...")
    parquet_file = pq.ParquetFile(source.path)

    with engine.begin() as conn:
        conn.exec_driver_sql(f'DROP TABLE IF EXISTS "{source.table_name}"')

    for index, batch in enumerate(parquet_file.iter_batches(batch_size=chunksize), start=1):
        df_chunk = batch.to_pandas()
        print(f"  Inserindo lote {index} da tabela {source.table_name}...")
        df_chunk.to_sql(source.table_name, engine, if_exists="append", index=False)


def load_csv_in_chunks(source: DataSource, engine, chunksize: int = 50_000) -> None:
    import pandas as pd

    print(f"Lendo CSV {source.path}...")
    with engine.begin() as conn:
        conn.exec_driver_sql(f'DROP TABLE IF EXISTS "{source.table_name}"')

    for index, df_chunk in enumerate(
        pd.read_csv(source.path, chunksize=chunksize, low_memory=False), start=1
    ):
        print(f"  Inserindo lote {index} da tabela {source.table_name}...")
        df_chunk.to_sql(source.table_name, engine, if_exists="append", index=False)


def load_source_in_chunks(source: DataSource, engine, chunksize: int = 50_000) -> None:
    if source.kind == "parquet":
        load_parquet_in_chunks(source, engine, chunksize)
    elif source.kind == "csv":
        load_csv_in_chunks(source, engine, chunksize)
    else:
        raise ValueError(f"Unsupported data source kind: {source.kind}")
    print(f"Sucesso: {source.table_name} carregado.")


def build_index_statements(table_names: Iterable[str]) -> list[str]:
    tables = set(table_names)
    statements: list[str] = []

    if "fato_transgressao_mensal_distribuidora" in tables:
        statements.extend(
            [
                "CREATE INDEX IF NOT EXISTS idx_fato_transgressao_mensal_distribuidora_ano_mes "
                "ON fato_transgressao_mensal_distribuidora (ano, mes, distributor_id)",
                "CREATE INDEX IF NOT EXISTS idx_fato_transgressao_mensal_distribuidora_group "
                "ON fato_transgressao_mensal_distribuidora (group_id, ano, mes)",
                "CREATE INDEX IF NOT EXISTS idx_fato_transgressao_mensal_distribuidora_porte "
                "ON fato_transgressao_mensal_distribuidora (bucket_porte, ano, mes)",
            ]
        )

    if "fato_transgressao_mensal_porte" in tables:
        statements.extend(
            [
                "CREATE INDEX IF NOT EXISTS idx_fato_transgressao_mensal_porte_ano_mes "
                "ON fato_transgressao_mensal_porte (ano, mes, distributor_id)",
                "CREATE INDEX IF NOT EXISTS idx_fato_transgressao_mensal_porte_classe "
                "ON fato_transgressao_mensal_porte (classe_local_servico, ano, mes)",
            ]
        )

    if "fato_servicos_classe_mes" in tables:
        statements.extend(
            [
                "CREATE INDEX IF NOT EXISTS idx_fato_servicos_classe_mes_ano_mes "
                "ON fato_servicos_classe_mes (ano, mes, distributor_id)",
                "CREATE INDEX IF NOT EXISTS idx_fato_servicos_classe_mes_group "
                "ON fato_servicos_classe_mes (group_id, ano, mes)",
                "CREATE INDEX IF NOT EXISTS idx_fato_servicos_classe_mes_classe "
                "ON fato_servicos_classe_mes (classe_local_servico, ano, mes)",
                "CREATE INDEX IF NOT EXISTS idx_fato_servicos_classe_mes_tipo "
                "ON fato_servicos_classe_mes (codtiposervico, ano, mes)",
            ]
        )

    if "grupos_mensal_2023_plus" in tables:
        statements.append(
            "CREATE INDEX IF NOT EXISTS idx_grupos_mensal_2023_plus_group_mes "
            "ON grupos_mensal_2023_plus (group_id, ano, mes)"
        )

    if "dim_distributor_group" in tables:
        statements.append(
            "CREATE INDEX IF NOT EXISTS idx_dim_distributor_group_id "
            "ON dim_distributor_group (group_id, distributor_id)"
        )

    if "dim_distribuidora_porte" in tables:
        statements.append(
            "CREATE INDEX IF NOT EXISTS idx_dim_distribuidora_porte_ano "
            "ON dim_distribuidora_porte (ano, distributor_id)"
        )

    return statements


def create_indexes(engine, table_names: Iterable[str]) -> None:
    statements = build_index_statements(table_names)
    if not statements:
        print("Nenhum índice conhecido para criar.")
        return

    print("\nCriando índices de consulta...")
    with engine.begin() as conn:
        for statement in statements:
            conn.exec_driver_sql(statement)
    print(f"Índices criados/verificados: {len(statements)}")


def main() -> None:
    from dotenv import load_dotenv
    from sqlalchemy import create_engine

    load_dotenv()
    db_url = normalize_database_url(os.getenv("DATABASE_URL", DEFAULT_LOCAL_DATABASE_URL))
    engine = create_engine(db_url)
    base_dir = Path(__file__).resolve().parent.parent

    table_filter = parse_table_filter(os.getenv("LOAD_POSTGRES_TABLES"))
    sources = filter_sources(discover_data_sources(base_dir), table_filter)
    if not sources:
        print("Nenhum artefato Parquet/CSV tratado encontrado para carregar.")
        if table_filter:
            print(f"Filtro solicitado: {', '.join(sorted(table_filter))}")
        return

    errors: list[str] = []
    loaded_tables: list[str] = []
    for source in sources:
        print(f"\nIniciando carga de {source.table_name} ({source.kind}) ...")
        try:
            load_source_in_chunks(source, engine)
            loaded_tables.append(source.table_name)
        except Exception as exc:
            message = f"Erro ao carregar {source.table_name}: {exc}"
            print(message)
            errors.append(message)

    if errors:
        print("\nCarga PostgreSQL finalizada com falhas:")
        for err in errors:
            print(f" - {err}")
        raise SystemExit(1)

    create_indexes(engine, loaded_tables)
    print("\nCarga PostgreSQL concluida sem falhas.")


if __name__ == "__main__":
    main()
