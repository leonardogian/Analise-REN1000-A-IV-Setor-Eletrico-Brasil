# Design Spec: Limpeza do Repo + Design System Frontend + Playwright

**Data:** 2026-03-13
**Status:** Aprovado
**Fase do projeto:** ETL completo, backend estável — foco em organização e qualidade do frontend

---

## Contexto

O repositório cresceu de forma descontrolada com novas páginas, scripts experimentais e diretórios de ferramentas externas. O resultado:

- Páginas frontend sem consistência visual nem navegação unificada
- Módulos compartilhados (`nav.js`, `utils.js`, `filters.js`) criados mas não integrados em todas as páginas
- Arquivos mortos (`prompt.html`, `scripts/inspect_nb*.py`, etc.) dificultando navegação mental
- Sem forma de verificar automaticamente se o dashboard está funcionando após mudanças

Este spec cobre três iniciativas complementares: (1) limpeza estrutural do repo, (2) design system leve no frontend, (3) setup de automação com playwright.

---

## Seção 1: Limpeza do Repositório

### Remover (arquivos mortos)

| Caminho | Motivo |
|---|---|
| `app/frontend/prompt.html` | Página experimental, fora da navegação |
| `app/frontend/prompt.js` | Script associado à prompt.html |
| `scripts/inspect_nb*.py` | Ferramentas one-shot de inspeção de notebooks |
| `scripts/update_nb*.py` | Atualizações de notebooks — uso único descartável |
| `scripts/fix_nb2.py` | Patch de notebook one-shot — mesmo caso dos demais |
| `scripts/exemplo_agrupamento.py` | Arquivo de exemplo, não é pipeline |
| `sql/` | Não documentado; pipeline usa Parquet/CSV |
| `package.json` + `server.js` (raiz) | Servidor Express legado — substituído pelo FastAPI; remover junto com `node_modules/` |
| `node_modules/` (raiz) | Dependências do Express legado (já em `.gitignore`; remover localmente) |

### Arquivar (manter mas mover)

| Caminho | Destino |
|---|---|
| `docs/plans/` (planos de Mar 5) | `docs/archive/plans-2026-03-05/` |

### Preservar (ferramentas de trabalho ativo)

- `.agent/` — skills Claude Code para uso futuro
- `.superpowers/` — artefatos de brainstorming (sessões ativas)
- `kestra_flows/` — fluxos de orquestração planejados
- `logos/` — assets de marca (distribuidoras)
- `notebooks/` — exploração analítica (read-only, não pipeline)

### `.gitignore` — já cobre os casos necessários

- `node_modules/` — já no `.gitignore`
- `output/` — já no `.gitignore` (cobre `output/screenshots/` gerado pelo playwright)

Nenhuma alteração necessária no `.gitignore`.

### Atualizar documentação

Após limpeza, atualizar `CLAUDE.md` e `.ai/CONTEXT.md` para refletir o estado real das páginas e diretórios.

---

## Seção 2: Frontend Design System

### Inventário de páginas (pós-limpeza)

| Página | Status | Prioridade |
|---|---|---|
| `index.html` | Principal | Alta |
| `transgressoes.html` | Ativa | Alta |
| `benchmark.html` | Nova (Mar 11) | Alta |
| `evolucao.html` | Nova (Mar 11) | Alta |
| `ranking.html` | Nova (Mar 11) | Alta |
| `mapa.html` | Parcial (624 linhas, Leaflet) → completar | Alta |
| `relatorio.html` | Print-only (sem nav intencional) | Baixa |

### Integração dos módulos compartilhados

Todas as páginas (exceto `relatorio.html`) devem carregar na seguinte ordem:

```html
<script src="utils.js"></script>
<script src="nav.js"></script>
<script src="filters.js"></script>
<script src="app.js"></script>
<script src="[page].js"></script>
```

**Estado atual confirmado — ações necessárias:**
- `benchmark.html`, `evolucao.html`, `ranking.html`: ordem de scripts incorreta (`nav → filters → utils`) e `app.js` **ausente** — adicionar `app.js` e reordenar
- `index.html`, `transgressoes.html`: verificar se já seguem a ordem correta
- `benchmark.js`, `evolucao.js`: redefinem `Chart.defaults.font.family` e `Chart.defaults.color` inline — remover após adicionar `app.js`

**Verificar e corrigir em cada página:**
- `nav.js` inicializando sidebar + toast
- `utils.js` substituindo formatadores inline duplicados
- `filters.js` gerenciando estado global de período/porte/grupo

### Chart.js — versão e defaults centralizados

