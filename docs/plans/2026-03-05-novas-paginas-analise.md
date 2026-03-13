# Novas Páginas de Análise — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 3 new independent analysis pages (ranking.html, evolucao.html, benchmark.html) following the exact visual and technical patterns of the existing dashboard.

**Architecture:** Each page is a standalone HTML file with a dedicated JS file. All share `styles.css`. Data comes from pre-built static JSON files served by FastAPI. No new dependencies — Chart.js via CDN only.

**Tech Stack:** Vanilla JS, Chart.js 4.4.7 (CDN), CSS Grid, FastAPI (Python), existing `dashboard_*.json` files.

---

## Task 1: Enrich scatter JSON with porte + holding_id

**Files:**
- Modify: `src/analysis/build_dashboard_data.py` lines ~996-1030

The function `build_franquias_insights` (line 996) builds the scatter data from `fato_mensal` but doesn't include `bucket_porte` or `group_id`. Fix by accepting `dim_porte` and joining.

**Step 1: Change the function signature at line 996**

```python
# BEFORE:
def build_franquias_insights(fato_mensal: pd.DataFrame, fato_indicadores: pd.DataFrame, grupos_classe: pd.DataFrame) -> dict:

# AFTER:
def build_franquias_insights(fato_mensal: pd.DataFrame, fato_indicadores: pd.DataFrame, grupos_classe: pd.DataFrame, dim_porte: pd.DataFrame | None = None) -> dict:
```

**Step 2: Enrich scatter records inside the same function (~line 1018)**

Replace the scatter block (lines 1015–1030):

```python
    # Scatter Eficiência
    if not fato_mensal.empty:
        df = fato_mensal.copy()
        res_scatter = df.groupby(["distributor_label", "periodo_regulatorio"], as_index=False).agg({
            "qtd_fora_prazo": "sum",
            "compensacao_rs_por_uc_mes": "mean"
        })
        # Enrich with porte and group_id
        if dim_porte is not None and not dim_porte.empty:
            porte_map = (
                dim_porte[["distributor_label", "bucket_porte", "group_id"]]
                .drop_duplicates("distributor_label")
            )
            res_scatter = res_scatter.merge(porte_map, on="distributor_label", how="left")
        else:
            res_scatter["bucket_porte"] = None
            res_scatter["group_id"] = None
        scat_data = []
        for _, row in res_scatter.iterrows():
            scat_data.append({
                "x": int(row["qtd_fora_prazo"]),
                "y": _safe(row["compensacao_rs_por_uc_mes"]),
                "label": row["distributor_label"],
                "regra": "REN 414" if row["periodo_regulatorio"] == "pre_2022" else "REN 1000",
                "porte": row.get("bucket_porte"),
                "holding_id": row.get("group_id"),
            })
        insights["scatter_eficiencia"] = scat_data
```

**Step 3: Pass dim_porte in the call at ~line 1169**

```python
# BEFORE:
"franquias_insights": build_franquias_insights(fato_mensal, fato_indicadores, grupos_classe),

# AFTER:
"franquias_insights": build_franquias_insights(fato_mensal, fato_indicadores, grupos_classe, dim_porte),
```

**Step 4: Regenerate the scatter JSON**

```bash
cd /home/gianmarinolc/Documents/Estudos/TCC_leo_main
source .venv/bin/activate
python3 -m src.analysis.build_dashboard_data
```

**Step 5: Verify porte field is present**

```bash
python3 -c "
import json
data = json.load(open('app/frontend/dashboard_scatter.json'))
sample = data['data'][:3]
for s in sample:
    print(s.get('porte'), s.get('holding_id'), s['label'])
"
```
Expected: prints porte values like `P`, `M`, `G`, `GG` next to each distributor label.

---

## Task 2: Add CSS for new components

**Files:**
- Modify: `app/frontend/styles.css` (append to end of file)

**Step 1: Append these CSS classes to the end of `styles.css`**

