# Diagnostico Neoenergia (5 distribuidoras)

## Escopo
- Distribuidoras: Neoenergia Coelba, Pernambuco, Cosern, Elektro e Brasilia.
- Fontes: `fato_transgressao_mensal_distribuidora`, `fato_transgressao_mensal_porte`, `fato_indicadores_anuais`.
- Periodos: mensal detalhado 2023-2025; serie longa anual 2011-2023.

## Validacao de dados
- Total de alertas nas checagens estruturais: **0**
- Alertas de comparabilidade (quebra de volume/mix entre anos): **3**
- Total de spikes mensais (variacao >= 50% da taxa fora prazo): **62**

### Checagens
| checagem | qtd_linhas |
|---|---|
| duplicidades_chave_ano_mes_dist | 0 |
| fora_prazo_maior_que_servico | 0 |
| linhas_compensacao_positiva_sem_fora | 0 |
| linhas_taxa_fora_prazo_maior_1 | 0 |
| linhas_total | 180 |
| linhas_uc_ativa_zero_ou_negativa | 0 |
| linhas_valor_negativo | 0 |

### Cobertura mensal
| neo_distribuidora | ano | meses_com_dados | meses_faltantes |
|---|---|---|---|
| Neoenergia Brasilia | 2023 | 12 |  |
| Neoenergia Brasilia | 2024 | 12 |  |
| Neoenergia Brasilia | 2025 | 12 |  |
| Neoenergia Coelba | 2023 | 12 |  |
| Neoenergia Coelba | 2024 | 12 |  |
| Neoenergia Coelba | 2025 | 12 |  |
| Neoenergia Cosern | 2023 | 12 |  |
| Neoenergia Cosern | 2024 | 12 |  |
| Neoenergia Cosern | 2025 | 12 |  |
| Neoenergia Elektro | 2023 | 12 |  |
| Neoenergia Elektro | 2024 | 12 |  |
| Neoenergia Elektro | 2025 | 12 |  |
| Neoenergia Pernambuco | 2023 | 12 |  |
| Neoenergia Pernambuco | 2024 | 12 |  |
| Neoenergia Pernambuco | 2025 | 12 |  |

### Alertas de comparabilidade
| neo_distribuidora | ano | qtd_serv_realizado | delta_serv_pct | share_serv_focus | delta_share_focus_abs | alerta_quebra_volume | alerta_quebra_mix |
|---|---|---|---|---|---|---|---|
| Neoenergia Cosern | 2025 | 5.513.087 | -68.79% | 88.37% | -9.10% | True | False |
| Neoenergia Elektro | 2024 | 50.085.158 | -50.99% | 97.58% | -1.47% | True | False |
| Neoenergia Pernambuco | 2025 | 1.481.135 | -95.45% | 1.10% | -94.81% | True | True |

