"""Build analytical tables for ANEEL commercial service analysis.

Usage:
    python -m src.analysis.build_analysis_tables
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
import pandas as pd

from src.analysis.distributor_groups import (
    annotate_distributor_group,
    build_group_dimension,
    load_group_overrides,
)

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_PROCESSED = ROOT / "data" / "processed"
DIR_ANALYSIS = DIR_PROCESSED / "analysis"
DOMAIN_INDICATORS_PATH = ROOT / "data" / "raw" / "dominio-indicadores.csv"

FAMILIAS_VALIDAS = {"QS", "QV", "PM", "CR"}


def parse_br_number(series: pd.Series) -> pd.Series:
    """Parse Brazilian formatted numbers into float."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    normalized = (
        series.astype("string")
        .str.strip()
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
        .str.replace(r"[^0-9\.-]", "", regex=True)
        .replace({"": pd.NA, "-": pd.NA, ".": pd.NA})
    )
    return pd.to_numeric(normalized, errors="coerce")


def safe_read_csv(path: Path, sep: str = ";") -> pd.DataFrame:
    """Read CSV trying common encodings and skipping malformed rows."""
    encodings = ["utf-16", "utf-8", "latin-1", "cp1252"]
    for encoding in encodings:
        try:
            return pd.read_csv(path, sep=sep, encoding=encoding, engine="python", on_bad_lines="skip")
        except Exception:
            continue
    raise RuntimeError(f"Could not read CSV: {path}")


def normalize_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def classify_segment(text: str) -> str:
    upper = text.upper()
    if "GRUPO A" in upper:
        return "grupo_a"
    if "GRUPO B" in upper and "RURAL" in upper:
        return "grupo_b_rural"
    if "GRUPO B" in upper and ("URBANA" in upper or "URBANO" in upper):
        return "grupo_b_urbana"
    if "GRUPO B" in upper:
        return "grupo_b"
    if "RURAL" in upper:
        return "rural"
    if "URBANA" in upper or "URBANO" in upper:
        return "urbana"
    return "nao_classificado"


def clean_service_name(description: str) -> str:
    if not description:
        return ""

    text = normalize_text(description)
    text = re.sub(r"\(art\.[^)]*\)", "", text, flags=re.IGNORECASE)

    prefixes = [
        r"^Quantidade de\s*",
        r"^Quant\.\s*Prazos\s*Viol\.\s*de\s*",
        r"^Quant\.\s*Prazos\s*Viol\.\s*",
        r"^Prazo\s*M[eé]dio\s*de\s*",
        r"^Cr[eé]d\.\s*Prazo\s*Viol\.\s*de\s*",
        r"^Cr[eé]d\.\s*Prazo\s*Viol\.\s*por\s*",
        r"^Cr[eé]ditos\s*cedidos\s*por\s*",
    ]
    for pattern in prefixes:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    return normalize_text(text)


def extract_artigo(description: str) -> str:
    if not description:
        return ""
    match = re.search(r"\((art\.[^)]*)\)", description, flags=re.IGNORECASE)
    return normalize_text(match.group(1)) if match else ""


def infer_familia(sigindicador: str) -> str:
    code = normalize_text(sigindicador)
    if len(code) < 2:
        return "OUTRO"
    prefix = code[:2]
    return prefix if prefix in FAMILIAS_VALIDAS else "OUTRO"


def infer_codigo_base(sigindicador: str, familia: str) -> str:
    code = normalize_text(sigindicador)
    if familia in FAMILIAS_VALIDAS and len(code) > 2:
        return code[2:]
    return code


def assign_porte_bucket(values: pd.Series) -> pd.Series:
    pct = values.rank(method="average", pct=True)
    return pd.cut(
        pct,
        bins=[0.0, 0.25, 0.5, 0.75, 1.0],
        labels=["P", "M", "G", "GG"],
        include_lowest=True,
    ).astype("string")


