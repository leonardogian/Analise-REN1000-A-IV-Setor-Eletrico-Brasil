# Diretrizes Principais para IA (Contexto e Escopo Atual)

> **⚠️ ATENÇÃO IAs:** Antes de atuar, leia sempre `CLAUDE.md` (comandos, arquitetura, constraints) e os arquivos em `.ai/` (especialmente `CONTEXT.md` e `CONVENTIONS.md`). Para detalhes do frontend oficial, consulte `app/frontend-next/README.md`.

## 🎯 Momento Atual do Projeto

- **Dados consolidados:** A etapa de limpeza (ETL), extração e validação básica dos dados está concluída e sua estrutura é confiável.
- **Foco de atuação:** O desenvolvimento técnico centrará as forças no **Front-End oficial Next.js/React** (`app/frontend-next/`, projeto Vercel `tcc-frontend-react`) suportado pelas APIs no **Back-End** (FastAPI/Railway). O dashboard Vanilla ficou legado na branch `legacy/vanilla-dashboard`.
- **Mindset:** Priorize implementar soluções lógicas para o backend servir os dados prontos ao frontend interativo. Pense em JSON, REST APIs e renderização de dados na tela do cliente.

## 🔄 Rotina Obrigatória de Inicialização (Para IAs)

Sempre que iniciar uma nova interação ou tarefa neste repositório, você DEVE priorizar a seguinte rotina de contextualização:

1. **Analise os Commits Recentes:** Execute `git log -n 5 --stat` e `git status` para entender as últimas mudanças.
2. **Leia os Arquivos Relacionados:** Leia os arquivos recém-modificados e arquivos chaves para o domínio do problema. Faça isso expandindo o contexto lendo os arquivos em blocos/lotes (de certa em certa quantidade) para não se perder.
3. **Mantenha o Contexto Atualizado:** Ao concluir mudanças, sempre atualize os arquivos de contexto relevantes com o status mais recente — veja a lista canônica em `CLAUDE.md` seção "Context Files for AI Agents". No mínimo: `README.md`, `AGENTS.md`, `CLAUDE.md` e `.ai/CONTEXT.md`. Para mudanças no frontend oficial, atualize também `app/frontend-next/README.md`.

## 🛑 Escopo Estrito e Limites de Domínio (MUITO IMPORTANTE)

- **O domínio exclusivo do projeto é a regulação distribuidora de energia da ANEEL (REN 1000/2021).**
- O projeto foca em transgressões regulatórias (prazos de serviços, UCs ativas) e suas respectivas **compensações financeiras pagas na fatura dos consumidores**.
- **Infraestrutura e Build Vercel:** O build estático do Frontend para o Vercel depende de NÃO existirem arquivos ou diretórios python soltos (ex: arquivos falsos como `/api/index.py`) na pasta global que gerem conflitos Serverless indesejados no build autônomo do Vercel. **Todo o código backend (FastAPI) reside exclusivamente em `app/backend/`.**

## 💾 Acesso aos Dados Importantes & Portas Padrão

