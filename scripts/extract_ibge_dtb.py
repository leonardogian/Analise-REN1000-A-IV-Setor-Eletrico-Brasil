import pandas as pd
import zipfile
import os

zip_path = "/home/gianmarinolc/Documents/Estudos/TCC_leo_main/data/raw/DTB_2024.zip"
output_path = "/home/gianmarinolc/Documents/Estudos/TCC_leo_main/data/processed/dim_municipio.parquet"

print(f"Lendo {zip_path}...")
with zipfile.ZipFile(zip_path, "r") as z:
    with z.open("RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.ods") as f:
        df = pd.read_excel(f, engine="odf")

print("Colunas:", df.columns.tolist())
df.head().to_csv("/home/gianmarinolc/Documents/Estudos/TCC_leo_main/data/processed/ibge_head.csv", index=False)