def load_qualidade_comercial(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
) -> pd.DataFrame:
    path = DIR_PROCESSED / "qualidade_comercial.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    frame = pd.read_parquet(
        path,
        columns=[
            "sigagente",
            "sigindicador",
            "anoindice",
            "numperiodoindice",
            "vlrindiceenviado",
        ],
    )
    frame["sigagente"] = frame["sigagente"].astype("string").str.strip()
    frame["sigindicador"] = frame["sigindicador"].astype("string").str.strip()
    frame["ano"] = pd.to_numeric(frame["anoindice"], errors="coerce").astype("Int64")
    frame["periodo"] = pd.to_numeric(frame["numperiodoindice"], errors="coerce").astype("Int64")
    frame["valor"] = parse_br_number(frame["vlrindiceenviado"]).fillna(0.0)
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
    )
    return frame


def load_domain_indicators() -> pd.DataFrame:
    if not DOMAIN_INDICATORS_PATH.exists():
        raise FileNotFoundError(f"Missing file: {DOMAIN_INDICATORS_PATH}")

    domain = safe_read_csv(DOMAIN_INDICATORS_PATH, sep=";")
    domain.columns = [normalize_text(c) for c in domain.columns]
    rename_map = {
        "DatGeracaoConjuntoDados": "datgeracaoconjuntodados",
        "SigIndicador": "sigindicador",
        "DscIndicador": "dscindicador",
    }
    domain = domain.rename(columns=rename_map)

    required = {"sigindicador", "dscindicador"}
    missing = required - set(domain.columns)
    if missing:
        raise RuntimeError(f"Domain indicator columns missing: {missing}")

    domain["sigindicador"] = domain["sigindicador"].astype("string").str.strip()
    domain["dscindicador"] = domain["dscindicador"].astype("string").str.strip()
    domain = domain.dropna(subset=["sigindicador"]).drop_duplicates(subset=["sigindicador"])
    return domain[["sigindicador", "dscindicador"]]


def build_dim_indicador_servico(qualidade: pd.DataFrame, domain: pd.DataFrame) -> pd.DataFrame:
    dim = (
        qualidade[["sigindicador"]]
        .dropna()
        .drop_duplicates()
        .merge(domain, on="sigindicador", how="left")
        .sort_values("sigindicador")
        .reset_index(drop=True)
    )
    dim["familia_indicador"] = dim["sigindicador"].apply(infer_familia)
    dim["codigo_base"] = dim.apply(
        lambda row: infer_codigo_base(row["sigindicador"], row["familia_indicador"]), axis=1
    )
    dim["servico_nome"] = dim["dscindicador"].apply(lambda v: clean_service_name(normalize_text(v)))
    dim["classe_local"] = dim["dscindicador"].apply(lambda v: classify_segment(normalize_text(v)))
    dim["artigo_ren"] = dim["dscindicador"].apply(lambda v: extract_artigo(normalize_text(v)))
    return dim


def build_fato_indicadores_anuais(qualidade: pd.DataFrame, dim_indicador: pd.DataFrame) -> pd.DataFrame:
    enriched = qualidade.merge(
        dim_indicador[["sigindicador", "familia_indicador", "codigo_base", "classe_local"]],
        on="sigindicador",
        how="left",
    )
    enriched = enriched[enriched["familia_indicador"].isin(FAMILIAS_VALIDAS)].copy()
    enriched = enriched.dropna(subset=["ano", "sigagente", "codigo_base", "distributor_id", "group_id"])

    keys = ["ano", "group_id", "distributor_id", "sigagente", "codigo_base", "classe_local"]

    qs = (
        enriched[enriched["familia_indicador"] == "QS"]
        .groupby(keys, dropna=False)["valor"]
        .sum()
        .rename("qtd_serv")
    )
    qv = (
        enriched[enriched["familia_indicador"] == "QV"]
        .groupby(keys, dropna=False)["valor"]
        .sum()
        .rename("qtd_fora_prazo")
    )
    pm = (
        enriched[enriched["familia_indicador"] == "PM"]
        .groupby(keys, dropna=False)["valor"]
        .mean()
        .rename("prazo_medio")
    )
    cr = (
        enriched[enriched["familia_indicador"] == "CR"]
        .groupby(keys, dropna=False)["valor"]
        .sum()
        .rename("compensacao_rs")
    )

    fact = pd.concat([qs, qv, pm, cr], axis=1).reset_index()

    fact["has_qs"] = fact["qtd_serv"].notna()
    fact["has_qv"] = fact["qtd_fora_prazo"].notna()
    fact["has_pm"] = fact["prazo_medio"].notna()
    fact["has_cr"] = fact["compensacao_rs"].notna()

    for col in ["qtd_serv", "qtd_fora_prazo", "prazo_medio", "compensacao_rs"]:
        fact[col] = fact[col].fillna(0.0)

    fact["taxa_fora_prazo"] = np.where(
        fact["qtd_serv"] > 0,
        fact["qtd_fora_prazo"] / fact["qtd_serv"],
        np.nan,
    )
    fact["periodo_regulatorio"] = np.where(fact["ano"] <= 2021, "pre_2022", "pos_2022")
    fact["ano_comparavel_principal"] = fact["ano"].between(2011, 2023, inclusive="both")

    return fact.sort_values(["ano", "group_id", "distributor_id", "codigo_base"]).reset_index(drop=True)


