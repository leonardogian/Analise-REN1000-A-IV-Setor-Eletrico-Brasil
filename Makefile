SHELL := /bin/bash

PORT ?= 8051
NEXT_PORT ?= 3051
PROJECT_ROOT := $(CURDIR)
PYTHON_VENV := $(PROJECT_ROOT)/.venv/bin/python
PYTHON ?= $(if $(shell test -x $(PYTHON_VENV) && echo ok),$(PYTHON_VENV),python3)
PIP ?= $(PYTHON) -m pip
NPM ?= npm
FRONTEND_NEXT_DIR := app/frontend-next

ANALYSIS_DIR := data/processed/analysis

.PHONY: help venv venv-recreate install doctor \
	extract extract-aneel extract-aneel-full extract-ibge transform update-data \
	analysis report grupos-diagnostico neoenergia-diagnostico \
	load-postgres qa-audit pipeline \
	dashboard dashboard-transgressoes dashboard-full \
	serve frontend frontend-next frontend-next-railway frontend-next-install stack-next preflight-backend backend dev-serve \
	screenshots check-visual \
	check-artifacts check-artifacts-full validate-contracts validate-contracts-processed \
	test-fast test-smoke test clean-analysis \
	docker-up docker-down docker-build docker-ps \
	logs logs-backend logs-nginx health \
	docker-full-up docker-full-down docker-full-ps

# ── Help ───────────────────────────────────────────────────────────────────────

help:
	@echo "Targets disponíveis:"
	@echo ""
	@echo "Setup:"
	@echo "  make venv                   - cria ambiente virtual .venv"
	@echo "  make venv-recreate          - recria .venv do zero (remove + cria)"
	@echo "  make install                - instala dependências em requirements.txt"
	@echo "  make doctor                 - verifica saúde da .venv e imports críticos"
	@echo ""
	@echo "Pipeline de dados:"
	@echo "  make extract                - extract-aneel + extract-ibge (nuclear)"
	@echo "  make extract-aneel          - baixa fontes nucleares da ANEEL (qualidade + INDGER)"
	@echo "  make extract-aneel-full     - + fontes complementares (autos_infracao + reclamacoes)"
	@echo "  make extract-ibge           - baixa DTB 2024 do IBGE (idempotente)"
	@echo "  make transform              - transforma dados brutos"
	@echo "  make update-data            - extract + transform"
	@echo "  make analysis               - gera tabelas analíticas"
	@echo "  make report                 - gera relatório markdown"
	@echo "  make grupos-diagnostico     - diagnóstico por grupos econômicos"
	@echo "  make neoenergia-diagnostico - alias de compatibilidade (artefatos legados neo)"
	@echo "  make load-postgres          - carrega dados no PostgreSQL"
	@echo "  make qa-audit               - executa auditoria de qualidade QA"
	@echo "  make pipeline               - update-data + analysis + report + grupos + dashboards"
	@echo ""
	@echo "Dashboard:"
	@echo "  make dashboard              - gera JSON do dashboard principal"
	@echo "  make dashboard-transgressoes - gera JSON para a página transgressoes.html"
	@echo "  make dashboard-full         - analysis + grupos + dashboard + dashboard-transgressoes"
	@echo ""
	@echo "Serving / Backend:"
	@echo "  make serve                  - frontend classico em http://localhost:$(PORT)"
	@echo "  make frontend               - alias de make serve"
	@echo "  make backend                - sobe backend FastAPI em http://localhost:$(PORT)"
	@echo "  make dev-serve              - dashboard-full + preflight + backend com reload"
	@echo "  make frontend-next          - frontend Next.js em http://localhost:$(NEXT_PORT) usando backend local"
	@echo "  make frontend-next-railway  - frontend Next.js em http://localhost:$(NEXT_PORT) usando Railway"
	@echo "  make stack-next             - sobe backend local em background + frontend Next.js"
	@echo "  make frontend-next-install  - instala dependencias do frontend Next.js"
	@echo ""
	@echo "Extras:"
	@echo "  make screenshots            - tira screenshots de todas as páginas (requer: make serve)"
	@echo "  make check-visual           - verifica erros de console/charts (requer: make serve)"
	@echo ""
	@echo "Qualidade / Testes:"
	@echo "  make validate-contracts     - valida contratos de schema (raw + processed)"
	@echo "  make check-artifacts        - valida artefatos core"
	@echo "  make check-artifacts-full   - valida artefatos completos + dashboard JSON"
	@echo "  make test-fast              - compilação + imports + contratos + artefatos core"
	@echo "  make test-smoke             - smoke completo com grupos + dashboards"
	@echo "  make test                   - alias para test-fast"
	@echo "  make clean-analysis         - remove saídas em $(ANALYSIS_DIR)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up              - sobe nginx + backend em background"
	@echo "  make docker-down            - para e remove os containers"
	@echo "  make docker-build           - reconstrói a imagem do backend"
	@echo "  make docker-ps              - status dos containers"
	@echo "  make logs                   - segue logs de todos os containers"
	@echo "  make logs-backend           - segue logs do backend FastAPI"
	@echo "  make logs-nginx             - segue logs do nginx"
	@echo "  make health                 - checa /health e exibe JSON formatado"
	@echo ""
	@echo "Docker (stack completa):"
	@echo "  make docker-full-up         - sobe app + banco + kestra em background"
	@echo "  make docker-full-down       - para e remove todos os containers"
	@echo "  make docker-full-ps         - status de todos os containers"