```css
/* ===== HEATMAP (evolucao.html) ===== */
.heatmap-wrapper {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 65vh;
    padding-bottom: 0.5rem;
}
.heatmap-grid {
    display: grid;
    gap: 2px;
    min-width: max-content;
}
.heatmap-header-corner {
    background: transparent;
    min-width: 140px;
}
.heatmap-col-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-align: center;
    padding: 2px 1px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
}
.heatmap-row-label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    padding: 2px 6px 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
    min-width: 120px;
    display: flex;
    align-items: center;
    height: 28px;
}
.heatmap-cell {
    border-radius: 3px;
    cursor: pointer;
    transition: opacity 0.12s, outline 0.12s;
    height: 28px;
    min-width: 28px;
}
.heatmap-cell:hover {
    opacity: 0.8;
    outline: 2px solid var(--pop-cyan);
    outline-offset: 1px;
    z-index: 2;
    position: relative;
}
.heatmap-legend {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    font-size: 0.78rem;
    color: var(--text-muted);
}
.heatmap-legend-bar {
    flex: 1;
    max-width: 200px;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(to right, hsl(180, 80%, 45%), hsl(90, 80%, 45%), hsl(0, 80%, 45%));
}

/* ===== SUMMARY CARDS (benchmark.html) ===== */
.summary-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}
.summary-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    text-align: center;
}
.summary-card .card-porte {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
    color: var(--text-muted);
}
.summary-card .card-metric {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-display);
}
.summary-card .card-range {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.2rem;
}

/* ===== RANKING TABLE (ranking.html) ===== */
.ranking-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    margin-top: 1rem;
}
.ranking-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-color);
}
.ranking-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    vertical-align: middle;
}
.ranking-table tr:hover td {
    background: rgba(255,255,255,0.03);
}
.rank-num {
    color: var(--text-muted);
    font-size: 0.75rem;
    width: 36px;
}
.group-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.group-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
    border-radius: 3px;
}
.metric-val {
    font-weight: 600;
    color: var(--pop-cyan);
    font-variant-numeric: tabular-nums;
}
```

**Step 2: Verify no syntax errors**

```bash
# quick check — just open the site and confirm styles load without console errors
# (formal CSS validation not needed for this project)
```

---

## Task 3: Update navigation in all existing pages

**Files to modify (same nav change in each):**
- `app/frontend/index.html`
- `app/frontend/transgressoes.html`
- `app/frontend/mapa.html`
- `app/frontend/prompt.html`

**Step 1: In each file, find the `<nav class="main-nav-links">` block and add 3 links**

Current nav (example from transgressoes.html):
```html
<nav class="main-nav-links">
    <a href="index.html">Visão Geral</a>
    <a href="transgressoes.html" class="active">Séries Temporais</a>
    <a href="mapa.html">Mapa Interativo</a>
    <a href="prompt.html">IA</a>
</nav>
```

Add 3 new links after `prompt.html`:
```html
    <a href="ranking.html">Ranking</a>
    <a href="evolucao.html">Evolução</a>
    <a href="benchmark.html">Benchmark</a>
```

Do this for all 4 existing pages. Do NOT add `class="active"` to the new links in existing pages.

---

## Task 4: Create ranking.html

**Files:**
- Create: `app/frontend/ranking.html`
- Create: `app/frontend/ranking.js`

**Step 1: Create `ranking.html`** — copy the shell from `transgressoes.html` with these differences:

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCC ANEEL — Ranking Regulatório</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="layout-container">
    <header class="global-header">
      <div class="header-brand">
        <span class="header-logo">⚡</span>
        <div class="header-title-group">
          <span class="header-title">TCC ANEEL</span>
          <span class="header-subtitle">REN 1000/2021</span>
        </div>
      </div>
      <nav class="main-nav-links">
        <a href="index.html">Visão Geral</a>
        <a href="transgressoes.html">Séries Temporais</a>
        <a href="mapa.html">Mapa Interativo</a>
        <a href="prompt.html">IA</a>
        <a href="ranking.html" class="active">Ranking</a>
        <a href="evolucao.html">Evolução</a>
        <a href="benchmark.html">Benchmark</a>
      </nav>
      <div class="header-actions">
        <button id="theme-toggle" class="btn-icon" title="Alternar tema"><span class="icon">🌙</span></button>
      </div>
    </header>

    <main class="dashboard-grid">
      <aside class="sidebar-panel">
        <div class="control-card glass-panel">
          <p class="nav-title">Ranking Regulatório</p>
          <p class="nav-subtitle">Grupos econômicos por desempenho</p>

          <div class="filter-group">
            <label for="metric-select">Métrica de Ranking</label>
            <select id="metric-select" class="custom-select">
              <option value="taxa">Taxa Fora do Prazo (%)</option>
              <option value="por100k">Transgr. por 100k UC/mês</option>
              <option value="compensacao">Compensação R$/UC mês</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="topn-select">Mostrar Top</label>
            <select id="topn-select" class="custom-select">
              <option value="10">Top 10</option>
              <option value="20" selected>Top 20</option>
              <option value="50">Top 50</option>
              <option value="0">Todos</option>
            </select>
          </div>

          <div class="filter-group toggle-group">
            <label class="toggle-label" for="asc-toggle">Ordem Crescente</label>
            <label class="toggle-switch">
              <input type="checkbox" id="asc-toggle">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="insight-card glass-panel">
          <p class="nav-title" style="font-size:1rem;">Legenda de Porte</p>
          <div style="font-size:0.8rem; line-height:1.8; color: var(--text-secondary);">
            <div><strong style="color:var(--pop-green)">P</strong> — Pequeno (&lt;30k UCs)</div>
            <div><strong style="color:var(--pop-cyan)">M</strong> — Médio (30k–300k)</div>
            <div><strong style="color:var(--pop-amber)">G</strong> — Grande (300k–1,5M)</div>
            <div><strong style="color:var(--pop-orange)">GG</strong> — Muito Grande (&gt;1,5M)</div>
          </div>
        </div>
      </aside>

      <section class="main-panel">
        <div class="chart-header">
          <h2 id="chart-title" style="font-size:1rem; color:var(--text-secondary);">Carregando...</h2>
        </div>
        <div class="chart-wrapper" style="max-height: 45vh;">
          <canvas id="rankingChart"></canvas>
        </div>
        <div class="glass-panel" style="margin-top:1rem; overflow-y:auto; max-height:35vh;">
          <table class="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Grupo Econômico</th>
                <th>Métrica</th>
                <th>Distribuidoras</th>
              </tr>
            </thead>
            <tbody id="ranking-tbody"></tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script src="ranking.js"></script>