def build_dim_distribuidora_porte(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
) -> pd.DataFrame:
    path = DIR_PROCESSED / "indger_dados_comerciais.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    frame = pd.read_parquet(
        path,
        columns=[
            "datreferenciainformada",
            "sigagente",
            "nomagente",
            "qtducativa",
        ],
    )

    frame["sigagente"] = frame["sigagente"].astype("string").str.strip()
    frame["nomagente"] = frame["nomagente"].astype("string").str.strip()
    frame["dt_ref"] = pd.to_datetime(frame["datreferenciainformada"], errors="coerce")
    frame = frame.dropna(subset=["dt_ref", "sigagente"])
    frame["ano"] = frame["dt_ref"].dt.year
    frame["mes"] = frame["dt_ref"].dt.month
    frame["uc_ativa"] = parse_br_number(frame["qtducativa"]).fillna(0.0)
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
    )

    monthly = (
        frame.groupby(
            ["ano", "mes", "group_id", "distributor_id", "sigagente", "nomagente"],
            dropna=False,
        )["uc_ativa"]
        .sum()
        .reset_index()
    )

    dim = (
        monthly.groupby(
            ["ano", "group_id", "distributor_id", "sigagente", "nomagente"],
            dropna=False,
        )["uc_ativa"]
        .mean()
        .reset_index()
        .rename(columns={"uc_ativa": "uc_ativa_media_mensal"})
    )

    dim["rank_porte_ano"] = (
        dim.groupby("ano")["uc_ativa_media_mensal"].rank(method="dense", ascending=False).astype("Int64")
    )
    dim["bucket_porte"] = dim.groupby("ano", group_keys=False)["uc_ativa_media_mensal"].apply(assign_porte_bucket)
    dim["share_uc_ano"] = dim["uc_ativa_media_mensal"] / dim.groupby("ano")["uc_ativa_media_mensal"].transform("sum")

    return dim.sort_values(["ano", "rank_porte_ano", "group_id", "distributor_id"]).reset_index(drop=True)


def build_uc_ativa_mensal_distribuidora(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
) -> pd.DataFrame:
    """Build monthly UC active totals per distributor."""
    path = DIR_PROCESSED / "indger_dados_comerciais.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    frame = pd.read_parquet(
        path,
        columns=[
            "datreferenciainformada",
            "sigagente",
            "nomagente",
            "qtducativa",
        ],
    )

    frame["sigagente"] = frame["sigagente"].astype("string").str.strip()
    frame["nomagente"] = frame["nomagente"].astype("string").str.strip()
    frame["dt_ref"] = pd.to_datetime(frame["datreferenciainformada"], errors="coerce")
    frame = frame.dropna(subset=["dt_ref", "sigagente"])
    frame["ano"] = frame["dt_ref"].dt.year
    frame["mes"] = frame["dt_ref"].dt.month
    frame["uc_ativa"] = parse_br_number(frame["qtducativa"]).fillna(0.0)
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
    )

    monthly = (
        frame.groupby(
            ["ano", "mes", "group_id", "distributor_id", "sigagente", "nomagente"],
            dropna=False,
        )["uc_ativa"]
        .sum()
        .reset_index()
        .rename(columns={"uc_ativa": "uc_ativa_mes"})
    )
    return monthly.sort_values(["ano", "mes", "group_id", "distributor_id"]).reset_index(drop=True)


