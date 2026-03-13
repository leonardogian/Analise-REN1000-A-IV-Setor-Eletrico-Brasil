# Design: 3 Novas Páginas de Análise — TCC ANEEL

**Data:** 2026-03-05
**Status:** Aprovado

## Contexto

O dashboard já tem 4 páginas funcionais (`index.html`, `transgressoes.html`, `mapa.html`, `prompt.html`) com dados analíticos ricos e 4 JSONs avançados gerados mas sub-utilizados (`dashboard_timeseries.json`, `dashboard_scatter.json`, `dashboard_radar.json`, `dashboard_heatmap.json`). O objetivo é criar 3 novas páginas independentes que explorem os dados de ângulos ainda não cobertos, seguindo exatamente o padrão visual e técnico existente: dark glassmorphism, sidebar 320px, Chart.js via CDN, Vanilla JS puro, zero dependências externas novas.

---

## Páginas a Criar

### Página 1: `ranking.html` + `ranking.js`
**Objetivo:** Ranking interativo de todos os grupos econômicos por desempenho regulatório.

**Dados:** `dashboard_data.json` → chave `distributor_groups` (78 grupos)
- Campos: `label`, `latest_metrics.taxa_fora_prazo`, `latest_metrics.fora_prazo_por_100k_uc_mes`, `latest_metrics.compensacao_rs_por_uc_mes`, `distributors[]`

**Layout:**
- Sidebar: selector de métrica, slider top-N (10/20/50/todos), toggle crescente/decrescente
- Main superior: horizontal bar chart (Chart.js `indexAxis: 'y'`), barras coloridas por grupo
- Main inferior: tabela glass-panel com rank#, logo, métrica, nº distribuidoras, badge porte

---

### Página 2: `evolucao.html` + `evolucao.js`
**Objetivo:** Heatmap de calor — sazonalidade e evolução mensal das transgressões por holding (2023–2025).

**Dados:** `dashboard_timeseries.json` → `data` (3.833 registros, filtrar `tipo === 'holding'` → ~40 holdings)
- Campos: `date` (YYYY-MM), `grupo`, `fora_prazo_por_100k_uc_mes`, `compensacao_rs_por_uc_mes`

**Implementação:** CSS Grid puro (sem lib nova)
- Eixo X: 36 colunas (Jan/23 → Dez/25)
- Eixo Y: holdings selecionadas (máx 10 default)
- Cor: escala `hsl()` interpolada em JS (ciano=baixo → vermelho=alto)
- Sidebar: multi-select holdings, toggle métrica, seletor de período

**CSS novo em `styles.css`:**
```css
.heatmap-grid { display: grid; gap: 2px; }
.heatmap-cell { border-radius: 3px; cursor: pointer; transition: opacity 0.15s; }
.heatmap-cell:hover { opacity: 0.75; outline: 1px solid var(--pop-cyan); }
```

---

### Página 3: `benchmark.html` + `benchmark.js`
**Objetivo:** Bubble chart — todas as distribuidoras por tamanho × desempenho, segmentado por porte.

**Dados:** `dashboard_scatter.json` → `data` (102 registros: `x`, `y`, `label`) — **enriquecido com `porte` e `holding_id`**
- Requer modificação em `src/analysis/build_dashboard_data.py`: join com `dim_distribuidora_porte.csv`

**Layout:**
- Sidebar: checkboxes porte (P/M/G/GG), multi-select holdings
- Main superior: Chart.js bubble chart (X=UCs log scale, Y=taxa, cor=porte, tamanho=compensação)
- Main inferior: 4 cards glass-panel (resumo P/M/G/GG: média, min, max)

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| CRIAR | `app/frontend/ranking.html`, `ranking.js` |
| CRIAR | `app/frontend/evolucao.html`, `evolucao.js` |
| CRIAR | `app/frontend/benchmark.html`, `benchmark.js` |
| MODIFICAR | `app/frontend/styles.css` — `.heatmap-grid`, `.heatmap-cell`, `.summary-cards-grid` |
| MODIFICAR | `app/frontend/index.html`, `transgressoes.html`, `mapa.html`, `prompt.html` — nav links |
| MODIFICAR | `src/analysis/build_dashboard_data.py` — enriquecer scatter JSON |

## Utilitários Reutilizados

- `fmtNum()`, `fmtPct()`, `fmtMoney()` — replicados inline em cada `.js` (padrão existente)
- `colors` object (mapeamento holding→cor neon) — replicado
- `.glass-panel`, `.dashboard-grid`, `.sidebar-panel`, `.chart-wrapper` — sem modificação
- Padrão `DOMContentLoaded → fetch → initFilters → renderChart` — replicado
- Tema: `data-theme` + `localStorage` + `initThemeToggle()` — replicado do `transgressoes.js`

## Verificação

```bash
python3 -m src.analysis.build_dashboard_data  # regenerar scatter enriquecido
make backend                                   # http://localhost:8050
# Verificar: /ranking.html, /evolucao.html, /benchmark.html
# Testar filtros e toggle tema em cada página
```
