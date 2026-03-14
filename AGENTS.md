# Diretrizes Principais para IA (Contexto e Escopo Atual)

> **⚠️ ATENÇÃO IAs:** Antes de atuar, leiam sempre todos os arquivos na pasta `.ai/` (especialmente `CONTEXT.md` e `CONVENTIONS.md`).

## 🎯 Momento Atual do Projeto

- **Dados consolidados:** A etapa de limpeza (ETL), extração e validação básica dos dados está concluída e sua estrutura é confiável.
- **Foco de atuação:** O desenvolvimento técnico centrará as forças no **Front-End** (Dashboard web com Vanilla JS/HTML/CSS e Chart.js) suportado pelas APIs no **Back-End** (FastAPI).
- **Mindset:** Priorize implementar soluções lógicas para o backend servir os dados prontos ao frontend interativo. Pense em JSON, REST APIs e renderização de dados na tela do cliente.

## 🔄 Rotina Obrigatória de Inicialização (Para IAs)

Sempre que iniciar uma nova interação ou tarefa neste repositório, você DEVE priorizar a seguinte rotina de contextualização:

1. **Analise os Commits Recentes:** Execute `git log -n 5 --stat` e `git status` para entender as últimas mudanças.
2. **Leia os Arquivos Relacionados:** Leia os arquivos recém-modificados e arquivos chaves para o domínio do problema. Faça isso expandindo o contexto lendo os arquivos em blocos/lotes (de certa em certa quantidade) para não se perder.
3. **Mantenha o Contexto Atualizado:** Ao concluir mudanças, sempre atualize `README.md`, `AGENTS.md` e `.ai/CONTEXT.md` com o status mais recente do código para que todos os seus próximos chats/agentes comecem alinhados.

## 🛑 Escopo Estrito e Limites de Domínio (MUITO IMPORTANTE)

- **O domínio exclusivo do projeto é a regulação distribuidora de energia da ANEEL (REN 1000/2021).**
- O projeto foca em transgressões regulatórias (prazos de serviços, UCs ativas) e suas respectivas **compensações financeiras pagas na fatura dos consumidores**.

## 💾 Acesso aos Dados Importantes & Portas Padrão

- **Localização dos Dados Prontos:** Os CSVs validados pós-ETL/processamento estão exclusivamente na pasta `data/processed/analysis/`, caso necessário mais dados a busca deve ser feita indicando as fontes e de lugares confiaveis como balanços de empresas e registrado de onde pegamos os dados.
- **Interface Web:** A aplicação frontend consome `app/frontend/dashboard_data.json` e `app/frontend/dashboard_transgressoes.json`.
- **Apresentação do TCC (.pptx):** Gerar via `scripts/generate_tcc_investigacao_pptx.py`, com saída em `output/apresentacao_tcc_investigacao_dados_analises.pptx`.
- **Logos das Holdings:** Manter os logos em `logos/` (raiz) e espelhar em `app/frontend/assets/logos/` com nomes padronizados (`neoenergia.png`, `cpfl.png`, `equatorial.png`, etc.).
- **Porta Padronizada:** Desenvolvimento local e via Docker usam a **porta `8051`** (`http://localhost:8051/`). Não usar porta 8000 ou outras para o dashboard.

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
