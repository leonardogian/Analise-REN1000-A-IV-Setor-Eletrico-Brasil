# README da Branch `frontend-react`

## 📌 Objetivo desta branch

Esta branch entrega o novo frontend em **Next.js 14 + Tailwind CSS + TanStack Query**, com foco em um dashboard moderno e responsivo para a análise da REN 1000/2021.

Ela adiciona ou atualiza:
- páginas `benchmark`, `mapa`, `ranking` e `transgressoes` no diretório `app/frontend-next/`
- carregamento de dados via `useDashboardData` e hooks React/TanStack Query
- design responsivo e navegação lateral atualizada em `Sidebar.tsx`
- integração com a API local `http://localhost:8051/api/dashboard`
- dados de análise recentemente gerados e JSONs atualizados consumidos pelo frontend

## 🚀 Como usar

### 1. Branch ativa

Certifique-se de estar na branch:

```bash
git checkout frontend-react
```

### 2. Rodar o backend local

Use o backend FastAPI local para servir API e arquivos estáticos:

```bash
make dev-serve
```

- API local: `http://localhost:8051/api/dashboard`
- Frontend Vanilla JS: `http://localhost:8051`

### 3. Rodar o novo frontend Next.js

```bash
make frontend-next
```

- Novo frontend Next.js local: `http://localhost:3051`

### 4. Rodar o stack completo (backend + Next.js)

```bash
make stack-next
```

Isso inicia o backend local e o frontend Next.js juntos.

## 📷 Prints e evidências de funcionamento

Os screenshots já existentes para o dashboard estão em `docs/images/` e conferem as páginas principais:

- `docs/images/dashboard_visao_geral.png`
- `docs/images/dashboard_transgressoes.png`
- `docs/images/dashboard_benchmark.png`
- `docs/images/dashboard_evolucao.png`
- `docs/images/dashboard_ranking.png`
- `docs/images/dashboard_mapa.png`

### Páginas principais do novo frontend

| Página | O que mostra | Screenshot |
|---|---|---|
| `benchmark` | Benchmark de serviços por porte e compensação | `docs/images/dashboard_benchmark.png` |
| `transgressoes` | Séries temporais de transgressão e compensação | `docs/images/dashboard_transgressoes.png` |
| `ranking` | Ranking de grupos econômicos por métrica | `docs/images/dashboard_ranking.png` |
| `mapa` | Mapa geográfico interativo com distribuidoras | `docs/images/dashboard_mapa.png` |
| `evolucao` | Heatmap mensal de transgressões | `docs/images/dashboard_evolucao.png` |
| `index` | Visão geral de KPIs e tendências | `docs/images/dashboard_visao_geral.png` |

## 📈 Análises mais atualizadas nesta branch

### Conteúdo de dados atualizado

Nesta branch, os dados e scripts estão alinhados com as últimas análises de transgressões e compensações:

- `data/processed/analysis/` contém CSVs atualizados usados para gerar os dashboards
- `src/analysis/build_analysis_tables.py` e `src/analysis/build_dashboard_data.py` foram revisados para a nova lógica de consumo
- `reports/neoenergia_diagnostico.md` reflete a análise mais recente do grupo Neoenergia

### Temas de análise prioritários

- evolução de transgressões em `2023-2025`
- comparação entre grupos econômicos e holdings
- normalização por UC ativa para avaliar R$/UC-mês
- análise de benchmark por porte de distribuidora
- identificação de padrões regionais no mapa geográfico

## 🧠 Nota de implementação

Esta branch é voltada para a evolução do dashboard visual e para a migração de conteúdo estático para um frontend Next.js com rotas modernas.

Use este README como guia principal para entender o novo fluxo de desenvolvimento e testar localmente a interface.

## ✅ Commit desta branch

Este arquivo foi criado e será commitado na branch `frontend-react` como documentação da implementação e dos recursos visuais.