**Versão:** Todas as páginas devem carregar `chart.js@4.4.7/dist/chart.umd.min.js` (pinned).
- `index.html` já usa `@4.4.7` ✅
- `benchmark.html`, `evolucao.html`, `ranking.html` carregam sem versão (unpinned) — corrigir

**Defaults:** `app.js` define o tema Iberdrola globalmente. Após adicionar `app.js` nas páginas que faltam, remover qualquer redefinição inline de `Chart.defaults` nos scripts de página.

### CSS — consistência visual

Em `styles.css`, verificar e padronizar:
- **Cards:** um único padrão `.card` com variantes (não múltiplas definições por página)
- **Badges/chips de filtro:** classe única reutilizável
- **Estados de loading:** spinner/skeleton consistente
- **Tipografia:** hierarquia `h1/h2/h3` + `.kpi-value` uniforme em todas as páginas
- **Grid de KPIs:** `.kpi-grid` com breakpoints consistentes

### Mapa (`mapa.html`) — auditoria e completude

`mapa.js` já tem 624 linhas implementadas com Leaflet (circle markers, timeline playback, filtro por holding, troca de métrica). **Não é greenfield — é auditoria e completude.**

**Gaps a identificar e corrigir:**
- Verificar se integra com `nav.js` / `filters.js` (atualmente ausentes)
- Verificar se carrega `app.js` (atualmente ausente)
- Adicionar visão coroplética por estado/distribuidora (complementar ao mapa de círculos existente)
- Garantir que filtros de período se conectam ao estado global de `filters.js`
- Revisar tooltip e drill-down existentes; completar onde incompleto

---

## Seção 3: Playwright Setup

### Runtime: Node.js via `npx playwright`

O Playwright disponível nesta máquina é o Node/JS (`npx playwright` v1.58.2). Os scripts serão arquivos `.js` executados com `node`, não Python.

### Estrutura de arquivos

```
scripts/playwright/
├── screenshot-all.js      # screenshot de todas as páginas do dashboard
├── check-charts.js        # verifica erros de console JS e renderização
└── aneel-fetch.js         # acesso ao portal ANEEL para dados novos (quando necessário)
```

### `screenshot-all.js`

- Assume servidor rodando em `localhost:8050` (rodar `make serve` antes)
- Navega para cada página HTML listada
- Salva screenshots em `output/screenshots/YYYY-MM-DD-HHMMSS/`
- Nomeia arquivos por página: `index.png`, `transgressoes.png`, etc.

### `check-charts.js`

- Navega para cada página
- Captura erros de console JS
- Verifica se canvas dos charts estão presentes no DOM
- Imprime relatório: `✅ benchmark.html — 2 charts OK` / `❌ mapa.html — 1 console error`

### `aneel-fetch.js`

- Navega em `dadosabertos.aneel.gov.br`
- Localiza e baixa CSVs específicos quando pipeline de ETL precisar de atualização
- Parametrizado por indicador e ano via argv

### Makefile targets

```makefile
screenshots:    ## Tirar screenshots de todas as páginas
    node scripts/playwright/screenshot-all.js

check-visual:   ## Screenshots + relatório de erros de console
    node scripts/playwright/check-charts.js
```

---

## Ordem de Implementação

1. **Limpeza do repo** — remover arquivos mortos, arquivar `docs/plans/`, remover Express legado
2. **Chart.js audit** — adicionar `app.js` em benchmark/evolucao/ranking, pin versão `@4.4.7`, remover redefinições inline
3. **Auditoria de scripts** — corrigir ordem de carregamento em todas as páginas, integrar nav/utils/filters
4. **CSS pass** — padronizar cards, badges, grid, tipografia em `styles.css`
5. **Playwright setup** — `screenshot-all.js` e `check-charts.js` rodando contra `localhost:8050`
6. **Mapa** — auditar `mapa.js` existente, integrar nav/filters, completar gaps, adicionar coroplético
7. **Documentação** — atualizar CLAUDE.md e `.ai/CONTEXT.md`

---

## Verificação (Definition of Done)

- [ ] `node scripts/playwright/check-charts.js` roda sem erros em todas as 6 páginas ativas
- [ ] Screenshots de todas as 6 páginas geradas em `output/screenshots/`
- [ ] Todas as páginas carregam `app.js` e seguem a ordem `utils → nav → filters → app → [page]`
- [ ] Chart.js `@4.4.7` pinado em todas as páginas
- [ ] `utils.js` é o único lugar de formatadores `fmtNum`/`fmtMoney` (sem duplicações inline)
- [ ] `mapa.html` integra `nav.js` + `filters.js` e exibe dados reais
- [ ] Repo sem arquivos mortos listados na Seção 1
- [ ] CLAUDE.md atualizado com lista de páginas e estrutura atual
