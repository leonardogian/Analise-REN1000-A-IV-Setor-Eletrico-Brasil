import pandas as pd
from sqlalchemy import create_engine
import os

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
        print(f"Carregando {table_name} ...")
        
        try:
            df = pd.read_parquet(p_file)
            df.to_sql(table_name, engine, if_exists='replace', index=False)
            print(f"Sucesso: {table_name} ({len(df)} registros)")
        except Exception as e:
            print(f"Erro ao carregar {table_name}: {e}")

if __name__ == "__main__":
    main()
