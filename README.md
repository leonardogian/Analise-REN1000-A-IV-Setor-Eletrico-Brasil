# 📊 TCC — Análise de Eficácia da REN 1000/2021 (ANEEL)

**Tema:** Avaliação do impacto da Resolução Normativa ANEEL nº 1.000/2021 na qualidade comercial das distribuidoras de energia elétrica do Brasil.

**Foco:** Prazos de serviços comerciais, transgressões (fora do prazo) e compensações financeiras (R$) — **não** DEC/FEC.

---

## 📂 Estrutura do Projeto

```
├── data/
│   ├── raw/              ← CSVs brutos baixados da ANEEL (não vai pro Git)
│   ├── processed/        ← Dados limpos em Parquet/CSV + camada analítica
│   └── docs/             ← Dicionários de dados e manuais (PDFs)
│
├── src/
│   ├── etl/
│   │   ├── extract_aneel.py    ← Baixa os dados do portal Dados Abertos
│   │   └── transform_aneel.py  ← Limpa e salva em Parquet/CSV
│   └── analysis/               ← Análises, benchmark e geração de dados
│
├── dashboard/            ← Dashboard interativo + relatório imprimível
│   ├── index.html        ← SPA com 4 abas (Chart.js + dark mode)
│   ├── app.js            ← Lógica de gráficos e navegação
│   ├── styles.css        ← Design system (CSS puro)
│   ├── relatorio.html    ← Relatório otimizado para PDF
│   └── README.md         ← Documentação detalhada do dashboard
│
├── _archive/             ← Arquivos da versão anterior do projeto
├── requirements.txt      ← Bibliotecas Python necessárias
└── COMO_USAR_GIT.md      ← Guia rápido de Git
```

## ✅ Estado Atual dos Dados

- **Qualidade Comercial:** 2011–2025 (com 2024/2025 ainda incompletos para inferência de tendência).
- **INDGER Serviços Comerciais:** 2023–2025 (nível detalhado mensal/municipal).
- **INDGER Dados Comerciais:** 2023–2025 (usado para porte por UC ativa).
- **Valor pago/compensação:** disponível localmente nas bases:
  - `vlrpagocompensacao` (INDGER serviços)
  - indicadores `CR*` (Qualidade Comercial)

## 🛠️ Configurando o Ambiente

```bash
# 1. Crie o ambiente virtual
python3 -m venv .venv

# 2. Ative o ambiente
source .venv/bin/activate        # Linux/Mac
# .venv\Scripts\activate         # Windows

# 3. Instale as dependências
pip install -r requirements.txt
```

## 🚀 Como Usar (Pipeline)

Execute na ordem:

```bash
# Passo 1: Baixar dados reais da ANEEL
python -m src.etl.extract_aneel

# Passo 2: Limpar e transformar os dados
python -m src.etl.transform_aneel

# Passo 3: Gerar tabelas analíticas (inclui normalização por porte)
python -m src.analysis.build_analysis_tables

# Passo 4: Gerar relatório consolidado
python -m src.analysis.build_report

# Passo 5: Gerar dashboard interativo
python -m src.analysis.build_dashboard_data
```

Atalho para abrir resultados principais:

```bash
ls -lh data/processed/analysis
sed -n '1,200p' reports/relatorio_aneel.md
```

## ⚙️ Atalhos com Makefile

Você também pode usar comandos curtos:

```bash
make help
make update-data
make analysis
make report
make neoenergia-diagnostico
make dashboard              # gera JSON + abre dashboard
make serve                  # servidor local em http://localhost:8080
make pipeline               # tudo: ETL → análise → relatório → dashboard
```

Testes rápidos e smoke test:

```bash
make test-fast
make test-smoke
```

## 📊 Dashboard Interativo

O projeto inclui um dashboard web com 4 abas de análise e um relatório imprimível:

```bash
# Gerar dados + abrir no navegador
make serve
```

| Componente | Arquivo | Descrição |
|---|---|---|
| Dashboard SPA | `dashboard/index.html` | 4 abas interativas com Chart.js |
| Relatório PDF | `dashboard/relatorio.html` | Otimizado para impressão (Ctrl+P) |
| Dados JSON | `dashboard/dashboard_data.json` | Gerado automaticamente |

**Tecnologias:** HTML5 + CSS3 + JavaScript vanilla + Chart.js 4.4.7 (CDN). Sem Node.js, sem build.

> Para detalhes completos (como alterar, adicionar gráficos, arquitetura), veja:
>
> 👉 [`dashboard/README.md`](dashboard/README.md)

## 📈 Saídas de Análise (já implementadas)

Após rodar os comandos acima, o projeto gera:

- `data/processed/analysis/dim_indicador_servico.parquet`
- `data/processed/analysis/dim_distribuidora_porte.parquet`
- `data/processed/analysis/fato_uc_ativa_mensal_distribuidora.parquet`
- `data/processed/analysis/fato_indicadores_anuais.parquet`
- `data/processed/analysis/fato_servicos_municipio_mes.parquet`
- `data/processed/analysis/fato_transgressao_mensal_porte.parquet`
- `data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet`
- `data/processed/analysis/kpi_regulatorio_anual.parquet`
- `reports/relatorio_aneel.md`
- `dashboard/index.html` (dashboard interativo)
- `dashboard/relatorio.html` (relatório imprimível)
- `dashboard/dashboard_data.json` (dados JSON)

