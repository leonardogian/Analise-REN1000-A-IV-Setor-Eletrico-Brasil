import pandas as pd
from sqlalchemy import create_engine
import os
import glob
from pathlib import Path
import pyarrow.parquet as pq

def load_in_chunks(file_path, engine, table_name, chunksize=50000):
    print(f"Lendo parquet {file_path}...")
    parquet_file = pq.ParquetFile(file_path)
    
    # Check if table exists, if so drop it first so we can append chunks
    with engine.begin() as conn:
        conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table_name}")
        
    for i, batch in enumerate(parquet_file.iter_batches(batch_size=chunksize)):
        df_chunk = batch.to_pandas()
        print(f"  Inserindo lote {i+1} da tabela {table_name} no banco de dados...")
        df_chunk.to_sql(table_name, engine, if_exists='append', index=False)
        
    print(f"Sucesso: {table_name} carregado com sucesso em lotes!")

def main():
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL', 'postgresql+psycopg2://admin:adminpassword@localhost:5432/tcc_db')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    # SQLAlchemy sometimes works better with postgresql+psycopg2 explicitly if not using async
    if db_url.startswith("postgresql://") and "+psycopg2" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        
    engine = create_engine(db_url)
    
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
        print(f"\nIniciando carga de {table_name} ...")
        
        try:
            load_in_chunks(p_file, engine, table_name)
        except Exception as e:
            print(f"Erro ao carregar {table_name}: {e}")

if __name__ == "__main__":
    main()