</body>
</html>
```

**Step 2: Create `ranking.js`**

```javascript
'use strict';

// --- Formatters ---
const fmtNum = (v, d = 0) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (Number(v ?? 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const fmtMoney = (v) => {
    const n = Number(v ?? 0);
    if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
    if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'k';
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- Holding color map (matches existing pages) ---
const HOLDING_COLORS = {
    neoenergia: '#00f0ff', cpfl: '#00ff66', equatorial: '#ff0055',
    enel: '#f59e0b', energisa: '#b026ff', cemig: '#00e5ff',
    copel: '#ff3366', edp: '#3b82f6', celesc: '#10b981',
    light: '#fbbf24', coelce: '#a78bfa', outros: '#64748b'
};
function getHoldingColor(groupId) {
    const id = String(groupId || '').toLowerCase();
    for (const key of Object.keys(HOLDING_COLORS)) {
        if (id.includes(key)) return HOLDING_COLORS[key];
    }
    return HOLDING_COLORS.outros;
}

// --- Metrics config ---
const METRICS = {
    taxa: { key: 'taxa_fora_prazo', label: 'Taxa Fora do Prazo (%)', fmt: fmtPct },
    por100k: { key: 'fora_prazo_por_100k_uc_mes', label: 'Transgr. por 100k UC/mês', fmt: v => fmtNum(v, 1) },
    compensacao: { key: 'compensacao_rs_por_uc_mes', label: 'Compensação R$/UC mês', fmt: fmtMoney }
};

// --- State ---
const state = { metric: 'taxa', topN: 20, ascending: false };
let allGroups = [];
let chartInstance = null;

// --- UI refs ---
const UI = {
    metricSelect: () => document.getElementById('metric-select'),
    topNSelect: () => document.getElementById('topn-select'),
    ascToggle: () => document.getElementById('asc-toggle'),
    tableBody: () => document.getElementById('ranking-tbody'),
    canvas: () => document.getElementById('rankingChart'),
    chartTitle: () => document.getElementById('chart-title'),
};

// --- Theme ---
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle .icon');
    if (icon) icon.textContent = getTheme() === 'light' ? '☀️' : '🌙';
}
function initThemeToggle() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = getTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle .icon');
        if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙';
        renderAll();
    });
}

// --- Data helpers ---
function getSorted() {
    const cfg = METRICS[state.metric];
    return [...allGroups]
        .filter(g => g.latest_metrics?.[cfg.key] != null)
        .sort((a, b) => {
            const av = a.latest_metrics[cfg.key];
            const bv = b.latest_metrics[cfg.key];
            return state.ascending ? av - bv : bv - av;
        })
        .slice(0, state.topN === 0 ? undefined : state.topN);
}

// --- Render ---
function renderChart(sorted) {
    const cfg = METRICS[state.metric];
    const isLight = getTheme() === 'light';
    Chart.defaults.color = isLight ? '#475569' : '#8a949e';
    Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

    const labels = sorted.map(g => g.label);
    const values = sorted.map(g => g.latest_metrics[cfg.key]);
    const colors = sorted.map(g => getHoldingColor(g.group_id));

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const ctx = UI.canvas().getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + 'bb'),
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.9)',
                    titleColor: isLight ? '#1e293b' : '#f8fafc',
                    bodyColor: isLight ? '#475569' : '#cbd5e1',
                    callbacks: { label: ctx => ' ' + cfg.fmt(ctx.parsed.x) }
                }
            },
            scales: {
                x: { beginAtZero: true, title: { display: true, text: cfg.label } },
                y: { ticks: { font: { size: 11 } } }
            }
        }
    });

    const dir = state.ascending ? 'crescente' : 'decrescente';
    const n = state.topN === 0 ? 'Todos os' : `Top ${sorted.length}`;
    UI.chartTitle().textContent = `${n} grupos — ${cfg.label} (${dir})`;
}

