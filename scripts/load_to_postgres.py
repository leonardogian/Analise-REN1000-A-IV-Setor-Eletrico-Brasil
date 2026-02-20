import pandas as pd
from sqlalchemy import create_engine
import os
import glob
from pathlib import Path

def main():
    engine = create_engine('postgresql+psycopg2://admin:adminpassword@localhost:5432/tcc_db')
    
    # Processed and Analysis folders
    base_dir = Path(__file__).resolve().parent.parent
    data_dirs = [
        base_dir / 'data' / 'processed',
        base_dir / 'data' / 'processed' / 'analysis'
    ]
    
    # The files specifically needed for the SQL view
    # Or just load all parquet files we can find
    parquet_files = []
    for d in data_dirs:
        if d.exists():
            parquets = glob.glob(str(d / '*.parquet'))
            parquet_files.extend(parquets)
            
    if not parquet_files:
        print("Nenhum arquivo parquet encontrado.")
        return
        
    for p_file in parquet_files:
        table_name = Path(p_file).stem
        print(f"Carregando {table_name} ...")
        
        try:
            df = pd.read_parquet(p_file)
            # Create table and insert data (replace if it exists)
            df.to_sql(table_name, engine, if_exists='replace', index=False)
            print(f"Sucesso: {table_name} ({len(df)} registros)")
        except Exception as e:
            print(f"Erro ao carregar {table_name}: {e}")

if __name__ == "__main__":
    main()
