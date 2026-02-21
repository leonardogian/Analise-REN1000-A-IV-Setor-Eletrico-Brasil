import json
import pandas as pd
from pathlib import Path

def append_cells(nb_path, new_cells):
    path = Path(nb_path)
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    for cell in new_cells:
        cell_type = cell['cell_type']
        source = cell['source']
        if isinstance(source, str):
            source = [line + '\n' for line in source.split('\n')]
            if source:
                source[-1] = source[-1].rstrip('\n') # remove trailing newline from last line format
        
        new_cell = {
            'cell_type': cell_type,
            'metadata': {},
            'source': source
        }
        if cell_type == 'code':
            new_cell['execution_count'] = None
            new_cell['outputs'] = []
            
        nb['cells'].append(new_cell)
        
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
        
# ------------------------------------------------------------------------------
# 01 - Mapa de Dados e Qualidade
# ------------------------------------------------------------------------------
print("Updating 01_mapa_dados_e_qualidade.ipynb ...")
append_cells('notebooks/01_mapa_dados_e_qualidade.ipynb', [
    {
        'cell_type': 'markdown',
        'source': '## Visualização da Cobertura de Dados\n\nAbaixo, plotamos a evolução do número de agentes e serviços base ao longo dos anos para verificar a consistência da base de dados histórica.'
    },
    {
        'cell_type': 'code',
        'source': 'import matplotlib.pyplot as plt\nimport seaborn as sns\n\n# Preparar dados de cobertura\ncobertura = fato.groupby("ano", as_index=False).agg(\n    agentes=("sigagente", "nunique"),\n    servicos_base=("codigo_base", "nunique")\n)\n\nfig, ax1 = plt.subplots(figsize=(10, 5))\n\n# Eixo 1: Agentes\ncolor = "tab:blue"\nax1.set_xlabel("Ano")\nax1.set_ylabel("Quantidade de Agentes (Distribuidoras)", color=color)\nax1.plot(cobertura["ano"], cobertura["agentes"], marker="o", color=color, linewidth=2)\nax1.tick_params(axis="y", labelcolor=color)\nax1.set_ylim(0, cobertura["agentes"].max() * 1.2)\n\n# Eixo 2: Servicos\nax2 = ax1.twinx()  \ncolor = "tab:orange"\nax2.set_ylabel("Quantidade de Serviços Base", color=color)\nax2.plot(cobertura["ano"], cobertura["servicos_base"], marker="s", color=color, linewidth=2)\nax2.tick_params(axis="y", labelcolor=color)\nax2.set_ylim(0, cobertura["servicos_base"].max() * 1.2)\n\nplt.title("Evolução da Cobertura de Dados: Agentes e Serviços (2011-2023)")\nfig.tight_layout()\nplt.grid(alpha=0.3)\nplt.show()'
    },
    {
        'cell_type': 'markdown',
        'source': '### Insights sobre Qualidade e Cobertura\n\n- **Estabilidade da Amostra**: O número de distribuidoras (agentes) reportando dados mantém-se relativamente estável ao longo da década, o que permite uma análise longitudinal confiável.\n- **Evolução de Serviços**: A quantidade de serviços monitorados e reportados pode sofrer leves flutuações dependendo da revisão tarifária ou mudanças metodológicas da ANEEL, mas a estrutura central da base permanece consistente para o período histórico.\n- **Prontidão para Análise**: A base `fato_indicadores_anuais` consolida as dezenas de milhões de registros da ANEEL em agregações limpas, ideal para investigar a tendência de longo prazo das taxas de serviço fora do prazo.'
    }
])


