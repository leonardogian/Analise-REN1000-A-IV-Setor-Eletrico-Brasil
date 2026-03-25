# Remoção Features AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover completamente as features de chat IA do dashboard (transgressoes + mapa), limpar CSS orphan e configs Kestra/Gemini do repo, e ajustar espaço visual onde os painéis foram removidos.

**Architecture:** Remoção cirúrgica — excluir blocos HTML dos painéis, funções JS `initAI()`/`initAIMap()` e seus event listeners, bloco CSS `.chat-*`, variáveis Gemini no docker/kestra e referência no README. Ajuste de layout no grid 2-colunas das páginas afetadas. Branch + testes Playwright antes do merge.

**Tech Stack:** Vanilla JS, HTML5, CSS puro, Chart.js, FastAPI (backend não tem o endpoint — apenas frontend e configs de infra são afetados), Playwright (tcc-qa skill)

---

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `app/frontend/transgressoes.html` | Remover bloco HTML painel IA + ajustar grid |
| `app/frontend/transgressoes.js` | Remover `btnGenerateAi`/`aiInsightContainer` do `UI` + função `initAI()` + sua chamada |
| `app/frontend/mapa.html` | Remover bloco HTML painel IA + ajustar grid |
| `app/frontend/mapa.js` | Remover função `initAIMap()` + sua chamada |
| `app/frontend/styles.css` | Remover bloco `.chat-*` (linhas 1397–1539) |
| `docker/docker-compose.kestra.yml` | Remover 4 vars `GEMINI`/`KESTRA_AI_*` |
| `docker/application.yml` | Remover bloco `ai:` (linhas 3–6) |
| `.env.example` | Remover linha `GEMINI_API_KEY` |
| `README.md` | Remover nota sobre GEMINI_API_KEY + Kestra AI (linha 173) |

---

## Task 1: Criar branch de trabalho

**Files:**
- N/A (git)

- [ ] **Step 1: Criar e mudar para branch**
```bash
git checkout -b chore/remove-ai-chat
```

- [ ] **Step 2: Confirmar branch atual**
```bash
git branch --show-current
```
Expected: `chore/remove-ai-chat`

---

## Task 2: Remover painel IA de `transgressoes.html` + ajustar layout

**Files:**
- Modify: `app/frontend/transgressoes.html`

O painel IA ocupa o segundo card do grid `display:grid;grid-template-columns:1fr 1fr` junto com "Insights de Mercado". Após remover, transformar o grid em coluna única para o card de Insights ocupar toda a largura.

- [ ] **Step 1: Localizar o bloco a remover**

No arquivo `app/frontend/transgressoes.html`, localizar o div externo:
```html
<!-- Insights -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;">
    <div class="chart-card">          ← manter (Insights de Mercado)
        ...
    </div>
    <div class="chart-card" style="border-top:2px solid var(--orange);">  ← REMOVER
        <h3 class="chart-title"><span>✨</span> Análise Guiada por IA</h3>
        <textarea id="ai-custom-prompt" ...></textarea>
        <button id="btn-generate-ai" ...>Gerar Análise IA</button>
        <div id="ai-insight-container" ...></div>
    </div>
</div>
```

- [ ] **Step 2: Editar o arquivo**

Substituir **apenas o div wrapper** (trocar grid por div simples) e deletar o segundo card. O primeiro card deve ser preservado verbatim:
```html
<!-- Insights -->
<div style="margin-top:24px;">
    <div class="chart-card">
        <h3 class="chart-title"><span>🔍</span> Insights de Mercado</h3>
        <div id="insight-container" style="font-size:12px;color:var(--text-secondary);">
            Carregando análises preditivas...
        </div>
    </div>
</div>
```
(O conteúdo interno do primeiro card é exatamente igual ao original — apenas o wrapper `display:grid` foi removido e o segundo card foi deletado.)

- [ ] **Step 3: Verificar sem erros de HTML**
```bash
grep -n "ai-custom-prompt\|btn-generate-ai\|ai-insight-container\|Análise Guiada por IA" app/frontend/transgressoes.html
```
Expected: nenhum resultado (saída vazia)

---

## Task 3: Remover código IA de `transgressoes.js`

**Files:**
- Modify: `app/frontend/transgressoes.js`

- [ ] **Step 1: Remover referências no objeto `UI`**

