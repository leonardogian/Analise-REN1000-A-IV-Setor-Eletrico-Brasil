import nbformat
from pathlib import Path

ROOT = Path('/home/gianmarinolc/Documents/Estudos/TCC_leo_main/notebooks')

# Modificando 05_analise...
nb5_path = ROOT / '05_analise_5_maiores_grupos.ipynb'
if nb5_path.exists():
    with open(nb5_path, 'r', encoding='utf-8') as f:
        nb5 = nbformat.read(f, as_version=4)
        
    # Replaces in the first cell (markdown)
    nb5.cells[0].source = nb5.cells[0].source.replace("5 maiores grupos", "Grandes Grupos de Distribuição").replace("(Neoenergia, CPFL, Equatorial, Energisa, Enel)", "(Neoenergia, CPFL, Equatorial, Energisa, Enel, EDP, Eletrobras, Outras Grandes)")
    
    # Replacing the cell defining the groups
    source_top5 = """# Selecionando os principais grupos de interesse (Holdings)
maiores_grupos = ['neoenergia', 'cpfl', 'equatorial', 'energisa', 'enel', 'edp', 'eletrobras', 'cemig', 'copel', 'celesc']

# Adicionando a Média Brasil/Geral como um "Grupo" para benchmark
# Primero, calculamos as métricas globais antes de filtrar
total_brasil_absoluto = df_fato['qtd_fora_prazo'].sum()
total_uc_ativa = df_fato['uc_ativa_media_mensal'].sum()

# Filtrando a base para as Top 8 Holdings
df_top = df_fato[df_fato['group_id'].isin(maiores_grupos)].copy()

print('Total de registros após o filtro:', df_top.shape)"""
    
    for cell in nb5.cells:
        if cell.cell_type == 'code' and "maiores_grupos = [" in cell.source:
            cell.source = source_top5
            break
            
    # We will rename top5 to df_top in subsequent cells if needed, or just replace var names
    for cell in nb5.cells:
        if cell.cell_type == 'code':
            cell.source = cell.source.replace("df_top5", "df_top")
            
    # Modify "Gráfico Absoluto" adding the Brasil indicator (or we can just skip it since Absoluto Brasil is huge and visually breaks it)
    
    # Modify "Gráfico Normalizado" to add Brasil
    source_norm = """# Gráfico Normalizado: Falhas por 100k Unidades Consumidoras
# Agregamos os totais primeiro para calcular uma taxa real consolidada
agreg_norm = df_top.groupby('group_label').agg({
    'qtd_fora_prazo': 'sum',
    'uc_ativa_media_mensal': 'sum' # Assumindo a m\u00e9dia do ano soma, ajustado via formula
}).reset_index()

# Calculando a taxa consolidada das Holdings
agreg_norm['taxa_100k_uc'] = (agreg_norm['qtd_fora_prazo'] / agreg_norm['uc_ativa_media_mensal']) * 100000

# Calculando a Média Brasil Geral e inserindo como linha/barra adicional
taxa_brasil = (total_brasil_absoluto / total_uc_ativa) * 100000
agreg_brasil = pd.DataFrame([{'group_label': 'Média Brasil (Geral)', 'qtd_fora_prazo': total_brasil_absoluto, 'uc_ativa_media_mensal': total_uc_ativa, 'taxa_100k_uc': taxa_brasil}])
agreg_norm = pd.concat([agreg_norm, agreg_brasil], ignore_index=True)

agreg_norm = agreg_norm.sort_values(by='taxa_100k_uc', ascending=False)

plt.figure(figsize=(12, 6))
sns.barplot(data=agreg_norm, x='taxa_100k_uc', y='group_label', palette='magma')

# Add a vertical line for the Média Brasil
plt.axvline(x=taxa_brasil, color='red', linestyle='--', label='Média Brasil')
plt.legend()

plt.title('Taxa Normalizada Inter-Grupos vs Média Geral (Por 100k UCs)')
plt.xlabel('Falhas a cada 100 mil UCs Ativas')
plt.ylabel('Holding / Média Geral')
plt.tight_layout()
plt.show()"""

    for cell in nb5.cells:
        if cell.cell_type == 'code' and "agreg_norm = df_top.groupby" in cell.source:
            cell.source = source_norm
            break
            
    with open(nb5_path, 'w', encoding='utf-8') as f:
        nbformat.write(nb5, f)

# Modificando e renomeando
nb5_path.rename(ROOT / '05_analise_grandes_grupos.ipynb')

print("Refatoração do 05 concluída")
