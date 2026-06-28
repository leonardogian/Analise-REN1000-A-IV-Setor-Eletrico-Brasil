"""Build a lightweight municipality-level JSON payload for the optional map page.

This module intentionally stays out of the main dashboard pipeline. It scans the
large INDGER service Parquet in batches, aggregates directly to municipality
level, and writes a compact dashboard JSON for the experimental map branch.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_PROCESSED = ROOT / "data" / "processed"
DASHBOARD_DIR = DIR_PROCESSED / "dashboard"
INDGER_SERVICOS_PATH = DIR_PROCESSED / "indger_servicos_comerciais.parquet"
IBGE_MUNICIPIOS_ODS = ROOT / "data" / "raw" / "RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.ods"
OUTPUT_PATH = DASHBOARD_DIR / "dashboard_municipios.json"

INDGER_SOURCE_MONTH_RE = re.compile(r"(20\d{2})-(0[1-9]|1[0-2])\.csv$")
START_YEAR = 2023
BATCH_SIZE = 500_000

UF_NAMES = {
    "11": "Rondônia",
    "12": "Acre",
    "13": "Amazonas",
    "14": "Roraima",
    "15": "Pará",
    "16": "Amapá",
    "17": "Tocantins",
    "21": "Maranhão",
    "22": "Piauí",
    "23": "Ceará",
    "24": "Rio Grande do Norte",
    "25": "Paraíba",
    "26": "Pernambuco",
    "27": "Alagoas",
    "28": "Sergipe",
    "29": "Bahia",
    "31": "Minas Gerais",
    "32": "Espírito Santo",
    "33": "Rio de Janeiro",
    "35": "São Paulo",
    "41": "Paraná",
    "42": "Santa Catarina",
    "43": "Rio Grande do Sul",
    "50": "Mato Grosso do Sul",
    "51": "Mato Grosso",
    "52": "Goiás",
    "53": "Distrito Federal",
}

UF_ABBR = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}


def _safe_number(value: object) -> int | float | str | None:
    if value is None:
        return None
    if isinstance(value, (int, np.integer)) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, (np.floating, float)):
        number = float(value)
        if not np.isfinite(number):
            return None
        if number.is_integer():
            return int(number)
        return round(number, 6)
    if pd.isna(value):
        return None
    return str(value) if not isinstance(value, str) else value


def _parse_numeric(series: pd.Series) -> pd.Series:
    """Parse numeric columns from Parquet or Brazilian text fallback."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    text = series.astype("string").str.strip()
    text = text.str.replace(r"[^0-9,\.\-]", "", regex=True)
    text = text.replace({"": pd.NA, "-": pd.NA, ".": pd.NA, ",": pd.NA})
    has_comma = text.str.contains(",", na=False)

    out = text.copy()
    out.loc[has_comma] = out.loc[has_comma].str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    multi_dot = (~has_comma) & (out.str.count(r"\.") > 1)
    out.loc[multi_dot] = out.loc[multi_dot].str.replace(".", "", regex=False)
    return pd.to_numeric(out, errors="coerce")


def _ods_row_values(row: ET.Element, ns: dict[str, str]) -> list[str]:
    values: list[str] = []
    table_ns = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    for cell in row.findall("table:table-cell", ns):
        repeat = int(cell.attrib.get(f"{{{table_ns}}}number-columns-repeated", "1"))
        text = " ".join(node.text or "" for node in cell.findall(".//text:p", ns)).strip()
        # Clamp repeated trailing blank cells; the DTB table has a few at row ends.
        values.extend([text] * min(repeat, 16))
    return values


