import nbformat
from pathlib import Path

ROOT = Path('/home/gianmarinolc/Documents/Estudos/TCC_leo_main/notebooks')
nb_path = ROOT / '03_porte_e_benchmark_distribuidoras.ipynb'

if nb_path.exists():
    with open(nb_path, 'r', encoding='utf-8') as f:
        nb = nbformat.read(f, as_version=4)
        
    source_rank = """# Ranking por taxa normalizada no periodo mais recente (agrupado por Holding GERAL)
ultimo_ano = dist_mes['ano'].max()

# Definindo Holdings de foco
maiores_grupos = ['neoenergia', 'cpfl', 'equatorial', 'energisa', 'enel', 'edp', 'eletrobras', 'cemig', 'copel', 'celesc']

df_ultimo_ano = dist_mes[dist_mes['ano'] == ultimo_ano].copy()

# Filtrando só grandes grupos
df_holdings = df_ultimo_ano[df_ultimo_ano['group_id'].isin(maiores_grupos)].copy()

rank = (
    df_holdings.groupby(['group_id', 'group_label'], as_index=False)
    .agg(
        qtd_serv_realizado=('qtd_serv_realizado', 'sum'),
        qtd_fora_prazo=('qtd_fora_prazo', 'sum'),
        compensacao_rs=('compensacao_rs', 'sum'),
        uc_ativa_mes=('uc_ativa_mes', 'sum'),
    )
)
rank['taxa_fora_prazo'] = rank['qtd_fora_prazo'] / rank['qtd_serv_realizado']
rank['fora_prazo_por_100k_uc_mes'] = (rank['qtd_fora_prazo'] / rank['uc_ativa_mes']) * 100000

# Adicionando Linha do indice GERAL / Média Brasil
taxa_brasil_abs = df_ultimo_ano['qtd_fora_prazo'].sum() / df_ultimo_ano['qtd_serv_realizado'].sum()
taxa_brasil_100k = (df_ultimo_ano['qtd_fora_prazo'].sum() / df_ultimo_ano['uc_ativa_mes'].sum()) * 100000
rank_brasil = pd.DataFrame([{
    'group_id': 'geral', 'group_label': 'Média Brasil (Geral)',
    'qtd_serv_realizado': df_ultimo_ano['qtd_serv_realizado'].sum(),
    'qtd_fora_prazo': df_ultimo_ano['qtd_fora_prazo'].sum(),
    'taxa_fora_prazo': taxa_brasil_abs,
    'fora_prazo_por_100k_uc_mes': taxa_brasil_100k
}])

rank = pd.concat([rank, rank_brasil], ignore_index=True)
rank = rank.sort_values('fora_prazo_por_100k_uc_mes', ascending=False)
rank"""

    for cell in nb.cells:
        if cell.cell_type == 'code' and "ultimo_ano = dist_mes['ano'].max()" in cell.source:
            cell.source = source_rank
            break
            
    source_chart = """import matplotlib.pyplot as plt
import seaborn as sns

plt.figure(figsize=(10, 6))
sns.barplot(data=rank, x='fora_prazo_por_100k_uc_mes', y='group_label', palette='viridis')
plt.title('Ranking de Serviços Fora do Prazo por 100k UCs - Grandes Holdings vs Média Brasil')
plt.xlabel('Serviços Fora do Prazo a cada 100 mil UCs')
plt.ylabel('Holding / Group ID')

# Destacar a média brasil
plt.axvline(x=taxa_brasil_100k, color='red', linestyle='--', label='Média Brasil')
plt.legend()
plt.tight_layout()
plt.show()"""

    for cell in nb.cells:
        if cell.cell_type == 'code' and "rank_grupo = rank.merge" in cell.source or "try:" in cell.source and "dim_grupos = pd.read_parquet(ANALYSIS_DIR" in cell.source:
            cell.source = source_chart
            break

    with open(nb_path, 'w', encoding='utf-8') as f:
        nbformat.write(nb, f)

print("Notebook 03 refatorado.")
