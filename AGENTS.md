# Diretrizes Principais para IA (Contexto e Escopo Atual)

> **⚠️ ATENÇÃO IAs:** Antes de atuar, leia sempre `CLAUDE.md` (comandos, arquitetura, constraints) e os arquivos em `.ai/` (especialmente `CONTEXT.md` e `CONVENTIONS.md`). Para detalhes do frontend, consulte `app/frontend/README.md`.

## 🎯 Momento Atual do Projeto

- **Dados consolidados:** A etapa de limpeza (ETL), extração e validação básica dos dados está concluída e sua estrutura é confiável.
- **Foco de atuação:** O desenvolvimento técnico centrará as forças no **Front-End oficial Next.js/React** (`app/frontend-next/`, projeto Vercel `tcc-frontend-react`) suportado pelas APIs no **Back-End** (FastAPI/Railway). O dashboard Vanilla em `app/frontend/` é legado.
- **Mindset:** Priorize implementar soluções lógicas para o backend servir os dados prontos ao frontend interativo. Pense em JSON, REST APIs e renderização de dados na tela do cliente.

## 🔄 Rotina Obrigatória de Inicialização (Para IAs)

Sempre que iniciar uma nova interação ou tarefa neste repositório, você DEVE priorizar a seguinte rotina de contextualização:

1. **Analise os Commits Recentes:** Execute `git log -n 5 --stat` e `git status` para entender as últimas mudanças.
2. **Leia os Arquivos Relacionados:** Leia os arquivos recém-modificados e arquivos chaves para o domínio do problema. Faça isso expandindo o contexto lendo os arquivos em blocos/lotes (de certa em certa quantidade) para não se perder.
3. **Mantenha o Contexto Atualizado:** Ao concluir mudanças, sempre atualize os arquivos de contexto relevantes com o status mais recente — veja a lista canônica em `CLAUDE.md` seção "Context Files for AI Agents". No mínimo: `README.md`, `AGENTS.md`, `CLAUDE.md` e `.ai/CONTEXT.md`. Para mudanças no frontend oficial, atualize também `app/frontend-next/README.md`; para legado Vanilla, atualize `app/frontend/README.md`.

## 🛑 Escopo Estrito e Limites de Domínio (MUITO IMPORTANTE)

- **O domínio exclusivo do projeto é a regulação distribuidora de energia da ANEEL (REN 1000/2021).**
- O projeto foca em transgressões regulatórias (prazos de serviços, UCs ativas) e suas respectivas **compensações financeiras pagas na fatura dos consumidores**.
- **Infraestrutura e Build Vercel:** O build estático do Frontend para o Vercel depende de NÃO existirem arquivos ou diretórios python soltos (ex: arquivos falsos como `/api/index.py`) na pasta global que gerem conflitos Serverless indesejados no build autônomo do Vercel. **Todo o código backend (FastAPI) reside exclusivamente em `app/backend/`.**

## 💾 Acesso aos Dados Importantes & Portas Padrão