def build_fato_servicos_municipio_mes(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
) -> pd.DataFrame:
    path = DIR_PROCESSED / "indger_servicos_comerciais.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    frame = pd.read_parquet(
        path,
        columns=[
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
        ],
    )

    frame["sigagente"] = frame["sigagente"].astype("string").str.strip()
    frame["nomagente"] = frame["nomagente"].astype("string").str.strip()
    frame["dsctiposervico"] = frame["dsctiposervico"].astype("string").str.strip()
    frame["dscprazo"] = frame["dscprazo"].astype("string").str.strip()

    frame["dt_ref"] = pd.to_datetime(frame["datreferenciainformada"], errors="coerce")
    frame = frame.dropna(subset=["dt_ref", "sigagente"])
    frame["ano"] = frame["dt_ref"].dt.year
    frame["mes"] = frame["dt_ref"].dt.month
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
    )

    frame["codmunicipioibge"] = (
        frame["codmunicipioibge"].astype("string").str.replace(".0", "", regex=False).str.strip()
    )
    frame["codtiposervico"] = frame["codtiposervico"].astype("string").str.strip()

    frame["qtd_serv_realizado"] = parse_br_number(frame["qtdservrealizado"]).fillna(0.0)
    frame["qtd_fora_prazo"] = parse_br_number(frame["qtdservrealizdescprazo"]).fillna(0.0)
    frame["compensacao_rs"] = parse_br_number(frame["vlrpagocompensacao"]).fillna(0.0)
    frame["classe_local_servico"] = frame["dsctiposervico"].apply(lambda v: classify_segment(normalize_text(v)))

    keys = [
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "sigagente",
        "nomagente",
        "codmunicipioibge",
        "codtiposervico",
        "dsctiposervico",
        "dscprazo",
        "classe_local_servico",
    ]

    fact = (
        frame.groupby(keys, dropna=False)[["qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs"]]
        .sum()
        .reset_index()
    )

    fact["taxa_fora_prazo"] = np.where(
        fact["qtd_serv_realizado"] > 0,
        fact["qtd_fora_prazo"] / fact["qtd_serv_realizado"],
        np.nan,
    )
    fact["periodo_regulatorio"] = np.where(fact["ano"] <= 2021, "pre_2022", "pos_2022")
    fact["ano_comparavel_principal"] = fact["ano"].between(2023, 2025, inclusive="both")

    return fact.sort_values(
        ["ano", "mes", "group_id", "distributor_id", "codmunicipioibge", "codtiposervico"]
    ).reset_index(drop=True)