Localizar no objeto `UI` (em torno da linha 36-37):
```js
        btnGenerateAi: document.getElementById('btn-generate-ai'),
        aiInsightContainer: document.getElementById('ai-insight-container')
```
Deletar essas duas linhas. Atenção: a linha anterior (`inflectionMonth`) terminará com vírgula — remover a vírgula trailing também se necessário.

- [ ] **Step 2: Remover chamada `initAI()`**

Localizar em torno da linha 56:
```js
        initAI();
```
Deletar essa linha.

- [ ] **Step 3: Remover a função `initAI()` inteira**

Localizar o bloco (linhas ~436–533):
```js
    // --- Funções de IA ---
    function initAI() {
        ...
    }
```
Deletar tudo desde o comentário `// --- Funções de IA ---` até o `}` de fechamento da função (inclusive).

- [ ] **Step 4: Verificar ausência de referências**
```bash
grep -n "initAI\|btnGenerateAi\|aiInsightContainer\|ai-insights\|btn-generate-ai" app/frontend/transgressoes.js
```
Expected: nenhum resultado

---

## Task 4: Remover painel IA de `mapa.html` + ajustar layout

**Files:**
- Modify: `app/frontend/mapa.html`

O painel IA ocupa o segundo card do grid ao lado de "Guia do Mapa". Após remover, o card "Guia do Mapa" deve ocupar largura total.

- [ ] **Step 1: Localizar o bloco**

Em `app/frontend/mapa.html` localizar:
```html
<!-- INSIGHTS -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;">
    <div class="chart-card" style="border-top:2px solid var(--green);">  ← manter (Guia do Mapa)
        ...
    </div>
    <div class="chart-card" style="border-top:2px solid var(--orange);">  ← REMOVER
        <h3 class="chart-title"><span>✨</span> Análise IA do Mapa</h3>
        <textarea id="ai-custom-prompt" ...></textarea>
        <button id="btn-generate-ai" ...>Gerar Análise IA</button>
        <div id="ai-insight-container" ...></div>
    </div>
</div>
```

- [ ] **Step 2: Editar o arquivo**

Substituir por versão sem grid e sem segundo card:
```html
<!-- INSIGHTS -->
<div style="margin-top:24px;">
    <div class="chart-card" style="border-top:2px solid var(--green);">
        <h3 class="chart-title"><span>🧭</span> Guia do Mapa</h3>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;">
            <p><strong>Tamanho:</strong> Proporcional à métrica selecionada.</p>
            <p><strong>Cores:</strong> Representam os grupos econômicos.</p>
            <p><strong>Interação:</strong> Passe o mouse para ver os valores.</p>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Verificar**
```bash
grep -n "ai-custom-prompt\|btn-generate-ai\|ai-insight-container\|Análise IA do Mapa" app/frontend/mapa.html
```
Expected: nenhum resultado

---

## Task 5: Remover código IA de `mapa.js`

**Files:**
- Modify: `app/frontend/mapa.js`

- [ ] **Step 1: Remover chamada `initAIMap()`**

Localizar em torno da linha 131:
```js
        initAIMap();
```
Deletar essa linha.

- [ ] **Step 2: Remover a função `initAIMap()` inteira**

Localizar o bloco (linhas ~606–705):
```js
    // --- Funções de IA ---
    function initAIMap() {
        ...
    }
