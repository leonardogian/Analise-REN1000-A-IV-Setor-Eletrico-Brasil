# Relatorio ANEEL - Prazo, Transgressoes e Compensacoes

## Escopo
- Comparacao regulatoria: pre-2022 (REN 414) vs pos-2022 (REN 1000).
- Serie longa principal: Qualidade Comercial (2011-2023 comparavel).
- Detalhe mensal e normalizacao por porte: INDGER Servicos + INDGER Dados Comerciais (2023-2025).

## Disponibilidade de valor pago
- Existe base de valor pago/compensacao no seu ambiente.
- Fontes usadas: `vlrpagocompensacao` (INDGER Servicos Comerciais) e indicadores `CR*` (Qualidade Comercial).

## Resultado pre vs pos (agregado)
- Taxa fora do prazo (pre): 3.525%
- Taxa fora do prazo (pos): 2.461%
- Variacao absoluta da taxa: -1.064%
- Compensacao total (pre): R$ 327.854.013,52
- Compensacao total (pos): R$ 87.203.838,32
- Variacao de compensacao total: R$ -240.650.175,20

## Serie anual consolidada
| Ano | Periodo | Qtd servicos | Qtd fora do prazo | Taxa fora do prazo | Compensacao |
|---|---|---:|---:|---:|---:|
| 2011 | pre_2022 | 4.465.359 | 114.192 | 2.557% | R$ 608.020,26 |
| 2012 | pre_2022 | 18.662.552 | 587.160 | 3.146% | R$ 5.560.674,57 |
| 2013 | pre_2022 | 21.798.305 | 828.517 | 3.801% | R$ 17.212.256,01 |
| 2014 | pre_2022 | 21.313.691 | 840.782 | 3.945% | R$ 20.002.356,83 |
| 2015 | pre_2022 | 22.609.592 | 1.069.246 | 4.729% | R$ 32.155.433,59 |
| 2016 | pre_2022 | 24.679.568 | 946.340 | 3.835% | R$ 33.572.778,76 |
| 2017 | pre_2022 | 25.866.211 | 986.696 | 3.815% | R$ 37.880.353,09 |
| 2018 | pre_2022 | 27.064.107 | 882.793 | 3.262% | R$ 40.117.429,96 |
| 2019 | pre_2022 | 29.692.567 | 930.043 | 3.132% | R$ 54.555.324,74 |
| 2020 | pre_2022 | 24.112.828 | 768.899 | 3.189% | R$ 40.265.323,10 |
| 2021 | pre_2022 | 29.416.470 | 847.270 | 2.880% | R$ 45.924.062,61 |
| 2022 | pos_2022 | 27.376.176 | 710.246 | 2.594% | R$ 37.275.391,75 |
| 2023 | pos_2022 | 7.075.110 | 137.521 | 1.944% | R$ 49.928.446,57 |

## Serie mensal normalizada (2023-2025)
| Ano | Mes | Qtd fora do prazo | Taxa fora prazo | Compensacao | Fora prazo por 100k UC | Compensacao por UC |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 1 | 458.841 | 0.089% | R$ 241.348.541,82 | 10.05 | R$ 0,0529 |
| 2024 | 1 | 476.354 | 0.101% | R$ 251.696.471,80 | 10.25 | R$ 0,0542 |
| 2025 | 1 | 744.189 | 0.189% | R$ 237.274.515,70 | 15.51 | R$ 0,0495 |

## Benchmark de distribuidoras (porte e normalizacao)
| Ano | Distribuidora | Porte | Rank porte | UC ativa media mensal | Qtd fora do prazo | Taxa fora prazo | Fora prazo por 100k UC | Compensacao | Compensacao por UC |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2023 | CEMIG DISTRIBUIÇÃO S.A. | GG | 1 | 124.046.670 | 107.304 | 0.173% | 21.63 | R$ 81.427.220,05 | R$ 0,1641 |
| 2023 | COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA | GG | 3 | 79.410.938 | 35.045 | 0.051% | 11.03 | R$ 19.076.328,16 | R$ 0,0601 |
| 2023 | ELETROPAULO METROPOLITANA ELETRICIDADE DE SÃO PAULO S.A. | GG | 2 | 99.534.079 | 23.165 | 0.061% | 5.82 | R$ 11.340.248,57 | R$ 0,0285 |
| 2024 | CEMIG DISTRIBUIÇÃO S.A. | GG | 1 | 125.723.050 | 57.485 | 0.116% | 11.43 | R$ 34.935.633,06 | R$ 0,0695 |
| 2024 | COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA | GG | 3 | 81.153.562 | 28.707 | 0.040% | 8.84 | R$ 41.095.381,80 | R$ 0,1266 |
| 2024 | ELETROPAULO METROPOLITANA ELETRICIDADE DE SÃO PAULO S.A. | GG | 2 | 101.542.485 | 12.735 | 0.028% | 3.14 | R$ 15.926.437,21 | R$ 0,0392 |
| 2025 | CEMIG DISTRIBUIÇÃO S.A. | GG | 1 | 128.137.826 | 49.799 | 0.089% | 9.72 | R$ 42.312.798,18 | R$ 0,0826 |
| 2025 | COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA | GG | 3 | 83.475.206 | 23.697 | 0.059% | 7.10 | R$ 35.872.530,09 | R$ 0,1074 |
| 2025 | ELETROPAULO METROPOLITANA ELETRICIDADE DE SÃO PAULO S.A. | GG | 2 | 103.295.686 | 26.791 | 0.085% | 6.48 | R$ 7.883.179,84 | R$ 0,0191 |

## Proximos acompanhamentos
- Atualizar mensalmente a tabela `fato_transgressao_mensal_porte`.
- Monitorar anos incompletos (2024-2025) para nao inferir tendencia regulatoria antes da consolidacao.
- Refinar analise de servicos por classe/localidade com foco nos maiores desvios normalizados por porte.
