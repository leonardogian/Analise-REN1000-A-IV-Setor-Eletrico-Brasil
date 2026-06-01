# Auditoria de afirmações numéricas do TCC

Relatório gerado a partir dos artefatos locais após a correção da referência mensal INDGER.

## Fontes locais usadas

- `data/processed/analysis/kpi_regulatorio_anual.csv`
- `data/processed/analysis/fato_transgressao_mensal_distribuidora.csv`
- `data/processed/analysis/fato_transgressao_mensal_porte.csv`
- `data/processed/analysis/grupos/*.csv`
- Parquets base em `data/processed/*.parquet` apenas para contagem física de linhas.

## Cobertura mensal pós-correção

- Períodos distintos em `fato_transgressao_mensal_distribuidora.csv`: 36.
- Cobertura por ano: {2023: 12, 2024: 12, 2025: 12}.
- `dashboard_timeseries.json` contém datas de `2023-01` a `2025-12`.
- Validação final: `make dashboard-full`, `make validate-contracts-processed`, `make check-artifacts-full`, `make qa-data` e `make test-fast` executaram sem erros. O `qa-data` manteve apenas alertas de denominador/taxa já documentados.

## Serviços monitorados versus linhas físicas

- Soma de serviços monitorados 2011-2022 (Qualidade Comercial) + 2023-2025 (INDGER): 1,659 bilhão.
- Linhas físicas nos três Parquets nucleares locais: 21.641.963 linhas.
- Portanto, a redação metodologicamente correta é “aprox. 1,66 bilhão de serviços monitorados”, não “1,66 bilhão de registros”.

## Comparativo central 2021 versus 2023

| Métrica | 2021 `kpi_regulatorio_anual.csv` | 2023 INDGER mensal | Variação |
|---|---:|---:|---:|
| Serviços monitorados | 29.416.470 | 513.813.252 | 1.646,7% |
| Transgressões | 847.270 | 458.841 | -45,8% |
| Taxa de transgressão | 2,88% | 0,09% | -96,9% |
| Compensações | R$ 45,9 mi | R$ 241,3 mi | 425,5% |
| Compensação média por transgressão | R$ 54,20 | R$ 526,00 | 870,4% |

## Classes/localidade em 2023

A tabela abaixo usa a classificação disponível em `fato_transgressao_mensal_porte.csv`. A exposição por UC é proxy, pois o INDGER traz UC ativa por distribuidora-mês, não por classe/localidade.

| classe_local_servico | serviços | transgressões | taxa | compensações | transgressões por 100k UC proxy | compensação média |
|---|---:|---:|---:|---:|---:|---:|
| nao_classificado | 494.822.308 | 305.994 | 0,06% | R$ 161,7 mi | 26,81 | R$ 528,60 |
| urbana | 17.829.634 | 112.390 | 0,63% | R$ 51,6 mi | 9,85 | R$ 458,80 |
| rural | 1.158.692 | 40.389 | 3,49% | R$ 27,3 mi | 3,54 | R$ 676,05 |
| grupo_a | 2.618 | 68 | 2,60% | R$ 0,7 mi | 0,01 | R$ 10.752,56 |

## EBITDA e dados financeiros externos

- Não há no repositório, nesta rodada, tabela local versionada com EBITDA/lucro de holdings ou URLs/arquivos CVM/B3 auditáveis.
- Assim, materialidade financeira versus EBITDA deve ser tratada como análise exploratória pendente de fonte documental, não como resultado certificado pelo pipeline de dados ANEEL/IBGE.

## Recomendações de redação

- Substituir 2,97% por 2,88% quando a referência for o agregado 2021 atual do pipeline.
- Substituir R$46,6 milhões por R$45,9 milhões para 2021.
- Substituir R$51,89 por R$54,20 para a compensação média de 2021.
- Substituir R$525,89 por R$526,00 para 2023.
- Substituir “registros” por “serviços monitorados” quando citar 1,66 bilhão.
- Remover ou qualificar afirmações fortes sobre rural maior que urbano e EBITDA até as respectivas fontes/recortes serem certificados.