- **Localização dos Dados Prontos:** Os CSVs validados pós-ETL/processamento estão em `data/processed/analysis/`; os JSONs canônicos do dashboard ficam em `data/processed/dashboard/`. Ambos podem estar versionados para auditoria/demo, mas o usuário externo deve regenerar tudo com `make pipeline` para reprodução científica.
- **Extração e Tratamento (fontes brutas):** Toda documentação canônica de "como baixar os dados do zero", URLs CKAN, periodicidade, limitações e troubleshooting mora em [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md). Antes de mexer em `src/etl/`, leia esse doc. Para checar/adicionar fonte nova: atualizar `CATALOGO` em `extract_aneel.py` (ou criar novo `extract_<portal>.py`) e refletir no doc.
- **Interface Web:** O frontend oficial consome `/api/*` e `/dashboard_*.json` via rewrites Next.js → Railway. A fonte canônica dos JSONs é `data/processed/dashboard/dashboard_*.json`, gerada por scripts em `src/analysis/`; cópias em `app/frontend/` são apenas espelho local legado.
- **CSP e deploy oficial:** Em `app/frontend-next/vercel.json`, mantenha `script-src 'unsafe-inline'` para permitir o boot/hydration do Next.js App Router na Vercel. Ao mudar `app/backend/main.py` ou `data/processed/dashboard/dashboard_*.json`, redeploye também o Railway para evitar produção com endpoints/JSONs antigos.
- **Apresentação do TCC (.pptx):** O script gerador foi removido. Apresentações devem ser criadas manualmente ou exportadas do Canva/Google Slides.
- **Logos das Holdings:** Manter os logos em `logos/` (raiz) e espelhar nos assets usados pelos frontends com nomes padronizados (`neoenergia.png`, `cpfl.png`, `equatorial.png`, etc.).
- **Porta Padronizada:** Desenvolvimento local e via Docker usam a **porta `8051`** (`http://localhost:8051/`). Não usar porta 8000 ou outras para o dashboard.
- **Frontend Next local:** quando precisar comparar com o frontend React em `app/frontend-next/`, use a **porta `3051`** (`http://localhost:3051/`) para evitar conflito com a 3000, que ja esta ocupada nesta maquina.

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

# [TCC_leo_main] recent context, 2026-04-28 3:00pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (25,731t read) | 1,573,607t work | 98% savings

