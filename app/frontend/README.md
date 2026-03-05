# 📊 Dashboard Interativo — REN 1000/2021

Painel analítico para visualização dos dados de qualidade comercial das distribuidoras de energia elétrica, com foco na eficácia da Resolução Normativa ANEEL nº 1.000/2021.

---

## 🖥️ Tecnologias Utilizadas

| Tecnologia | Versão | Uso |
|---|---|---|
| **HTML5** | — | Estrutura da SPA e do relatório |
| **CSS3** | — | Design system dark mode (Vanilla CSS, sem frameworks) |
| **JavaScript** (ES2020+) | — | Lógica de navegação, formatação e renderização |
| **Chart.js** | 4.4.7 | Gráficos interativos (line, bar, radar, doughnut, stacked area) |
| **Google Fonts** | — | Tipografia Inter (UI) + JetBrains Mono (números) |
| **Python** | 3.10+ | Geração do arquivo `dashboard_data.json` a partir dos CSVs |
| **FastAPI** | — | Backend local para API e serving estático em localhost |

> **Zero dependências de build.** Não há Node.js, npm, bundlers nem transpilers.  
> Os arquivos são servidos diretamente — basta um servidor HTTP simples.

---

## 📂 Estrutura de Arquivos

```
dashboard/
├── index.html              ← Dashboard interativo (SPA, 4 abas)
├── styles.css              ← Design system completo (dark mode, glassmorphism)
├── app.js                  ← Lógica de charts, navegação e formatação pt-BR
├── relatorio.html          ← Relatório imprimível (otimizado para PDF via Ctrl+P)
├── dashboard_data.json     ← Dados gerados (NÃO versionado — .gitignore)
└── README.md               ← Este arquivo
```

---

## 🚀 Como Subir / Visualizar

### Opção 1: `make serve`

```bash
# A partir da raiz do projeto
make serve
```

Isso gera o JSON (se necessário) e inicia um servidor Python em `http://localhost:8050` (ou `PORT` customizada).

### Opção 1B: `make dev-serve` (recomendado para backend local)

```bash
# A partir da raiz do projeto
make dev-serve
```

Isso executa preflight (artefatos + contratos), sobe backend FastAPI em `http://localhost:8050` e expõe:

- `GET /health`
- `GET /api/dashboard`
- `GET /api/dashboard/{section}`

### Recuperação rápida de ambiente (quando não sobe)

```bash
# raiz do projeto
make venv-recreate
make install
make doctor
make preflight-backend
make backend
```

### Opção 2: Servidor HTTP manual

```bash
cd dashboard
python3 -m http.server 8050
# Abra http://localhost:8050 no navegador
```

### Opção 4: Docker Compose

```bash
# Na raiz do projeto
docker compose up --build
```

### Opção 3: Extensão Live Server (VS Code)

1. Instale a extensão **Live Server** no VS Code.
2. Clique com botão direito em `dashboard/index.html` → **Open with Live Server**.

### ⚠️ Por que não basta abrir o arquivo direto?

Navegadores bloqueiam `fetch()` em protocolo `file://` (política CORS). O dashboard precisa carregar `dashboard_data.json` via HTTP. Por isso é necessário um servidor local.

---

## 🔄 Como Atualizar os Dados

O dashboard consome um único arquivo JSON gerado a partir dos CSVs analíticos:

```bash
# Opção 1: apenas gerar o JSON
make dashboard

# Opção 2: benchmark Neoenergia (gera tabelas e relatório específicos)
python3 -m src.analysis.neoenergia_diagnostico

# Opção 3: pipeline completo (ETL → análise → diagnóstico Neoenergia → dashboard)
make pipeline

# Opção 4: direto pelo Python
python3 -m src.analysis.build_dashboard_data
```

O script lê os CSVs de `data/processed/analysis/` e gera `dashboard/dashboard_data.json` (~1.6 MB).

> Nota: os arquivos de `data/processed/analysis/grupos/` também podem ser gerados via SQL em PostgreSQL (DBeaver), usando `sql/grupos_diagnostico_dbeaver.sql`. Instruções: `docs/DBEAVER_SQL_MIGRATION.md`.

### Fluxo de dados