function renderTable(sorted) {
    const cfg = METRICS[state.metric];
    UI.tableBody().innerHTML = sorted.map((g, i) => {
        const val = g.latest_metrics[cfg.key];
        const ndist = g.distributors?.length ?? '—';
        const gid = String(g.group_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return `<tr>
            <td class="rank-num">#${i + 1}</td>
            <td class="group-name">
                <img src="assets/logos/${gid}.png" onerror="this.style.display='none'" class="group-logo" alt="${g.label}">
                ${g.label}
            </td>
            <td class="metric-val">${cfg.fmt(val)}</td>
            <td>${ndist}</td>
        </tr>`;
    }).join('');
}

function renderAll() {
    const sorted = getSorted();
    renderChart(sorted);
    renderTable(sorted);
}

// --- Init ---
function initFilters() {
    UI.metricSelect()?.addEventListener('change', e => { state.metric = e.target.value; renderAll(); });
    UI.topNSelect()?.addEventListener('change', e => { state.topN = Number(e.target.value); renderAll(); });
    UI.ascToggle()?.addEventListener('change', e => { state.ascending = e.target.checked; renderAll(); });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initThemeToggle();
    try {
        const res = await fetch('./dashboard_data.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_data.json');
        const data = await res.json();
        allGroups = (data.distributor_groups || []).filter(g => g.latest_metrics);
        initFilters();
        renderAll();
    } catch (err) {
        console.error(err);
        document.querySelector('.main-panel').innerHTML =
            `<div class="glass-panel" style="padding:2rem;"><p style="color:var(--pop-orange)">Erro: ${err.message}</p></div>`;
    }
});
```

**Step 3: Verify in browser**

```bash
make backend
# Open http://localhost:8050/ranking.html
# Verify: bar chart renders with top 20 groups
# Change metric dropdown → chart updates
# Toggle crescente → order reverses
# Table rows match chart labels
```

---

## Task 5: Create evolucao.html

**Files:**
- Create: `app/frontend/evolucao.html`
- Create: `app/frontend/evolucao.js`

**Step 1: Create `evolucao.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCC ANEEL — Evolução Temporal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="layout-container">
    <header class="global-header">
      <div class="header-brand">
        <span class="header-logo">⚡</span>
        <div class="header-title-group">
          <span class="header-title">TCC ANEEL</span>
          <span class="header-subtitle">REN 1000/2021</span>
        </div>
      </div>
      <nav class="main-nav-links">
        <a href="index.html">Visão Geral</a>
        <a href="transgressoes.html">Séries Temporais</a>
        <a href="mapa.html">Mapa Interativo</a>
        <a href="prompt.html">IA</a>
        <a href="ranking.html">Ranking</a>
        <a href="evolucao.html" class="active">Evolução</a>
        <a href="benchmark.html">Benchmark</a>
      </nav>
      <div class="header-actions">
        <button id="theme-toggle" class="btn-icon" title="Alternar tema"><span class="icon">🌙</span></button>
      </div>
    </header>

    <main class="dashboard-grid">
      <aside class="sidebar-panel">
        <div class="control-card glass-panel">
          <p class="nav-title">Evolução Temporal</p>
          <p class="nav-subtitle">Heatmap mensal por distribuidora</p>

          <div class="filter-group">
            <label for="metric-select">Métrica</label>
            <select id="metric-select" class="custom-select">
              <option value="fora_prazo_por_100k_uc_mes">Transgr. por 100k UC/mês</option>
              <option value="compensacao_rs_por_uc_mes">Compensação R$/UC mês</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="period-select">Período</label>
            <select id="period-select" class="custom-select">
              <option value="all" selected>Todos (2023–2025)</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="topn-select">Distribuidoras a exibir</label>
            <select id="topn-select" class="custom-select">
              <option value="10" selected>Top 10 (por métrica)</option>
              <option value="20">Top 20</option>
              <option value="30">Top 30</option>
              <option value="0">Todas</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="dist-select">Ou selecione distribuidoras</label>
            <select id="dist-select" class="custom-select" multiple size="8" style="height:160px;">
            </select>
            <small style="color:var(--text-muted); font-size:0.72rem;">Ctrl+clique para múltiplas</small>
          </div>
        </div>

        <div class="insight-card glass-panel">
          <p class="nav-title" style="font-size:1rem;">Escala de Cores</p>
          <div class="heatmap-legend">
            <span>Baixo</span>
            <div class="heatmap-legend-bar"></div>
            <span>Alto</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">
            <span id="legend-min">—</span>
            <span id="legend-max">—</span>
          </div>
          <p id="heatmap-status" style="font-size:0.75rem; color:var(--text-muted); margin-top:0.75rem;"></p>
        </div>
      </aside>

      <section class="main-panel">
        <div class="chart-header">
          <h2 id="chart-title" style="font-size:1rem; color:var(--text-secondary);">Carregando heatmap...</h2>
        </div>
        <div class="glass-panel" style="flex:1; overflow:auto; padding:1rem;">
          <div class="heatmap-wrapper">
            <div id="heatmap-container" class="heatmap-grid"></div>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script src="evolucao.js"></script>
