"""
===============================================================================
🧹 TRANSFORMAÇÃO DE DADOS — Qualidade Comercial ANEEL
===============================================================================
OBJETIVO:
    Ler os CSVs brutos baixados pelo extract_aneel.py, limpar e preparar
    os dados para análise.

ENTRADA:  data/raw/*.csv
SAÍDA:    data/processed/*.parquet  (eficiente)
          data/processed/*.csv     (legível)

COMO RODAR:
    python -m src.etl.transform_aneel

VARIÁVEIS DE INTERESSE (para a análise do TCC):
    - Eficácia: serviços realizados dentro do prazo
    - Transgressões: serviços fora do prazo
    - Compensações: valores financeiros (R$) pagos ao consumidor
    - Segmentação: por distribuidora, estado, grupo tarifário
    - Temporal: antes e depois da REN 1000
===============================================================================
"""

import sys
from pathlib import Path

import pandas as pd

from src.etl.schema_contracts import (
    RAW_REQUIRED_COLUMNS,
    RAW_SERVICOS_REQUIRED_COLUMNS,
    missing_required_columns,
    validate_processed_contracts,
    validate_raw_contracts,
)

# Diretório raiz do projeto
RAIZ_PROJETO = Path(__file__).resolve().parent.parent.parent
DIR_RAW = RAIZ_PROJETO / "data" / "raw"
DIR_PROCESSED = RAIZ_PROJETO / "data" / "processed"


def validar_colunas_obrigatorias(
    df: pd.DataFrame,
    obrigatorias: set[str],
    contexto: str,
) -> bool:
    """Valida contrato mínimo de colunas para evitar falhas silenciosas."""
    faltantes = missing_required_columns(df.columns, obrigatorias)
    if faltantes:
        print(f"  ❌ Contrato de schema inválido em {contexto}.")
        print(f"     Colunas faltantes: {', '.join(faltantes)}")
        return False
    return True


# ==============================================================================
# 1. QUALIDADE DO ATENDIMENTO COMERCIAL
# ==============================================================================

