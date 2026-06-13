# Contexto metodológico para os fluxogramas

## Objetivo do Capítulo 3

O Capítulo 3 apresenta a metodologia da pesquisa. Ele descreve como os dados oficiais foram coletados, tratados, consolidados, validados e transformados em indicadores, análises e visualizações.

A metodologia precisa comunicar uma cadeia auditável:

```text
dados oficiais → coleta automatizada → tratamento → tabelas analíticas → validação → indicadores → análise → painel
```

## Lógica visual desejada

O orientador valoriza fluxos conectados. Portanto, a melhor solução é criar uma estrutura em camadas:

```text
Figura 1: visão macro do Capítulo 3 inteiro
      ↓
Figura 2: zoom em fontes + coleta + tratamento
      ↓
Figura 3: zoom em consolidação analítica
      ↓
Figura 4: zoom em validação + reprodutibilidade
      ↓
Figura 5: zoom em painel analítico e interpretação
```

Assim, cada figura não aparece solta no texto. Todas derivam da Figura 1.

## Seções do Capítulo 3 e relação com os fluxogramas

| Seção | Conteúdo | Figura associada |
|---|---|---|
| 3.1 | Desenho geral da pesquisa | Introdução textual |
| 3.2 | Fluxo metodológico | Figura 1 |
| 3.3 | Fontes de dados e critérios de seleção | Figura 2 |
| 3.4 | Coleta dos dados | Figura 2 |
| 3.5 | Tratamento e padronização | Figura 2 |
| 3.6 | Consolidação analítica | Figura 3 |
| 3.7 | Validação e reprodutibilidade | Figura 4 |
| 3.8 | Construção das métricas analíticas | Figura 1 e texto |
| 3.9 | Estratégia comparativa pré e pós-REN 1.000/2021 | Figura 1 e texto |
| 3.10 | Painel analítico como instrumento exploratório | Figura 5 |
| 3.11 | Limitações metodológicas | Texto |

## Fontes de dados

As fontes principais são:

- ANEEL — Qualidade do Atendimento Comercial;
- ANEEL — INDGER, Indicadores Gerenciais da Distribuição;
- IBGE — Divisão Territorial Brasileira, DTB;
- dados financeiros e societários de holdings, quando aplicável.

## Eixos analíticos importantes

Os fluxogramas devem permitir rastrear a construção das análises do Capítulo 4, especialmente:

- comparação pré e pós-REN 1.000/2021;
- taxa de transgressão de prazos;
- valor das compensações financeiras;
- custo médio por transgressão;
- segmentação Grupo A vs. Grupo B;
- segmentação urbano vs. rural;
- comparação por distribuidoras e holdings;
- materialidade das compensações em relação ao EBITDA.

## Linguagem adequada

Usar linguagem conceitual/científica:

| Evitar | Preferir |
|---|---|
| `make run` | Execução reprodutível do fluxo |
| `script.py` | Rotinas computacionais |
| `data/raw` | Dados brutos |
| `data/processed` | Dados tratados |
| `parquet` isolado | Formato colunar otimizado |
| dashboard como fonte | Painel como camada derivada |

## Tese visual dos fluxogramas

A mensagem visual deve ser:

> A pesquisa parte de dados públicos oficiais, transforma esses dados por meio de procedimentos automatizados e auditáveis, valida as tabelas resultantes e somente então constrói indicadores, análises e visualizações.