</body>
</html>
```

**Step 2: Create `evolucao.js`**

```javascript
'use strict';

// --- Formatters ---
const fmtNum = (v, d = 1) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (v) => {
    const n = Number(v ?? 0);
    if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + 'k';
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

// --- State ---
const state = {
    metric: 'fora_prazo_por_100k_uc_mes',
    period: 'all',
    topN: 10,
    selectedDists: []
};

let allData = [];
let allDistributors = [];

// --- UI refs ---
const UI = {
    metricSelect: () => document.getElementById('metric-select'),
    periodSelect: () => document.getElementById('period-select'),
    topNSelect: () => document.getElementById('topn-select'),
    distSelect: () => document.getElementById('dist-select'),
    heatmapContainer: () => document.getElementById('heatmap-container'),
    chartTitle: () => document.getElementById('chart-title'),
    legendMin: () => document.getElementById('legend-min'),
    legendMax: () => document.getElementById('legend-max'),
    heatmapStatus: () => document.getElementById('heatmap-status'),
};

// --- Theme ---
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle .icon');
    if (icon) icon.textContent = getTheme() === 'light' ? '☀️' : '🌙';
}
function initThemeToggle() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = getTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle .icon');
        if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙';
        renderHeatmap();
    });
}

// --- Color scale: hsl 180 (cyan) → 0 (red) ---
function cellColor(v, min, max) {
    if (v == null) return getTheme() === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
    const norm = max === min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));
    const hue = Math.round(180 - norm * 180);
    return `hsl(${hue}, 75%, 48%)`;
}

function fmtVal(v) {
    if (v == null) return 'Sem dados';
    return state.metric === 'compensacao_rs_por_uc_mes' ? fmtMoney(v) : fmtNum(v);
}

function fmtMonth(dateStr) {
    const [y, m] = dateStr.split('-');
    return new Date(+y, +m - 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '') + '/' + y.slice(2);
}

// --- Build matrix ---
function buildMatrix() {
    let filtered = allData.filter(d => d.tipo === 'franquia');

    if (state.period !== 'all') {
        filtered = filtered.filter(d => d.date.startsWith(state.period));
    }

    // Determine which distributors to show
    let groups;
    if (state.selectedDists.length > 0) {
        groups = state.selectedDists;
    } else {
        // top-N by mean metric value
        const means = {};
        const counts = {};
        filtered.forEach(d => {
            const v = d[state.metric];
            if (v != null) {
                means[d.grupo] = (means[d.grupo] || 0) + v;
                counts[d.grupo] = (counts[d.grupo] || 0) + 1;
            }
        });
        const sorted = Object.keys(means)
            .map(g => ({ g, mean: means[g] / counts[g] }))
            .sort((a, b) => b.mean - a.mean);
        groups = state.topN === 0
            ? sorted.map(x => x.g)
            : sorted.slice(0, state.topN).map(x => x.g);
    }

    filtered = filtered.filter(d => groups.includes(d.grupo));
    const months = [...new Set(filtered.map(d => d.date))].sort();

    // matrix[group][month] = value
    const matrix = {};
    groups.forEach(g => { matrix[g] = {}; });
    filtered.forEach(d => { matrix[d.grupo][d.date] = d[state.metric]; });

    return { months, groups, matrix };
}