def transformar_qualidade_comercial() -> pd.DataFrame | None:
    """
    Lê, limpa e salva o dataset de Qualidade do Atendimento Comercial.

    Este é o dataset principal para a análise de eficácia da REN 1000.
    Contém: nº de serviços, prazo médio, transgressões, compensações R$.
    """
    arquivo = DIR_RAW / "qualidade-atendimento-comercial.csv"

    if not arquivo.exists():
        print(f"⚠️  Arquivo não encontrado: {arquivo.name}")
        print("   Rode primeiro: python -m src.etl.extract_aneel")
        return None

    print(f"\n🔹 Processando: {arquivo.name}")
    print("-" * 50)

    # ---- Leitura ----
    # A ANEEL costuma usar separador ";" e encoding "latin1" ou "utf-8"
    # Tentamos utf-8 primeiro, depois latin1
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(arquivo, sep=";", encoding=encoding, low_memory=False)
            print(f"  Encoding detectado: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    else:
        # Última tentativa: separador vírgula
        try:
            df = pd.read_csv(arquivo, encoding="utf-8", low_memory=False)
            print("  Encoding: utf-8, separador: vírgula")
        except Exception as e:
            print(f"  ❌ Não foi possível ler o arquivo: {e}")
            return None

    print(f"  Linhas brutas: {len(df):,}")
    print(f"  Colunas: {list(df.columns)}")

    # ---- Limpeza básica ----
    # 1. Remover duplicatas
    antes = len(df)
    df = df.drop_duplicates()
    removidas = antes - len(df)
    if removidas > 0:
        print(f"  🗑️  Removidas {removidas:,} duplicatas")

    # 2. Remover linhas totalmente vazias
    df = df.dropna(how="all")

    # 3. Padronizar nomes de colunas (minúscula, sem espaços extras)
    df.columns = df.columns.str.strip().str.lower()
    if not validar_colunas_obrigatorias(
        df,
        RAW_REQUIRED_COLUMNS["qualidade-atendimento-comercial.csv"],
        arquivo.name,
    ):
        return None

    # ---- Informações úteis ----
    print(f"  Linhas após limpeza: {len(df):,}")
    print(f"  Colunas finais: {list(df.columns)}")

    # Mostrar tipos de dados
    print("\n  Tipos de dados:")
    for col, dtype in df.dtypes.items():
        print(f"    {col}: {dtype}")

    # ---- Salvamento ----
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    # Parquet (eficiente para análise com pandas)
    parquet_path = DIR_PROCESSED / "qualidade_comercial.parquet"
    df.to_parquet(parquet_path, index=False)
    print(f"\n  💾 Salvo: {parquet_path.name} ({parquet_path.stat().st_size / 1024:.0f} KB)")

    # CSV (legível para humanos)
    csv_path = DIR_PROCESSED / "qualidade_comercial.csv"
    df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
    print(f"  💾 Salvo: {csv_path.name} ({csv_path.stat().st_size / 1024:.0f} KB)")

    return df


# ==============================================================================
# 2. INDGER — SERVIÇOS COMERCIAIS
# ==============================================================================

def transformar_indger_servicos() -> pd.DataFrame | None:
    """
    Lê, limpa e salva os dados de Serviços Comerciais do INDGER.

    O ZIP contém um ou mais CSVs com dados mensais de quantidades,
    prazos, estoques e compensações por distribuidora.
    """
    # O ZIP foi descompactado pelo extract_aneel.py
    # Procura qualquer CSV que contenha "servico" no nome
    csvs = list(DIR_RAW.glob("*servico*comercia*.csv")) + list(DIR_RAW.glob("*servicos*comercia*.csv"))

    if not csvs:
        # Tenta procurar em subpastas (caso o ZIP tenha estrutura interna)
        csvs = list(DIR_RAW.rglob("*servico*comercia*.csv")) + list(DIR_RAW.rglob("*servicos*comercia*.csv"))

    if not csvs:
        print(f"\n⚠️  Nenhum CSV de serviços comerciais encontrado em {DIR_RAW}")
        print("   Verifique se o ZIP foi descompactado corretamente.")
        return None

    print(f"\n🔹 Processando INDGER Serviços Comerciais")
    print(f"  Arquivos encontrados: {[f.name for f in csvs]}")
    print("-" * 50)

    # Lê e concatena todos os CSVs encontrados
    dfs = []
    for csv_file in csvs:
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                df_temp = pd.read_csv(csv_file, sep=";", encoding=encoding, low_memory=False)
                print(f"  📄 {csv_file.name}: {len(df_temp):,} linhas ({encoding})")
                dfs.append(df_temp)
                break
            except UnicodeDecodeError:
                continue

    if not dfs:
        print("  ❌ Não foi possível ler nenhum CSV")
        return None

    df = pd.concat(dfs, ignore_index=True)

    # Limpeza
    df = df.drop_duplicates()
    df = df.dropna(how="all")
    df.columns = df.columns.str.strip().str.lower()
    if not validar_colunas_obrigatorias(df, RAW_SERVICOS_REQUIRED_COLUMNS, "INDGER serviços comerciais"):
        return None

    print(f"  Linhas totais: {len(df):,}")
    print(f"  Colunas: {list(df.columns)}")

    # Salvamento
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    parquet_path = DIR_PROCESSED / "indger_servicos_comerciais.parquet"
    df.to_parquet(parquet_path, index=False)
    print(f"\n  💾 Salvo: {parquet_path.name}")

    csv_path = DIR_PROCESSED / "indger_servicos_comerciais.csv"
    df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
    print(f"  💾 Salvo: {csv_path.name}")

    return df


# ==============================================================================
# 3. INDGER — DADOS COMERCIAIS
# ==============================================================================

def transformar_indger_comercial() -> pd.DataFrame | None:
    """
    Lê, limpa e salva os Dados Comerciais do INDGER.
    Contém: faturamento, danos elétricos, atendimento por distribuidora.
    """
    arquivo = DIR_RAW / "indger-dados-comerciais.csv"

    if not arquivo.exists():
        print(f"\n⚠️  Arquivo não encontrado: {arquivo.name}")
        return None

    print(f"\n🔹 Processando: {arquivo.name}")
    print("-" * 50)

    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(arquivo, sep=";", encoding=encoding, low_memory=False)
            print(f"  Encoding: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    else:
        print("  ❌ Não foi possível ler o arquivo")
        return None

    # Limpeza
    df = df.drop_duplicates()
    df = df.dropna(how="all")
    df.columns = df.columns.str.strip().str.lower()
    if not validar_colunas_obrigatorias(
        df,
        RAW_REQUIRED_COLUMNS["indger-dados-comerciais.csv"],
        arquivo.name,
    ):
        return None

    print(f"  Linhas: {len(df):,}")
    print(f"  Colunas: {list(df.columns)}")

    # Salvamento
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    parquet_path = DIR_PROCESSED / "indger_dados_comerciais.parquet"
    df.to_parquet(parquet_path, index=False)
    print(f"\n  💾 Salvo: {parquet_path.name}")

    csv_path = DIR_PROCESSED / "indger_dados_comerciais.csv"
    df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
    print(f"  💾 Salvo: {csv_path.name}")

    return df


# ==============================================================================
# 4. AUTOS DE INFRAÇÃO
# ==============================================================================

def transformar_autos_infracao() -> pd.DataFrame | None:
    """
    Lê, limpa e salva o dataset de Autos de Infração da ANEEL.
    Contém: penalidades, multas, natureza da fiscalização por agente.
    """
    arquivo = DIR_RAW / "auto-infracao.csv"

    if not arquivo.exists():
        print(f"\n⚠️  Arquivo não encontrado: {arquivo.name}")
        return None

    print(f"\n🔹 Processando: {arquivo.name}")
    print("-" * 50)

    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(arquivo, sep=";", encoding=encoding, low_memory=False)
            print(f"  Encoding detectado: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    else:
        print("  ❌ Não foi possível ler o arquivo")
        return None

    print(f"  Linhas brutas: {len(df):,}")

    # Limpeza
    antes = len(df)
    df = df.drop_duplicates()
    removidas = antes - len(df)
    if removidas > 0:
        print(f"  🗑️  Removidas {removidas:,} duplicatas")

    df = df.dropna(how="all")
    df.columns = df.columns.str.strip().str.lower()

    if not validar_colunas_obrigatorias(
        df,
        RAW_REQUIRED_COLUMNS["auto-infracao.csv"],
        arquivo.name,
    ):
        return None

    print(f"  Linhas após limpeza: {len(df):,}")
    print(f"  Colunas: {list(df.columns)}")

    # Salvamento (CSV apenas — dataset complementar, não precisa de parquet)
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    csv_path = DIR_PROCESSED / "autos_infracao.csv"
    df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
    print(f"\n  💾 Salvo: {csv_path.name} ({csv_path.stat().st_size / 1024:.0f} KB)")

    return df


# ==============================================================================
# 5. RECLAMAÇÕES NOS 1º E 2º NÍVEIS DA DISTRIBUIDORA
# ==============================================================================

def transformar_reclamacoes() -> pd.DataFrame | None:
    """
    Lê, limpa e concatena os CSVs de Reclamações da ANEEL (2010–2025).
    Múltiplos arquivos por período são concatenados em um único CSV.
    """
    padrao = "reclamacoes-n1e2-distribuidoras-*.csv"
    csvs = sorted(DIR_RAW.glob(padrao))

    if not csvs:
        print(f"\n⚠️  Nenhum CSV de reclamações encontrado em {DIR_RAW}")
        return None

    print(f"\n🔹 Processando Reclamações ({len(csvs)} arquivos)")
    print(f"  Arquivos: {[f.name for f in csvs]}")
    print("-" * 50)

    dfs = []
    for csv_file in csvs:
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                df_temp = pd.read_csv(csv_file, sep=";", encoding=encoding, low_memory=False)
                print(f"  📄 {csv_file.name}: {len(df_temp):,} linhas ({encoding})")
                dfs.append(df_temp)
                break
            except UnicodeDecodeError:
                continue

    if not dfs:
        print("  ❌ Não foi possível ler nenhum CSV")
        return None

    df = pd.concat(dfs, ignore_index=True)

    # Limpeza
    antes = len(df)
    df = df.drop_duplicates()
    removidas = antes - len(df)
    if removidas > 0:
        print(f"  🗑️  Removidas {removidas:,} duplicatas")

    df = df.dropna(how="all")
    df.columns = df.columns.str.strip().str.lower()

    if not validar_colunas_obrigatorias(
        df,
        RAW_REQUIRED_COLUMNS["reclamacoes-n1e2-distribuidoras-2023.csv"],
        "reclamacoes",
    ):
        return None

    print(f"  Linhas totais: {len(df):,}")
    print(f"  Colunas: {list(df.columns)}")

    # Salvamento
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    csv_path = DIR_PROCESSED / "reclamacoes.csv"
    df.to_csv(csv_path, index=False, sep=";", encoding="utf-8")
    print(f"\n  💾 Salvo: {csv_path.name} ({csv_path.stat().st_size / 1024:.0f} KB)")

    return df


# ==============================================================================
# FUNÇÃO PRINCIPAL
# ==============================================================================

def executar_transformacao():
    """Executa a transformação de todos os datasets."""
    from datetime import datetime

    print("=" * 70)
    print("🧹 TRANSFORMAÇÃO DE DADOS — ANEEL")
    print(f"   Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    erros_raw = validate_raw_contracts(DIR_RAW)
    if erros_raw:
        print("\n❌ Falha de contrato nos dados brutos. Corrija antes da transformação:")
        for erro in erros_raw:
            print(f"  - {erro}")
        return False

    resultados = {}

    # 1. Qualidade Comercial
    df_qc = transformar_qualidade_comercial()
    resultados["Qualidade Comercial"] = "✅" if df_qc is not None else "❌"

    # 2. INDGER Serviços Comerciais
    df_sc = transformar_indger_servicos()
    resultados["INDGER Serviços Comerciais"] = "✅" if df_sc is not None else "❌"

    # 3. INDGER Dados Comerciais
    df_dc = transformar_indger_comercial()
    resultados["INDGER Dados Comerciais"] = "✅" if df_dc is not None else "❌"

    # 4. Autos de Infração (complementar — falha não bloqueia)
    df_ai = transformar_autos_infracao()
    resultados["Autos de Infração"] = "✅" if df_ai is not None else "⚠️"

    # 5. Reclamações (complementar — falha não bloqueia)
    df_rec = transformar_reclamacoes()
    resultados["Reclamações"] = "✅" if df_rec is not None else "⚠️"

    # Resumo
    print("\n" + "=" * 70)
    print("📊 RESUMO DA TRANSFORMAÇÃO")
    print("=" * 70)
    for nome, status in resultados.items():
        print(f"  {status} {nome}")

    # Datasets core (❌) bloqueiam; complementares (⚠️) apenas alertam
    sucesso = all(status != "❌" for status in resultados.values())
    if not sucesso:
        print("\n❌ Transformação interrompida: datasets obrigatórios falharam.")
        return False

    erros_processed = validate_processed_contracts(DIR_PROCESSED)
    if erros_processed:
        print("\n❌ Falha de contrato nos dados processados:")
        for erro in erros_processed:
            print(f"  - {erro}")
        return False

    print(f"\n  📂 Arquivos processados em: {DIR_PROCESSED}")
    print("  Próximo passo: análise exploratória em src/analysis/")
    return True


if __name__ == "__main__":
    ok = executar_transformacao()
    sys.exit(0 if ok else 1)