def load_ibge_municipal_dimension(path: Path = IBGE_MUNICIPIOS_ODS) -> dict[str, dict[str, str]]:
    """Load IBGE municipality code/name/UF from the extracted DTB ODS using stdlib only."""
    if not path.exists():
        return {}

    ns = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    }
    with ZipFile(path) as archive:
        # Safe in this project context: the ODS is a trusted local IBGE DTB artifact
        # extracted by src.etl.extract_ibge.py, not arbitrary user-supplied XML.
        root = ET.fromstring(archive.read("content.xml"))

    rows = root.findall(".//table:table-row", ns)
    header: list[str] | None = None
    out: dict[str, dict[str, str]] = {}

    for row in rows:
        values = _ods_row_values(row, ns)
        if not any(values):
            continue
        if header is None:
            if "Código Município Completo" in values and "Nome_Município" in values:
                header = values
            continue

        if len(values) < len(header):
            values.extend([""] * (len(header) - len(values)))
        record = dict(zip(header, values))
        code = str(record.get("Código Município Completo", "")).strip()
        if not code or not code.isdigit():
            continue
        uf_code = str(record.get("UF", code[:2])).strip().zfill(2)
        out[code.zfill(7)] = {
            "uf_code": uf_code,
            "uf": UF_ABBR.get(uf_code, uf_code),
            "uf_nome": str(record.get("Nome_UF") or UF_NAMES.get(uf_code, uf_code)).strip(),
            "nome_municipio": str(record.get("Nome_Município") or code).strip(),
        }

    return out


def _month_from_source(source: pd.Series) -> pd.DataFrame:
    extracted = source.astype("string").fillna("").str.extract(INDGER_SOURCE_MONTH_RE)
    return pd.DataFrame(
        {
            "ano": pd.to_numeric(extracted[0], errors="coerce").astype("Int64"),
            "mes": pd.to_numeric(extracted[1], errors="coerce").astype("Int64"),
        }
    )


