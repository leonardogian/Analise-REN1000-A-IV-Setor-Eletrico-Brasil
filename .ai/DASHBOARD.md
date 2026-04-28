# 📊 Dashboard — Guia para IA

## Como Subir o Dashboard

```bash
# Opção 1: Automatizado (gera JSON + sobe servidor)
make serve
# → http://localhost:8051

# Opção 1B: Backend FastAPI (API + estático)
make dev-serve
# → http://localhost:8051 (health em /health, API em /api/dashboard)

# Opção 2: Só gerar os dados
make dashboard
# → app/frontend/dashboard_data.json

# Opção 3: Servidor manual
cd app/frontend && python3 -m http.server 8051
```

Para reprodução científica, rode `make pipeline` antes de servir: os JSONs podem estar versionados para demo/deploy, mas são derivados dos dados tratados localmente.

> ⚠️ O dashboard **NÃO funciona** abrindo `index.html` diretamente no navegador
> (`file://`). É necessário servir via HTTP por causa de restrições CORS do
> `fetch()`.

## Arquitetura dos Arquivos

```
app/frontend/
├── index.html              ← Visão Geral
├── transgressoes.html      ← Séries temporais de transgressão
├── benchmark.html          ← Volume de serviços × compensação
├── evolucao.html           ← Evolução mensal por holding
├── ranking.html            ← Ranking por métrica
├── mapa.html               ← Mapa geográfico
├── relatorio.html          ← Relatório imprimível
├── dashboard_data.json     ← Payload principal
└── dashboard_*.json        ← Micro-payloads por visualização
```

## Páginas do Dashboard

- `index.html`: KPIs, séries anuais e visão geral.
- `transgressoes.html`: séries temporais mensais por distribuidora/grupo.
- `benchmark.html`: comparação de volume de serviços e compensação.
- `evolucao.html`: heatmap mensal por holding.
- `ranking.html`: ranking horizontal por métrica.
- `mapa.html`: mapa interativo.
- `relatorio.html`: saída imprimível.

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

- **Arquivo**: `app/frontend/relatorio.html`
- **Serve para**: Gerar PDF via Ctrl+P / botão "Imprimir / Salvar PDF"
- **Visual**: Fundo branco, layout otimizado para impressão (page breaks)
- **Dados**: Usa o mesmo `dashboard_data.json`
- **Diferença do dashboard**: Estático, sem interatividade, otimizado para papel

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| "Erro ao carregar dados" | `dashboard_data.json` não existe | `make dashboard-full` ou `make pipeline` |
| "Erro ao carregar dados" | Acessou via `file://` | `make serve` |
| Backend não sobe | Pré-check falhou em artefatos/schema | `make preflight-backend` |
| Porta 8051 ocupada | Outro processo na porta | `ss -tlnp \| grep :8051` |
| Gráficos vazios | JSON desatualizado | `make dashboard-full` ou `make pipeline` |
| Charts não renderizam | CDN Chart.js inacessível | Verificar internet |