- **Localização dos Dados Prontos:** Os CSVs validados pós-ETL/processamento estão em `data/processed/analysis/`; os JSONs canônicos do dashboard ficam em `data/processed/dashboard/`. Ambos podem estar versionados para auditoria/demo, mas o usuário externo deve regenerar tudo com `make pipeline` para reprodução científica.
- **Mensalidade INDGER:** A linha de base metodológica continua sendo `2023-01` a `2025-12`, mas o pipeline aceita meses posteriores quando a ANEEL publica novos CSVs mensais contíguos (ex.: 2026-01+). O mês de `indger_servicos_comerciais` é derivado de `_source_file`; em `indger_dados_comerciais`, datas `YYYY-01-DD` usam o dia `1..12` como mês codificado quando aplicável. `make validate-contracts-processed`, `make check-artifacts-full` e `make qa-data` protegem a base 2023–2025 sem quebrar por safra futura.
- **Extração e Tratamento (fontes brutas):** Toda documentação canônica de "como baixar os dados do zero", URLs CKAN, periodicidade, limitações e troubleshooting mora em [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md). Antes de mexer em `src/etl/`, leia esse doc. Para checar/adicionar fonte nova: atualizar `CATALOGO` em `extract_aneel.py` (ou criar novo `extract_<portal>.py`) e refletir no doc.
- **Interface Web:** O frontend oficial consome `/api/*` e `/dashboard_*.json` via rewrites Next.js → Railway. A fonte canônica dos JSONs é `data/processed/dashboard/dashboard_*.json`, gerada por scripts em `src/analysis/`; endpoints `/api/v2/*` podem usar PostgreSQL para filtros server-side quando as tabelas analíticas estiverem carregadas.
- **Backend Railway degradável:** O backend FastAPI deve iniciar e servir os JSONs canônicos mesmo quando PostgreSQL ou Redis estiverem indisponíveis. `/health` expõe `dashboard_artifacts_ready`, `database_connected` e `redis_connected`; não trate falha isolada de Postgres/Redis como motivo para quebrar o site público se os JSONs existem. A primeira rota Postgres-backed é `/api/v2/timeseries-tendencia`, com fallback automático para `dashboard_timeseries.json`.
- **CSP e deploy oficial:** Em `app/frontend-next/vercel.json`, mantenha `script-src 'unsafe-inline'` para permitir o boot/hydration do Next.js App Router na Vercel. Ao mudar `app/backend/main.py` ou `data/processed/dashboard/dashboard_*.json`, redeploye também o Railway para evitar produção com endpoints/JSONs antigos.
- **Mapa visual da metodologia:** `docs/metodologia_tcc.excalidraw` resume para banca o fluxo real do TCC: pergunta regulatória, fontes ANEEL/IBGE, ETL, análise, validação, API/dashboard e interpretação.
- **Fluxogramas do Capítulo 3:** `docs/Fluxogramas_v2/` é o pacote visual atual para leitura acadêmica/GitHub, com Mermaid canônico, SVGs renderizados e a prancha editável `exports/excalidraw/fluxogramas_capitulo_3.excalidraw`.
- **Fluxograma do pipeline Make:** `docs/mtdpipeline.excalidraw` documenta, em linguagem metodológica, o que cada target (`make pipeline`, `make validate-contracts`, `make qa-data`, etc.) executa e qual artefato/riscos controla.
- **Apresentação do TCC (.pptx):** O script gerador foi removido. Apresentações devem ser criadas manualmente ou exportadas do Canva/Google Slides.
- **Logos das Holdings:** Manter os logos em `logos/` (raiz) e espelhar nos assets usados pelos frontends com nomes padronizados (`neoenergia.png`, `cpfl.png`, `equatorial.png`, etc.).
- **Porta Padronizada:** Desenvolvimento local e via Docker usam a **porta `8051`** (`http://localhost:8051/`). Não usar porta 8000 ou outras para o dashboard.
- **Frontend Next local:** quando precisar comparar com o frontend React em `app/frontend-next/`, use a **porta `3051`** (`http://localhost:3051/`) para evitar conflito com a 3000, que ja esta ocupada nesta maquina.
- **Devcontainer VS Code:** `.devcontainer/devcontainer.json` usa Debian Bookworm (`mcr.microsoft.com/devcontainers/python:3.12-bookworm`), Node 20 e Docker-in-Docker. A `.venv` do container fica no volume nomeado `tcc-ren1000-devcontainer-venv`, isolada da `.venv` do host.
- **Contexto de IA ativo:** mantenha contexto vivo em `.ai/`, `AGENTS.md`, `CLAUDE.md` e `.github/agents/`. Planos/specs antigos de agentes e fluxos Kestra obsoletos não devem voltar como documentação operacional sem decisão explícita.

---

## Regras de Espera e Monitoramento de Tempo

Estas regras valem para qualquer execucao bloqueante (comando/app) quando nao for possivel avancar em outra tarefa no mesmo momento.

## 1) Antes de iniciar

- Sempre informar uma estimativa de tempo em faixa:
  - meio otimista
  - provavel
  - limite de paciencia
- Sempre oferecer opcoes de escolha ao usuario antes de iniciar espera longa:
  - opcao A: executar agora e aguardar
  - opcao B: executar com limite de tempo e parar automaticamente
  - opcao C: nao executar agora
- Informar o criterio de decisao:
  - quando continuar
  - quando sugerir parar
- Informar o que sera monitorado para detectar progresso real:
  - CPU/tempo de processo
  - crescimento de logs
  - atualizacao de artefatos/arquivos de saida

## 2) Durante a execucao