### Apr 23, 2026
S23 TCC ANEEL Full Code Audit — Senior Data Engineer review of ETL pipeline, redundancies, data integrity, and dashboard optimization across the entire codebase (Apr 23, 5:09 PM)
S11 User Inquired About ODT File Manipulation Support (Apr 23, 5:09 PM)
23 6:07p 🔵 TCC ANEEL Data Layer Mapped: Star Schema CSVs + 5 Analysis Notebooks in Worktree
### Apr 27, 2026
25 4:15p ⚖️ TCC ANEEL — Full Data Pipeline Audit Scope Defined
26 " 🔵 TCC ANEEL Analysis Pipeline Structure: ETL Architecture and Data Integrity Patterns
27 " 🔵 Code Redundancy: Duplicate Column Normalization Logic Across Modules
28 " 🔵 Data Quality Risk: Pre/Post REN Comparison Uses Aggregated Rates Without Distributor-Level Validation
29 " 🔵 Data Integrity Gap: Missing Validation for Zero-Division and NaN Propagation in Metric Calculations
30 4:16p 🔵 QA Infrastructure and Validation Framework Established
31 4:18p 🔵 TCC ANEEL — Senior Data Engineer Audit Request Scoped Across ETL Pipeline
32 4:19p ⚖️ TCC ANEEL — Senior Data Engineer Audit Scope Defined
33 4:25p 🔵 TCC ANEEL — Full ETL/Analysis Audit: 70+ Findings Mapped Across 4 Pipeline Layers
34 4:32p ⚖️ TCC ANEEL — Senior Data Engineer Audit Scope Formally Defined
35 10:35p 🔵 TCC ANEEL — Onboarding Audit Scope Defined for External User Reproducibility
36 10:36p 🔵 TCC ANEEL — Project Structure and Onboarding Documentation Map Confirmed
37 " 🔵 TCC ANEEL — All 7 Dashboard JSON Files ARE Versioned Despite README Stating Otherwise
38 " 🔵 TCC ANEEL — extract_aneel.py CATALOGO Has Hardcoded Direct CKAN Resource URLs
39 " 🔵 TCC ANEEL — requirements.txt Contains LangChain Dependencies for Removed Gemini Feature
40 " 🔵 TCC ANEEL — docs/EXTRACAO_DADOS.md is a Complete Onboarding Runbook with Direct URLs, Troubleshooting and Known Gaps
41 10:37p ⚖️ TCC ANEEL — Reproducibility Audit Scope Defined for External User Onboarding
42 10:38p 🔵 TCC ANEEL — Reproducibility Audit Scope Defined for External User Onboarding
43 10:39p ⚖️ TCC ANEEL — Reproducibility Audit Scope: External User Onboarding Focus
44 " ⚖️ TCC ANEEL — Reproducibility Audit Scope Defined for External-User Onboarding
45 10:40p ⚖️ TCC ANEEL — Reproducibility Audit Scope Defined for External User Onboarding
46 10:44p ⚖️ TCC ANEEL — Reproducibility Audit Scope Formally Defined for External-User Clone Workflow
47 10:51p 🔵 TCC ANEEL — Large Batch of Uncommitted Changes Discovered Pre-Audit Including Critical Analysis Scripts
48 " ⚖️ TCC ANEEL — 6-Phase Remediation Plan Defined for Reproducibility + Data Integrity Fixes
49 10:52p 🔵 TCC ANEEL — Data Sizes Confirmed: 8.3GB Raw + 7.6GB Processed + 7 Tracked Dashboard JSONs
50 " 🔵 TCC ANEEL — Analysis Layer Already Substantially Refactored in Uncommitted Working Tree
51 " 🔵 TCC ANEEL — B1 Bug Still Active: transform_aneel.py Reads All CSVs Without decimal="," Parameter
52 " 🔵 TCC ANEEL — build_regulatory_long_summary Silent Fallback (C7) Still Present in build_dashboard_data.py
54 10:54p 🟣 TCC ANEEL — docs/REPRODUCIBILITY_FIX_TASKS.md Created as Operational Handoff Document
55 " 🔵 TCC ANEEL — C8 Confirmed Active: normalize_regulatory_class Collapses Rural/Urban Distinction in Dashboard
57 10:55p 🔄 TCC ANEEL — transform_aneel.py Fully Rewritten: B1/B2/B3/B9 Audit Findings Fixed
58 10:56p 🔄 TCC ANEEL — schema_contracts.py Massively Extended: B10/B11/B13/D13/D19 Audit Findings Fixed
60 10:59p ⚖️ TCC ANEEL — Reproducibility Audit Request: External User Git Clone Perspective
62 11:00p 🔄 build_dashboard_data.py — Hardcoded Labels, Metric Formulas, and Timeseries Aggregation Fully Replaced
63 " 🔄 check_artifacts.py — Artifact Manifest Updated to CSV-First + Parquet Drift Checker Added
64 " 🔵 extract_aneel.py — Full CKAN Download Catalog with Direct URLs Confirmed
### Apr 28, 2026
68 1:03p 🔵 Claude Context Overload — MCP Plugins and Deferred Tools Burning Tokens
69 " 🔵 Claude Context Bloat Identified — MCP Plugins and Deferred Tools Consuming Tokens
70 1:06p ⚖️ Context Pollution Audit — MCP Plugins and Token Waste
71 1:14p 🔵 Claude Context Bloat Identified — MCPs and Deferred Tools Burning Tokens
72 " ✅ settings.local.json Permissions Cleaned — 154 Lines Reduced to 49
73 " 🚨 Discord Bot Token Hardcoded in settings.local.json Permission Entries
S36 settings.local.json Permissions Cleaned — 154 Lines Reduced to 49 (Apr 28, 1:14 PM)
74 1:17p ⚖️ TCC Frontend Strategy: tcc-frontend-react as Primary, analise-ren-1000 as Legacy
75 " 🔵 Dual Vercel Project Structure Confirmed: Legacy Root vs New app/frontend-next
76 " 🔵 Vercel MCP Tool Returns 403 for Both Project IDs
77 " 🔵 tcc-frontend-react Next.js Config: Railway Rewrites Already Wired
78 1:18p 🔵 tcc-frontend-react Live on Vercel but Serving Stale March 2026 Data
79 " 🔵 Vercel MCP OAuth Authenticated to Wrong Scope — No Team Access
80 " 🔵 Backend /api/v1/groups-ranking Returns 404 via Railway

Access 1574k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