# ── Setup ─────────────────────────────────────────────────────────────────────

venv:
	python3 -m venv .venv

venv-recreate:
	rm -rf .venv
	python3 -m venv .venv

install:
	@test -x $(PYTHON_VENV) || (echo "❌ .venv ausente ou inválida. Rode: make venv-recreate" && exit 1)
	$(PYTHON_VENV) -m pip install -r requirements.txt

doctor:
	python3 scripts/doctor_env.py

# ── Pipeline de dados ─────────────────────────────────────────────────────────

extract-aneel:
	$(PYTHON) -m src.etl.extract_aneel

extract-aneel-full:
	$(PYTHON) -m src.etl.extract_aneel --with-complementares

extract-ibge:
	$(PYTHON) -m src.etl.extract_ibge

extract: extract-aneel extract-ibge

transform:
	$(PYTHON) -m src.etl.transform_aneel

update-data: extract transform

analysis:
	$(PYTHON) -m src.analysis.build_analysis_tables

report:
	$(PYTHON) -m src.analysis.build_report

grupos-diagnostico:
	$(PYTHON) -m src.analysis.grupos_diagnostico

neoenergia-diagnostico:
	$(PYTHON) -m src.analysis.neoenergia_diagnostico

load-postgres:
	$(PYTHON) scripts/load_to_postgres.py

qa-audit:
	$(PYTHON) scripts/qa_audit.py

pipeline: update-data analysis report grupos-diagnostico neoenergia-diagnostico dashboard dashboard-transgressoes

# ── Dashboard ─────────────────────────────────────────────────────────────────

dashboard:
	$(PYTHON) -m src.analysis.build_dashboard_data
	@echo ""
	@echo "✅ Dashboard pronto! Abra no navegador:"
	@echo "   app/frontend/index.html      (interativo)"
	@echo "   app/frontend/relatorio.html  (relatório imprimível)"

dashboard-transgressoes:
	$(PYTHON) -m src.analysis.dashboard_transgressoes

dashboard-full: analysis grupos-diagnostico neoenergia-diagnostico dashboard dashboard-transgressoes

# ── Serving / Backend ─────────────────────────────────────────────────────────
# Frontend principal: make stack-next (backend + Next.js juntos)
# Frontend legado (Vanilla JS): make serve