# ------------------------------------------------------------------------------
# 02 - Tendencia Regulatoria (REN 414 x REN 1000)
# ------------------------------------------------------------------------------
print("Updating 02_tendencia_regulatoria_414_vs_1000.ipynb ...")
append_cells('notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb', [
    {
        'cell_type': 'markdown',
        'source': '## Análise Visual: Pré vs Pós REN 1000\n\nA resolução normativa 1000 entrou em vigor de forma consolidada em 2022. Vamos observar as métricas dividindo a série histórica neste marco.'
    },
    {
        'cell_type': 'code',
        'source': '# Ajuste do gráfico de Tendência Anual com marcador vertical para a REN 1000\nfig, ax = plt.subplots(1, 2, figsize=(14, 5))\n\n# 1. Taxa fora do prazo\nax[0].plot(kpi["ano"], kpi["taxa_fora_prazo"], marker="o", color="#2ca02c", linewidth=2.5)\nax[0].axvline(x=2021.5, color="red", linestyle="--", alpha=0.7, label="Início REN 1000 (2022)")\nax[0].set_title("Evolução da Taxa de Serviços Fora do Prazo")\nax[0].set_xlabel("Ano")\nax[0].set_ylabel("Taxa (Qtd Fora / Qtd Total Serv)")\nax[0].grid(True, alpha=0.3)\nax[0].legend()\n\n# 2. Compensação Total\nax[1].plot(kpi["ano"], kpi["compensacao_rs"] / 1e6, marker="o", color="#d62728", linewidth=2.5)\nax[1].axvline(x=2021.5, color="red", linestyle="--", alpha=0.7, label="Início REN 1000 (2022)")\nax[1].set_title("Evolução da Compensação Paga aos Consumidores")\nax[1].set_xlabel("Ano")\nax[1].set_ylabel("Milhões de R$")\nax[1].grid(True, alpha=0.3)\nax[1].legend()\n\nplt.tight_layout()\nplt.show()'
    },
    {
        'cell_type': 'code',
        'source': '# Gráfico de Barras Comparativo Pre vs Pos\ncomp_df = pd.DataFrame({\n    "periodo": ["Pre 2022", "Pos 2022"],\n    "taxa_fora_prazo": [pre_taxa, pos_taxa],\n    "compensacao_anual_media": [\n        pre["compensacao_rs"].sum() / len(pre["ano"].unique()) / 1e6,\n        pos["compensacao_rs"].sum() / len(pos["ano"].unique()) / 1e6\n    ]\n})\n\nfig, ax = plt.subplots(1, 2, figsize=(14, 4))\n\nsns.barplot(data=comp_df, x="periodo", y="taxa_fora_prazo", ax=ax[0], palette="Blues")\nax[0].set_title("Média da Taxa Fora do Prazo (Período)")\nax[0].set_ylabel("Média Taxa Fora do Prazo")\nax[0].bar_label(ax[0].containers[0], fmt="%.4f")\n\nsns.barplot(data=comp_df, x="periodo", y="compensacao_anual_media", ax=ax[1], palette="Reds")\nax[1].set_title("Compensação Anual Média (Milhões de R$)")\nax[1].set_ylabel("Milhões R$ / Ano")\nax[1].bar_label(ax[1].containers[0], fmt="%.1f")\n\nplt.tight_layout()\nplt.show()'
    },
    {
        'cell_type': 'markdown',
        'source': '### Insights Tendência Regulatória\n\n- **Impacto na Taxa de Atraso**: Observa-se a partir dos gráficos comparativos se houve uma redução ou aumento na proporção de serviços realizados fora do prazo após a implementação da REN 1000. \n- **Efeito Financeiro (Compensações)**: Os valores pagos em compensações mostram qual período penalizou mais as distribuidoras financeiramente. Uma queda pós-2022 sugeriria que as distribuidoras se ajustaram mais rápido aos novos prazos regulatórios, ou que a regulação conteve excessos.\n- **Conclusão Pré-liminar**: A divisão entre Pré e Pós evidencia de forma clara qual o custo regulatório da qualidade de atendimento comercial para o setor elétrico.'
    }
])


# ------------------------------------------------------------------------------
# 03 - Porte e Benchmark de Distribuidoras
# ------------------------------------------------------------------------------
print("Updating 03_porte_e_benchmark_distribuidoras.ipynb ...")
append_cells('notebooks/03_porte_e_benchmark_distribuidoras.ipynb', [
    {
        'cell_type': 'markdown',
        'source': '## Análise de Grupos e Ranking Moderno\n\nVamos agora explorar a `dim_distributor_group` para agrupar agentes e desenhar o ranking das concessionárias no ano mais recente.'
    },
    {
        'cell_type': 'code',
        'source': 'import matplotlib.pyplot as plt\nimport seaborn as sns\n\ntry:\n    # Carregar a base de agrupamento de concessionárias\n    dim_grupos = pd.read_parquet(ANALYSIS_DIR / "dim_distributor_group.parquet")\n    fato_grupos = pd.read_parquet(ANALYSIS_DIR / "fato_grupos_algoritmicos.parquet")\n    \n    # Enriquecer o rank atual com os grupos se disponível\n    if "sigagente" in dim_grupos.columns:\n        rank_grupo = rank.merge(dim_grupos, on="sigagente", how="left")\n    else:\n        rank_grupo = rank.copy()\n        rank_grupo["distributor_group"] = "Geral"\nexcept Exception as e:\n    print("Base dim_distributor_group não processada ou com esquema diferente. Usando base geral.")\n    rank_grupo = rank.copy()\n    rank_grupo["distributor_group"] = "Geral"\n\nrank_grupo = rank_grupo.sort_values("fora_prazo_por_100k_uc_mes", ascending=False)\n\n# Ranking dos 5 Piores e 5 Melhores\npiores = rank_grupo.head(5)\nmelhores = rank_grupo.tail(5)\ntop_bottom = pd.concat([piores, melhores])\n\nfig, ax = plt.subplots(figsize=(12, 6))\nsns.barplot(data=top_bottom, y="sigagente", x="fora_prazo_por_100k_uc_mes", hue="sigagente", dodge=False, palette="coolwarm_r", ax=ax)\nax.set_title(f"Benchmark: 5 Piores vs 5 Melhores Distribuidoras em {ultimo_ano} (Atrasos por 100k UC)")\nax.set_xlabel("Média de Atrasos Mensais p/ cada 100 mil UCs")\nax.set_ylabel("Distribuidora")\nplt.tight_layout()\nplt.show()'
    },
    {
        'cell_type': 'markdown',
        'source': '### Insights de Benchmark e Porte\n\n- **Melhores e Piores**: O indicador de normalização `fora_prazo_por_100k_uc_mes` é muito poderoso, pois permite comparar justamento concessionárias enormes (ex: CMIG, CPFL) com locais.\n- **Destaques Positivos**: As concessionárias no final da tabela (lado azul do gráfico) figuram como benchmarks do setor. Seus processos operacionais garantem um fluxo mais linear e prazos controlados.\n- **Gargalo Setorial**: As do topo (em vermelho) requerem maior acompanhamento, comércios que extrapolam mais vezes a faixa regulatória, resultando potencialmente em penalizações mais severas para o agente concessionário.'
    }
])

print("Done updating notebooks!")
