# Proximos Passos do TCC (Roadmap pratico)

## Etapa 1 - Consolidacao da base

1. Rodar pipeline completo.
2. Validar se tabelas em `data/processed/analysis/` foram atualizadas.
3. Verificar no relatorio se houve mudanca relevante em taxa fora do prazo e compensacao.

Comando:

```bash
python -m src.etl.extract_aneel
python -m src.etl.transform_aneel
python -m src.analysis.build_analysis_tables
python -m src.analysis.build_report
```

## Etapa 2 - Analise principal (resultado da pesquisa)

1. Definir janela oficial de inferencia (sugestao: 2011-2023).
2. Comparar pre_2022 vs pos_2022:
   - taxa fora do prazo
   - compensacao total
3. Repetir em visao normalizada por porte:
   - fora_prazo_por_100k_uc_mes
   - compensacao_rs_por_uc_mes

## Etapa 3 - Benchmark de distribuidoras

1. Atualizar comparativo anual e mensal de:
   - Coelba
   - Neoenergia Brasilia
   - Copel
2. Avaliar tanto valores absolutos quanto normalizados.
3. Destacar convergencias e divergencias no relatorio.

## Etapa 4 - Graficos finais para a monografia

1. Grafico anual da taxa fora do prazo.
2. Grafico anual da compensacao.
3. Grafico mensal normalizado por UC.
4. Grafico comparativo das 3 distribuidoras foco.

## Etapa 5 - Redacao final

1. Metodo (fontes, limpeza, metricas, normalizacao).
2. Resultados (pre vs pos + benchmark por porte).
3. Limitacoes (anos incompletos, cobertura por indicador).
4. Conclusao (efeito observado e implicacoes).

## Critério de pronto

Considere o ciclo pronto quando:

- o relatorio em `reports/relatorio_aneel.md` estiver atualizado;
- os notebooks tiverem resultados reproduziveis sem erro;
- as tabelas finais exportadas para uso no texto estiverem congeladas para a versao da banca.