function renderHeatmap() {
    const { months, groups, matrix } = buildMatrix();
    const container = UI.heatmapContainer();

    if (!months.length || !groups.length) {
        container.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Sem dados para o filtro selecionado.</p>';
        return;
    }

    // Global min/max
    const allVals = groups.flatMap(g => months.map(m => matrix[g][m])).filter(v => v != null);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);

    // Set grid columns: row-label + N month cols
    container.style.gridTemplateColumns = `140px repeat(${months.length}, minmax(24px, 1fr))`;

    let html = '<div class="heatmap-header-corner"></div>';
    months.forEach(m => {
        html += `<div class="heatmap-col-label">${fmtMonth(m)}</div>`;
    });
    groups.forEach(group => {
        const shortName = group.length > 22 ? group.slice(0, 20) + '…' : group;
        html += `<div class="heatmap-row-label" title="${group}">${shortName}</div>`;
        months.forEach(m => {
            const v = matrix[group][m];
            const color = cellColor(v, min, max);
            const tip = `${group}\n${fmtMonth(m)}: ${fmtVal(v)}`;
            html += `<div class="heatmap-cell" style="background:${color}" title="${tip}"></div>`;
        });
    });

    container.innerHTML = html;

    // Update legend
    UI.legendMin().textContent = fmtVal(min);
    UI.legendMax().textContent = fmtVal(max);
    UI.heatmapStatus().textContent = `${groups.length} distribuidoras × ${months.length} meses`;

    const metricLabel = state.metric === 'compensacao_rs_por_uc_mes'
        ? 'Compensação R$/UC mês' : 'Transgr. por 100k UC/mês';
    UI.chartTitle().textContent = `${metricLabel} — ${groups.length} distribuidoras, ${months.length} meses`;
}

// --- Populate distributor multi-select ---
function populateDistSelect() {
    const sel = UI.distSelect();
    sel.innerHTML = allDistributors.map(d =>
        `<option value="${d}">${d}</option>`
    ).join('');
}