def build_fato_transgressao_mensal_porte(
    fato_servicos_municipio_mes: pd.DataFrame,
    uc_ativa_mensal_distribuidora: pd.DataFrame,
    dim_porte: pd.DataFrame,
) -> pd.DataFrame:
    """Monthly transgression/compensation by distributor, normalized by size."""
    mensal = (
        fato_servicos_municipio_mes.groupby(
            [
                "ano",
                "mes",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "classe_local_servico",
            ],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )

    mensal = mensal.merge(
        uc_ativa_mensal_distribuidora[
            ["ano", "mes", "distributor_id", "group_id", "uc_ativa_mes"]
        ],
        on=["ano", "mes", "distributor_id", "group_id"],
        how="left",
    )
    mensal = mensal.merge(
        dim_porte[
            [
                "ano",
                "distributor_id",
                "group_id",
                "bucket_porte",
                "rank_porte_ano",
                "uc_ativa_media_mensal",
            ]
        ],
        on=["ano", "distributor_id", "group_id"],
        how="left",
    )

    mensal["taxa_fora_prazo"] = np.where(
        mensal["qtd_serv_realizado"] > 0,
        mensal["qtd_fora_prazo"] / mensal["qtd_serv_realizado"],
        np.nan,
    )
    mensal["fora_prazo_por_100k_uc_mes"] = np.where(
        mensal["uc_ativa_mes"] > 0,
        mensal["qtd_fora_prazo"] / mensal["uc_ativa_mes"] * 100000.0,
        np.nan,
    )
    mensal["compensacao_rs_por_uc_mes"] = np.where(
        mensal["uc_ativa_mes"] > 0,
        mensal["compensacao_rs"] / mensal["uc_ativa_mes"],
        np.nan,
    )
    mensal["compensacao_media_por_transgressao_rs"] = np.where(
        mensal["qtd_fora_prazo"] > 0,
        mensal["compensacao_rs"] / mensal["qtd_fora_prazo"],
        np.nan,
    )
    mensal["periodo_regulatorio"] = np.where(mensal["ano"] <= 2021, "pre_2022", "pos_2022")
    mensal["ano_comparavel_principal"] = mensal["ano"].between(2023, 2025, inclusive="both")

    return mensal.sort_values(
        ["ano", "mes", "group_id", "distributor_id", "classe_local_servico"]
    ).reset_index(drop=True)


def build_fato_transgressao_mensal_distribuidora(
    fato_transgressao_mensal_porte: pd.DataFrame,
) -> pd.DataFrame:
    """Lean monthly table by distributor (aggregated across service classes)."""
    fact = (
        fato_transgressao_mensal_porte.groupby(
            [
                "ano",
                "mes",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "uc_ativa_mes",
                "bucket_porte",
                "rank_porte_ano",
                "uc_ativa_media_mensal",
            ],
            as_index=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    fact["taxa_fora_prazo"] = np.where(
        fact["qtd_serv_realizado"] > 0,
        fact["qtd_fora_prazo"] / fact["qtd_serv_realizado"],
        np.nan,
    )
    fact["fora_prazo_por_100k_uc_mes"] = np.where(
        fact["uc_ativa_mes"] > 0,
        fact["qtd_fora_prazo"] / fact["uc_ativa_mes"] * 100000.0,
        np.nan,
    )
    fact["compensacao_rs_por_uc_mes"] = np.where(
        fact["uc_ativa_mes"] > 0,
        fact["compensacao_rs"] / fact["uc_ativa_mes"],
        np.nan,
    )
    fact["compensacao_media_por_transgressao_rs"] = np.where(
        fact["qtd_fora_prazo"] > 0,
        fact["compensacao_rs"] / fact["qtd_fora_prazo"],
        np.nan,
    )
    fact["periodo_regulatorio"] = np.where(fact["ano"] <= 2021, "pre_2022", "pos_2022")
    fact["ano_comparavel_principal"] = fact["ano"].between(2023, 2025, inclusive="both")
    return fact.sort_values(["ano", "mes", "group_id", "distributor_id"]).reset_index(drop=True)


def merge_fato_with_porte(fato_indicadores: pd.DataFrame, dim_porte: pd.DataFrame) -> pd.DataFrame:
    merge_cols = [
        "ano",
        "group_id",
        "distributor_id",
        "sigagente",
        "uc_ativa_media_mensal",
        "bucket_porte",
        "rank_porte_ano",
        "nomagente",
    ]
    enriched = fato_indicadores.merge(
        dim_porte[merge_cols],
        on=["ano", "group_id", "distributor_id", "sigagente"],
        how="left",
    )

    enriched["fora_prazo_por_100k_uc"] = np.where(
        enriched["uc_ativa_media_mensal"] > 0,
        enriched["qtd_fora_prazo"] / enriched["uc_ativa_media_mensal"] * 100000.0,
        np.nan,
    )
    enriched["compensacao_rs_por_uc"] = np.where(
        enriched["uc_ativa_media_mensal"] > 0,
        enriched["compensacao_rs"] / enriched["uc_ativa_media_mensal"],
        np.nan,
    )
    return enriched


def save_table(frame: pd.DataFrame, base_name: str, write_csv: bool = True) -> None:
    DIR_ANALYSIS.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(DIR_ANALYSIS / f"{base_name}.parquet", index=False)
    if write_csv:
        frame.to_csv(DIR_ANALYSIS / f"{base_name}.csv", index=False)


def build_kpi_overview(fato_indicadores: pd.DataFrame) -> pd.DataFrame:
    yearly = (
        fato_indicadores[fato_indicadores["ano_comparavel_principal"]]
        .groupby(["ano", "periodo_regulatorio"], as_index=False)
        .agg(
            qtd_serv=("qtd_serv", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    yearly["taxa_fora_prazo"] = np.where(
        yearly["qtd_serv"] > 0,
        yearly["qtd_fora_prazo"] / yearly["qtd_serv"],
        np.nan,
    )
    return yearly.sort_values("ano").reset_index(drop=True)


def run_all() -> dict[str, pd.DataFrame]:
    distributor_to_group, group_labels = load_group_overrides()
    qualidade = load_qualidade_comercial(distributor_to_group, group_labels)
    domain = load_domain_indicators()

    dim_indicador = build_dim_indicador_servico(qualidade, domain)
    fato_indicadores = build_fato_indicadores_anuais(qualidade, dim_indicador)
    dim_porte = build_dim_distribuidora_porte(distributor_to_group, group_labels)
    uc_ativa_mensal = build_uc_ativa_mensal_distribuidora(distributor_to_group, group_labels)
    fato_servicos = build_fato_servicos_municipio_mes(distributor_to_group, group_labels)
    fato_transgressao_mensal_porte = build_fato_transgressao_mensal_porte(
        fato_servicos, uc_ativa_mensal, dim_porte
    )
    fato_transgressao_mensal_distribuidora = build_fato_transgressao_mensal_distribuidora(
        fato_transgressao_mensal_porte
    )

    fato_indicadores = merge_fato_with_porte(fato_indicadores, dim_porte)
    kpi_overview = build_kpi_overview(fato_indicadores)
    dim_group = build_group_dimension(dim_porte)

    fact_tables = {
        "dim_distribuidora_porte": dim_porte,
        "fato_uc_ativa_mensal_distribuidora": uc_ativa_mensal,
        "fato_indicadores_anuais": fato_indicadores,
        "fato_servicos_municipio_mes": fato_servicos,
        "fato_transgressao_mensal_porte": fato_transgressao_mensal_porte,
        "fato_transgressao_mensal_distribuidora": fato_transgressao_mensal_distribuidora,
    }
    for table_name, table in fact_tables.items():
        if "group_id" in table.columns and table["group_id"].isna().any():
            raise RuntimeError(f"group_id contains nulls in table {table_name}")
        if "distributor_id" in table.columns and table["distributor_id"].isna().any():
            raise RuntimeError(f"distributor_id contains nulls in table {table_name}")

    save_table(dim_indicador, "dim_indicador_servico")
    save_table(dim_porte, "dim_distribuidora_porte")
    save_table(dim_group, "dim_distributor_group")
    save_table(uc_ativa_mensal, "fato_uc_ativa_mensal_distribuidora")
    save_table(fato_indicadores, "fato_indicadores_anuais")
    save_table(fato_servicos, "fato_servicos_municipio_mes", write_csv=False)
    save_table(fato_transgressao_mensal_porte, "fato_transgressao_mensal_porte")
    save_table(fato_transgressao_mensal_distribuidora, "fato_transgressao_mensal_distribuidora")
    save_table(kpi_overview, "kpi_regulatorio_anual")

    return {
        "dim_indicador_servico": dim_indicador,
        "dim_distribuidora_porte": dim_porte,
        "dim_distributor_group": dim_group,
        "fato_uc_ativa_mensal_distribuidora": uc_ativa_mensal,
        "fato_indicadores_anuais": fato_indicadores,
        "fato_servicos_municipio_mes": fato_servicos,
        "fato_transgressao_mensal_porte": fato_transgressao_mensal_porte,
        "fato_transgressao_mensal_distribuidora": fato_transgressao_mensal_distribuidora,
        "kpi_regulatorio_anual": kpi_overview,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ANEEL analysis tables")
    _ = parser.parse_args()

    outputs = run_all()
    print("Analysis tables generated:")
    for name, frame in outputs.items():
        print(f"  - {name}: {len(frame):,} rows")
    print(f"Output dir: {DIR_ANALYSIS}")


if __name__ == "__main__":
    main()