## Visao 1: Anual 2023-2025 (absoluto + normalizado)
| ano | neo_distribuidora | qtd_fora_prazo | taxa_fora_prazo | fora_prazo_por_100k_uc_mes | compensacao_rs | compensacao_rs_por_uc_mes |
|---|---|---|---|---|---|---|
| 2023 | Neoenergia Brasilia | 3.034 | 0.47% | 21,48 | R$ 2.777.969,71 | R$ 0,20 |
| 2023 | Neoenergia Coelba | 35.045 | 0.05% | 44,13 | R$ 19.076.328,16 | R$ 0,24 |
| 2023 | Neoenergia Cosern | 6.835 | 0.04% | 36,13 | R$ 1.865.132,68 | R$ 0,10 |
| 2023 | Neoenergia Elektro | 2.610 | 0.00% | 7,37 | R$ 1.361.347,65 | R$ 0,04 |
| 2023 | Neoenergia Pernambuco | 20.333 | 0.06% | 42,17 | R$ 10.499.861,71 | R$ 0,22 |
| 2024 | Neoenergia Brasilia | 4.084 | 0.75% | 28,70 | R$ 6.817.583,02 | R$ 0,48 |
| 2024 | Neoenergia Coelba | 28.707 | 0.04% | 35,37 | R$ 41.095.381,80 | R$ 0,51 |
| 2024 | Neoenergia Cosern | 3.874 | 0.02% | 20,11 | R$ 3.118.335,62 | R$ 0,16 |
| 2024 | Neoenergia Elektro | 1.696 | 0.00% | 4,70 | R$ 350.467,92 | R$ 0,01 |
| 2024 | Neoenergia Pernambuco | 10.914 | 0.03% | 22,18 | R$ 11.363.770,79 | R$ 0,23 |
| 2025 | Neoenergia Brasilia | 3.035 | 0.55% | 20,86 | R$ 4.272.767,30 | R$ 0,29 |
| 2025 | Neoenergia Coelba | 23.697 | 0.06% | 28,39 | R$ 35.872.530,09 | R$ 0,43 |
| 2025 | Neoenergia Cosern | 1.840 | 0.03% | 9,38 | R$ 1.180.588,80 | R$ 0,06 |
| 2025 | Neoenergia Elektro | 734 | 0.00% | 2,00 | R$ 502.892,99 | R$ 0,01 |
| 2025 | Neoenergia Pernambuco | 8.895 | 0.60% | 17,71 | R$ 6.894.282,01 | R$ 0,14 |

### Visao 1B: Anual sem codigos 69/93 (robustez)
| ano | neo_distribuidora | qtd_fora_prazo | taxa_fora_prazo | fora_prazo_por_100k_uc_mes | compensacao_rs | compensacao_rs_por_uc_mes |
|---|---|---|---|---|---|---|
| 2023 | Neoenergia Brasilia | 3.034 | 0.93% | 21,48 | R$ 2.777.969,71 | R$ 0,20 |
| 2023 | Neoenergia Coelba | 35.045 | 1.82% | 44,13 | R$ 19.076.328,16 | R$ 0,24 |
| 2023 | Neoenergia Cosern | 6.830 | 1.77% | 36,11 | R$ 1.865.132,68 | R$ 0,10 |
| 2023 | Neoenergia Elektro | 2.598 | 0.27% | 7,33 | R$ 1.361.347,65 | R$ 0,04 |
| 2023 | Neoenergia Pernambuco | 20.333 | 1.74% | 42,17 | R$ 10.499.861,71 | R$ 0,22 |
| 2024 | Neoenergia Brasilia | 4.084 | 1.16% | 28,70 | R$ 6.817.583,02 | R$ 0,48 |
| 2024 | Neoenergia Coelba | 28.702 | 1.47% | 35,37 | R$ 41.095.381,80 | R$ 0,51 |
| 2024 | Neoenergia Cosern | 3.871 | 0.87% | 20,10 | R$ 3.086.162,50 | R$ 0,16 |
| 2024 | Neoenergia Elektro | 1.695 | 0.14% | 4,70 | R$ 350.467,92 | R$ 0,01 |
| 2024 | Neoenergia Pernambuco | 10.914 | 0.82% | 22,18 | R$ 11.363.770,79 | R$ 0,23 |
| 2025 | Neoenergia Brasilia | 3.035 | 0.62% | 20,86 | R$ 4.272.767,30 | R$ 0,29 |
| 2025 | Neoenergia Coelba | 23.680 | 1.14% | 28,37 | R$ 35.872.530,09 | R$ 0,43 |
| 2025 | Neoenergia Cosern | 1.833 | 0.29% | 9,35 | R$ 1.180.503,14 | R$ 0,06 |
| 2025 | Neoenergia Elektro | 610 | 0.05% | 1,66 | R$ 462.343,16 | R$ 0,01 |
| 2025 | Neoenergia Pernambuco | 8.895 | 0.61% | 17,71 | R$ 6.894.282,01 | R$ 0,14 |

