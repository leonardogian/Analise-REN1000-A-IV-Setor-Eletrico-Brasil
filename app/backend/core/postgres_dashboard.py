"""PostgreSQL-backed dashboard queries with JSON fallback handled by the API layer."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable

TIMESERIES_TABLE = "grupos_mensal_2023_plus"
HOME_SERVICE_TYPES_TABLE = "fato_transgressao_mensal_porte"
CORE_TABLES = (
    "fato_transgressao_mensal_distribuidora",
    HOME_SERVICE_TYPES_TABLE,
    "fato_uc_ativa_mensal_distribuidora",
    "fato_indicadores_anuais",
    "dim_distributor_group",
    "dim_distribuidora_porte",
    "fato_grupos_algoritmicos",
    TIMESERIES_TABLE,
)


class PostgresDashboardUnavailable(RuntimeError):
    """Raised when the optional PostgreSQL analytical path cannot serve a request."""


@dataclass(frozen=True)
class MonthWindow:
    start_yyyymm: int | None = None
    end_yyyymm: int | None = None


def parse_yyyy_mm(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    parts = value.split("-", 1)
    if len(parts) != 2:
        raise ValueError("Use month filters in YYYY-MM format.")
    year, month = int(parts[0]), int(parts[1])
    if month < 1 or month > 12:
        raise ValueError("Month must be between 01 and 12.")
    return year * 100 + month


def _number_or_none(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _number_or_zero(value: Any) -> float:
    return _number_or_none(value) or 0.0


def _ratio_or_none(numerator: Any, denominator: Any, multiplier: float = 1.0) -> float | None:
    num = _number_or_none(numerator)
    den = _number_or_none(denominator)
    if num is None or den in (None, 0):
        return None
    return num / den * multiplier


def _month_label(ano: int, mes: int) -> str:
    return f"{ano:04d}-{mes:02d}"


async def table_exists(pool: Any, table_name: str) -> bool:
    async with pool.acquire() as conn:
        return bool(await conn.fetchval("SELECT to_regclass($1) IS NOT NULL", table_name))


async def table_status(pool: Any, table_names: Iterable[str] = CORE_TABLES) -> dict[str, Any]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY($1::text[])
            ORDER BY table_name
            """,
            list(table_names),
        )
        present = {row["table_name"] for row in rows}

        counts: dict[str, int] = {}
        for table_name in sorted(present):
            counts[table_name] = int(await conn.fetchval(f'SELECT COUNT(*) FROM "{table_name}"'))

    expected = set(table_names)
    return {
        "available": True,
        "tables_ready": TIMESERIES_TABLE in present,
        "present_tables": sorted(present),
        "missing_tables": sorted(expected - present),
        "row_counts": counts,
    }


def _build_month_where(
    *, group_id: str | None, start: str | None, end: str | None
) -> tuple[str, list[Any]]:
    window = MonthWindow(parse_yyyy_mm(start), parse_yyyy_mm(end))
    clauses: list[str] = []
    args: list[Any] = []

    if group_id:
        args.append(group_id)
        clauses.append(f"group_id = ${len(args)}")
    if window.start_yyyymm is not None:
        args.append(window.start_yyyymm)
        clauses.append(f"(ano * 100 + mes) >= ${len(args)}")
    if window.end_yyyymm is not None:
        args.append(window.end_yyyymm)
        clauses.append(f"(ano * 100 + mes) <= ${len(args)}")

    return ("WHERE " + " AND ".join(clauses), args) if clauses else ("", args)


