SHELL := /bin/bash
.DEFAULT_GOAL := help

PORT ?= 8051
NEXT_PORT ?= 3051
PROJECT_ROOT := $(CURDIR)
PYTHON_VENV := $(PROJECT_ROOT)/.venv/bin/python
PYTHON ?= $(if $(shell test -x "$(PYTHON_VENV)" && echo ok),$(PYTHON_VENV),python3)
NPM ?= npm
FRONTEND_NEXT_DIR := app/frontend-next
ANALYSIS_DIR := data/processed/analysis
DASHBOARD_DIR := data/processed/dashboard
COMPOSE ?= docker compose
COMPOSE_BACKEND := $(COMPOSE) -f docker/docker-compose.yml

.PHONY: help \
	venv venv-recreate install doctor \
	extract extract-aneel extract-aneel-full extract-ibge transform update-data \
	analysis report grupos-diagnostico neoenergia-diagnostico mapa-municipios load-postgres \
	dashboard dashboard-transgressoes dashboard-full pipeline clean-analysis \
	preflight-backend backend dev-serve stack-next site site-clean site-refresh site-full site-railway \
	frontend-next-install frontend-next frontend-next-railway frontend-next-build frontend-next-clean \
	validate-contracts validate-contracts-processed check-artifacts check-artifacts-full \
	qa-data test-fast test-smoke test \
	docker-up docker-down docker-ps docker-logs health

help:
	@echo "Targets essenciais:"
	@echo ""
	@echo "Setup:"
	@echo "  make venv-recreate          recria .venv do zero"
	@echo "  make install                instala requirements.txt na .venv"
	@echo "  make doctor                 valida ambiente e imports criticos"
	@echo ""
	@echo "Pipeline:"
	@echo "  make pipeline               ETL completo + analise + JSONs + validacoes"
	@echo "  make dashboard-full         analise + relatorio + grupos + JSONs"
	@echo "  make extract                baixa fontes nucleares ANEEL + IBGE"
	@echo "  make transform              gera dados tratados em data/processed/"
	@echo "  make analysis               gera tabelas analiticas"
	@echo "  make mapa-municipios        gera JSON municipal agregado opcional para /mapa"
	@echo "  make qa-data                auditoria numerica dos artefatos"
	@echo ""
	@echo "Aplicacao:"
	@echo "  make site                   sobe backend + Next.js com JSON atual"
	@echo "  make site-clean             limpa build dev do Next.js e sobe o site"
	@echo "  make site-refresh           regenera dashboard e sobe backend + Next.js"
	@echo "  make site-full              ETL completo, valida artefatos e sobe o site"
	@echo "  make site-railway           Next.js local usando backend Railway (como Vercel)"
	@echo "  make backend                FastAPI em http://localhost:$(PORT)"
	@echo "  make dev-serve              FastAPI com reload em http://localhost:$(PORT)"
	@echo "  make frontend-next-install  instala dependencias do Next.js com npm ci"
	@echo "  make frontend-next          Next.js em http://localhost:$(NEXT_PORT) usando backend local"
	@echo "  make frontend-next-railway  Next.js em http://localhost:$(NEXT_PORT) usando Railway"
	@echo "  make stack-next             backend local + Next.js oficial"
	@echo ""
	@echo "Validacao:"
	@echo "  make test-fast              py_compile + imports + contratos + artefatos core"
	@echo "  make test-smoke             dashboard-full + contratos + artefatos completos"
	@echo "  make validate-contracts     contratos raw/processed"
	@echo "  make check-artifacts-full   artefatos completos + JSONs"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up              sobe backend Docker em http://localhost:$(PORT)"
	@echo "  make docker-down            para containers do backend"
	@echo "  make docker-logs            segue logs do backend"

# Setup

venv:
	python3 -m venv .venv

venv-recreate:
	rm -rf .venv
	python3 -m venv .venv

install:
	@test -x "$(PYTHON_VENV)" || (echo ".venv ausente ou invalida. Rode: make venv-recreate" && exit 1)
	"$(PYTHON_VENV)" -m pip install -r requirements.txt

doctor:
	$(PYTHON) scripts/doctor_env.py

# Pipeline de dados

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

mapa-municipios:
	$(PYTHON) -m src.analysis.build_municipal_map_data

load-postgres:
	$(PYTHON) scripts/load_to_postgres.py

dashboard:
	$(PYTHON) -m src.analysis.build_dashboard_data
	@echo "Payloads prontos em $(DASHBOARD_DIR)/."

dashboard-transgressoes:
	$(PYTHON) -m src.analysis.dashboard_transgressoes

dashboard-full: analysis report grupos-diagnostico neoenergia-diagnostico dashboard dashboard-transgressoes

pipeline:
	@$(MAKE) update-data
	@$(MAKE) dashboard-full
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full
	@$(MAKE) qa-data

clean-analysis:
	rm -rf "$(ANALYSIS_DIR)"

# Aplicacao local