## Visao 2: Tendencia 2023 -> 2025
| neo_distribuidora | taxa_fora_prazo_2023 | taxa_fora_prazo_2025 | delta_taxa_fora_prazo_abs | delta_taxa_fora_prazo_pct | fora_prazo_por_100k_uc_mes_2023 | fora_prazo_por_100k_uc_mes_2025 | delta_fora_prazo_por_100k_uc_mes_pct |
|---|---|---|---|---|---|---|---|
| Neoenergia Brasilia | 0.47% | 0.55% | 0.09% | 18.76% | 21,48 | 20,86 | -2.93% |
| Neoenergia Coelba | 0.05% | 0.06% | 0.01% | 15.93% | 44,13 | 28,39 | -35.67% |
| Neoenergia Cosern | 0.04% | 0.03% | -0.01% | -19.72% | 36,13 | 9,38 | -74.04% |
| Neoenergia Elektro | 0.00% | 0.00% | -0.00% | -36.03% | 7,37 | 2,00 | -72.88% |
| Neoenergia Pernambuco | 0.06% | 0.60% | 0.54% | 966.27% | 42,17 | 17,71 | -58.00% |

## Visao 3: Mix por classe/localizacao (2023-2025)
| neo_distribuidora | classe_local_servico | qtd_fora_prazo | share_fora_prazo | compensacao_rs | share_compensacao | taxa_fora_prazo |
|---|---|---|---|---|---|---|
| Neoenergia Brasilia | nao_classificado | 9.285 | 91.45% | R$ 12.099.226,97 | 87.24% | 0.75% |
| Neoenergia Brasilia | urbana | 627 | 6.18% | R$ 999.269,37 | 7.21% | 0.13% |
| Neoenergia Coelba | nao_classificado | 41.876 | 47.89% | R$ 71.804.127,29 | 74.76% | 0.02% |
| Neoenergia Coelba | urbana | 34.906 | 39.92% | R$ 20.440.573,94 | 21.28% | 1.21% |
| Neoenergia Cosern | nao_classificado | 8.179 | 65.18% | R$ 4.615.865,02 | 74.88% | 0.02% |
| Neoenergia Cosern | rural | 2.799 | 22.30% | R$ 577.506,42 | 9.37% | 2.46% |
| Neoenergia Elektro | nao_classificado | 3.783 | 75.06% | R$ 1.731.968,65 | 78.20% | 0.00% |
| Neoenergia Elektro | urbana | 1.096 | 21.75% | R$ 412.313,36 | 18.62% | 0.06% |
| Neoenergia Pernambuco | nao_classificado | 20.321 | 50.62% | R$ 18.916.026,25 | 65.78% | 0.03% |
| Neoenergia Pernambuco | rural | 11.509 | 28.67% | R$ 2.393.643,82 | 8.32% | 4.11% |

### Mix codigos 69/93 no volume total
| neo_distribuidora | ano | total_serv | serv_focus | share_serv_focus |
|---|---|---|---|---|
| Neoenergia Brasilia | 2023 | 652.433 | 325.823 | 49.94% |
| Neoenergia Brasilia | 2024 | 542.759 | 191.851 | 35.35% |
| Neoenergia Brasilia | 2025 | 549.555 | 57.421 | 10.45% |
| Neoenergia Coelba | 2023 | 68.708.813 | 66.784.875 | 97.20% |
| Neoenergia Coelba | 2024 | 72.185.466 | 70.231.311 | 97.29% |
| Neoenergia Coelba | 2025 | 40.075.691 | 37.992.285 | 94.80% |
| Neoenergia Cosern | 2023 | 16.441.663 | 16.056.039 | 97.65% |
| Neoenergia Cosern | 2024 | 17.666.873 | 17.219.505 | 97.47% |
| Neoenergia Cosern | 2025 | 5.513.087 | 4.871.923 | 88.37% |
| Neoenergia Elektro | 2023 | 102.192.822 | 101.219.583 | 99.05% |
| Neoenergia Elektro | 2024 | 50.085.158 | 48.873.122 | 97.58% |
| Neoenergia Elektro | 2025 | 44.924.879 | 43.575.237 | 97.00% |
| Neoenergia Pernambuco | 2023 | 36.100.762 | 34.935.452 | 96.77% |
| Neoenergia Pernambuco | 2024 | 32.550.577 | 31.218.656 | 95.91% |
| Neoenergia Pernambuco | 2025 | 1.481.135 | 16.304 | 1.10% |

