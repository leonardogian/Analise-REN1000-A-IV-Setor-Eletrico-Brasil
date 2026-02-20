# Resumo das Tabelas de Dados para Gráficos e Análises

Este documento lista as principais tabelas geradas pelo pipeline (`data/processed/analysis` e `data/processed`) e suas colunas mais importantes, facilitando a escolha da base correta para as análises e novos gráficos do TCC.

## 1. Fatos Mensais (Ocorrências e Transgressões)

Se você precisa montar gráficos de linha mostrando a evolução mensal ou comparar meses:

### `fato_transgressao_mensal_distribuidora.parquet`

Nível de granularidade: Mensal por Distribuidora.

- **Período**: `ano`, `mes`, `periodo_regulatorio` (ex: PRE-REN1000, POS-REN1000)
- **Distribuidora**: `nomagente`, `sigagente`, `distributor_name_sig`
- **Porte**: `bucket_porte` (Grande, Médio, Pequeno)
- **Métricas**:
  - `qtd_serv_realizado` (total serviços)
  - `qtd_fora_prazo` (serviços atrasados)
  - `taxa_fora_prazo` (%)
  - `compensacao_rs` (R$ pagos em multas)
  - `fora_prazo_por_100k_uc_mes` (taxa normalizada)

### `fato_transgressao_mensal_porte.parquet`

Nível de granularidade: Mensal Agregado por Porte da Distribuidora.

- Idêntico ao acima, mas agrupa as distribuidoras por `bucket_porte` e `classe_local_servico`. Bom para ver tendência de grupos de empresas.

### `fato_servicos_municipio_mes.parquet`

Nível de granularidade: Mensal por Município (para mapas).

- **Localidade**: `codmunicipioibge`
- **Serviço**: `dsctiposervico` (tipo exato do serviço prestado)
- **Métricas**: `qtd_serv_realizado`, `qtd_fora_prazo`

---

## 2. Fatos Anuais e KPIs (Visão Macro)

Se você precisa de gráficos de barra comparando o desempenho anual ou rankings:

### `fato_indicadores_anuais.parquet`

Granularidade: Anual por Distribuidora (consolida os SLAs anuais de DEC/FEC ou tempos médios).

- **Métricas**: `qtd_serv`, `qtd_fora_prazo`, `prazo_medio`, `compensacao_rs`.
- Contém sinalizadores booleanos: `has_qs`, `has_qv`, `has_pm`, `has_cr` para filtrar quais indicadores se aplicam.

### `kpi_regulatorio_anual.parquet`

Granularidade: Anual Brasil (O Brasil como um todo).

- Super resumida para ver a evolução global: `qtd_serv`, `qtd_fora_prazo`, `compensacao_rs`.

### `fato_grupos_algoritmicos.parquet`

Usada para gráficos pré-computados (dashboard). Agrupa por dimensões pré-definidas (`dimension_label`, `dimension_id`).

---

## 3. Dimensões (Cadastros)

Usadas para cruzar informações ou filtrar dados:

### `dim_distribuidora_porte.parquet`

- Como o porte (`bucket_porte`) de cada `sigagente` evoluiu a cada `ano`.
- Qual o ranking (`rank_porte_ano`) de porte e `share_uc_ano` de cada distribuidora.

### `dim_indicador_servico.parquet`

- Tabela de "De-Para" dos indicadores.
- Contém `sigindicador`, `dscindicador` e qual o `artigo_ren` associado àquele serviço.

---

## 4. Bases Brutas Processadas (Microdados)

Apenas use essas caso as tabelas `fato` (acima) não tenham o que você precisa. Ficam em `data/processed/`.

### `indger_servicos_comerciais.parquet` (MUITO GRANDE)

Detalhe a nível de serviço específico prestado por município num dado trimestre/mês.

- Colunas úteis: `dsctiposervico` (nome do serviço), `dscprazo` (prazo regulatório), `qtdservrealizado`, `vlrpagocompensacao`.

### `indger_dados_comerciais.parquet`

Detalhe comercial (faturamento, leituras, atendimento presencial/telefônico).

- Colunas úteis: `qtducativa`, `qtdfatura`, `qtdatendrealizposto` etc.

### `qualidade_comercial.parquet`

Indicadores anuais clássicos reportados na DGC.

---

## Próximos Passos

Para montar seus gráficos, cruze as informações de negócio com a granularidade que deseja:

1. Para ver a evolução do cumprimento de prazo **ao longo do tempo**, use `fato_transgressao_mensal_distribuidora`.
2. Para ver os **piores ofensores (empresas)** no ano, use `fato_indicadores_anuais`.
3. Para pesquisar os **tipos de serviço** que mais atrasam, use `fato_servicos_municipio_mes` agrupando por `dsctiposervico`.
