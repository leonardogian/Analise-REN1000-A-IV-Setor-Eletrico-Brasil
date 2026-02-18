SHELL := /bin/bash

PORT ?= 8050
PROJECT_ROOT := $(CURDIR)
PYTHON_VENV := $(PROJECT_ROOT)/.venv/bin/python
PYTHON ?= $(if $(shell test -x $(PYTHON_VENV) && echo ok),$(PYTHON_VENV),python3)
PIP ?= $(PYTHON) -m pip

ANALYSIS_DIR := data/processed/analysis

.PHONY: help venv install extract transform update-data analysis report grupos-diagnostico neoenergia-diagnostico \
	dashboard dashboard-full serve backend dev-serve preflight-backend pipeline \
	check-artifacts check-artifacts-full validate-contracts validate-contracts-processed \
	test-fast test-smoke test clean-analysis venv-recreate doctor

help:
	@echo "Targets disponíveis:"
	@echo "  make venv            - cria ambiente virtual .venv"
	@echo "  make venv-recreate   - recria .venv do zero (remove + cria)"
	@echo "  make install         - instala dependências em requirements.txt"
	@echo "  make doctor          - verifica saúde da .venv e imports críticos"
	@echo "  make extract         - baixa dados da ANEEL"
	@echo "  make transform       - transforma dados brutos"
	@echo "  make update-data     - extract + transform"
	@echo "  make analysis        - gera tabelas analíticas"
	@echo "  make report          - gera relatório markdown"
	@echo "  make grupos-diagnostico - gera diagnóstico por grupos econômicos"
	@echo "  make neoenergia-diagnostico - alias de compatibilidade (exporta artefatos legados neo)"
	@echo "  make dashboard       - gera JSON + abre dashboard/relatorio interativo"
	@echo "  make dashboard-full  - analysis + grupos + dashboard JSON"
	@echo "  make serve           - servidor local para visualizar o dashboard (PORT=8050 por padrão)"
	@echo "  make backend         - sobe backend FastAPI local em http://localhost:\$${PORT}"
	@echo "  make dev-serve       - dashboard-full + preflight + backend em modo reload (PORT=8050)"
	@echo "  make pipeline        - update-data + analysis + report + grupos + dashboard"
	@echo "  make validate-contracts - valida contratos de schema (raw + processed)"
	@echo "  make check-artifacts - valida artefatos core"
	@echo "  make check-artifacts-full - valida artefatos completos + dashboard JSON"
	@echo "  make test-fast       - compilação + imports + contratos + artefatos core"
	@echo "  make test-smoke      - smoke completo com grupos + dashboard"
	@echo "  make test            - alias para test-fast"
	@echo "  make clean-analysis  - remove saídas em data/processed/analysis"

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

extract:
	$(PYTHON) -m src.etl.extract_aneel

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

dashboard:
	$(PYTHON) -m src.analysis.build_dashboard_data
	@echo ""
	@echo "✅ Dashboard pronto! Abra no navegador:"
	@echo "   dashboard/index.html      (interativo)"
	@echo "   dashboard/relatorio.html  (relatório imprimível)"

dashboard-full: analysis grupos-diagnostico neoenergia-diagnostico dashboard

serve: dashboard
	@echo "🌐 Abrindo http://localhost:$(PORT)"
	cd dashboard && $(PYTHON) -m http.server $(PORT)

preflight-backend:
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts-full

backend: preflight-backend
	@echo "🚀 Backend FastAPI em http://localhost:$(PORT)"
	$(PYTHON) -m uvicorn src.backend.main:app --host 0.0.0.0 --port $(PORT)

dev-serve: dashboard-full preflight-backend
	@echo "🚀 Backend FastAPI (reload) em http://localhost:$(PORT)"
	$(PYTHON) -m uvicorn src.backend.main:app --host 0.0.0.0 --port $(PORT) --reload

pipeline: update-data analysis report grupos-diagnostico neoenergia-diagnostico dashboard

check-artifacts:
	$(PYTHON) scripts/check_artifacts.py --profile core

check-artifacts-full:
	$(PYTHON) scripts/check_artifacts.py --profile full

validate-contracts:
	$(PYTHON) scripts/validate_schema_contracts.py

validate-contracts-processed:
	$(PYTHON) scripts/validate_schema_contracts.py --processed-only

test-fast:
	$(PYTHON) -m py_compile src/etl/extract_aneel.py src/etl/transform_aneel.py src/etl/schema_contracts.py src/analysis/build_analysis_tables.py src/analysis/build_report.py src/analysis/distributor_groups.py src/analysis/grupos_diagnostico.py src/analysis/neoenergia_diagnostico.py src/analysis/build_dashboard_data.py src/backend/main.py
	$(PYTHON) scripts/smoke_imports.py
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts

test-smoke: analysis report grupos-diagnostico neoenergia-diagnostico dashboard
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full

test: test-fast

clean-analysis:
	rm -rf $(ANALYSIS_DIR)