## Visao 4: Serie longa 2011-2023
| neo_distribuidora | ano_inicio | ano_fim | taxa_inicio | taxa_fim | delta_taxa_abs | delta_taxa_pct |
|---|---|---|---|---|---|---|
| Neoenergia Brasilia | 2011 | 2023 | 11.91% | 0.25% | -11.66% | -97.91% |
| Neoenergia Coelba | 2011 | 2023 | 2.09% | 3.37% | 1.28% | 61.26% |
| Neoenergia Cosern | 2011 | 2023 | 1.54% | 0.79% | -0.75% | -48.58% |
| Neoenergia Elektro | 2011 | 2023 | 2.51% | 0.72% | -1.78% | -71.10% |
| Neoenergia Pernambuco | 2011 | 2023 | 6.39% | 3.46% | -2.93% | -45.81% |

## Visao 5: Porte (ultimo ano disponivel)
| rank_porte_neo | neo_distribuidora | uc_ativa_media_ano | taxa_fora_prazo | fora_prazo_por_100k_uc_mes | indice_fora_vs_mediana_neo | compensacao_rs_por_uc_mes | indice_comp_vs_mediana_neo |
|---|---|---|---|---|---|---|---|
| 1 | Neoenergia Coelba | 6.956.267 | 0.06% | 28,39 | 1,60 | R$ 0,43 | 3,13 |
| 2 | Neoenergia Pernambuco | 4.184.413 | 0.60% | 17,71 | 1,00 | R$ 0,14 | 1,00 |
| 3 | Neoenergia Elektro | 3.061.481 | 0.00% | 2,00 | 0,11 | R$ 0,01 | 0,10 |
| 4 | Neoenergia Cosern | 1.634.496 | 0.03% | 9,38 | 0,53 | R$ 0,06 | 0,44 |
| 5 | Neoenergia Brasilia | 1.212.704 | 0.55% | 20,86 | 1,18 | R$ 0,29 | 2,14 |

## Leituras rapidas
- Maior pressao normalizada no ultimo ano: **Neoenergia Coelba** (28,39 fora prazo por 100k UC-mes).
- Menor pressao normalizada no ultimo ano: **Neoenergia Elektro** (2,00 fora prazo por 100k UC-mes).
- Se o objetivo for comparacao justa entre distribuidoras, priorize metricas normalizadas por UC-mes.
- Se o objetivo for impacto financeiro, acompanhe `compensacao_rs_por_uc_mes` e `compensacao_media_por_transgressao_rs`.

## Arquivos gerados
- `data/processed/analysis/neoenergia/neo_mensal_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_anual_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_anual_sem_cod_69_93.csv`
- `data/processed/analysis/neoenergia/neo_tendencia_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_classe_local_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_share_codigos_69_93.csv`
- `data/processed/analysis/neoenergia/neo_alertas_comparabilidade.csv`
- `data/processed/analysis/neoenergia/neo_longa_2011_2023.csv`
- `data/processed/analysis/neoenergia/neo_longa_resumo_2011_2023.csv`
- `data/processed/analysis/neoenergia/neo_benchmark_porte_latest.csv`
- `data/processed/analysis/neoenergia/neo_data_quality_checks.csv`
- `data/processed/analysis/neoenergia/neo_cobertura_mensal.csv`
- `data/processed/analysis/neoenergia/neo_outliers_taxa.csv`