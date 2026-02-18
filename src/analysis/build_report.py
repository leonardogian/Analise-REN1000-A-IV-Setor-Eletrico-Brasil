"""Build markdown report from analysis tables.

Usage:
    python -m src.analysis.build_report
"""

from __future__ import annotations

from pathlib import Path
import unicodedata

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
DIR_ANALYSIS = ROOT / "data" / "processed" / "analysis"
REPORT_PATH = ROOT / "reports" / "relatorio_aneel.md"


def fmt_int(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"{int(round(float(value))):,}".replace(",", ".")


def fmt_money(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_pct(value: float | int | None) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    return f"{float(value) * 100:.3f}%"


def load_table(name: str) -> pd.DataFrame:
    path = DIR_ANALYSIS / f"{name}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing analysis table: {path}")
    return pd.read_parquet(path)


def find_agent_name(frame: pd.DataFrame, terms: list[str]) -> str | None:
    def ascii_fold(text: str) -> str:
        folded = unicodedata.normalize("NFKD", text)
        return "".join(ch for ch in folded if not unicodedata.combining(ch)).upper()

    names = frame["nomagente"].dropna().astype(str).unique()
    for term in terms:
        term_norm = ascii_fold(term)
        for name in names:
            if term_norm in ascii_fold(name):
                return name
    return None


def build_pre_post_summary(fato_indicadores: pd.DataFrame) -> dict[str, float]:
    base = fato_indicadores[fato_indicadores["ano_comparavel_principal"]].copy()
    base = base[base["ano"] <= 2023].copy()

    pre = base[base["ano"] <= 2021]
    post = base[(base["ano"] >= 2022) & (base["ano"] <= 2023)]

    def summarize(frame: pd.DataFrame) -> tuple[float, float]:
        serv = frame["qtd_serv"].sum()
        fora = frame["qtd_fora_prazo"].sum()
        taxa = fora / serv if serv > 0 else np.nan
        comp = frame["compensacao_rs"].sum()
        return taxa, comp

    pre_taxa, pre_comp = summarize(pre)
    post_taxa, post_comp = summarize(post)

    return {
        "pre_taxa": pre_taxa,
        "post_taxa": post_taxa,
        "pre_comp": pre_comp,
        "post_comp": post_comp,
        "delta_taxa": post_taxa - pre_taxa if not np.isnan(pre_taxa) and not np.isnan(post_taxa) else np.nan,
        "delta_comp": post_comp - pre_comp,
    }


def build_benchmark_table(
    fato_mensal_porte: pd.DataFrame,
    dim_porte: pd.DataFrame,
    focus_names: list[str],
) -> pd.DataFrame:
    agg = (
        fato_mensal_porte.groupby(["ano", "sigagente", "nomagente"], as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            fora_prazo_por_100k_uc_mes=("fora_prazo_por_100k_uc_mes", "mean"),
            compensacao_rs_por_uc_mes=("compensacao_rs_por_uc_mes", "mean"),
        )
    )

    agg["taxa_fora_prazo"] = np.where(
        agg["qtd_serv_realizado"] > 0,
        agg["qtd_fora_prazo"] / agg["qtd_serv_realizado"],
        np.nan,
    )

    agg = agg.merge(
        dim_porte[["ano", "sigagente", "uc_ativa_media_mensal", "bucket_porte", "rank_porte_ano"]],
        on=["ano", "sigagente"],
        how="left",
    )

    result = agg[agg["nomagente"].isin(focus_names)].copy()
    return result.sort_values(["ano", "nomagente"]).reset_index(drop=True)


def build_monthly_summary(fato_mensal_porte: pd.DataFrame) -> pd.DataFrame:
    monthly = (
        fato_mensal_porte.groupby(["ano", "mes"], as_index=False)
        .agg(
            qtd_serv_realizado=("qtd_serv_realizado", "sum"),
            qtd_fora_prazo=("qtd_fora_prazo", "sum"),
            compensacao_rs=("compensacao_rs", "sum"),
            uc_ativa_mes=("uc_ativa_mes", "sum"),
        )
    )
    monthly["taxa_fora_prazo"] = np.where(
        monthly["qtd_serv_realizado"] > 0,
        monthly["qtd_fora_prazo"] / monthly["qtd_serv_realizado"],
        np.nan,
    )
    monthly["fora_prazo_por_100k_uc"] = np.where(
        monthly["uc_ativa_mes"] > 0,
        monthly["qtd_fora_prazo"] / monthly["uc_ativa_mes"] * 100000.0,
        np.nan,
    )
    monthly["compensacao_rs_por_uc"] = np.where(
        monthly["uc_ativa_mes"] > 0,
        monthly["compensacao_rs"] / monthly["uc_ativa_mes"],
        np.nan,
    )
    return monthly.sort_values(["ano", "mes"]).reset_index(drop=True)


def render_markdown(
    kpi: pd.DataFrame,
    pre_post: dict[str, float],
    monthly_summary: pd.DataFrame,
    foco: pd.DataFrame,
    has_compensation_data: bool,
    data_sources_note: str,
) -> str:
    lines: list[str] = []
    lines.append("# Relatorio ANEEL - Prazo, Transgressoes e Compensacoes")
    lines.append("")
    lines.append("## Escopo")
    lines.append("- Comparacao regulatoria: pre-2022 (REN 414) vs pos-2022 (REN 1000).")
    lines.append("- Serie longa principal: Qualidade Comercial (2011-2023 comparavel).")
    lines.append("- Detalhe mensal e normalizacao por porte: INDGER Servicos + INDGER Dados Comerciais (2023-2025).")
    lines.append("")

    lines.append("## Disponibilidade de valor pago")
    if has_compensation_data:
        lines.append("- Existe base de valor pago/compensacao no seu ambiente.")
    else:
        lines.append("- Nao ha valores de compensacao utilizaveis nas bases locais. Recomendado buscar fonte externa.")
    lines.append(f"- {data_sources_note}")
    lines.append("")

    lines.append("## Resultado pre vs pos (agregado)")
    lines.append(f"- Taxa fora do prazo (pre): {fmt_pct(pre_post['pre_taxa'])}")
    lines.append(f"- Taxa fora do prazo (pos): {fmt_pct(pre_post['post_taxa'])}")
    lines.append(f"- Variacao absoluta da taxa: {fmt_pct(pre_post['delta_taxa'])}")
    lines.append(f"- Compensacao total (pre): {fmt_money(pre_post['pre_comp'])}")
    lines.append(f"- Compensacao total (pos): {fmt_money(pre_post['post_comp'])}")
    lines.append(f"- Variacao de compensacao total: {fmt_money(pre_post['delta_comp'])}")
    lines.append("")

    lines.append("## Serie anual consolidada")
    lines.append("| Ano | Periodo | Qtd servicos | Qtd fora do prazo | Taxa fora do prazo | Compensacao |")
    lines.append("|---|---|---:|---:|---:|---:|")
    for _, row in kpi.sort_values("ano").iterrows():
        lines.append(
            "| {ano} | {periodo} | {serv} | {fora} | {taxa} | {comp} |".format(
                ano=int(row["ano"]),
                periodo=row["periodo_regulatorio"],
                serv=fmt_int(row["qtd_serv"]),
                fora=fmt_int(row["qtd_fora_prazo"]),
                taxa=fmt_pct(row["taxa_fora_prazo"]),
                comp=fmt_money(row["compensacao_rs"]),
            )
        )
    lines.append("")

    lines.append("## Serie mensal normalizada (2023-2025)")
    lines.append(
        "| Ano | Mes | Qtd fora do prazo | Taxa fora prazo | Compensacao | Fora prazo por 100k UC | Compensacao por UC |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|---:|")
    for _, row in monthly_summary.tail(12).iterrows():
        lines.append(
            "| {ano} | {mes} | {fora} | {taxa} | {comp} | {fora_uc} | {comp_uc} |".format(
                ano=int(row["ano"]),
                mes=int(row["mes"]),
                fora=fmt_int(row["qtd_fora_prazo"]),
                taxa=fmt_pct(row["taxa_fora_prazo"]),
                comp=fmt_money(row["compensacao_rs"]),
                fora_uc=f"{row['fora_prazo_por_100k_uc']:.2f}" if pd.notna(row["fora_prazo_por_100k_uc"]) else "-",
                comp_uc=f"R$ {row['compensacao_rs_por_uc']:.4f}".replace(".", ",")
                if pd.notna(row["compensacao_rs_por_uc"])
                else "-",
            )
        )
    lines.append("")

    lines.append("## Benchmark de distribuidoras (porte e normalizacao)")
    if foco.empty:
        lines.append("- Nao foi possivel montar benchmark para Coelba, Neoenergia Brasilia e Copel com os nomes atuais.")
    else:
        lines.append(
            "| Ano | Distribuidora | Porte | Rank porte | UC ativa media mensal | Qtd fora do prazo | Taxa fora prazo | Fora prazo por 100k UC | Compensacao | Compensacao por UC |"
        )
        lines.append("|---|---|---|---:|---:|---:|---:|---:|---:|---:|")
        for _, row in foco.iterrows():
            lines.append(
                "| {ano} | {nome} | {bucket} | {rank} | {uc} | {fora} | {taxa} | {fora_uc} | {comp} | {comp_uc} |".format(
                    ano=int(row["ano"]),
                    nome=row["nomagente"],
                    bucket=row.get("bucket_porte", "-"),
                    rank=fmt_int(row.get("rank_porte_ano")),
                    uc=fmt_int(row.get("uc_ativa_media_mensal")),
                    fora=fmt_int(row["qtd_fora_prazo"]),
                    taxa=fmt_pct(row["taxa_fora_prazo"]),
                    fora_uc=f"{row['fora_prazo_por_100k_uc_mes']:.2f}" if pd.notna(row["fora_prazo_por_100k_uc_mes"]) else "-",
                    comp=fmt_money(row["compensacao_rs"]),
                    comp_uc=(
                        f"R$ {row['compensacao_rs_por_uc_mes']:.4f}".replace(".", ",")
                        if pd.notna(row["compensacao_rs_por_uc_mes"])
                        else "-"
                    ),
                )
            )
    lines.append("")

    lines.append("## Proximos acompanhamentos")
    lines.append("- Atualizar mensalmente a tabela `fato_transgressao_mensal_porte`.")
    lines.append("- Monitorar anos incompletos (2024-2025) para nao inferir tendencia regulatoria antes da consolidacao.")
    lines.append("- Refinar analise de servicos por classe/localidade com foco nos maiores desvios normalizados por porte.")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    kpi = load_table("kpi_regulatorio_anual")
    fato_indicadores = load_table("fato_indicadores_anuais")
    fato_mensal_porte = load_table("fato_transgressao_mensal_porte")
    dim_porte = load_table("dim_distribuidora_porte")

    has_compensation_data = (
        fato_mensal_porte["compensacao_rs"].sum() > 0
        or fato_indicadores["compensacao_rs"].sum() > 0
    )

    data_sources_note = (
        "Fontes usadas: `vlrpagocompensacao` (INDGER Servicos Comerciais) e indicadores `CR*` (Qualidade Comercial)."
    )

    pre_post = build_pre_post_summary(fato_indicadores)
    monthly_summary = build_monthly_summary(fato_mensal_porte)

    coelba = find_agent_name(dim_porte, ["ESTADO DA BAHIA", "COELBA"])
    brasilia = find_agent_name(dim_porte, ["BRASILIA"])
    copel = find_agent_name(dim_porte, ["COPEL"])
    focus_names = [name for name in [coelba, brasilia, copel] if name]

    foco = build_benchmark_table(fato_mensal_porte, dim_porte, focus_names)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = render_markdown(
        kpi,
        pre_post,
        monthly_summary,
        foco,
        has_compensation_data,
        data_sources_note,
    )
    REPORT_PATH.write_text(content, encoding="utf-8")

    print(f"Report generated: {REPORT_PATH}")


if __name__ == "__main__":
    main()