```
Deletar tudo desde o comentário até o `}` de fechamento (inclusive).

- [ ] **Step 3: Verificar**
```bash
grep -n "initAIMap\|ai-insights\|btn-generate-ai\|ai-insight-container\|ai-custom-prompt" app/frontend/mapa.js
```
Expected: nenhum resultado

---

## Task 6: Remover bloco CSS `.chat-*` de `styles.css`

**Files:**
- Modify: `app/frontend/styles.css`

- [ ] **Step 1: Localizar o bloco**

Em `styles.css`, o bloco vai da linha 1397 à 1539:
```css
/* ==================== CHAT (prompt.html) ==================== */
.chat-container { ... }
...
.chat-send-btn:hover { ... }
```
A próxima seção após o bloco é `/* ==================== SCROLLBAR ==================== */`.

- [ ] **Step 2: Deletar o bloco inteiro**

Remover desde `/* ==================== CHAT (prompt.html) ==================== */` até (e incluindo) `.chat-send-btn:hover { background: #00a84d; }` — o bloco antes de `/* ==================== SCROLLBAR ==================== */`.

- [ ] **Step 3: Verificar**
```bash
grep -n "\.chat-\|chat-container\|chat-input\|chat-send" app/frontend/styles.css
```
Expected: nenhum resultado

---

## Task 7: Limpar configs Kestra/Gemini no docker

**Files:**
- Modify: `docker/docker-compose.kestra.yml`
- Modify: `docker/application.yml`

- [ ] **Step 1: Remover vars Gemini do docker-compose.kestra.yml**

Localizar e remover as 4 linhas:
```yaml
      SECRET_GEMINI_API_KEY: "${GEMINI_API_KEY}"
      KESTRA_AI_TYPE: "gemini"
      KESTRA_AI_GEMINI_API_KEY: "${GEMINI_API_KEY}"
      KESTRA_AI_GEMINI_MODEL_NAME: "gemini-2.5-flash"
```

- [ ] **Step 2: Deletar conteúdo completo de application.yml**

O arquivo `docker/application.yml` contém apenas o bloco de configuração Gemini do Kestra (7 linhas, sem nenhuma outra config). Deletar o arquivo inteiro:
```bash
rm docker/application.yml
```
E criar um arquivo vazio placeholder (para não quebrar mounts docker que referenciem ele):
```bash
echo "# Kestra application config (AI config removed)" > docker/application.yml
```

- [ ] **Step 3: Verificar**
```bash
grep -n "gemini\|GEMINI\|KESTRA_AI" docker/docker-compose.kestra.yml docker/application.yml
```
Expected: nenhum resultado

---

## Task 8: Limpar `.env.example` e `README.md`

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Remover linha do .env.example**

O arquivo tem 4 linhas — remover apenas a primeira:
```
GEMINI_API_KEY=sua_chave_aqui   ← deletar apenas esta linha
HOST_PORT=8051                  ← manter
SERVE_STATIC=true               ← manter
RAILWAY_PUBLIC_URL=https://...  ← manter
```

- [ ] **Step 2: Remover nota do README.md**

Localizar e remover a linha 173:
```
> **Nota**: Para que os fluxos com IA funcionem, inclua `GEMINI_API_KEY` em seu arquivo `.env`, o qual é lido pelo Kestra via `.env` map no compose e injetado nos containers de plugin do Kestra.
```

- [ ] **Step 3: Verificar**
```bash
grep -n "GEMINI\|gemini" .env.example README.md
```
Expected: nenhum resultado

---

## Task 9: Commit das mudanças

- [ ] **Step 1: Verificar arquivos modificados**
```bash
git status
git diff --stat
```

- [ ] **Step 2: Commit**
```bash
git add app/frontend/transgressoes.html app/frontend/transgressoes.js \
        app/frontend/mapa.html app/frontend/mapa.js \
        app/frontend/styles.css \
        docker/docker-compose.kestra.yml docker/application.yml \
        .env.example README.md
git commit -m "chore: remover features de chat IA e configs Gemini/Kestra"
```

---

## Task 10: Teste visual com Playwright (tcc-qa skill)

**Files:**
- N/A (testes de browser)

Usar a skill `tcc-qa` para validar que:
1. As páginas `transgressoes` e `mapa` renderizam sem erros de console
2. Os charts carregam normalmente
3. Nenhum elemento com id `btn-generate-ai` ou `ai-insight-container` existe no DOM
4. O layout ficou correto (cards de insights ocupam largura total)

- [ ] **Step 1: Subir o backend local**
```bash
make backend &
```
Aguardar `Application startup complete` nos logs.

- [ ] **Step 2: Invocar skill tcc-qa**

Usar a skill `tcc-qa` para tirar screenshots de:
- `http://localhost:8051/transgressoes.html`
- `http://localhost:8051/mapa.html`

E verificar erros de console em ambas.

- [ ] **Step 3: Confirmar ausência de elementos IA no DOM**

Via Playwright, verificar:
```js
// Deve retornar null (não existe mais no DOM)
document.getElementById('btn-generate-ai')
document.getElementById('ai-insight-container')
```

- [ ] **Step 4: Se todos os testes passarem, fazer merge para main**
```bash
git checkout main
git merge chore/remove-ai-chat
git push origin main
git branch -d chore/remove-ai-chat
```