async def fetch_timeseries_tendencia(
    pool: Any,
    *,
    group_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    """Return the same data contract as dashboard_timeseries.json from Postgres."""
    if pool is None:
        raise PostgresDashboardUnavailable("PostgreSQL pool is not initialized.")
    if not await table_exists(pool, TIMESERIES_TABLE):
        raise PostgresDashboardUnavailable(f"Table {TIMESERIES_TABLE} is not loaded.")

    where_sql, args = _build_month_where(group_id=group_id, start=start, end=end)
    group_sql = f"""
        SELECT
            group_id,
            COALESCE(NULLIF(MAX(group_label), ''), group_id) AS grupo,
            ano,
            mes,
            SUM(qtd_fora_prazo)::double precision AS qtd_fora_prazo,
            SUM(compensacao_rs)::double precision AS compensacao_rs,
            SUM(uc_ativa_mes)::double precision AS uc_ativa_mes,
            MAX(periodo_regulatorio) AS periodo_regulatorio
        FROM {TIMESERIES_TABLE}
        {where_sql}
        GROUP BY group_id, ano, mes
        ORDER BY ano, mes, group_id
    """
    national_sql = f"""
        SELECT
            ano,
            mes,
            SUM(qtd_fora_prazo)::double precision AS qtd_fora_prazo,
            SUM(compensacao_rs)::double precision AS compensacao_rs,
            SUM(uc_ativa_mes)::double precision AS uc_ativa_mes,
            MAX(periodo_regulatorio) AS periodo_regulatorio
        FROM {TIMESERIES_TABLE}
        {where_sql}
        GROUP BY ano, mes
        ORDER BY ano, mes
    """

    async with pool.acquire() as conn:
        group_rows = await conn.fetch(group_sql, *args)
        national_rows = await conn.fetch(national_sql, *args)

    data: list[dict[str, Any]] = []
    if group_id is None:
        for row in national_rows:
            data.append(
                {
                    "grupo": "Média Nacional",
                    "tipo": "nacional",
                    "date": _month_label(int(row["ano"]), int(row["mes"])),
                    "fora_prazo_por_100k_uc_mes": _ratio_or_none(
                        row["qtd_fora_prazo"], row["uc_ativa_mes"], 100_000.0
                    ),
                    "compensacao_rs_por_uc_mes": _ratio_or_none(
                        row["compensacao_rs"], row["uc_ativa_mes"]
                    ),
                    "periodo_regulatorio": row["periodo_regulatorio"],
                }
            )

    for row in group_rows:
        data.append(
            {
                "grupo": row["grupo"],
                "tipo": row["group_id"],
                "date": _month_label(int(row["ano"]), int(row["mes"])),
                "fora_prazo_por_100k_uc_mes": _ratio_or_none(
                    row["qtd_fora_prazo"], row["uc_ativa_mes"], 100_000.0
                ),
                "compensacao_rs_por_uc_mes": _ratio_or_none(
                    row["compensacao_rs"], row["uc_ativa_mes"]
                ),
                "periodo_regulatorio": row["periodo_regulatorio"],
            }
        )

    return {"data": data}


async def fetch_home_service_types(pool: Any) -> dict[str, Any]:
    """Return exact annual class/locality rows for the Home lower charts."""
    if pool is None:
        raise PostgresDashboardUnavailable("PostgreSQL pool is not initialized.")
    if not await table_exists(pool, HOME_SERVICE_TYPES_TABLE):
        raise PostgresDashboardUnavailable(f"Table {HOME_SERVICE_TYPES_TABLE} is not loaded.")

    query = f"""
        SELECT
            ano,
            group_id,
            distributor_id,
            classe_local_servico,
            SUM(qtd_serv_realizado)::double precision AS qtd_serv_realizado,
            SUM(qtd_fora_prazo)::double precision AS qtd_fora_prazo,
            SUM(compensacao_rs)::double precision AS compensacao_rs,
            SUM(COALESCE(uc_ativa_mes, 0))::double precision AS uc_ativa_mes,
            COUNT(DISTINCT (ano::text || '-' || LPAD(mes::text, 2, '0')))::integer AS meses_observados
        FROM {HOME_SERVICE_TYPES_TABLE}
        GROUP BY ano, group_id, distributor_id, classe_local_servico
        ORDER BY ano, group_id, distributor_id, classe_local_servico
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    data = [
        {
            "ano": int(row["ano"]),
            "group_id": str(row["group_id"]),
            "distributor_id": str(row["distributor_id"]),
            "classe_local_servico": str(row["classe_local_servico"]),
            "qtd_serv_realizado": _number_or_zero(row["qtd_serv_realizado"]),
            "qtd_fora_prazo": _number_or_zero(row["qtd_fora_prazo"]),
            "compensacao_rs": _number_or_zero(row["compensacao_rs"]),
            "uc_ativa_mes": _number_or_zero(row["uc_ativa_mes"]),
            "meses_observados": int(row["meses_observados"] or 0),
        }
        for row in rows
    ]
    return {"data": data}