```
data/raw/*.csv
    ↓ extract_aneel.py
data/processed/*.parquet
    ↓ transform_aneel.py + build_analysis_tables.py
data/processed/analysis/*.csv
    ↓ neoenergia_diagnostico.py (subconjunto neoenergia/* + relatório dedicado)
data/processed/analysis/neoenergia/*.csv + reports/neoenergia_diagnostico.md
    ↓ build_dashboard_data.py
dashboard/dashboard_data.json
    ↓ app.js (fetch)
Gráficos no navegador
```

---

## 🎨 Como Alterar o Dashboard

### Adicionar/editar gráficos

Os gráficos são renderizados em **`app.js`** usando Chart.js. Cada aba tem sua função:

| Função | Aba | O que renderiza |
|---|---|---|
| `renderOverview()` | Visão Geral | KPIs + série anual (taxa e compensação) |
| `renderNeoenergia()` | Neoenergia | Benchmark 5 distribuidoras + radar + tendência |
| `renderRegulatory()` | Análise Regulatória | Série mensal (taxa + compensação empilhada) |
| `renderDiagnostico()` | Diagnóstico | Donuts por classe/local + série longa 2011–2023 |

Para adicionar um novo gráfico:

1. Adicione um `<canvas id="meu-chart">` no `index.html` dentro da aba desejada.
2. Chame `createChart('meu-chart', config)` na função da aba em `app.js`.
3. A configuração segue o padrão [Chart.js v4](https://www.chartjs.org/docs/latest/).

### Alterar cores e layout

- **`styles.css`** contém todas as variáveis CSS em `:root` (cores, fontes, espaçamentos).
- O design usa **CSS custom properties** — basta alterar uma variável para mudar globalmente.
- Cores das distribuidoras Neoenergia estão em `NEO_COLORS` no `app.js`.

### Alterar dados disponíveis

O script `src/analysis/build_dashboard_data.py` controla quais CSVs são convertidos em JSON.  
Para adicionar um novo dataset:

1. Crie uma função `build_nome_dataset(df)` no script Python.
2. Adicione a chave ao dicionário `data` na função `main()`.
3. Consuma a nova chave em `app.js` dentro da função de renderização.

### Alterar o relatório imprimível

O arquivo `relatorio.html` é independente do dashboard — tem seus próprios estilos inline e scripts Chart.js. Para alterar:

1. Edite seções diretamente no HTML.
2. A função `init()` no `<script>` do relatório carrega o mesmo `dashboard_data.json`.
3. Use `@media print` para ajustar estilos de impressão.
4. `page-break` classes controlam quebras de página no PDF.

---

## 📋 Abas do Dashboard

### 1. Visão Geral

- **6 KPI cards** com comparação pré vs pós REN 1000
- **Gráfico de linha** — taxa fora do prazo (2011–2023)
- **Gráfico de barras** — compensações financeiras anuais
- Insights automáticos baseados nos dados

### 2. Neoenergia (Benchmark)

- **Barras agrupadas** — transgressões por 100k UC-mês
- **Barras agrupadas** — compensação por UC-mês
- **Radar chart** — benchmark multidimensional
- **Tabela** — tendência 2023 → 2025

### 3. Análise Regulatória

- **Multi-line chart** — taxa mensal por distribuidora (2023–2025)
- **Stacked area** — compensação financeira mensal empilhada

### 4. Diagnóstico Detalhado

- **Donut charts** — distribuição por classe/localização (5 distribuidoras)
- **Barras comparativas** — taxa 2011 vs 2023
- **Tabela** — série longa com variação percentual

---

## 🖨️ Relatório Imprimível

O arquivo `relatorio.html` é otimizado para impressão/PDF:

```
Ctrl + P  →  Salvar como PDF
```

- Layout claro em fundo branco com tipografia Inter
- Botão "Imprimir / Salvar PDF" no canto superior
- Botão de alternância de tema (sincronizado com o dashboard principal)
- Quebras de página automáticas entre seções
- Gráficos Chart.js renderizam no PDF

---

## 🧰 Dependências

**Frontend (CDN — sem instalação):**

- `chart.js@4.4.7` — via jsDelivr CDN
- Google Fonts (Inter, JetBrains Mono)

**Backend (Python — já está no requirements.txt):**

- `pandas` — leitura e manipulação dos CSVs
- `numpy` — operações numéricas
- `fastapi` — API local e static serving
- `uvicorn` — servidor ASGI local

Nenhuma dependência adicional é necessária.