preflight-backend:
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts-full

backend: preflight-backend
	@echo "FastAPI em http://localhost:$(PORT)"
	$(PYTHON) -m uvicorn app.backend.main:app --host 0.0.0.0 --port $(PORT)

dev-serve: dashboard-full preflight-backend
	@echo "FastAPI com reload em http://localhost:$(PORT)"
	$(PYTHON) -m uvicorn app.backend.main:app --host 0.0.0.0 --port $(PORT) --reload

frontend-next-install:
	cd "$(FRONTEND_NEXT_DIR)" && $(NPM) ci

frontend-next:
	@echo "Next.js em http://localhost:$(NEXT_PORT) usando API local http://localhost:$(PORT)"
	cd "$(FRONTEND_NEXT_DIR)" && API_REWRITE_URL=http://localhost:$(PORT) $(NPM) run dev -- --hostname 0.0.0.0 --port $(NEXT_PORT)

frontend-next-railway:
	@echo "Next.js em http://localhost:$(NEXT_PORT) usando Railway"
	cd "$(FRONTEND_NEXT_DIR)" && $(NPM) run dev -- --hostname 0.0.0.0 --port $(NEXT_PORT)

frontend-next-build:
	cd "$(FRONTEND_NEXT_DIR)" && $(NPM) run build

frontend-next-clean:
	rm -rf "$(FRONTEND_NEXT_DIR)/.next"

stack-next:
	@echo "Backend local + Next.js oficial (http://localhost:$(PORT) + http://localhost:$(NEXT_PORT))"
	@if curl -sf http://localhost:$(PORT)/api/dashboard/kpi_overview >/dev/null 2>&1; then \
		echo "Backend ja esta ativo em http://localhost:$(PORT)"; \
	else \
		echo "Iniciando backend local em background (log: /tmp/tcc-backend-$(PORT).log)"; \
		($(MAKE) backend > /tmp/tcc-backend-$(PORT).log 2>&1 &) ; \
		for i in {1..20}; do \
			curl -sf http://localhost:$(PORT)/api/dashboard/kpi_overview >/dev/null 2>&1 && break; \
			sleep 1; \
		done; \
		if ! curl -sf http://localhost:$(PORT)/api/dashboard/kpi_overview >/dev/null 2>&1; then \
			echo "Backend nao respondeu. Ultimas linhas do log:"; \
			tail -n 40 /tmp/tcc-backend-$(PORT).log; \
			exit 1; \
		fi; \
	fi
	@$(MAKE) frontend-next

site:
	@$(MAKE) stack-next

site-clean: frontend-next-clean
	@$(MAKE) site

site-refresh: dashboard-full
	@$(MAKE) stack-next

site-full:
	@$(MAKE) update-data
	@$(MAKE) dashboard-full
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full
	@$(MAKE) stack-next

site-railway:
	@$(MAKE) frontend-next-railway

# Validacao

validate-contracts:
	$(PYTHON) scripts/validate_schema_contracts.py

validate-contracts-processed:
	$(PYTHON) scripts/validate_schema_contracts.py --processed-only

check-artifacts:
	$(PYTHON) scripts/check_artifacts.py --profile core

check-artifacts-full:
	$(PYTHON) scripts/check_artifacts.py --profile full

qa-data:
	$(PYTHON) scripts/qa_data_audit.py

test-fast:
	$(PYTHON) -m py_compile \
	  src/etl/extract_aneel.py \
	  src/etl/extract_ibge.py \
	  src/etl/transform_aneel.py \
	  src/etl/schema_contracts.py \
	  src/analysis/build_analysis_tables.py \
	  src/analysis/build_report.py \
	  src/analysis/distributor_groups.py \
	  src/analysis/grupos_diagnostico.py \
	  src/analysis/neoenergia_diagnostico.py \
	  src/analysis/build_dashboard_data.py \
	  src/analysis/build_municipal_map_data.py \
	  src/analysis/dashboard_transgressoes.py \
	  app/backend/main.py \
	  app/backend/core/database.py \
	  scripts/test_backend_dependency_degradation.py \
	  scripts/test_indger_temporal_contracts.py \
	  scripts/test_gitignore_contracts.py
	$(PYTHON) scripts/smoke_imports.py
	$(PYTHON) scripts/test_backend_dependency_degradation.py
	$(PYTHON) scripts/test_indger_temporal_contracts.py
	$(PYTHON) scripts/test_gitignore_contracts.py
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts

test-smoke: dashboard-full
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full

test: test-fast

# Docker backend-only. O frontend oficial roda separado via make frontend-next.

docker-up:
	PORT=$(PORT) $(COMPOSE_BACKEND) up -d --build backend

docker-down:
	$(COMPOSE_BACKEND) down

docker-ps:
	$(COMPOSE_BACKEND) ps

docker-logs:
	$(COMPOSE_BACKEND) logs -f backend

health:
	@curl -s http://localhost:$(PORT)/health | $(PYTHON) -m json.tool
