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
import pyarrow.parquet as pq

from src.analysis.config import (
    ANOS_COMPARAVEIS,
    REN1000_CUTOFF_YEAR,
    SERIES_HISTORICA,
)
from src.analysis.metrics import (
    calc_compensacao_anualizada,
    calc_compensacao_media_por_transgressao,
    calc_compensacao_por_uc,
    calc_fora_prazo_por_100k,
    calc_taxa_fora_prazo,
    classify_periodo_regulatorio,
    classify_regime_regulatorio,
)
from src.analysis.distributor_groups import (
    annotate_distributor_group,
    build_group_dimension,
    compose_distributor_label,
    default_group_label,
    load_distributor_name_overrides,
    load_group_overrides,
)
from src.etl.schema_contracts import validate_indger_periods

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_PROCESSED = ROOT / "data" / "processed"
DIR_ANALYSIS = DIR_PROCESSED / "analysis"
DOMAIN_INDICATORS_PATH = ROOT / "data" / "raw" / "dominio-indicadores.csv"

FAMILIAS_VALIDAS = {"QS", "QV", "PM", "CR"}
INDGER_SOURCE_MONTH_RE = re.compile(r"(20\d{2})-(0[1-9]|1[0-2])\.csv$")


def build_indger_servicos_analysis_filters() -> list[tuple[str, str, str]]:
    """Return Parquet filters for the current analytical INDGER service window.

    INDGER Servicos Comerciais is the monthly REN 1000 operational source. The
    dashboard should follow newly published months after the baseline instead of
    freezing at 2025, while keeping the start anchored at 2023-01 (first monthly
    INDGER service period used by the project).
    """
    start_year, _ = ANOS_COMPARAVEIS
    return [
        ("_source_file", ">=", f"indger-dados-servicos-comerciais-{start_year}-01.csv"),
    ]


