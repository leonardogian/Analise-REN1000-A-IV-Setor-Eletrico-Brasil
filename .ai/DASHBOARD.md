# 📊 Dashboard — Guia para IA

## Como Subir o Dashboard

```bash
# Opção 1: Automatizado (gera JSON + sobe servidor)
make serve
# → http://localhost:8050

# Opção 2: Só gerar os dados
make dashboard
# → dashboard/dashboard_data.json

# Opção 3: Servidor manual
cd dashboard && python3 -m http.server 8050
```

> ⚠️ O dashboard **NÃO funciona** abrindo `index.html` diretamente no navegador
> (`file://`). É necessário servir via HTTP por causa de restrições CORS do
> `fetch()`.

## Arquitetura dos Arquivos

```
dashboard/
├── index.html           ← Página principal (4 abas de navegação)
├── app.js               ← Lógica: carrega JSON, renderiza gráficos
├── styles.css           ← Visual: dark mode, glassmorphism, responsivo
├── relatorio.html       ← Relatório imprimível (Ctrl+P → PDF)
├── dashboard_data.json  ← Dados (gerado por build_dashboard_data.py)
└── README.md            ← Documentação técnica para humanos
```

## As 4 Abas do Dashboard

### Tab 1: Visão Geral (`#overview`)

- 6 cards KPI (taxa pré/pós 2022, compensações, total serviços, total fora do prazo)
- 2 insights textuais
- Gráfico: Taxa Fora do Prazo — Série Anual (2011-2023)
- Gráfico: Compensações Financeiras — Série Anual (2011-2023)
- Dados: `kpi_overview`, `serie_anual`

### Tab 2: Neoenergia (`#neoenergia`)

- Gráfico de barras agrupadas: Transgressões por 100k UC-mês (2023-2025)
- Gráfico de barras agrupadas: Compensação R$/UC-mês (2023-2025)
- Gráfico Radar: Benchmark multidimensional (último ano)
- Tabela: Tendência 2023→2025 com variações percentuais
- Dados: `neo_anual`, `neo_tendencia`, `neo_benchmark`

### Tab 3: Análise Regulatória (`#regulatory`)

- Gráfico: Série mensal — Taxa fora do prazo por distribuidora
- Gráfico: Série mensal — Compensações financeiras
- Legendas interativas (toggle ON/OFF distribuidoras)
- Dados: `serie_mensal_nacional`

### Tab 4: Diagnóstico Detalhado (`#diagnostico`)

- 5 gráficos donut: Distribuição por classe de consumo por distribuidora
- Gráfico de barras: Série longa 2011-2023 (taxa 2011 vs 2023)
- Tabela: Resumo da série longa com variações
- 3 insights automáticos
- Dados: `neo_classe_local`, `neo_longa_resumo`

## Modificar o Dashboard

### Adicionar um novo gráfico

1. Edite `app.js` — crie a função `renderNovoGrafico(data)`:

   ```javascript
   function renderNovoGrafico(data) {
       const ctx = document.getElementById('novo-chart').getContext('2d');
       new Chart(ctx, {
           type: 'bar',
           data: { ... },
           options: { ...chartDefaults }
       });
   }
   ```

2. Edite `index.html` — adicione o canvas na aba desejada:

   ```html
   <div class="chart-card">
       <canvas id="novo-chart"></canvas>
   </div>
   ```

3. Chame a função na aba correta dentro de `app.js` (ex: `renderOverview(data)`)

### Adicionar novos dados ao JSON

1. Edite `src/analysis/build_dashboard_data.py`
2. Crie a função `build_novo_dado(df)` que retorna dict/list
3. Adicione ao dict `data` em `main()`
4. Rode `make dashboard` para regenerar

### Alterar o visual

- **Cores**: Edite as variáveis CSS em `styles.css` (`:root { ... }`)
- **Fonte**: Mudar import do Google Fonts em `index.html`
- **Glassmorphism**: Ajuste `backdrop-filter` e `background` em `.chart-card`

## Dados de Entrada (`dashboard_data.json`)

Gerado por `src/analysis/build_dashboard_data.py`. Lê estes CSVs:

| CSV de entrada | Chave no JSON | Usado na aba |
|----------------|---------------|--------------|
| `kpi_regulatorio_anual.csv` | `kpi_overview`, `serie_anual` | Visão Geral |
| `fato_transgressao_mensal_distribuidora.csv` | `serie_mensal_nacional` | Regulatória |
| `neo_anual_2023_2025.csv` | `neo_anual` | Neoenergia |
| `neo_tendencia_2023_2025.csv` | `neo_tendencia` | Neoenergia |
| `neo_benchmark_porte_latest.csv` | `neo_benchmark` | Neoenergia |
| `neo_classe_local_2023_2025.csv` | `neo_classe_local` | Diagnóstico |
| `neo_longa_resumo_2011_2023.csv` | `neo_longa_resumo` | Diagnóstico |
| `neo_mensal_2023_2025.csv` | `neo_mensal` | (reservado) |

## Relatório Imprimível

- **Arquivo**: `dashboard/relatorio.html`
- **Serve para**: Gerar PDF via Ctrl+P / botão "Imprimir / Salvar PDF"
- **Visual**: Fundo branco, layout otimizado para impressão (page breaks)
- **Dados**: Usa o mesmo `dashboard_data.json`
- **Diferença do dashboard**: Estático, sem interatividade, otimizado para papel

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| "Erro ao carregar dados" | `dashboard_data.json` não existe | `make dashboard` |
| "Erro ao carregar dados" | Acessou via `file://` | `make serve` |
| Porta 8050 ocupada | Outro processo na porta | `ss -tlnp \| grep :8050` |
| Gráficos vazios | JSON desatualizado | `make dashboard` (regenerar) |
| Charts não renderizam | CDN Chart.js inacessível | Verificar internet |
