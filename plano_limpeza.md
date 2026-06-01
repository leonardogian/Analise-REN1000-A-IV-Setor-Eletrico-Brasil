# Plano de Limpeza e Reorganização do Repositório

Status atualizado em 2026-06-01, após auditoria do estado real da `main`.

## Objetivo

Reduzir ruído de arquivos legados e artefatos locais sem afetar o núcleo do
projeto: ETL, análise, FastAPI, frontend Next.js, JSONs canônicos e CSVs
analíticos versionados.

## Preservar Sempre

| Item | Motivo |
|---|---|
| `app/backend/` | FastAPI oficial no Railway; serve `/api/*` e `dashboard_*.json`. |
| `app/frontend-next/` | Frontend oficial Next.js/React no Vercel (`tcc-frontend-react`). |
| `src/` e `scripts/` | Pipeline ETL/análise, QA, contratos e utilitários. |
| `data/processed/analysis/` | CSVs analíticos versionados para auditoria/demo. |
| `data/processed/dashboard/` | JSONs canônicos consumidos por backend/frontend. |
| `data/docs/` | PDFs/dicionários oficiais baixados pelo extrator ANEEL. |
| `.ai/`, `AGENTS.md`, `CLAUDE.md` | Contexto operacional canônico para agentes. |
| `.devcontainer/` | Ambiente VS Code reproduzível. |
| `.github/agents/` | Agentes especializados; não confundir com workflows removidos. |
| `docs/Fluxogramas_v2/` e `docs/METODOLOGIA_PIPELINE_MAKE.md` | Material acadêmico novo para metodologia/pipeline. |

## Limpeza Aplicada

| Item | Ação | Motivo |
|---|---|---|
| `docs/referencias/Manual-Envio-Dados-IndGer-ConectANEEL.pdf` | Remover do Git | Duplicata exata do PDF canônico em `data/docs/`. |
| `docs/archive/` | Remover do Git | Planos históricos do frontend Vanilla, hoje obsoletos. |
| `docs/superpowers/` | Remover do Git | Planos/specs de agentes já consumidos e ligados a Vanilla/Kestra/Gemini. |
| `docs/ai-skills/` | Remover local | Skill experimental não integrada; conteúdo útil já está em `.ai/PIPELINE.md` e `docs/METODOLOGIA_PIPELINE_MAKE.md`. |
| `kestra_flows/` | Remover do Git | Fluxos Kestra não são mais caminho oficial; Make/Railway é o fluxo ativo. |
| `.playwright-mcp/` | Remover local | Logs temporários de inspeção UI. |
| `.claude/worktrees/` | Remover local | Cache/worktree temporário de agente. |
| `.agents/`, `.codex/` | Remover local | Diretórios vazios/locais de ferramenta. |
| `docker/nginx.conf/` | Remover local | Diretório vazio com nome de arquivo legado. |
| `playwright-cli.json` | Remover local | Config temporária ignorada pelo Git. |
| `__pycache__/`, `app/frontend-next/.next/` | Remover local | Caches regeneráveis. |

## Dotfolders

Não consolidar fisicamente `.claude/`, `.cursor/`, `.vercel/`, `.vscode/`,
`.codex/` ou equivalentes em uma pasta única. Essas ferramentas esperam caminhos
próprios. A organização correta é:

- versionar apenas diretórios de configuração que fazem parte do projeto
  (`.ai/`, `.devcontainer/`, `.github/agents/`);
- ignorar estado local de ferramenta (`.claude/`, `.cursor/`, `.vercel/`,
  `.vscode/`, `.codex/`, `.agents/`, `.playwright-mcp/`);
- remover caches/logs locais quando atrapalharem a navegação.

## Branches

Política aplicada: limpeza apenas local, sem apagar remotes.

Usar `git branch -d` para remover branches locais já mescladas em `main`.
Preservar branches não mescladas, especialmente `claude/peaceful-ishizaka`.

## Validação

Depois da limpeza:

```bash
git status --short
git ls-files kestra_flows docs/referencias docs/archive docs/superpowers
rg -n "app/frontend|api/dashboard-data|api/transgressoes|api/grupos/ranking|outputDirectory|index.html" \
  DEPLOY_CHECKLIST.md README.md CLAUDE.md AGENTS.md .ai app/frontend-next/README.md
git ls-files docs/referencias/Manual-Envio-Dados-IndGer-ConectANEEL.pdf
make test-fast
```

Resultado esperado:

- `git ls-files` dos caminhos removidos sem saída;
- nenhuma referência operacional ao frontend Vanilla em docs ativos;
- `make test-fast` passando;
- somente arquivos novos acadêmicos e mudanças de limpeza aparecendo no diff.