def parse_br_number(series: pd.Series) -> pd.Series:
    """Parse Brazilian formatted numbers into float safely, avoiding US format corruption."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    def _parse_val(val: object) -> float:
        if pd.isna(val):
            return pd.NA
        s = str(val).strip()
        if not s or s in ("-", ".", ","):
            return pd.NA

        s = re.sub(r"[^0-9\.,-]", "", s)
        if not s:
            return pd.NA

        last_dot = s.rfind(".")
        last_comma = s.rfind(",")

        if last_dot > -1 and last_comma > -1:
            if last_dot > last_comma:
                # 1,234.56 -> US
                s = s.replace(",", "")
            else:
                # 1.234,56 -> BR
                s = s.replace(".", "").replace(",", ".")
        elif last_comma > -1:
            # 1234,56 -> BR
            s = s.replace(",", ".")
        elif last_dot > -1:
            # Multiple dots -> BR thousands: 1.000.000
            if s.count(".") > 1:
                s = s.replace(".", "")
            # Single dot -> assume US decimal (1234.56)

        try:
            return float(s)
        except ValueError:
            return pd.NA

    return series.apply(_parse_val)


def derive_indger_year_month(frame: pd.DataFrame) -> pd.DataFrame:
    """Derive INDGER reference year/month from source file or encoded date."""
    if "datreferenciainformada" not in frame.columns:
        raise RuntimeError("INDGER frame missing datreferenciainformada")

    result = frame.copy()
    parsed = pd.to_datetime(result["datreferenciainformada"], errors="coerce")
    result["ano"] = parsed.dt.year.astype("Int64")
    result["mes"] = parsed.dt.month.astype("Int64")

    parsed_day = parsed.dt.day.astype("Int64")

    if "_source_file" in result.columns:
        source = result["_source_file"].astype("string").str.extract(INDGER_SOURCE_MONTH_RE)
        source_year = pd.to_numeric(source[0], errors="coerce").astype("Int64")
        source_month = pd.to_numeric(source[1], errors="coerce").astype("Int64")
        has_source_month = source_year.notna() & source_month.notna()

        encoded_month = (
            parsed.notna()
            & result["mes"].eq(1)
            & parsed_day.between(1, 12)
        )
        expected_month_from_date = result["mes"].where(~encoded_month, parsed_day)
        inconsistent = (
            has_source_month
            & parsed.notna()
            & (
                source_year.ne(result["ano"])
                | source_month.ne(expected_month_from_date.astype("Int64"))
            )
        )
        if inconsistent.any():
            examples = (
                result.loc[inconsistent, ["datreferenciainformada", "_source_file"]]
                .head(5)
                .to_dict("records")
            )
            raise RuntimeError(
                "Referencia mensal INDGER inconsistente entre _source_file e "
                f"datreferenciainformada. Exemplos: {examples}"
            )

        result.loc[has_source_month, "ano"] = source_year.loc[has_source_month]
        result.loc[has_source_month, "mes"] = source_month.loc[has_source_month]

    suspicious_encoded_month = (
        result["mes"].eq(1)
        & parsed_day.between(1, 12)
        & result["datreferenciainformada"].notna()
    )
    if "_source_file" in result.columns:
        source_missing = result["_source_file"].isna() | (result["_source_file"].astype("string").str.strip() == "")
        suspicious_encoded_month = suspicious_encoded_month & source_missing

    result.loc[suspicious_encoded_month, "mes"] = parsed_day.loc[suspicious_encoded_month]
    return result


def assert_expected_indger_periods(
    frame: pd.DataFrame,
    table_name: str,
    *,
    require_baseline: bool = True,
) -> None:
    periods = {
        (int(row.ano), int(row.mes))
        for row in frame[["ano", "mes"]].dropna().drop_duplicates().itertuples(index=False)
    }
    errors = validate_indger_periods(
        periods,
        context=f"Cobertura mensal INDGER inesperada em {table_name}",
        require_baseline=require_baseline,
    )
    if errors:
        raise RuntimeError("; ".join(errors))


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
    
    # C8: Refinamento Grupo B para evitar agrupamento genérico
    if "GRUPO B" in upper:
        if "B1" in upper or "RESIDENCIAL" in upper:
            return "grupo_b_residencial"
        if "B2" in upper or "RURAL" in upper:
            return "grupo_b_rural"
        if "B3" in upper or "DEMAIS CLASSES" in upper:
            return "grupo_b_demais"
        if "B4" in upper or "ILUMINAÇÃO PÚBLICA" in upper or "ILUMINACAO PUBLICA" in upper:
            return "grupo_b_iluminacao"
        
        # Fallbacks específicos se houver Urbana/Rural sem B1/B2
        if "RURAL" in upper:
            return "grupo_b_rural"
        if "URBANA" in upper or "URBANO" in upper:
            return "grupo_b_urbana"
            
        return "grupo_b_outros"
        
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


def ensure_name_columns(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    if "sigagente" in out.columns and "distributor_name_sig" not in out.columns:
        out["distributor_name_sig"] = out["sigagente"].astype("string").fillna("")
    if "distributor_name_sig" in out.columns:
        sig = out["distributor_name_sig"].astype("string").fillna("").str.strip()
        fallback = (
            out["sigagente"].astype("string").fillna("").str.strip()
            if "sigagente" in out.columns
            else pd.Series([""] * len(out), index=out.index, dtype="string")
        )
        id_fallback = (
            out["distributor_id"].astype("string").fillna("").str.strip()
            if "distributor_id" in out.columns
            else pd.Series([""] * len(out), index=out.index, dtype="string")
        )
        sig = sig.mask(sig == "", fallback)
        sig = sig.mask(sig == "", id_fallback)
        out["distributor_name_sig"] = sig
    if "nomagente" in out.columns and "distributor_name_legal" not in out.columns:
        out["distributor_name_legal"] = out["nomagente"].astype("string").fillna(out.get("distributor_name_sig", ""))
    if "distributor_name_legal" in out.columns:
        legal = out["distributor_name_legal"].astype("string").fillna("").str.strip()
        legal = legal.mask(legal == "", out.get("distributor_name_sig", pd.Series([""] * len(out), index=out.index)).astype("string").fillna("").str.strip())
        out["distributor_name_legal"] = legal
    needs_label = (
        "distributor_label" not in out.columns
        or out["distributor_label"].isna().any()
        or (out["distributor_label"].astype(str).str.strip() == "").any()
    )
    if needs_label and "distributor_name_sig" in out.columns:
        legal_series = (
            out["distributor_name_legal"].astype("string").fillna("")
            if "distributor_name_legal" in out.columns
            else pd.Series([""] * len(out), index=out.index, dtype="string")
        )
        computed_labels = pd.Series(
            [
                compose_distributor_label(sig, legal)
                for sig, legal in zip(out["distributor_name_sig"].astype(str), legal_series.astype(str))
            ],
            index=out.index,
            dtype="string",
        )
        if "distributor_label" not in out.columns:
            out["distributor_label"] = computed_labels
        else:
            mask = out["distributor_label"].isna() | (out["distributor_label"].astype(str).str.strip() == "")
            out.loc[mask, "distributor_label"] = computed_labels[mask]
    if "distributor_label" in out.columns and "distributor_id" in out.columns:
        label = out["distributor_label"].astype("string").fillna("").str.strip()
        id_fallback = out["distributor_id"].astype("string").fillna("").str.strip()
        out["distributor_label"] = label.mask(label == "", id_fallback)
    return out


def load_qualidade_comercial(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
    distributor_name_overrides: dict[str, dict[str, str]],
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
    frame["valor"] = parse_br_number(frame["vlrindiceenviado"])
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
        distributor_name_overrides=distributor_name_overrides,
    )
    return ensure_name_columns(frame)


def load_domain_indicators() -> pd.DataFrame:
    if not DOMAIN_INDICATORS_PATH.exists():
        fallback_path = DIR_ANALYSIS / "dim_indicador_servico.csv"
        if not fallback_path.exists():
            raise FileNotFoundError(f"Missing file: {DOMAIN_INDICATORS_PATH}")
        fallback = pd.read_csv(fallback_path, usecols=["sigindicador", "dscindicador"])
        fallback["sigindicador"] = fallback["sigindicador"].astype("string").str.strip()
        fallback["dscindicador"] = fallback["dscindicador"].astype("string").str.strip()
        return fallback.dropna(subset=["sigindicador"]).drop_duplicates(subset=["sigindicador"])

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

    keys = [
        "ano", "group_id", "distributor_id", "sigagente",
        "distributor_name_sig", "distributor_name_legal", "distributor_label",
        "codigo_base", "classe_local",
    ]

    qs = (
        enriched[enriched["familia_indicador"] == "QS"]
        .groupby(keys, dropna=False)["valor"]
        .sum(min_count=1)
        .rename("qtd_serv")
    )
    qv = (
        enriched[enriched["familia_indicador"] == "QV"]
        .groupby(keys, dropna=False)["valor"]
        .sum(min_count=1)
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
        .sum(min_count=1)
        .rename("compensacao_rs")
    )

    fact = pd.concat([qs, qv, pm, cr], axis=1).reset_index()

    # C6: Prevenir dupla contagem por variações de classe_local para o mesmo código base
    # Se houver duplicatas de (ano, distributor_id, codigo_base), algo está errado na
    # taxonomia dos indicadores ou na classificação.
    dups = fact.duplicated(subset=["ano", "distributor_id", "codigo_base"], keep=False)
    if dups.any():
        num_dups = dups.sum()
        print(f"  AVISO: {num_dups} linhas duplicadas por codigo_base detectadas (C6).")
        # Para o TCC, preferimos a linha que tem classificação mais específica se disponível.
        # Ordenamos para que 'nao_classificado' fique por último e removemos duplicatas.
        fact["_class_rank"] = fact["classe_local"].apply(
            lambda x: 0 if x not in ["nao_classificado", "urbana", "rural"] else (1 if x != "nao_classificado" else 2)
        )
        fact = fact.sort_values(["ano", "distributor_id", "codigo_base", "_class_rank"])
        fact = fact.drop_duplicates(subset=["ano", "distributor_id", "codigo_base"], keep="first")
        fact = fact.drop(columns=["_class_rank"])
        print(f"  INFO: Duplicatas resolvidas priorizando classe específica.")

    fact["has_qs"] = fact["qtd_serv"].notna()
    fact["has_qv"] = fact["qtd_fora_prazo"].notna()
    fact["has_pm"] = fact["prazo_medio"].notna()
    fact["has_cr"] = fact["compensacao_rs"].notna()

    fact["taxa_fora_prazo"] = calc_taxa_fora_prazo(fact["qtd_fora_prazo"], fact["qtd_serv"])
    fact["flag_taxa_fora_prazo_invalida"] = (
        (fact["qtd_serv"] > 0)
        & (fact["qtd_fora_prazo"] > fact["qtd_serv"])
    ).fillna(False)
    fact["flag_codigo_base_multiclasse"] = fact.duplicated(
        subset=["ano", "distributor_id", "codigo_base"],
        keep=False,
    )
    fact["periodo_regulatorio"] = classify_periodo_regulatorio(fact["ano"])
    fact["regime_regulatorio"] = classify_regime_regulatorio(fact["ano"])
    fact["ano_comparavel_principal"] = fact["ano"].between(*SERIES_HISTORICA, inclusive="both")

    return fact.sort_values(["ano", "group_id", "distributor_id", "codigo_base"]).reset_index(drop=True)


def build_dim_distribuidora_porte(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
    distributor_name_overrides: dict[str, dict[str, str]],
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
    frame = derive_indger_year_month(frame)
    frame = frame.dropna(subset=["ano", "mes", "sigagente"])
    frame["ano"] = frame["ano"].astype(int)
    frame["mes"] = frame["mes"].astype(int)
    frame["uc_ativa"] = parse_br_number(frame["qtducativa"])
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
        distributor_name_overrides=distributor_name_overrides,
    )
    frame = ensure_name_columns(frame)

    monthly = (
        frame.groupby(
            [
                "ano",
                "mes",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
            ],
            dropna=False,
        )["uc_ativa"]
        .sum()
        .reset_index()
    )

    dim = (
        monthly.groupby(
            [
                "ano",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
            ],
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
    distributor_name_overrides: dict[str, dict[str, str]],
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
    frame = derive_indger_year_month(frame)
    frame = frame.dropna(subset=["ano", "mes", "sigagente"])
    frame["ano"] = frame["ano"].astype(int)
    frame["mes"] = frame["mes"].astype(int)
    frame["uc_ativa"] = parse_br_number(frame["qtducativa"])
    frame = annotate_distributor_group(
        frame,
        sig_col="sigagente",
        name_col="nomagente",
        distributor_to_group=distributor_to_group,
        group_labels=group_labels,
        distributor_name_overrides=distributor_name_overrides,
    )
    frame = ensure_name_columns(frame)

    monthly = (
        frame.groupby(
            [
                "ano",
                "mes",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
            ],
            dropna=False,
        )["uc_ativa"]
        .sum()
        .reset_index()
        .rename(columns={"uc_ativa": "uc_ativa_mes"})
    )
    monthly["periodo_regulatorio"] = classify_periodo_regulatorio(monthly["ano"])
    monthly["regime_regulatorio"] = classify_regime_regulatorio(monthly["ano"])
    return monthly.sort_values(["ano", "mes", "group_id", "distributor_id"]).reset_index(drop=True)


def build_fato_servicos_classe_mes(
    distributor_to_group: dict[str, str],
    group_labels: dict[str, str],
    distributor_name_overrides: dict[str, dict[str, str]],
) -> pd.DataFrame:
    """Build lightweight monthly service aggregates for the operational dashboard.

    This reads all INDGER service months from 2023 onward, preserving service-code
    granularity needed by the diagnostics while dropping municipality-level detail
    that made routine refreshes too memory-intensive.
    """
    path = DIR_PROCESSED / "indger_servicos_comerciais.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    columns = [
        "datreferenciainformada",
        "sigagente",
        "nomagente",
        "codtiposervico",
        "dsctiposervico",
        "qtdservrealizado",
        "qtdservrealizdescprazo",
        "vlrpagocompensacao",
        "_source_file",
    ]
    keys = [
        "ano",
        "mes",
        "group_id",
        "distributor_id",
        "sigagente",
        "nomagente",
        "distributor_name_sig",
        "distributor_name_legal",
        "distributor_label",
        "codtiposervico",
        "classe_local_servico",
    ]
    metric_cols = ["qtd_serv_realizado", "qtd_fora_prazo", "compensacao_rs"]
    source_file_start = f"indger-dados-servicos-comerciais-{ANOS_COMPARAVEIS[0]}-01.csv"

    partials: list[pd.DataFrame] = []
    parquet_file = pq.ParquetFile(path)
    for batch in parquet_file.iter_batches(batch_size=250_000, columns=columns):
        frame = batch.to_pandas()
        if frame.empty:
            continue

        source_file = frame["_source_file"].astype("string").fillna("")
        frame = frame[source_file >= source_file_start].copy()
        if frame.empty:
            continue

        frame["sigagente"] = frame["sigagente"].astype("string").str.strip()
        frame["nomagente"] = frame["nomagente"].astype("string").str.strip()
        frame["codtiposervico"] = frame["codtiposervico"].astype("string").str.strip()
        frame["dsctiposervico"] = frame["dsctiposervico"].astype("string").str.strip()
        frame = derive_indger_year_month(frame)
        frame = frame.dropna(subset=["ano", "mes", "sigagente"])
        if frame.empty:
            continue
        frame["ano"] = frame["ano"].astype(int)
        frame["mes"] = frame["mes"].astype(int)
        frame = annotate_distributor_group(
            frame,
            sig_col="sigagente",
            name_col="nomagente",
            distributor_to_group=distributor_to_group,
            group_labels=group_labels,
            distributor_name_overrides=distributor_name_overrides,
        )
        frame = ensure_name_columns(frame)

        frame["qtd_serv_realizado"] = parse_br_number(frame["qtdservrealizado"])
        frame["qtd_fora_prazo"] = parse_br_number(frame["qtdservrealizdescprazo"])
        frame["compensacao_rs"] = parse_br_number(frame["vlrpagocompensacao"])
        frame["classe_local_servico"] = frame["dsctiposervico"].apply(lambda v: classify_segment(normalize_text(v)))

        partials.append(
            frame.groupby(keys, dropna=False, as_index=False)[metric_cols]
            .sum()
        )

    if not partials:
        return pd.DataFrame(columns=keys + metric_cols + ["taxa_fora_prazo"])

    fact = (
        pd.concat(partials, ignore_index=True)
        .groupby(keys, dropna=False, as_index=False)[metric_cols]
        .sum()
    )
    fact["taxa_fora_prazo"] = calc_taxa_fora_prazo(
        fact["qtd_fora_prazo"], fact["qtd_serv_realizado"]
    )
    return fact.sort_values(["ano", "mes", "group_id", "distributor_id", "classe_local_servico"]).reset_index(drop=True)


def build_fato_transgressao_mensal_porte(
    fato_servicos: pd.DataFrame,
    uc_ativa_mensal_distribuidora: pd.DataFrame,
    dim_porte: pd.DataFrame,
) -> pd.DataFrame:
    """Monthly transgression/compensation by distributor, normalized by size."""
    mensal = (
        fato_servicos.groupby(
            [
                "ano",
                "mes",
                "group_id",
                "distributor_id",
                "sigagente",
                "nomagente",
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
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

    mensal["taxa_fora_prazo"] = calc_taxa_fora_prazo(mensal["qtd_fora_prazo"], mensal["qtd_serv_realizado"])
    mensal["flag_uc_ativa_ausente"] = mensal["uc_ativa_mes"].isna() & (mensal["qtd_serv_realizado"] > 0)
    mensal["flag_taxa_fora_prazo_invalida"] = (
        (mensal["qtd_serv_realizado"] > 0)
        & (mensal["qtd_fora_prazo"] > mensal["qtd_serv_realizado"])
    ).fillna(False)
    mensal["fora_prazo_por_100k_uc_mes"] = calc_fora_prazo_por_100k(mensal["qtd_fora_prazo"], mensal["uc_ativa_mes"])
    mensal["compensacao_rs_por_uc_mes"] = calc_compensacao_por_uc(mensal["compensacao_rs"], mensal["uc_ativa_mes"])
    mensal["compensacao_media_por_transgressao_rs"] = calc_compensacao_media_por_transgressao(mensal["compensacao_rs"], mensal["qtd_fora_prazo"])
    mensal["periodo_regulatorio"] = classify_periodo_regulatorio(mensal["ano"])
    mensal["regime_regulatorio"] = classify_regime_regulatorio(mensal["ano"])
    mensal["ano_comparavel_principal"] = mensal["ano"] >= ANOS_COMPARAVEIS[0]

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
                "distributor_name_sig",
                "distributor_name_legal",
                "distributor_label",
                "uc_ativa_mes",
                "bucket_porte",
                "rank_porte_ano",
                "uc_ativa_media_mensal",
            ],
            as_index=False,
            dropna=False,
        )
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
        )
    )
    fact["taxa_fora_prazo"] = calc_taxa_fora_prazo(fact["qtd_fora_prazo"], fact["qtd_serv_realizado"])
    fact["flag_taxa_fora_prazo_invalida"] = (
        (fact["qtd_serv_realizado"] > 0)
        & (fact["qtd_fora_prazo"] > fact["qtd_serv_realizado"])
    ).fillna(False)
    fact["fora_prazo_por_100k_uc_mes"] = calc_fora_prazo_por_100k(fact["qtd_fora_prazo"], fact["uc_ativa_mes"])
    fact["compensacao_rs_por_uc_mes"] = calc_compensacao_por_uc(fact["compensacao_rs"], fact["uc_ativa_mes"])
    fact["compensacao_media_por_transgressao_rs"] = calc_compensacao_media_por_transgressao(fact["compensacao_rs"], fact["qtd_fora_prazo"])
    fact["periodo_regulatorio"] = classify_periodo_regulatorio(fact["ano"])
    fact["regime_regulatorio"] = classify_regime_regulatorio(fact["ano"])
    fact["ano_comparavel_principal"] = fact["ano"] >= ANOS_COMPARAVEIS[0]
    return fact.sort_values(["ano", "mes", "group_id", "distributor_id"]).reset_index(drop=True)


def merge_fato_with_porte(fato_indicadores: pd.DataFrame, dim_porte: pd.DataFrame) -> pd.DataFrame:
    merge_cols = ["ano", "group_id", "distributor_id", "uc_ativa_media_mensal", "bucket_porte", "rank_porte_ano"]

    # Name fields are optional and only used as fallback completion for annual rows.
    optional_name_cols = [
        "sigagente",
        "nomagente",
        "distributor_name_sig",
        "distributor_name_legal",
        "distributor_label",
    ]
    merge_cols.extend([c for c in optional_name_cols if c in dim_porte.columns])

    merge_cols = [c for c in merge_cols if c in dim_porte.columns]
    enriched = fato_indicadores.merge(
        dim_porte[merge_cols],
        on=["ano", "group_id", "distributor_id"],
        how="left",
        suffixes=("", "_porte"),
    )

    for col in optional_name_cols:
        col_porte = f"{col}_porte"
        if col in enriched.columns and col_porte in enriched.columns:
            mask = enriched[col].isna() | (enriched[col].astype(str).str.strip() == "")
            enriched.loc[mask, col] = enriched.loc[mask, col_porte]
            enriched = enriched.drop(columns=[col_porte])

    enriched["fora_prazo_por_100k_uc"] = calc_fora_prazo_por_100k(enriched["qtd_fora_prazo"], enriched["uc_ativa_media_mensal"])
    enriched["compensacao_rs_por_uc"] = calc_compensacao_por_uc(enriched["compensacao_rs"], enriched["uc_ativa_media_mensal"])
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
    yearly["taxa_fora_prazo"] = calc_taxa_fora_prazo(yearly["qtd_fora_prazo"], yearly["qtd_serv"])
    yearly["regime_regulatorio"] = classify_regime_regulatorio(yearly["ano"])
    return yearly.sort_values("ano").reset_index(drop=True)


def build_dimension_snapshot(
    frame: pd.DataFrame,
    *,
    dimension_id: str,
    dimension_label: str,
    id_col: str,
    label_col: str,
    low_share_threshold: float = 0.01,
    low_months_threshold: int = 6,
) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame()

    base = frame.copy()
    key_cols = [id_col] if id_col == label_col else [id_col, label_col]
    base[id_col] = base[id_col].astype("string").str.strip()
    if label_col in base.columns:
        base[label_col] = base[label_col].astype("string").str.strip()
    else:
        base[label_col] = base[id_col]
    base = base[(base[id_col].notna()) & (base[id_col] != "")]
    if base.empty:
        return pd.DataFrame()

    base["ano_mes"] = base["ano"].astype("Int64").astype("string") + "-" + base["mes"].astype("Int64").astype("string")
    
    # D13: Incluir regime_regulatorio na agregação
    agg_keys = key_cols + ["periodo_regulatorio"]
    if "regime_regulatorio" in base.columns:
        agg_keys.append("regime_regulatorio")

    period_agg = (
        base.groupby(agg_keys, as_index=False)
        .agg(
            meses_com_dados=("ano_mes", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("exposicao_uc_mes", "sum"),
        )
    )
    period_totals = period_agg.groupby("periodo_regulatorio", as_index=False)["qtd_serv_realizado"].sum()
    period_totals = period_totals.rename(columns={"qtd_serv_realizado": "qtd_serv_total_periodo"})
    period_agg = period_agg.merge(period_totals, on="periodo_regulatorio", how="left")
    period_agg["share_serv_periodo"] = np.where(
        period_agg["qtd_serv_total_periodo"] > 0,
        period_agg["qtd_serv_realizado"] / period_agg["qtd_serv_total_periodo"],
        0.0,
    )

    operational_agg_keys = list(key_cols)
    if "regime_regulatorio" in base.columns:
        operational_agg_keys.append("regime_regulatorio")

    operational = (
        base[base["ano"] >= 2023]
        .groupby(operational_agg_keys, as_index=False)
        .agg(
            meses_com_dados=("ano_mes", "nunique"),
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            exposicao_uc_mes=("exposicao_uc_mes", "sum"),
        )
    )
    operational["periodo_regulatorio"] = "operacional_2023_plus"
    total_operational = float(operational["qtd_serv_realizado"].sum()) if not operational.empty else 0.0
    operational["qtd_serv_total_periodo"] = total_operational
    operational["share_serv_periodo"] = np.where(
        total_operational > 0,
        operational["qtd_serv_realizado"] / total_operational,
        0.0,
    )

    period_comp = period_agg.pivot_table(
        index=key_cols,
        columns="periodo_regulatorio",
        values=["meses_com_dados", "share_serv_periodo"],
        aggfunc="first",
    )
    period_comp.columns = [f"{metric}_{period}" for metric, period in period_comp.columns]
    period_comp = period_comp.reset_index()

    for col in [
        "meses_com_dados_pre_2022",
        "meses_com_dados_pos_2022",
        "share_serv_periodo_pre_2022",
        "share_serv_periodo_pos_2022",
    ]:
        if col not in period_comp.columns:
            period_comp[col] = 0.0

    period_comp["suppressed_low_volume"] = (
        (period_comp["meses_com_dados_pre_2022"] < low_months_threshold)
        & (period_comp["meses_com_dados_pos_2022"] < low_months_threshold)
        & (period_comp["share_serv_periodo_pre_2022"] < low_share_threshold)
        & (period_comp["share_serv_periodo_pos_2022"] < low_share_threshold)
    )

    operational_selector = operational[key_cols].copy()
    operational_selector["has_operational_volume"] = operational["qtd_serv_realizado"] > 0
    period_comp = period_comp.merge(
        operational_selector,
        on=key_cols,
        how="left",
    )
    period_comp["has_operational_volume"] = period_comp["has_operational_volume"].fillna(False)
    period_comp["selector_enabled"] = (~period_comp["suppressed_low_volume"]) & period_comp["has_operational_volume"]

    combined = pd.concat([period_agg, operational], ignore_index=True, sort=False)
    combined = combined.merge(
        period_comp[key_cols + ["suppressed_low_volume", "selector_enabled"]],
        on=key_cols,
        how="left",
    )
    combined["taxa_fora_prazo"] = calc_taxa_fora_prazo(combined["qtd_fora_prazo"], combined["qtd_serv_realizado"])
    combined["fora_prazo_por_100k_uc_mes"] = calc_fora_prazo_por_100k(combined["qtd_fora_prazo"], combined["exposicao_uc_mes"])
    combined["compensacao_rs_por_uc_mes"] = calc_compensacao_por_uc(combined["compensacao_rs"], combined["exposicao_uc_mes"])
    
    # C4: Compensação Anualizada para comparação justa entre janelas
    combined["compensacao_anualizada"] = calc_compensacao_anualizada(combined["compensacao_rs"], combined["meses_com_dados"])

    combined["dimension_id"] = dimension_id
    combined["dimension_label"] = dimension_label
    combined["id"] = combined[id_col].astype("string")
    combined["label"] = combined[label_col].astype("string")
    keep_cols = [
        "dimension_id",
        "dimension_label",
        "id",
        "label",
        "periodo_regulatorio",
        "regime_regulatorio",
        "meses_com_dados",
        "qtd_serv_realizado",
        "qtd_fora_prazo",
        "compensacao_rs",
        "compensacao_anualizada",
        "exposicao_uc_mes",
        "taxa_fora_prazo",
        "fora_prazo_por_100k_uc_mes",
        "compensacao_rs_por_uc_mes",
        "share_serv_periodo",
        "suppressed_low_volume",
        "selector_enabled",
    ]
    return combined[keep_cols].sort_values(["dimension_id", "label", "periodo_regulatorio"]).reset_index(drop=True)


def build_algorithmic_group_snapshot(
    *,
    fato_transgressao_mensal_distribuidora: pd.DataFrame,
    uc_ativa_mensal_distribuidora: pd.DataFrame,
    dim_distributor_group: pd.DataFrame,
) -> pd.DataFrame:
    """Build algorithmic group snapshots (economic and porte dimensions only)."""
    monthly_dist = fato_transgressao_mensal_distribuidora.copy()
    monthly_dist["exposicao_uc_mes"] = monthly_dist["uc_ativa_mes"]

    group_lookup = (
        dim_distributor_group[["group_id", "group_label"]]
        .dropna(subset=["group_id"])
        .drop_duplicates(subset=["group_id"])
    )
    monthly_dist = monthly_dist.merge(group_lookup, on="group_id", how="left")
    monthly_dist["group_label"] = monthly_dist["group_label"].fillna(monthly_dist["group_id"])

    economic = build_dimension_snapshot(
        monthly_dist,
        dimension_id="economico",
        dimension_label="Grupo Econômico",
        id_col="group_id",
        label_col="group_label",
    )

    porte = build_dimension_snapshot(
        monthly_dist.dropna(subset=["bucket_porte"]),
        dimension_id="porte",
        dimension_label="Porte",
        id_col="bucket_porte",
        label_col="bucket_porte",
    )

    return pd.concat([economic, porte], ignore_index=True)

def augment_dim_group_with_historical(
    dim_group: pd.DataFrame,
    fato_indicadores: pd.DataFrame,
) -> pd.DataFrame:
    """Include historical-only distributors not present in recent UC datasets.

    This keeps monthly metrics untouched while exposing consistent IDs for annual facts.
    """
    if dim_group.empty or fato_indicadores.empty:
        return dim_group

    required = ["group_id", "distributor_id", "sigagente", "nomagente", "distributor_name_sig", "distributor_name_legal", "distributor_label"]
    available = [c for c in required if c in fato_indicadores.columns]
    if not {"group_id", "distributor_id"}.issubset(set(available)):
        return dim_group

    fact_dim = (
        fato_indicadores[available]
        .dropna(subset=["group_id", "distributor_id"])
        .drop_duplicates(subset=["group_id", "distributor_id"])
        .copy()
    )

    existing = set(zip(dim_group["group_id"].astype(str), dim_group["distributor_id"].astype(str)))
    fact_dim["_key"] = list(zip(fact_dim["group_id"].astype(str), fact_dim["distributor_id"].astype(str)))
    missing = fact_dim[~fact_dim["_key"].isin(existing)].drop(columns=["_key"])
    if missing.empty:
        return dim_group

    for col in ["sigagente", "nomagente", "distributor_name_sig", "distributor_name_legal", "distributor_label"]:
        if col not in missing.columns:
            missing[col] = ""

    group_labels = (
        dim_group[["group_id", "group_label"]]
        .dropna(subset=["group_id"])
        .drop_duplicates(subset=["group_id"])
        .set_index("group_id")["group_label"]
        .to_dict()
    )

    missing["group_label"] = missing["group_id"].astype(str).map(lambda gid: group_labels.get(gid, default_group_label(gid)))
    missing["distributor_count"] = 1
    missing["selector_enabled"] = False

    missing = missing[
        [
            "group_id",
            "group_label",
            "distributor_id",
            "sigagente",
            "nomagente",
            "distributor_name_sig",
            "distributor_name_legal",
            "distributor_label",
            "distributor_count",
            "selector_enabled",
        ]
    ]

    out = pd.concat([dim_group, missing], ignore_index=True, sort=False)
    out = out.drop_duplicates(subset=["group_id", "distributor_id"], keep="first")

    counts = out.groupby("group_id")["distributor_id"].nunique()
    out["distributor_count"] = out["group_id"].astype(str).map(counts).astype("Int64")
    out["selector_enabled"] = out["distributor_count"] >= 2

    return out.sort_values(["group_id", "distributor_label"]).reset_index(drop=True)


def run_all() -> dict[str, pd.DataFrame]:
    distributor_to_group, group_labels = load_group_overrides()
    distributor_name_overrides = load_distributor_name_overrides()
    qualidade = load_qualidade_comercial(distributor_to_group, group_labels, distributor_name_overrides)
    domain = load_domain_indicators()

    dim_indicador = build_dim_indicador_servico(qualidade, domain)
    fato_indicadores = build_fato_indicadores_anuais(qualidade, dim_indicador)
    dim_porte = build_dim_distribuidora_porte(distributor_to_group, group_labels, distributor_name_overrides)
    uc_ativa_mensal = build_uc_ativa_mensal_distribuidora(
        distributor_to_group, group_labels, distributor_name_overrides
    )
    fato_servicos = build_fato_servicos_classe_mes(
        distributor_to_group, group_labels, distributor_name_overrides
    )
    fato_transgressao_mensal_porte = build_fato_transgressao_mensal_porte(
        fato_servicos, uc_ativa_mensal, dim_porte
    )
    fato_transgressao_mensal_distribuidora = build_fato_transgressao_mensal_distribuidora(
        fato_transgressao_mensal_porte
    )
    assert_expected_indger_periods(
        uc_ativa_mensal,
        "fato_uc_ativa_mensal_distribuidora",
        require_baseline=False,
    )
    assert_expected_indger_periods(fato_transgressao_mensal_porte, "fato_transgressao_mensal_porte")
    assert_expected_indger_periods(
        fato_transgressao_mensal_distribuidora,
        "fato_transgressao_mensal_distribuidora",
    )

    fato_indicadores = merge_fato_with_porte(fato_indicadores, dim_porte)
    fato_indicadores = ensure_name_columns(fato_indicadores)
    dim_porte = ensure_name_columns(dim_porte)
    uc_ativa_mensal = ensure_name_columns(uc_ativa_mensal)
    fato_transgressao_mensal_porte = ensure_name_columns(fato_transgressao_mensal_porte)
    fato_transgressao_mensal_distribuidora = ensure_name_columns(fato_transgressao_mensal_distribuidora)
    kpi_overview = build_kpi_overview(fato_indicadores)
    dim_group = build_group_dimension(dim_porte)
    dim_group = augment_dim_group_with_historical(dim_group, fato_indicadores)
    algorithmic_group_snapshot = build_algorithmic_group_snapshot(
        fato_transgressao_mensal_distribuidora=fato_transgressao_mensal_distribuidora,
        uc_ativa_mensal_distribuidora=uc_ativa_mensal,
        dim_distributor_group=dim_group,
    )

    # Harmonize name columns in fato_indicadores using dim_group as canonical source
    _name_lookup = dim_group.drop_duplicates("distributor_id").set_index("distributor_id")
    for _col in ["sigagente", "nomagente", "distributor_name_sig", "distributor_name_legal", "distributor_label"]:
        if _col in _name_lookup.columns and _col in fato_indicadores.columns:
            _mapping = _name_lookup[_col].dropna()
            _mapping = _mapping[_mapping.astype(str).str.strip() != ""]
            _mask = fato_indicadores["distributor_id"].isin(_mapping.index)
            fato_indicadores.loc[_mask, _col] = fato_indicadores.loc[_mask, "distributor_id"].map(_mapping)

    fact_tables = {
        "dim_distribuidora_porte": dim_porte,
        "fato_uc_ativa_mensal_distribuidora": uc_ativa_mensal,
        "fato_indicadores_anuais": fato_indicadores,
        "fato_servicos_classe_mes": fato_servicos,
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
    save_table(fato_servicos, "fato_servicos_classe_mes")
    save_table(fato_transgressao_mensal_porte, "fato_transgressao_mensal_porte")
    save_table(fato_transgressao_mensal_distribuidora, "fato_transgressao_mensal_distribuidora")
    save_table(kpi_overview, "kpi_regulatorio_anual")
    save_table(algorithmic_group_snapshot, "fato_grupos_algoritmicos")

    return {
        "dim_indicador_servico": dim_indicador,
        "dim_distribuidora_porte": dim_porte,
        "dim_distributor_group": dim_group,
        "fato_uc_ativa_mensal_distribuidora": uc_ativa_mensal,
        "fato_indicadores_anuais": fato_indicadores,
        "fato_servicos_classe_mes": fato_servicos,
        "fato_transgressao_mensal_porte": fato_transgressao_mensal_porte,
        "fato_transgressao_mensal_distribuidora": fato_transgressao_mensal_distribuidora,
        "kpi_regulatorio_anual": kpi_overview,
        "fato_grupos_algoritmicos": algorithmic_group_snapshot,
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
