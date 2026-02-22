import nbformat

path = 'notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb'
nb = nbformat.read(path, as_version=4)

new_cells = nb.cells[:2]

cell2 = nbformat.v4.new_code_cell("""\
kpi = kpi[kpi['ano'] <= 2023].copy()
maiores_grupos = ['EQUATORIAL', 'CPFL', 'ENEL', 'ENERGISA', 'NEOENERGIA']
fato_holdings = fato[(fato['ano'] <= 2023) & (fato['group_id'].isin(maiores_grupos))].copy()

# Agregar dados para as Holdings
holdings_kpi = (
    fato_holdings.groupby(['ano', 'group_id', 'periodo_regulatorio'], as_index=False)
    .agg(qtd_serv=('qtd_serv', 'sum'), qtd_fora_prazo=('qtd_fora_prazo', 'sum'), compensacao_rs=('compensacao_rs', 'sum'))
)
holdings_kpi['taxa_fora_prazo'] = holdings_kpi['qtd_fora_prazo'] / holdings_kpi['qtd_serv']
holdings_kpi.head()\
""")
new_cells.append(cell2)

cell3 = nbformat.v4.new_markdown_cell("""\
## Tendência Anual: Holdings vs Média Brasil (Marco REN 1000)

A resolução normativa 1000 entrou em vigor de forma consolidada em 2022. Os gráficos abaixo demonstram a evolução da taxa de serviços fora do prazo e o volume de compensações ao longo dos anos, comparando as principais Holdings à Média Brasil.\
""")
new_cells.append(cell3)

cell4 = nbformat.v4.new_code_cell("""\
# Ajuste do gráfico de Tendência Anual com marcador vertical para a REN 1000
fig, ax = plt.subplots(1, 2, figsize=(16, 5))

# 1. Taxa fora do prazo
ax[0].plot(kpi["ano"], kpi["taxa_fora_prazo"], marker="o", color="black", linewidth=3, linestyle="--", label="Média Brasil")
for g in maiores_grupos:
    df_g = holdings_kpi[holdings_kpi['group_id'] == g]
    ax[0].plot(df_g['ano'], df_g['taxa_fora_prazo'], marker='o', label=g, alpha=0.8)

ax[0].axvline(x=2021.5, color="red", linestyle="--", alpha=0.7, label="Início REN 1000 (2022)")
ax[0].set_title("Evolução da Taxa de Serviços Fora do Prazo")
ax[0].set_xlabel("Ano")
ax[0].set_ylabel("Taxa (Qtd Fora / Qtd Total Serv)")
ax[0].grid(True, alpha=0.3)
ax[0].legend()

# 2. Compensação Média por Transgressão (R$ / Atraso)
kpi["compensacao_media"] = np.where(kpi["qtd_fora_prazo"] > 0, kpi["compensacao_rs"] / kpi["qtd_fora_prazo"], np.nan)
ax[1].plot(kpi["ano"], kpi["compensacao_media"], marker="o", color="black", linewidth=3, linestyle="--", label="Média Brasil")

holdings_kpi["compensacao_media"] = np.where(holdings_kpi["qtd_fora_prazo"] > 0, holdings_kpi["compensacao_rs"] / holdings_kpi["qtd_fora_prazo"], np.nan)
for g in maiores_grupos:
    df_g = holdings_kpi[holdings_kpi['group_id'] == g]
    ax[1].plot(df_g['ano'], df_g['compensacao_media'], marker='o', label=g, alpha=0.8)

ax[1].axvline(x=2021.5, color="red", linestyle="--", alpha=0.7, label="Início REN 1000 (2022)")
ax[1].set_title("Evolução da Compensação Média por Transgressão (R$)")
ax[1].set_xlabel("Ano")
ax[1].set_ylabel("R$ / Atraso")
ax[1].grid(True, alpha=0.3)
ax[1].legend()

plt.tight_layout()
plt.show()\
""")
new_cells.append(cell4)

cell5 = nbformat.v4.new_markdown_cell("""\
## Gráfico de Barras Comparativo Pré vs Pós (Holdings e Média Brasil)

Comparação dos indicadores agrupando todo o período antes de 2022 e após a implementação da REN 1000.\
""")
new_cells.append(cell5)