- Publicar checkpoint periodico com:
  - tempo decorrido
  - etapa atual
  - comparacao com estimativa
  - sinais de progresso (ou ausencia)
- Se ultrapassar o tempo provavel, dar recomendacao explicita:
  - `continuar` por mais X minutos, com motivo
  - ou `parar agora`, com motivo

## 3) Regra de decisao (continuar vs parar)

- Continuar quando houver progresso objetivo:
  - tempo de CPU subindo
  - logs/arquivos atualizando
  - sem erro recorrente
- Sugerir parar quando houver sinais de baixa probabilidade de termino util:
  - sem progresso observavel por janela relevante
  - repeticao de erro
  - degradacao forte de recursos (swap alta, thrashing)
- Se estiver em zona cinzenta, apresentar as duas opcoes com impacto esperado e recomendacao principal.

## 3.1) Delegacao para agentes menores

- Para tarefas longas, oferecer delegacao para agente menor antes de bloquear a conversa.
- Prioridade:
  - 1) agente interno menor (worker/explorer) quando disponivel
  - 1) execucao local direta com checkpoints quando delegacao nao for adequada
- Se o usuario pedir provedor externo (ex.: Google Flash), informar claramente:
  - dependencias necessarias (API key, SDK, script de integracao)
  - se o ambiente atual suporta ou nao essa integracao
  - alternativa imediata com agentes internos
- Em delegacao, sempre esperar resultado do agente e retornar resumo + evidencias objetivas.

## 4) Formato padrao de recomendacao

- "Estimativa inicial: X-Y min (limite Z min)."
- "Agora: N min, etapa E, progresso P."
- "Recomendacao: continuar/parar."
- "Motivo: ..."
- "Se continuar: proximo checkpoint em T min; criterio de corte: ..."

## 5) Encerramento

- Ao finalizar, reportar:
  - tempo total
  - gargalo principal
  - ajuste sugerido para melhorar a proxima estimativa


<claude-mem-context>
# Memory Context

# [TCC_leo_main] recent context, 2026-04-30 12:32pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,876t read) | 1,825,881t work | 99% savings