serve: dashboard
	@echo "🌐 Frontend Vanilla JS (legado) em http://localhost:$(PORT)"
	@(sleep 2 && xdg-open http://localhost:$(PORT) 2>/dev/null || true) &
	cd app/frontend && $(PYTHON) -m http.server $(PORT)

frontend: serve  ## legado: use stack-next para o frontend Next.js principal

frontend-next-install:
	cd $(FRONTEND_NEXT_DIR) && $(NPM) install

frontend-next:
	@echo "⚛️ Frontend Next.js em http://localhost:$(NEXT_PORT) com API local em http://localhost:$(PORT)"
	@(sleep 2 && xdg-open http://localhost:$(NEXT_PORT) 2>/dev/null || true) &
	cd $(FRONTEND_NEXT_DIR) && API_REWRITE_URL=http://localhost:$(PORT) $(NPM) run dev -- --hostname 0.0.0.0 --port $(NEXT_PORT)

frontend-next-railway:
	@echo "⚛️ Frontend Next.js em http://localhost:$(NEXT_PORT) com dados da Railway"
	@(sleep 2 && xdg-open http://localhost:$(NEXT_PORT) 2>/dev/null || true) &
	cd $(FRONTEND_NEXT_DIR) && $(NPM) run dev -- --hostname 0.0.0.0 --port $(NEXT_PORT)

preflight-backend:
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts-full

backend: preflight-backend
	@echo "🚀 Backend FastAPI em http://localhost:$(PORT)"
	@(sleep 2 && xdg-open http://localhost:$(PORT) 2>/dev/null || true) &
	$(PYTHON) -m uvicorn app.backend.main:app --host 0.0.0.0 --port $(PORT)

dev-serve: dashboard-full preflight-backend
	@echo "🚀 Backend FastAPI (reload) em http://localhost:$(PORT)"
	@(sleep 2 && xdg-open http://localhost:$(PORT) 2>/dev/null || true) &
	$(PYTHON) -m uvicorn app.backend.main:app --host 0.0.0.0 --port $(PORT) --reload

stack-next:
	@echo "🚀 Backend local + frontend Next.js (http://localhost:$(PORT) + http://localhost:$(NEXT_PORT))"
	@if curl -sf http://localhost:$(PORT)/health >/dev/null 2>&1; then \
		echo "ℹ️ Backend ja esta ativo em http://localhost:$(PORT)"; \
	else \
		echo "ℹ️ Iniciando backend local em background (log: /tmp/tcc-backend-$(PORT).log)"; \
		($(MAKE) backend > /tmp/tcc-backend-$(PORT).log 2>&1 &) ; \
		sleep 5; \
	fi
	@$(MAKE) frontend-next

# ── Extras ────────────────────────────────────────────────────────────────────

screenshots:
	node scripts/playwright/screenshot-all.js

check-visual:
	node scripts/playwright/check-charts.js

# ── Qualidade / Testes ────────────────────────────────────────────────────────

check-artifacts:
	$(PYTHON) scripts/check_artifacts.py --profile core

check-artifacts-full:
	$(PYTHON) scripts/check_artifacts.py --profile full

validate-contracts:
	$(PYTHON) scripts/validate_schema_contracts.py

validate-contracts-processed:
	$(PYTHON) scripts/validate_schema_contracts.py --processed-only

test-fast:
	$(PYTHON) -m py_compile \
	  src/etl/extract_aneel.py \
	  src/etl/transform_aneel.py \
	  src/etl/schema_contracts.py \
	  src/analysis/build_analysis_tables.py \
	  src/analysis/build_report.py \
	  src/analysis/distributor_groups.py \
	  src/analysis/grupos_diagnostico.py \
	  src/analysis/neoenergia_diagnostico.py \
	  src/analysis/build_dashboard_data.py \
	  src/analysis/dashboard_transgressoes.py \
	  app/backend/main.py
	$(PYTHON) scripts/smoke_imports.py
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts

test-smoke: analysis report grupos-diagnostico neoenergia-diagnostico dashboard dashboard-transgressoes
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full

test: test-fast

clean-analysis:
	rm -rf $(ANALYSIS_DIR)

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up:
	@echo "🐳 Subindo nginx + backend em http://localhost:$(PORT)"
	docker compose -f docker/docker-compose.yml up -d

docker-down:
	docker compose -f docker/docker-compose.yml down

docker-build:
	docker compose -f docker/docker-compose.yml build backend

docker-ps:
	docker compose -f docker/docker-compose.yml ps

logs:
	docker compose -f docker/docker-compose.yml logs -f

logs-backend:
	docker compose -f docker/docker-compose.yml logs -f backend

logs-nginx:
	docker compose -f docker/docker-compose.yml logs -f nginx

health:
	@curl -s http://localhost:$(PORT)/health | $(PYTHON) -m json.tool

docker-full-up:
	@echo "🐳 Subindo stack completa em http://localhost:$(PORT)"
	docker compose \
	  -f docker/docker-compose.yml \
	  -f docker/docker-compose.db.yml \
	  -f docker/docker-compose.kestra.yml \
	  up -d

docker-full-down:
	docker compose \
	  -f docker/docker-compose.yml \
	  -f docker/docker-compose.db.yml \
	  -f docker/docker-compose.kestra.yml \
	  down

docker-full-ps:
	docker compose \
	  -f docker/docker-compose.yml \
	  -f docker/docker-compose.db.yml \
	  -f docker/docker-compose.kestra.yml \
	  ps
