# Como Analisar Múltiplas Distribuidoras por Grupo Econômico

No setor elétrico, um grupo econômico como a **Neoenergia** ou **CPFL** é muitas vezes dividido em diversas distribuidoras regionais com CNPJs e cadastros separados na ANEEL (ex: `Neoenergia Coelba`, `Neoenergia Elektro`, `CPFL Paulista`, `CPFL Piratininga`, etc).

Para facilitar a sua análise, **o pipeline de dados do TCC já consolida isso automaticamente!**

Você não precisa fazer cruzamentos manuais complexos. As tabelas analíticas em `data/processed/analysis` já são enriquecidas com o pilar de grupos.

## As Colunas Chaves

Sempre que você abrir uma tabela fato (ex: `fato_transgressao_mensal_distribuidora.parquet`) ou a dimensão de base (`dim_distributor_group.parquet`), verá as seguintes colunas:

- **`group_id`**: O ID string único do grupo grande (ex: `"neoenergia"`, `"cpfl"`, `"enel"`, `"energisa"`). Para distribuidoras "solteiras" que não são de um grande grupo, usa-se a própria sigla da empresa ou `"outros"`.
- **`distributor_id`**: O ID limpo da distribuidora (ex: `"neoenergia_coelba"`).
- **`sigagente` / `nomagente`**: Os nomes oficias da ANEEL.
- **`distributor_name_sig` / `distributor_name_legal`**: Nomes limpos e normalizados pelo pipeline.

## Como Agrupar Dados em Python (Pandas)

Se você quer ver as multas pagas (`compensacao_rs`) ao longo do tempo focando apenas nos grandes grupos (ex: CPFL vs Neoenergia vs Enel), tudo o que você precisa fazer é extrair a tabela desejada e aplicar um `.groupby("group_id")`.

### Exemplo de Código: Comparando Grandes Grupos

```python
import pandas as pd

# 1. Carrega a tabela que tem o detalhe mensal de compensações pagas 
df = pd.read_parquet("data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet")

# 2. Agrupa pelo Identificador do Grupo Econômico e soma as Compensações
resumo_grupos = df.groupby("group_id")[["compensacao_rs", "qtd_fora_prazo"]].sum().reset_index()

# 3. Ordena para ver os grupos que mais pagaram compensações
resumo_grupos = resumo_grupos.sort_values("compensacao_rs", ascending=False)
print(resumo_grupos.head())
```

### Exemplo de Código: Analisando as empresas DENTRO da Neoenergia

```python
import pandas as pd
df = pd.read_parquet("data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet")

# 1. Filtra só Neoenergia
df_neo = df[df["group_id"] == "neoenergia"]

# 2. Agrupa pelas empresas filhas da Neoenergia
empresas_neo = df_neo.groupby("distributor_name_sig")[["compensacao_rs"]].sum().reset_index()
print(empresas_neo)
```

## Explorando os Metadados dos Grupos

Se você quer apenas entender quais empresas pertencem a qual grupo e se orientar antes de análises complexas, abra o arquivo principal de dimensões:
`data/processed/analysis/dim_distributor_group.parquet`.

Lá tem todas as traduções de Sigla ANEEL para "Nome Limpo", junto ao `group_id` correspondente.

> **Dica de Visualização (Dashboard)**: O arquivo `dashboard_data.json` que alimenta a aplicação Web já faz esses cruzamentos sozinho para construir a aba "Neoenergia", e a página principal já mostra o Ranking Regulatório comparando empresas filhas e grupos ao mesmo tempo!
