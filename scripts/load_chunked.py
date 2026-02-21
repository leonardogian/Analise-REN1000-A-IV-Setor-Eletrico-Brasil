import pandas as pd
from sqlalchemy import create_engine
import os

def load_in_chunks(file_path, engine, table_name, chunksize=50000):
    print(f"Lendo parquet {file_path}...")
    import pyarrow.parquet as pq
    
    parquet_file = pq.ParquetFile(file_path)
    
    # Check if table exists, if so drop it first so we can append chunks
    with engine.begin() as conn:
        conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table_name}")
        
    for i, batch in enumerate(parquet_file.iter_batches(batch_size=chunksize)):
        df_chunk = batch.to_pandas()
        print(f"  Inserindo lote {i+1} no banco de dados...")
        df_chunk.to_sql(table_name, engine, if_exists='append', index=False)
        
    print(f"Sucesso: {table_name} carregado com sucesso em lotes!")

def main():
    engine = create_engine('postgresql+psycopg2://admin:adminpassword@localhost:5432/tcc_db')
    
    files_to_load = [
        "/home/gianmarinolc/Documents/Estudos/TCC_leo_main/data/processed/analysis/fato_servicos_municipio_mes.parquet",
        "/home/gianmarinolc/Documents/Estudos/TCC_leo_main/data/processed/dim_municipio.parquet"
    ]
    
    for p_file in files_to_load:
        if not os.path.exists(p_file):
            print(f"Arquivo nao encontrado: {p_file}")
            continue
            
        table_name = os.path.basename(p_file).replace('.parquet', '')
        print(f"\nIniciando carga de {table_name} ...")
        
        try:
            load_in_chunks(p_file, engine, table_name)
        except Exception as e:
            print(f"Erro ao carregar {table_name}: {e}")

if __name__ == "__main__":
    main()