### Apr 23, 2026
S23 TCC ANEEL Full Code Audit — Senior Data Engineer review of ETL pipeline, redundancies, data integrity, and dashboard optimization across the entire codebase (Apr 23, 5:09 PM)
S11 User Inquired About ODT File Manipulation Support (Apr 23, 5:09 PM)
### Apr 27, 2026
S36 settings.local.json Permissions Cleaned — 154 Lines Reduced to 49 (Apr 27, 4:33 PM)
### Apr 28, 2026
68 1:03p 🔵 Claude Context Overload — MCP Plugins and Deferred Tools Burning Tokens
69 " 🔵 Claude Context Bloat Identified — MCP Plugins and Deferred Tools Consuming Tokens
70 1:06p ⚖️ Context Pollution Audit — MCP Plugins and Token Waste
71 1:14p 🔵 Claude Context Bloat Identified — MCPs and Deferred Tools Burning Tokens
72 " ✅ settings.local.json Permissions Cleaned — 154 Lines Reduced to 49
73 " 🚨 Discord Bot Token Hardcoded in settings.local.json Permission Entries
S37 codex:setup — Verify Codex CLI readiness and display setup status (Apr 28, 1:14 PM)
74 1:17p ⚖️ TCC Frontend Strategy: tcc-frontend-react as Primary, analise-ren-1000 as Legacy
75 " 🔵 Dual Vercel Project Structure Confirmed: Legacy Root vs New app/frontend-next
76 " 🔵 Vercel MCP Tool Returns 403 for Both Project IDs
77 " 🔵 tcc-frontend-react Next.js Config: Railway Rewrites Already Wired
78 1:18p 🔵 tcc-frontend-react Live on Vercel but Serving Stale March 2026 Data
79 " 🔵 Vercel MCP OAuth Authenticated to Wrong Scope — No Team Access
80 " 🔵 Backend /api/v1/groups-ranking Returns 404 via Railway
81 2:09p 🔴 CSP Hotfix Deployed to Vercel — Next.js Hydration Restored
82 " 🔵 Vercel CLI Deploy Workaround — Subdirectory Root Path Bug
83 " 🔵 Railway Backend Serving Stale Data — API Endpoints Missing
84 " 🔴 Vanilla Frontend Accidental Redeploy Rolled Back
85 7:18p 🔵 TCC ANEEL — Estado Atual do Repositório (git log)
86 " 🔵 Fase 1 (ff96e90) — Correções Críticas de Integridade de Dados nos Cards do Dashboard
87 " 🔵 Fase 2 (c7f7347) — Novas Métricas e Colunas no dashboard_data.json
88 7:19p 🔵 Root Cause dos Cards Errados — kpi_regulatorio_anual.csv vai até 2023 com Dados Incompletos
89 " 🔵 Frontend Next.js NÃO Tem Acesso Direto aos JSONs — Lê via FastAPI /api/dashboard/*
90 " 🔵 KPICard Interface — Componente Apresentacional Puro, Lógica de Cálculo em page.tsx
91 7:20p 🔵 Diagnóstico Completo dos 6 Cards de KPI — Raízes dos Bugs Confirmadas
92 " 🔵 dashboard_data.json Gerado em 28/Abr 18:52 — serie_anual e kpi_overview Não Incluem 2024/2025
93 " 🔵 Subagente Exploratório Confirma: Frontend Não Adaptado às Fases 1 e 2
94 7:21p 🔵 Validação Completa dos KPIs — Números Corretos e Incorretos Mapeados
95 " 🔵 Localização Exata das Linhas do Bug em page.tsx — Pronto Para Correção
96 7:22p 🔵 kpi_overview JSON Não Tem Campo delta_compensacao_pct — Frontend Sempre Cai no Fallback Bugado
97 " 🔵 Codex CLI Setup Status Verified — Ready
S38 codex:rescue/review attempted — git working tree is clean, nothing to review (Apr 28, 7:22 PM)
S39 Diagnose and fix incorrect KPI cards on TCC ANEEL dashboard home page — wrong REN1000 period window and misleading −73% compensation delta (Apr 28, 7:24 PM)
98 7:27p ⚖️ Plano de correção dos cards KPI do dashboard — cutoff REN1000 e métricas anualizadas
99 " 🔵 KPI Cards Showing Incorrect REN1000 Period Comparison Due to Wrong Cutoff Year
100 " ⚖️ Decided to Set REN1000 Cutoff to 2022 and Use Annualized Compensation Delta for KPI Cards
S51 Update docs/metodologia_tcc.excalidraw to be more academic, explanatory, and visually polished for TCC defense panel — using Codex as aid (Apr 28, 7:51 PM)
101 7:55p 🟣 TCC ANEEL Fase 2 — Demarcação Regulatória, Robustez e Normalização Temporal
102 " 🔵 Dois docs não-commitados definem próximos passos de implementação
103 " 🔵 KPI Cards do Dashboard Mostram Δ Compensações −73% Incorreto por Cutoff Errado
104 " ⚖️ Plano de Fix em 8 Passos para Cards KPI com Cutoff 2022 e Métrica Anualizada
### Apr 30, 2026
S50 Codex CLI setup check via /codex:setup skill (Apr 30, 10:36 AM)
130 10:41a 🔵 TCC Methodology Diagram Structure Mapped
131 " ⚖️ Academic TCC Diagram Expansion Plan Defined
132 " ⚖️ TCC Diagram Expansion Plan Approved — Execution Phase Started
133 " 🔵 Codex CLI exec Interface Confirmed for Non-Interactive Academic Text Generation
135 10:45a 🟣 Codex Generated Academic Texts for TCC Diagram Slots 1–10
136 10:47a 🟣 Codex Generated Academic Texts for Diagram Slots 11–30 (ETL, Analytics, Audit blocks)
137 10:49a 🟣 Codex Generated Academic Texts for Diagram Slots 31–50 (Product, Result, Timeline, Variables)
134 10:50a 🟣 TCC Excalidraw Diagram Academic Texts Generated
138 " 🔵 Codex Batch 4 Returned Empty Output — Slots 51–76 Not Generated
139 10:51a 🔵 Codex Batch 4 Succeeded on Retry — grep Extraction Was the Failure Point
140 11:01a 🔵 TCC REN 1.000/2021 — Metodologia Submetida à Banca Simulada
141 11:02a 🔵 TCC_leo_main — Estado Atual do Projeto e Histórico Recente de Commits
142 11:03a 🔵 docs/metodologia_tcc.excalidraw — Fluxograma Metodológico Completo para Banca

Access 1826k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
