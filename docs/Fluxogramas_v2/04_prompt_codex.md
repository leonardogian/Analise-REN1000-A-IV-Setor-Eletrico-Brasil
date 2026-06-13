# Prompt para usar no Codex pelo terminal

Use este prompt dentro da pasta vazia do projeto.

---

## Prompt principal

Você é meu assistente técnico para construir fluxogramas acadêmicos do Capítulo 3 de um TCC em Engenharia de Energia.

Contexto:
O TCC analisa a transição da REN ANEEL nº 414/2010 para a REN ANEEL nº 1.000/2021, com foco em eficiência operacional, transgressões de prazos, compensações financeiras automáticas, impacto por distribuidoras, grupos de consumidores, localização urbana/rural e holdings. O Capítulo 3 é a metodologia da pesquisa.

Objetivo:
Criar uma base de projeto para desenhar 5 fluxogramas metodológicos conectados entre si. A Figura 1 deve ser o fluxo macro da metodologia inteira. As Figuras 2 a 5 devem ser detalhamentos/zooms de blocos da Figura 1.

Regras visuais:
- Preto e branco exclusivamente.
- Fundo branco.
- Bordas pretas.
- Texto preto.
- Caixas retangulares com cantos retos.
- Conectores retos e ortogonais, com ângulos de 90°.
- Sem sombras, gradientes, ícones, cores decorativas ou elementos visuais complexos.
- Fonte sem serifa.
- Layout preferencialmente vertical.
- Legibilidade em impressão A4 monocromática.
- Linguagem conceitual/científica.
- Não usar comandos de terminal, nomes de scripts, caminhos de diretórios ou detalhes excessivamente operacionais.

Estrutura esperada do projeto:
1. Criar uma pasta `exports/`.
2. Dentro de `exports/`, criar:
   - `mermaid/`
   - `excalidraw/`
   - `png/`
3. Criar um arquivo Mermaid separado para cada figura.
4. Criar, se possível, arquivos `.excalidraw` correspondentes.
5. Manter nomes de arquivos claros e ordenados.

Figuras desejadas:

Figura 1 — Fluxo metodológico geral da pesquisa
Fluxo:
Fontes de dados → Coleta automatizada → Tratamento e padronização → Consolidação analítica → Validação e reprodutibilidade → Construção dos indicadores → Análise comparativa → Painel analítico e interpretação

Caixas:
- FONTES DE DADOS — ANEEL, INDGER e IBGE
- COLETA AUTOMATIZADA — Extração de bases públicas
- TRATAMENTO E PADRONIZAÇÃO — Limpeza, normalização e armazenamento otimizado
- CONSOLIDAÇÃO ANALÍTICA — Tabelas auditáveis e KPIs
- VALIDAÇÃO E REPRODUTIBILIDADE — Verificações estruturais, numéricas e relacionais
- CONSTRUÇÃO DOS INDICADORES — Métricas regulatórias e financeiras
- ANÁLISE COMPARATIVA — Pré/pós REN 1.000, grupos, localização e holdings
- PAINEL ANALÍTICO — Visualização e interpretação dos resultados

Figura 2 — Fluxograma da coleta e tratamento dos dados
Deve detalhar Fontes de dados, Coleta automatizada e Tratamento e padronização.
Fluxo:
Fontes ANEEL + Fontes IBGE → Coleta automatizada → Dados brutos → Tratamento e padronização → Dados tratados

Caixas:
- FONTES ANEEL — Qualidade comercial e INDGER
- FONTES IBGE — Divisão Territorial Brasileira
- COLETA AUTOMATIZADA — Extração sistemática das bases públicas
- DADOS BRUTOS — Formatos originais das fontes oficiais
- TRATAMENTO E PADRONIZAÇÃO — Encoding, separadores, datas, colunas e duplicidades
- DADOS TRATADOS — Bases limpas e otimizadas

Figura 3 — Fluxograma da consolidação analítica
Deve mostrar que a evidência científica vem das tabelas auditáveis, e não diretamente do dashboard.
Fluxo:
Dados tratados → Tabelas analíticas → bifurcação para Camada primária e Camada derivada.
Apenas Camada primária deve apontar para Evidência científica.

Caixas:
- DADOS TRATADOS — Bases padronizadas
- TABELAS ANALÍTICAS — Indicadores, KPIs, transgressões e segmentações
- CAMADA PRIMÁRIA — Tabelas auditáveis da pesquisa
- CAMADA DERIVADA — Relatórios, painel e artefatos visuais
- EVIDÊNCIA CIENTÍFICA — Base dos resultados do Capítulo 4

Regra crítica:
Não criar seta da CAMADA DERIVADA para EVIDÊNCIA CIENTÍFICA.

Figura 4 — Fluxograma da validação e reprodutibilidade dos dados
Fluxo:
Tabelas analíticas geradas → Validação estrutural → Verificação de completude → Auditoria numérica e relacional → Reprodutibilidade → Dados aprovados?
Se SIM: Avanço para indicadores.
Se NÃO: Correção do processo.

Caixas:
- TABELAS ANALÍTICAS GERADAS — Produtos da consolidação
- VALIDAÇÃO ESTRUTURAL — Campos, tipos e regimes regulatórios
- VERIFICAÇÃO DE COMPLETUDE — Artefatos esperados
- AUDITORIA NUMÉRICA E RELACIONAL — Chaves, denominadores e cobertura
- REPRODUTIBILIDADE — Código, dados tratados e rotinas abertas
- DADOS APROVADOS? — decisão lógica
- AVANÇO PARA INDICADORES — Construção das métricas analíticas
- CORREÇÃO DO PROCESSO — Revisão das etapas anteriores

Figura 5 — Fluxograma da arquitetura do painel analítico
Deve mostrar o painel como camada derivada de exploração, sem recálculo da evidência.
Fluxo:
Tabelas analíticas tratadas e validadas → Artefatos canônicos → Camada de serviço → Interface de exploração → Interpretação dos resultados

Caixas:
- TABELAS ANALÍTICAS TRATADAS E VALIDADAS — Fonte primária dos indicadores
- ARTEFATOS CANÔNICOS — Arquivos estruturados para consumo web
- CAMADA DE SERVIÇO — API sem recálculo dinâmico
- INTERFACE DE EXPLORAÇÃO — Dashboard interativo
- INTERPRETAÇÃO DOS RESULTADOS — Padrões, assimetrias e valores atípicos

Entregáveis:
- `exports/mermaid/figura_01_fluxo_metodologico.mmd`
- `exports/mermaid/figura_02_coleta_tratamento.mmd`
- `exports/mermaid/figura_03_consolidacao_analitica.mmd`
- `exports/mermaid/figura_04_validacao_reprodutibilidade.mmd`
- `exports/mermaid/figura_05_painel_analitico.mmd`
- Se possível, gerar também arquivos `.excalidraw` equivalentes.
- Criar um `README.md` explicando como editar, exportar e revisar as figuras.

Antes de gerar qualquer arquivo, leia os arquivos Markdown existentes nesta pasta e preserve a lógica metodológica descrita neles.
