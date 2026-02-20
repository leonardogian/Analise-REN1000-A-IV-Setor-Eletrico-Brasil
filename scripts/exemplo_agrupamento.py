import pandas as pd
import os

# Caminho para os dados já processados do TCC
data_path = "data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet"

if not os.path.exists(data_path):
    print(f"Erro: Arquivo {data_path} não encontrado.")
    exit(1)

print("--- Lendo os dados de penalidades mensais ---")
df = pd.read_parquet(data_path)

# =======================================================================
# EXEMPLO 1: Agrupar tudo por grandes Grupos Econômicos (Neoenergia, CPFL)
# =======================================================================
print("\n[Ranking de Compensações Totais Pagas por GRUPO ECONÔMICO] (Top 5)")
# Agrupamos as linhas usando a coluna 'group_id' e somamos a multa (compensacao_rs)
ranking_grupos = df.groupby("group_id")[["compensacao_rs", "qtd_fora_prazo"]].sum().reset_index()

# Ordenando do maior para o menor e formatando em Milhões de reais
ranking_grupos = ranking_grupos.sort_values(by="compensacao_rs", ascending=False).head(5)
ranking_grupos["Multa (Milhões)"] = ranking_grupos["compensacao_rs"] / 1_000_000
print(ranking_grupos[["group_id", "Multa (Milhões)", "qtd_fora_prazo"]])

# =======================================================================
# EXEMPLO 2: Comparar as distribuidoras detalhadas DENTRO DE UM GRUPO
# =======================================================================
alvo = "neoenergia"
print(f"\n[Abertura das Distribuidoras apenas da {alvo.upper()}]")

# Filtra a tabela mantendo apenas o grupo alvo
df_grupo = df[df["group_id"] == alvo]

# Agrupa usando o nome limpo das distribuidoras filhas do grupo e vê qual paga mais multas
ranking_internos = df_grupo.groupby("distributor_name_sig")[["compensacao_rs"]].sum().reset_index()
ranking_internos["Multa (Milhões)"] = ranking_internos["compensacao_rs"] / 1_000_000
ranking_internos = ranking_internos.sort_values(by="compensacao_rs", ascending=False)
print(ranking_internos[["distributor_name_sig", "Multa (Milhões)"]])
