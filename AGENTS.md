# Regras de Espera e Monitoramento de Tempo

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
