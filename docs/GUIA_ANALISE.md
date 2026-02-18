# Guia de Analise e Operacao

## Objetivo

Este guia explica como usar os arquivos gerados para responder as perguntas centrais do TCC:

- servicos ficaram menos fora do prazo ao longo do tempo?
- compensacoes ao consumidor aumentaram ou reduziram?
- como comparar distribuidoras grandes e pequenas de forma justa?

## Fluxo completo

1. Extrair dados ANEEL

```bash
python -m src.etl.extract_aneel
```

2. Transformar dados brutos

```bash
python -m src.etl.transform_aneel
```

3. Construir camada analitica

```bash
python -m src.analysis.build_analysis_tables
```

4. Atualizar relatorio consolidado

```bash
python -m src.analysis.build_report
```

Alternativa com atalhos:

```bash
make pipeline
```

## Onde estao as metricas-chave

### Fora do prazo

- anual/longo prazo: `data/processed/analysis/fato_indicadores_anuais.parquet`
  - coluna: `qtd_fora_prazo`
  - coluna derivada: `taxa_fora_prazo`

- mensal/operacional: `data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet`
  - coluna: `qtd_fora_prazo`
  - coluna derivada: `taxa_fora_prazo`

### Valor pago (compensacoes)

- existe base local para valor pago, sem necessidade de buscar internet neste momento.
- fontes usadas no pipeline:
  - `vlrpagocompensacao` (INDGER Servicos)
  - `CR*` (Qualidade Comercial)

arquivos finais:

- `data/processed/analysis/fato_indicadores_anuais.parquet` -> `compensacao_rs`
- `data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet` -> `compensacao_rs`

### Porte da distribuidora

- `data/processed/analysis/dim_distribuidora_porte.parquet`
  - `uc_ativa_media_mensal`
  - `bucket_porte`
  - `rank_porte_ano`

- `data/processed/analysis/fato_uc_ativa_mensal_distribuidora.parquet`
  - `uc_ativa_mes`

## Como normalizar por tamanho

Metricas ja prontas na camada enxuta mensal (`fato_transgressao_mensal_distribuidora`):

- `fora_prazo_por_100k_uc_mes`
- `compensacao_rs_por_uc_mes`
- `compensacao_media_por_transgressao_rs`

Interpretacao recomendada:

1. Use absoluto (`qtd_fora_prazo`, `compensacao_rs`) para impacto total.
2. Use normalizado (`...por_uc...`) para comparar eficiencia entre portes diferentes.
3. Nunca concluir com apenas uma visao.

## Recortes de interesse (A/B, rural/urbana)

- serie longa: `classe_local` em `fato_indicadores_anuais`
- serie mensal detalhada: `classe_local_servico` em `fato_transgressao_mensal_porte`

## Analises que ja podem ser feitas direto

1. Pre vs pos regulatorio (pre_2022 vs pos_2022)
2. Tendencia anual de taxa fora do prazo
3. Tendencia mensal de compensacao
4. Benchmark Coelba vs Neoenergia Brasilia vs Copel
5. Ranking de distribuidoras por taxa normalizada

## Notebooks e ordem recomendada

1. `notebooks/01_mapa_dados_e_qualidade.ipynb`
2. `notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb`
3. `notebooks/03_porte_e_benchmark_distribuidoras.ipynb`

## Testes recomendados

```bash
# Validacao rapida (compilacao + imports + artefatos)
make test-fast

# Smoke test (regera analise + relatorio e valida saidas)
make test-smoke
```

## Checklist de qualidade antes de concluir resultado

- [ ] ano analisado esta completo?
- [ ] comparacao inclui visao absoluta e normalizada?
- [ ] recorte regulatorio foi respeitado (pre_2022 vs pos_2022)?
- [ ] valor pago veio de `compensacao_rs` e nao de coluna errada?
- [ ] distribuidoras comparadas usam mesma janela temporal?

## Proximos passos sugeridos

1. Consolidar periodo oficial de inferencia (ex.: ate 2023).
2. Fechar tabela final de resultados para anexar na monografia.
3. Criar versao final dos graficos (taxa, compensacao, normalizados).
4. Adicionar analise de sensibilidade por subconjunto (somente grandes, somente pequenas).
5. Documentar limitacoes (anos incompletos, cobertura por indicador).

## Quando buscar dados externos

Buscar internet apenas se ocorrer uma destas situacoes:

- `compensacao_rs` vier zerada em todas as tabelas apos atualizacao;
- ANEEL alterar layout e quebrar o parsing local;
- necessidade de variavel que nao existe nas bases atuais (ex.: nova classificacao nao publicada nos CSVs usados).

Enquanto isso nao ocorrer, a base atual ja contem os campos necessarios para suas perguntas.