Diagnóstico dedicado das 5 Neoenergias:

- `reports/neoenergia_diagnostico.md`
- `data/processed/analysis/neoenergia/neo_mensal_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_anual_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_tendencia_2023_2025.csv`
- `data/processed/analysis/neoenergia/neo_alertas_comparabilidade.csv`

Notebooks de apoio:

- `notebooks/01_mapa_dados_e_qualidade.ipynb`
- `notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb`
- `notebooks/03_porte_e_benchmark_distribuidoras.ipynb`

## 🧭 Para que Serve Cada Tabela Analítica

| Arquivo | Nível | Uso principal |
|---|---|---|
| `dim_indicador_servico` | dimensão | Mapeia indicador para serviço/classe/localidade e artigo regulatório |
| `dim_distribuidora_porte` | distribuidora-ano | Porte por UC ativa média mensal + bucket/rank anual |
| `fato_uc_ativa_mensal_distribuidora` | distribuidora-mês | UC ativa mensal para normalização |
| `fato_indicadores_anuais` | distribuidora-ano-serviço | Série longa (QS, QV, PM, CR), pré/pós 2022 |
| `fato_servicos_municipio_mes` | distribuidora-mês-município-serviço | Drill-down detalhado para investigação |
| `fato_transgressao_mensal_porte` | distribuidora-mês-classe | Mensal com transgressão e compensação normalizadas por porte |
| `fato_transgressao_mensal_distribuidora` | distribuidora-mês | Versão enxuta para acompanhamento recorrente |
| `kpi_regulatorio_anual` | ano | Resumo anual consolidado para narrativa do TCC |

## ❓ Como Responder as Perguntas do TCC

1. **“Ficou menos fora do prazo?”**  
Use `kpi_regulatorio_anual` e `fato_indicadores_anuais` (`taxa_fora_prazo`).

2. **“As compensações aumentaram?”**  
Use `compensacao_rs` em `kpi_regulatorio_anual` e `fato_transgressao_mensal_distribuidora`.

3. **“Comparação justa por tamanho da distribuidora?”**  
Use `fora_prazo_por_100k_uc_mes` e `compensacao_rs_por_uc_mes` em `fato_transgressao_mensal_distribuidora`.

4. **“Grupo A/B e rural/urbana?”**  
Use `classe_local` em `fato_indicadores_anuais` e `classe_local_servico` em `fato_transgressao_mensal_porte`.

## 🔄 Rotina Recomendada de Trabalho

### Atualização mensal (quando ANEEL publicar novo mês)

```bash
python -m src.etl.extract_aneel
python -m src.etl.transform_aneel
python -m src.analysis.build_analysis_tables
python -m src.analysis.build_report
```

### Exploração e escrita analítica

1. Validar cobertura e qualidade: `notebooks/01_mapa_dados_e_qualidade.ipynb`
2. Atualizar tendência regulatória: `notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb`
3. Atualizar benchmark por porte: `notebooks/03_porte_e_benchmark_distribuidoras.ipynb`
4. Consolidar texto final em `reports/relatorio_aneel.md`

## 🎯 Próximos Passos (execução sugerida)

1. Congelar uma janela comparável para inferência (ex.: 2011–2023).
2. Rodar análise de sensibilidade (absoluto vs normalizado por UC ativa).
3. Fechar capítulo metodológico com definição explícita das métricas.
4. Exportar tabelas finais do TCC a partir de `data/processed/analysis`.
5. Criar versão final dos gráficos para o texto da monografia.

## 📘 Guia Operacional Detalhado

Para passo a passo completo (métricas, exemplos e checklist), veja:

👉 `docs/GUIA_ANALISE.md`

## 🗺️ Roadmap de execução

Sequência objetiva de trabalho até a versão final do TCC:

👉 `docs/PROXIMOS_PASSOS_TCC.md`

## 📊 Fontes de Dados

| Fonte | Conteúdo | Formato |
|---|---|---|
| **Qualidade do Atendimento Comercial** | Prazos, transgressões, compensações R$ | CSV |
| **INDGER — Serviços Comerciais** | Quantidades, prazos, estoques, compensações | ZIP/CSV |
| **INDGER — Dados Comerciais** | Faturamento, danos elétricos, atendimento | CSV |

Todos disponíveis em: [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br)

## 🎯 Variáveis de Interesse

- **Eficácia:** Serviços realizados dentro do prazo regulamentar
- **Transgressões:** Serviços fora do prazo (Anexo IV da REN 1000)
- **Compensações:** Valores financeiros (R$) creditados ao consumidor
- **Segmentação:** Por distribuidora, estado, grupo tarifário (A/B), zona (rural/urbana)
- **Temporal:** Antes × depois da vigência da REN 1000

## 📚 Contexto Normativo

- **REN ANEEL nº 1.000/2021:** Consolida as regras de distribuição de energia
- **Anexo IV:** Define prazos máximos para prestação de serviços comerciais
- **PRODIST (Módulo 8, Seção 8.3):** Detalhamento dos procedimentos

## 🤝 Trabalhando em Conjunto

👉 **[Guia de Git](COMO_USAR_GIT.md)**