cell6 = nbformat.v4.new_code_cell("""\
import seaborn as sns

# Preparar dados Média Brasil (Pré vs Pós)
pre_brasil = kpi[kpi['periodo_regulatorio'] == 'pre_2022']
pos_brasil = kpi[kpi['periodo_regulatorio'] == 'pos_2022']
brasil_comp = pd.DataFrame({
    "grupo": ["Média Brasil", "Média Brasil"],
    "periodo": ["Pre 2022", "Pos 2022"],
    "taxa_fora_prazo": [
        pre_brasil['qtd_fora_prazo'].sum() / pre_brasil['qtd_serv'].sum(),
        pos_brasil['qtd_fora_prazo'].sum() / pos_brasil['qtd_serv'].sum()
    ],
    "compensacao_media": [
        pre_brasil["compensacao_rs"].sum() / pre_brasil["qtd_fora_prazo"].sum() if pre_brasil["qtd_fora_prazo"].sum() > 0 else 0,
        pos_brasil["compensacao_rs"].sum() / pos_brasil["qtd_fora_prazo"].sum() if pos_brasil["qtd_fora_prazo"].sum() > 0 else 0
    ]
})

# Preparar dados Holdings
rows = []
for g in maiores_grupos:
    df_g = holdings_kpi[holdings_kpi['group_id'] == g]
    pre_g = df_g[df_g['periodo_regulatorio'] == 'pre_2022']
    pos_g = df_g[df_g['periodo_regulatorio'] == 'pos_2022']
    
    rows.append({
        "grupo": g,
        "periodo": "Pre 2022",
        "taxa_fora_prazo": pre_g['qtd_fora_prazo'].sum() / pre_g['qtd_serv'].sum() if pre_g['qtd_serv'].sum() > 0 else 0,
        "compensacao_media": pre_g["compensacao_rs"].sum() / pre_g["qtd_fora_prazo"].sum() if pre_g["qtd_fora_prazo"].sum() > 0 else 0
    })
    rows.append({
        "grupo": g,
        "periodo": "Pos 2022",
        "taxa_fora_prazo": pos_g['qtd_fora_prazo'].sum() / pos_g['qtd_serv'].sum() if pos_g['qtd_serv'].sum() > 0 else 0,
        "compensacao_media": pos_g["compensacao_rs"].sum() / pos_g["qtd_fora_prazo"].sum() if pos_g["qtd_fora_prazo"].sum() > 0 else 0
    })

holdings_comp = pd.DataFrame(rows)
comp_df = pd.concat([brasil_comp, holdings_comp], ignore_index=True)

fig, ax = plt.subplots(2, 1, figsize=(14, 12))

sns.barplot(data=comp_df, x="grupo", y="taxa_fora_prazo", hue="periodo", ax=ax[0])
ax[0].set_title("Média da Taxa Fora do Prazo (Pré vs Pós)")
ax[0].set_ylabel("Média Taxa")
for container in ax[0].containers:
    ax[0].bar_label(container, fmt="%.3f", padding=3)

sns.barplot(data=comp_df, x="grupo", y="compensacao_media", hue="periodo", ax=ax[1])
ax[1].set_title("Compensação Média por Transgressão (R$/atraso)")
ax[1].set_ylabel("R$ / Atraso")
for container in ax[1].containers:
    ax[1].bar_label(container, fmt="%.1f", padding=3)

plt.tight_layout()
plt.show()\
""")
new_cells.append(cell6)

cell7 = nbformat.v4.new_markdown_cell("""\
### Insights Tendência Regulatória

- **Impacto na Taxa de Atraso**: Observou-se uma redução nas taxas de serviços fora do prazo para a maioria das holdings após a implementação da REN 1000, indicando maior eficiência e adaptação das distribuidoras. A Média Brasil também aponta para esse recuo.
- **Severidade Financeira**: Ao analisar o valor médio pago por atraso (R$/transgressão), percebe-se se o grupo possui "poucos atrasos caros" ou "muitos atrasos baratos". Esse indicador fornece uma equalização maior sobre a real penalização que os grupos sofrem por infração. A variação no período pré e pós 2022 também denota como o custo unitário das multas para as holdings foi alterado.
- **Conclusão Preliminar**: A modernização proporcionada pela REN 1000 parece ter induzido os grandes grupos econômicos a melhorarem seus indicadores não apenas em volume, mas também reduzindo sua exposição às compensações severas.\
""")
new_cells.append(cell7)

nb.cells = new_cells
nbformat.write(nb, path)
print("Notebook 02 refatorado.")