// --- Init filters ---
function initFilters() {
    UI.metricSelect()?.addEventListener('change', e => { state.metric = e.target.value; renderHeatmap(); });
    UI.periodSelect()?.addEventListener('change', e => { state.period = e.target.value; renderHeatmap(); });
    UI.topNSelect()?.addEventListener('change', e => { state.topN = Number(e.target.value); state.selectedDists = []; UI.distSelect().selectedIndex = -1; renderHeatmap(); });
    UI.distSelect()?.addEventListener('change', e => {
        state.selectedDists = Array.from(e.target.selectedOptions).map(o => o.value);
        renderHeatmap();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initThemeToggle();
    try {
        const res = await fetch('./dashboard_timeseries.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_timeseries.json');
        const json = await res.json();
        allData = json.data || [];

        // Collect unique franquia distributors sorted alphabetically
        allDistributors = [...new Set(
            allData.filter(d => d.tipo === 'franquia').map(d => d.grupo)
        )].sort();

        populateDistSelect();
        initFilters();
        renderHeatmap();
    } catch (err) {
        console.error(err);
        document.querySelector('.main-panel').innerHTML =
            `<div class="glass-panel" style="padding:2rem;"><p style="color:var(--pop-orange)">Erro: ${err.message}</p></div>`;
    }
});
```

**Step 3: Verify in browser**

```bash
# http://localhost:8050/evolucao.html
# Verify: heatmap renders with colored cells (cyan=low, red=high)
# Change period → months column shrinks
# Select specific distributors in multi-select → heatmap updates
# Hover cell → tooltip shows distributor + month + value
```

---

## Task 6: Create benchmark.html

**Files:**
- Create: `app/frontend/benchmark.html`
- Create: `app/frontend/benchmark.js`

**Step 1: Create `benchmark.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCC ANEEL — Benchmark por Porte</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="layout-container">
    <header class="global-header">
      <div class="header-brand">
        <span class="header-logo">⚡</span>
        <div class="header-title-group">
          <span class="header-title">TCC ANEEL</span>
          <span class="header-subtitle">REN 1000/2021</span>
        </div>
      </div>
      <nav class="main-nav-links">
        <a href="index.html">Visão Geral</a>
        <a href="transgressoes.html">Séries Temporais</a>
        <a href="mapa.html">Mapa Interativo</a>
        <a href="prompt.html">IA</a>
        <a href="ranking.html">Ranking</a>
        <a href="evolucao.html">Evolução</a>
        <a href="benchmark.html" class="active">Benchmark</a>
      </nav>
      <div class="header-actions">
        <button id="theme-toggle" class="btn-icon" title="Alternar tema"><span class="icon">🌙</span></button>
      </div>
    </header>

    <main class="dashboard-grid">
      <aside class="sidebar-panel">
        <div class="control-card glass-panel">
          <p class="nav-title">Benchmark por Porte</p>
          <p class="nav-subtitle">Transgr. × Compensação por distribuidora</p>

          <div class="filter-group">
            <label>Porte das Distribuidoras</label>
            <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.4rem;">
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem; color:var(--text-secondary);">
                <input type="checkbox" class="porte-cb" value="P" checked> P — Pequeno (&lt;30k UCs)
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem; color:var(--text-secondary);">
                <input type="checkbox" class="porte-cb" value="M" checked> M — Médio (30k–300k)
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem; color:var(--text-secondary);">
                <input type="checkbox" class="porte-cb" value="G" checked> G — Grande (300k–1,5M)
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem; color:var(--text-secondary);">
                <input type="checkbox" class="porte-cb" value="GG" checked> GG — Muito Grande (&gt;1,5M)
              </label>
            </div>
          </div>

          <div class="filter-group">
            <label for="regra-select">Período Regulatório</label>
            <select id="regra-select" class="custom-select">
              <option value="all">Todos</option>
              <option value="REN 414">Pré-2022 (REN 414)</option>
              <option value="REN 1000" selected>Pós-2022 (REN 1000)</option>
            </select>
          </div>
        </div>

        <div class="insight-card glass-panel">
          <p class="nav-title" style="font-size:1rem;">Legenda de Porte</p>
          <div style="font-size:0.8rem; line-height:2; color:var(--text-secondary);">
            <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#00ff66;margin-right:6px;"></span>P — Pequeno</div>
            <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#00f0ff;margin-right:6px;"></span>M — Médio</div>
            <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f59e0b;margin-right:6px;"></span>G — Grande</div>
            <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff0055;margin-right:6px;"></span>GG — Muito Grande</div>
          </div>
          <p id="porte-count" style="font-size:0.75rem; color:var(--text-muted); margin-top:0.75rem;"></p>
        </div>
      </aside>

      <section class="main-panel">
        <div class="chart-header">
          <h2 id="chart-title" style="font-size:1rem; color:var(--text-secondary);">Carregando...</h2>
        </div>
        <div class="chart-wrapper" style="flex:1; min-height:380px;">
          <canvas id="benchmarkChart"></canvas>
        </div>
        <div id="summary-cards" class="summary-cards-grid"></div>
      </section>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script src="benchmark.js"></script>
</body>
</html>
```

**Step 2: Create `benchmark.js`**

```javascript
'use strict';

// --- Formatters ---
const fmtNum = (v, d = 0) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (v) => {
    const n = Number(v ?? 0);
    if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + 'k';
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

// --- Porte config ---
const PORTE_CONFIG = {
    P:  { label: 'Pequeno (P)',      color: '#00ff66', r: 7  },
    M:  { label: 'Médio (M)',        color: '#00f0ff', r: 9  },
    G:  { label: 'Grande (G)',       color: '#f59e0b', r: 11 },
    GG: { label: 'Muito Grande (GG)', color: '#ff0055', r: 13 },
};

// --- State ---
const state = { portes: new Set(['P', 'M', 'G', 'GG']), regra: 'REN 1000' };
let allData = [];
let chartInstance = null;

// --- UI refs ---
const UI = {
    porteCbs: () => document.querySelectorAll('.porte-cb'),
    regraSelect: () => document.getElementById('regra-select'),
    canvas: () => document.getElementById('benchmarkChart'),
    chartTitle: () => document.getElementById('chart-title'),
    summaryCards: () => document.getElementById('summary-cards'),
    porteCount: () => document.getElementById('porte-count'),
};

// --- Theme ---
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle .icon');
    if (icon) icon.textContent = getTheme() === 'light' ? '☀️' : '🌙';
}
function initThemeToggle() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = getTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle .icon');
        if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙';
        renderAll();
    });
}

// --- Render ---
function getFiltered() {
    return allData.filter(d => {
        const porteOk = !d.porte || state.portes.has(d.porte);
        const regraOk = state.regra === 'all' || d.regra === state.regra;
        return porteOk && regraOk && d.x != null && d.y != null;
    });
}

