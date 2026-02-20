import pandas as pd
import glob
import os

def inspect_parquet(directory):
    files = glob.glob(os.path.join(directory, "*.parquet"))
    for file in files:
        print(f"\n--- Tabela: {os.path.basename(file)} ---")
        try:
            # Ler apenas a primeira linha para ser mais rápido e extrair as colunas
            df = pd.read_parquet(file, engine='pyarrow') # Tentando usar pyarrow no pandas se disponível
        except:
            try:
                df = pd.read_parquet(file)
            except Exception as e:
                print(f"Erro ao ler {file}: {e}")
                continue
                
        print("\nColunas e tipos:")
        for col, dtype in zip(df.columns, df.dtypes):
            print(f"  - {col}: {dtype}")

print("=== TABELAS DE ANÁLISE (data/processed/analysis) ===")
inspect_parquet("data/processed/analysis")
inspect_parquet("data/processed/analysis/neoenergia")
inspect_parquet("data/processed/analysis/grupos")

print("\n=== TABELAS PROCESSADAS BASE (data/processed) ===")
inspect_parquet("data/processed")
