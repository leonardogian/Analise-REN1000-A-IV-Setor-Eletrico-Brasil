# 📊 Frontend — Dashboard REN 1000/2021

> Para comandos de build, arquitetura geral e constraints, veja [`CLAUDE.md`](../../CLAUDE.md).
> Para diretrizes operacionais de IA, veja [`AGENTS.md`](../../AGENTS.md).

Painel analítico interativo para visualização dos dados de qualidade comercial das distribuidoras de energia elétrica, com foco na eficácia da Resolução Normativa ANEEL nº 1.000/2021.

---

## 🖥️ Tecnologias

| Tecnologia | Versão | Uso |
|---|---|---|
| **HTML5** | — | Estrutura das páginas |
| **CSS3** | — | Design system dark mode (Vanilla CSS, sem frameworks) |
| **JavaScript** (ES2020+) | — | Lógica de navegação, formatação e renderização |
| **Chart.js** | 4.4.7 | Gráficos interativos (line, bar, radar, doughnut, stacked area, bubble) |
| **Google Fonts** | — | Inter (UI) + JetBrains Mono (números) |

> **Zero dependências de build.** Sem Node.js, npm, bundlers nem transpilers.
> Servido diretamente via `make serve` ou `make backend` — nunca via `file://` (CORS).

---

## 📂 Estrutura de Arquivos

```
app/frontend/
├── index.html              ← Visão Geral (KPIs, tendências, grupos overview)
├── transgressoes.html      ← Séries temporais de transgressão por distribuidora
├── benchmark.html          ← Bubble chart: volume de serviços × compensação por porte
├── evolucao.html           ← Heatmap mensal: transgressões por holding (2023–2025)
├── ranking.html            ← Ranking horizontal por métrica de grupo
├── mapa.html               ← Mapa geográfico interativo
├── relatorio.html          ← Relatório imprimível (Ctrl+P → PDF)
│
├── styles.css              ← Design system (variáveis CSS, dark mode, glassmorphism)
│
├── utils.js                ← Formatadores pt-BR compartilhados
├── nav.js                  ← Sidebar, mobile toggle, toast system
├── filters.js              ← Estado global de filtros + evento filters:change
├── app.js                  ← Chart.js defaults (tema), constantes compartilhadas
│
├── transgressoes.js        ← Lógica da página transgressoes.html
├── benchmark.js            ← Lógica da página benchmark.html
├── evolucao.js             ← Lógica da página evolucao.html
├── ranking.js              ← Lógica da página ranking.html
├── mapa.js                 ← Lógica da página mapa.html
│
├── dashboard_data.json           ← Payload principal ~27 MB (NÃO versionado)
├── dashboard_transgressoes.json  ← Transgressões por distribuidora/grupo/rural
├── dashboard_timeseries.json     ← Séries mensais para evolucao.html
├── dashboard_scatter.json        ← Scatter: volume × compensação para benchmark.html
├── dashboard_heatmap.json        ← Matriz grupo × dimensão
├── dashboard_radar.json          ← Perfis multidimensionais de grupo
├── dashboard_groups_ranking.json ← Ranking top-N de grupos para ranking.html
│
└── assets/
    └── logos/              ← Logos das holdings (neoenergia.png, cpfl.png, etc.)
```

---

## 🏗️ Arquitetura de Módulos Compartilhados

Os módulos são carregados em ordem específica em todas as páginas:

```
utils.js → nav.js → filters.js → app.js → [page].js
```

| Módulo | Responsabilidade |
|--------|-----------------|
| `utils.js` | Formatadores: `fmtNum`, `fmtMoney`, `fmtMoneyFull`, `fmtPct`, `fmtVar` |
| `nav.js` | Sidebar active-link, mobile toggle, toast notifications |
| `filters.js` | Estado global (período, porte, grupo) + evento `filters:change` |
| `app.js` | Chart.js defaults (tema dark), constantes compartilhadas |

Cada `[page].js` escuta o evento `filters:change` para reagir a filtros globais sem acoplamento direto.

---

## 📄 Páginas do Dashboard

| Página | Arquivo JS | JSON consumido | O que mostra |
|--------|------------|----------------|-------------|
| Visão Geral | `app.js` (inline) | `dashboard_data.json` | KPIs pré/pós REN 1000, séries anuais |
| Transgressões | `transgressoes.js` | `dashboard_transgressoes.json` | Séries temporais mensais por distribuidora/grupo |
| Benchmark | `benchmark.js` | `dashboard_scatter.json` | Bubble chart: volume × compensação por porte |
| Evolução | `evolucao.js` | `dashboard_timeseries.json` | Heatmap mensal de transgressões por holding |
| Ranking | `ranking.js` | `dashboard_groups_ranking.json` | Barras horizontais: grupos por métrica |
| Mapa | `mapa.js` | `dashboard_data.json` | Mapa geográfico interativo |
| Relatório | — | `dashboard_data.json` | Relatório imprimível (Ctrl+P → PDF) |

---

## 🔄 Como Regenerar os JSONs

```bash
# Todos os JSONs de uma vez (recomendado)
make dashboard-full

# JSONs individuais
python3 -m src.analysis.build_dashboard_data      # dashboard_data.json
python3 -m src.analysis.dashboard_transgressoes   # dashboard_transgressoes.json
# dashboard_timeseries, scatter, heatmap, radar e groups_ranking são gerados
# pelos scripts em src/analysis/ — veja CLAUDE.md para o mapeamento completo
```

---

## 🚀 Como Subir

```bash
# Opção 1: servidor HTTP simples
make serve        # http://localhost:8051

# Opção 2: backend FastAPI (API + estáticos)
make backend      # http://localhost:8051

# Opção 3: full pipeline + backend com --reload
make dev-serve

# Opção 4: Docker Compose
docker compose up --build
```

> **Nunca abrir via `file://`** — CORS bloqueia os `fetch()` dos JSONs.

---

## 🎨 Como Alterar o Dashboard

### Adicionar gráfico em página existente

1. Adicione `<canvas id="meu-chart">` na página HTML desejada.
2. Na função de renderização do `[page].js`, chame `new Chart('meu-chart', config)`.
3. Siga o padrão [Chart.js v4](https://www.chartjs.org/docs/latest/).

### Adicionar nova página

1. Crie `nova-pagina.html` e `nova-pagina.js` em `app/frontend/`.
2. Inclua os módulos compartilhados na ordem: `utils.js → nav.js → filters.js → app.js → nova-pagina.js`.
3. Adicione o link na sidebar em todos os HTMLs existentes (via `nav.js`).
4. Atualize `app/backend/main.py` se precisar de novo endpoint de dados.

### Alterar cores e layout

`styles.css` contém todas as variáveis CSS em `:root` — basta alterar uma variável para mudar globalmente.

### Alterar dados disponíveis

1. Crie/edite o script Python correspondente em `src/analysis/`.
2. Adicione a chave ao dicionário `data` na função `main()` do script.
3. Consuma a nova chave no `[page].js` correspondente.

---

## 🖨️ Relatório Imprimível

`relatorio.html` é otimizado para impressão/PDF:

```
Ctrl + P  →  Salvar como PDF
```

- Layout claro em fundo branco com tipografia Inter
- Quebras de página automáticas entre seções via classes `page-break`
- Gráficos Chart.js renderizam corretamente no PDF
