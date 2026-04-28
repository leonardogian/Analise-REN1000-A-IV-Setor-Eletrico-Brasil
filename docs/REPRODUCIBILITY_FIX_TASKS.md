# Plano Operacional — Correcoes de Reprodutibilidade

Este arquivo e o ponto de continuidade para qualquer CLI/agente que retome a
correcao do pipeline ANEEL. Nao use `git reset`, nao reverta alteracoes locais
preexistentes e leia o `git status` antes de editar: a worktree ja estava suja
antes desta rodada.

## Linha de Base

- Data da linha de base: 2026-04-28.
- Branch observada: `main`.
- Ultimos commits: merge `aae44fc` e docs `791ee23`, `43c3e65`, `92db34d`, `b4a8412`.
- Estado inicial: havia modificacoes locais em docs, `.ai/*`, `Makefile`,
  scripts de analise, JSONs do dashboard e artefatos em `data/processed/analysis/`.
- Dados locais presentes nesta maquina:
  - `data/raw`: 8.3G.
  - `data/processed`: 7.6G.
  - `app/frontend/dashboard_data.json`: 27M.
  - demais `app/frontend/dashboard_*.json`: versionados para demo/deploy.
- Politica operacional assumida:
  - `data/raw/` e `data/processed/*` base nao sao versionados.
  - `data/processed/analysis/*.csv` e `app/frontend/dashboard_*.json` podem existir no Git como artefatos de demo/auditoria, mas devem ser regenerados para reproducao cientifica local.
  - Parquets analiticos sao artefatos gerados localmente; checks devem explicar quando faltarem em clone limpo.

## Status das Tasks

| Task | Status | Objetivo | Arquivos principais | Validacao |
|---|---|---|---|---|
| T00 | Concluido | Handoff e baseline | `docs/REPRODUCIBILITY_FIX_TASKS.md` | arquivo presente e atualizado |
| T01 | Concluido | Remover duplicacao INDGER | `src/etl/transform_aneel.py` | `_buscar_indger_servicos_csvs()` retornou 36 arquivos unicos, 2023-01 a 2025-12 |
| T02 | Concluido | Centralizar leitura CSV ANEEL | `src/etl/transform_aneel.py`, `schema_contracts.py` | `validate_processed_base_contracts` OK apos transform |
| T03 | Concluido | Fortalecer contratos/schema | `src/etl/schema_contracts.py`, `scripts/check_artifacts.py` | `make validate-contracts` OK; analysis Parquet nao e requisito de clone |
| T04 | Concluido | Corrigir metricas analiticas | `src/analysis/build_analysis_tables.py`, `metrics.py` | `make qa-data`: 0 erros, 6 alertas de dado bruto |
| T05 | Concluido | Corrigir agregacoes dashboard | `src/analysis/build_dashboard_data.py` | JSONs regenerados; rankings e series usam agregacao ponderada |
| T06 | Concluido | Unificar identidade distribuidora/holding | `src/analysis/distributor_groups.py` | `dim_distributor_group.csv` regenerado; labels centralizados |
| T07 | Concluido | Makefile, deps e testes | `Makefile`, `requirements.txt`, `scripts/*` | `make doctor` OK; `make test-fast` OK |
| T08 | Concluido | Robustez de extracao/provenance | `src/etl/extract_aneel.py`, `extract_ibge.py` | retry/backoff, `.part`, Content-Length/Type, zip-slip e provenance implementados |
| T09 | Concluido | Remover hardcodes infra | `kestra_flows/*.yml`, docs | Kestra usa `${TCC_REPO_ROOT:-.}`; sem path absoluto operacional conhecido |
| T10 | Concluido | Politica versionamento dashboard | `.gitignore`, docs, `.ai/*` | JSONs versionados para demo/deploy; raw/base processed ignorados |
| T11 | Concluido | Quickstart clone limpo | `README.md`, `docs/EXTRACAO_DADOS.md` | README separa demo de reproducao cientifica |
| T12 | Parcial | Regenerar/validar artefatos | artefatos gerados | Transform/analysis/dashboard + validacoes passaram; `make pipeline` completo nao foi executado para evitar redownload ANEEL |
| T13 | Concluido | Atualizar contexto final | `AGENTS.md`, `CLAUDE.md`, `.ai/*`, READMEs | contexto atualizado para proxima CLI |

## Ordem de Execucao

1. T01-T02: impedir duplicacao e leitura mal tipada.
2. T03-T06: contratos e metricas cientificamente auditaveis.
3. T07-T11: automacao, extracao, hardcodes e docs.
4. T12-T13: validacao longa e contexto final.

## Comandos de Validacao Rapida

```bash
python3 -m py_compile src/etl/transform_aneel.py src/etl/schema_contracts.py
make validate-contracts
make qa-data
make test-fast
```

## Resultados da Rodada 2026-04-28

- `make install`: instalou `psycopg2-binary` faltante.
- `make doctor`: OK.
- `python3 -m py_compile ...`: OK nos scripts alterados.
- `scripts/smoke_imports.py` com `.venv`: OK.
- Contagem INDGER deduplicada: 36 arquivos unicos (`2023-01` a `2025-12`).
- `make transform`: regenerou `data/processed/*`; a primeira execucao falhou apenas porque o transform validava analysis antigo. O contrato foi separado e `validate_processed_base_contracts(data/processed)` ficou OK.
- `make analysis`: gerou 9 tabelas raiz, incluindo `regime_regulatorio` nos fatos.
- `make report && make grupos-diagnostico && make neoenergia-diagnostico && make dashboard && make dashboard-transgressoes`: OK.
- `make validate-contracts`: OK.
- `make check-artifacts-full`: OK.
- `make qa-data`: 0 erros, 6 alertas sobre linhas de dado bruto com denominador invalido/numerador maior que denominador.
- `make test-fast`: OK.
- Smoke HTTP estatico: `dashboard_data.json` respondeu HTTP 200 em `localhost:8051`.
- `make -n pipeline`: confirmou ordem sequencial `update-data -> analysis -> report -> grupos -> neoenergia -> dashboards -> validate-contracts -> check-artifacts-full -> qa-data`.

Observacao: `make pipeline` real nao foi reexecutado de ponta a ponta porque `make extract` baixa novamente recursos grandes da ANEEL. Para uma prova final de clone limpo, rode em janela dedicada.

## Comandos Longos

`make clean-analysis && make pipeline` pode processar muitos GB e deve ser
executado apenas quando houver tempo e disco. Estimativa local: otimista 20-30
min, provavel 40-60 min, limite de paciencia 90 min. Monitorar CPU, logs,
crescimento de `data/processed/analysis/` e atualizacao dos JSONs.