def build_payload() -> dict[str, object]:
    if not INDGER_SERVICOS_PATH.exists():
        raise FileNotFoundError(
            f"Missing {INDGER_SERVICOS_PATH.relative_to(ROOT)}. Run `make transform` first."
        )

    columns = [
        "codmunicipioibge",
        "qtdservrealizado",
        "qtdservrealizdescprazo",
        "vlrpagocompensacao",
        "_source_file",
    ]
    metric_cols = ["qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs"]
    partials: list[pd.DataFrame] = []
    parquet_file = pq.ParquetFile(INDGER_SERVICOS_PATH)
    input_rows = parquet_file.metadata.num_rows

    for batch in parquet_file.iter_batches(batch_size=BATCH_SIZE, columns=columns):
        frame = batch.to_pandas()
        if frame.empty:
            continue

        month = _month_from_source(frame["_source_file"])
        frame["ano"] = month["ano"]
        frame["mes"] = month["mes"]
        frame = frame.dropna(subset=["ano", "mes", "codmunicipioibge"])
        frame = frame[frame["ano"] >= START_YEAR].copy()
        if frame.empty:
            continue

        frame["ano"] = frame["ano"].astype(int)
        frame["mes"] = frame["mes"].astype(int)
        frame["codmunicipioibge"] = (
            frame["codmunicipioibge"].astype("string").str.replace(".0", "", regex=False).str.strip().str.zfill(7)
        )
        frame["qtd_serv_realizado"] = _parse_numeric(frame["qtdservrealizado"])
        frame["qtd_fora_prazo"] = _parse_numeric(frame["qtdservrealizdescprazo"])
        frame["compensacao_rs"] = _parse_numeric(frame["vlrpagocompensacao"])

        partials.append(
            frame.groupby(["ano", "mes", "codmunicipioibge"], as_index=False, dropna=False)[metric_cols]
            .sum()
        )

    if not partials:
        raise RuntimeError("No municipality rows were produced from INDGER service data.")

    monthly = (
        pd.concat(partials, ignore_index=True)
        .groupby(["ano", "mes", "codmunicipioibge"], as_index=False, dropna=False)[metric_cols]
        .sum()
    )
    monthly["periodo"] = monthly["ano"].astype(str) + "-" + monthly["mes"].astype(str).str.zfill(2)

    dimension = load_ibge_municipal_dimension()
    unknown_codes: list[str] = []
    unknown_monthly_rows = 0
    if dimension:
        known_codes = set(dimension.keys())
        known_mask = monthly["codmunicipioibge"].isin(known_codes)
        unknown_monthly_rows = int((~known_mask).sum())
        unknown_codes = sorted(monthly.loc[~known_mask, "codmunicipioibge"].dropna().unique().tolist())
        monthly = monthly[known_mask].copy()

    by_municipio = (
        monthly.groupby("codmunicipioibge", as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            meses_com_dados=("periodo", "nunique"),
        )
    )
    by_municipio["taxa_fora_prazo"] = np.where(
        by_municipio["qtd_serv_realizado"] > 0,
        by_municipio["qtd_fora_prazo"] / by_municipio["qtd_serv_realizado"],
        np.nan,
    )

    by_municipio["uf_code"] = by_municipio["codmunicipioibge"].str[:2]
    by_municipio["uf"] = by_municipio["uf_code"].map(lambda code: UF_ABBR.get(str(code), str(code)))
    by_municipio["uf_nome"] = by_municipio["uf_code"].map(lambda code: UF_NAMES.get(str(code), str(code)))
    by_municipio["nome_municipio"] = by_municipio["codmunicipioibge"]

    if dimension:
        by_municipio["uf_code"] = by_municipio["codmunicipioibge"].map(lambda code: dimension.get(str(code), {}).get("uf_code", str(code)[:2]))
        by_municipio["uf"] = by_municipio["codmunicipioibge"].map(lambda code: dimension.get(str(code), {}).get("uf", UF_ABBR.get(str(code)[:2], str(code)[:2])))
        by_municipio["uf_nome"] = by_municipio["codmunicipioibge"].map(lambda code: dimension.get(str(code), {}).get("uf_nome", UF_NAMES.get(str(code)[:2], str(code)[:2])))
        by_municipio["nome_municipio"] = by_municipio["codmunicipioibge"].map(lambda code: dimension.get(str(code), {}).get("nome_municipio", str(code)))

    ufs = (
        by_municipio.groupby(["uf_code", "uf", "uf_nome"], as_index=False)
        .agg(
            municipio_count=("codmunicipioibge", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    ufs["taxa_fora_prazo"] = np.where(
        ufs["qtd_serv_realizado"] > 0,
        ufs["qtd_fora_prazo"] / ufs["qtd_serv_realizado"],
        np.nan,
    )

    periods = sorted(monthly["periodo"].dropna().unique().tolist())
    municipio_records = []
    keep_cols = [
        "codmunicipioibge",
        "nome_municipio",
        "uf_code",
        "uf",
        "uf_nome",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "taxa_fora_prazo",
        "meses_com_dados",
    ]
    for row in by_municipio.sort_values(["uf_code", "nome_municipio"])[keep_cols].to_dict("records"):
        municipio_records.append({key: _safe_number(value) for key, value in row.items()})

    uf_records = []
    for row in ufs.sort_values("compensacao_rs", ascending=False).to_dict("records"):
        uf_records.append({key: _safe_number(value) for key, value in row.items()})

    return {
        "meta": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source": str(INDGER_SERVICOS_PATH.relative_to(ROOT)),
            "ibge_dimension": str(IBGE_MUNICIPIOS_ODS.relative_to(ROOT)) if IBGE_MUNICIPIOS_ODS.exists() else None,
            "input_rows": int(input_rows),
            "municipality_count": int(by_municipio["codmunicipioibge"].nunique()),
            "municipality_month_rows": int(len(monthly)),
            "period_start": periods[0] if periods else None,
            "period_end": periods[-1] if periods else None,
            "period_count": len(periods),
            "unknown_municipality_codes_dropped": unknown_codes,
            "unknown_municipality_month_rows_dropped": unknown_monthly_rows,
            "grain": "municipio agregado 2023+ para mapa; sem granularidade por serviço/distribuidora no JSON",
        },
        "ufs": uf_records,
        "municipios": municipio_records,
    }


def write_payload(payload: dict[str, object], path: Path = OUTPUT_PATH) -> Path:
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path


def main() -> None:
    payload = build_payload()
    output = write_payload(payload)
    size_mb = output.stat().st_size / (1024 * 1024)
    meta = payload["meta"]
    if not isinstance(meta, dict):
        raise RuntimeError("Invalid metadata generated for municipality map payload.")
    print(
        "Municipality map payload generated: "
        f"{output.relative_to(ROOT)} ({size_mb:.1f} MB, "
        f"{int(meta['municipality_count']):,} municipios, "
        f"{int(meta['municipality_month_rows']):,} municipio-mes)"
    )


if __name__ == "__main__":
    main()