function renderChart(filtered) {
    const isLight = getTheme() === 'light';
    Chart.defaults.color = isLight ? '#475569' : '#8a949e';
    Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

    // Build one dataset per porte
    const datasets = Object.entries(PORTE_CONFIG)
        .filter(([p]) => state.portes.has(p))
        .map(([porte, cfg]) => {
            const pts = filtered.filter(d => (d.porte || 'P') === porte);
            return {
                label: cfg.label,
                data: pts.map(d => ({ x: d.x, y: d.y, r: cfg.r, label: d.label, porte })),
                backgroundColor: cfg.color + 'aa',
                borderColor: cfg.color,
                borderWidth: 1,
            };
        });

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const ctx = UI.canvas().getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } },
                tooltip: {
                    backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.9)',
                    titleColor: isLight ? '#1e293b' : '#f8fafc',
                    bodyColor: isLight ? '#475569' : '#cbd5e1',
                    callbacks: {
                        title: ctx => ctx[0].raw.label,
                        label: ctx => [
                            `Porte: ${ctx.raw.porte || '—'}`,
                            `Qtd. Transgr.: ${fmtNum(ctx.raw.x)}`,
                            `Compens. R$/UC mês: ${fmtMoney(ctx.raw.y)}`,
                        ]
                    }
                }
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Qtd. Transgressões (log — total período)' },
                    ticks: { callback: v => fmtNum(v) }
                },
                y: {
                    title: { display: true, text: 'Compensação R$/UC mês (média)' },
                    ticks: { callback: v => fmtMoney(v) }
                }
            }
        }
    });

    const regraLabel = state.regra === 'all' ? 'todos os períodos' : state.regra;
    UI.chartTitle().textContent = `Transgr. × Compensação — ${filtered.length} distribuidoras (${regraLabel})`;
    UI.porteCount().textContent = `${filtered.length} distribuidoras no filtro atual`;
}

function renderSummaryCards(filtered) {
    const cards = Object.entries(PORTE_CONFIG).map(([porte, cfg]) => {
        const pts = filtered.filter(d => (d.porte || 'P') === porte);
        if (!pts.length) return '';
        const ys = pts.map(d => d.y).filter(v => v != null);
        const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
        const mn = Math.min(...ys);
        const mx = Math.max(...ys);
        return `<div class="summary-card" style="border-top: 3px solid ${cfg.color}">
            <div class="card-porte">${porte} — ${cfg.label.split(' ')[0]}</div>
            <div class="card-metric" style="color:${cfg.color}">${fmtMoney(avg)}</div>
            <div class="card-range">Min: ${fmtMoney(mn)} · Máx: ${fmtMoney(mx)}</div>
            <div class="card-range">${pts.length} distribuidoras</div>
        </div>`;
    });
    UI.summaryCards().innerHTML = cards.join('');
}

function renderAll() {
    const filtered = getFiltered();
    renderChart(filtered);
    renderSummaryCards(filtered);
}

// --- Init ---
function initFilters() {
    UI.porteCbs().forEach(cb => {
        cb.addEventListener('change', () => {
            state.portes = new Set(
                Array.from(UI.porteCbs()).filter(c => c.checked).map(c => c.value)
            );
            renderAll();
        });
    });
    UI.regraSelect()?.addEventListener('change', e => { state.regra = e.target.value; renderAll(); });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initThemeToggle();
    try {
        const res = await fetch('./dashboard_scatter.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_scatter.json');
        const json = await res.json();
        allData = json.data || [];
        initFilters();
        renderAll();
    } catch (err) {
        console.error(err);
        document.querySelector('.main-panel').innerHTML =
            `<div class="glass-panel" style="padding:2rem;"><p style="color:var(--pop-orange)">Erro: ${err.message}</p></div>`;
    }
});
```

**Step 3: Verify in browser**

```bash
# http://localhost:8050/benchmark.html
# Verify: bubble chart renders with 4 colored porte groups
# Uncheck porte "GG" → large bubbles disappear
# Switch período → different set of points
# 4 summary cards at bottom show avg/min/max per porte
# Hover bubble → tooltip shows distributor name + porte + counts
```

---

## Task 7: Final end-to-end verification

**Step 1: Check nav links work in all 7 pages**

```bash
# Visit each page and click every nav link:
# http://localhost:8050/index.html        → links to all 7 pages
# http://localhost:8050/transgressoes.html → links to all 7 pages
# http://localhost:8050/mapa.html         → links to all 7 pages
# http://localhost:8050/prompt.html       → links to all 7 pages
# http://localhost:8050/ranking.html      → "Ranking" is .active
# http://localhost:8050/evolucao.html     → "Evolução" is .active
# http://localhost:8050/benchmark.html    → "Benchmark" is .active
```

**Step 2: Test theme toggle on each new page**

Toggle theme on ranking, evolucao, benchmark — verify chart colors update.

**Step 3: Commit**

```bash
git add app/frontend/ranking.html app/frontend/ranking.js
git add app/frontend/evolucao.html app/frontend/evolucao.js
git add app/frontend/benchmark.html app/frontend/benchmark.js
git add app/frontend/styles.css
git add app/frontend/index.html app/frontend/transgressoes.html app/frontend/mapa.html app/frontend/prompt.html
git add src/analysis/build_dashboard_data.py app/frontend/dashboard_scatter.json
git add docs/plans/
git commit -m "feat: adicionar páginas ranking, evolucao e benchmark ao dashboard"
```
