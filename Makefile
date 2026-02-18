SHELL := /bin/bash

# Usa .venv/bin/python quando disponível; fallback para python3.
PYTHON ?= $(shell if [ -x .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)
PIP ?= $(PYTHON) -m pip

ANALYSIS_DIR := data/processed/analysis

.PHONY: help venv install extract transform update-data analysis report neoenergia-diagnostico \
	dashboard dashboard-full serve backend dev-serve preflight-backend pipeline \
	check-artifacts check-artifacts-full validate-contracts validate-contracts-processed \
	test-fast test-smoke test clean-analysis

help:
	@echo "Targets disponíveis:"
	@echo "  make venv            - cria ambiente virtual .venv"
	@echo "  make install         - instala dependências em requirements.txt"
	@echo "  make extract         - baixa dados da ANEEL"
	@echo "  make transform       - transforma dados brutos"
	@echo "  make update-data     - extract + transform"
	@echo "  make analysis        - gera tabelas analíticas"
	@echo "  make report          - gera relatório markdown"
	@echo "  make neoenergia-diagnostico - gera benchmark detalhado das 5 Neoenergias"
	@echo "  make dashboard       - gera JSON + abre dashboard/relatorio interativo"
	@echo "  make dashboard-full  - analysis + neoenergia + dashboard JSON"
	@echo "  make serve           - servidor local para visualizar o dashboard"
	@echo "  make backend         - sobe backend FastAPI local em http://localhost:8050"
	@echo "  make dev-serve       - dashboard-full + preflight + backend em modo reload"
	@echo "  make pipeline        - update-data + analysis + report + neoenergia + dashboard"
	@echo "  make validate-contracts - valida contratos de schema (raw + processed)"
	@echo "  make check-artifacts - valida artefatos core"
	@echo "  make check-artifacts-full - valida artefatos completos + dashboard JSON"
	@echo "  make test-fast       - compilação + imports + contratos + artefatos core"
	@echo "  make test-smoke      - smoke completo com neoenergia + dashboard"
	@echo "  make test            - alias para test-fast"
	@echo "  make clean-analysis  - remove saídas em data/processed/analysis"

venv:
	python3 -m venv .venv

install:
	$(PIP) install -r requirements.txt

extract:
	$(PYTHON) -m src.etl.extract_aneel

transform:
	$(PYTHON) -m src.etl.transform_aneel

update-data: extract transform

analysis:
	$(PYTHON) -m src.analysis.build_analysis_tables

report:
	$(PYTHON) -m src.analysis.build_report

neoenergia-diagnostico:
	$(PYTHON) -m src.analysis.neoenergia_diagnostico

dashboard:
	$(PYTHON) -m src.analysis.build_dashboard_data
	@echo ""
	@echo "✅ Dashboard pronto! Abra no navegador:"
	@echo "   dashboard/index.html      (interativo)"
	@echo "   dashboard/relatorio.html  (relatório imprimível)"

dashboard-full: analysis neoenergia-diagnostico dashboard

serve: dashboard
	@echo "🌐 Abrindo http://localhost:8050"
	cd dashboard && $(PYTHON) -m http.server 8050

preflight-backend:
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts-full

backend: preflight-backend
	@echo "🚀 Backend FastAPI em http://localhost:8050"
	$(PYTHON) -m uvicorn src.backend.main:app --host 0.0.0.0 --port 8050

dev-serve: dashboard-full preflight-backend
	@echo "🚀 Backend FastAPI (reload) em http://localhost:8050"
	$(PYTHON) -m uvicorn src.backend.main:app --host 0.0.0.0 --port 8050 --reload

pipeline: update-data analysis report neoenergia-diagnostico dashboard

check-artifacts:
	$(PYTHON) scripts/check_artifacts.py --profile core

check-artifacts-full:
	$(PYTHON) scripts/check_artifacts.py --profile full

validate-contracts:
	$(PYTHON) scripts/validate_schema_contracts.py

validate-contracts-processed:
	$(PYTHON) scripts/validate_schema_contracts.py --processed-only

test-fast:
	$(PYTHON) -m py_compile src/etl/extract_aneel.py src/etl/transform_aneel.py src/etl/schema_contracts.py src/analysis/build_analysis_tables.py src/analysis/build_report.py src/analysis/neoenergia_diagnostico.py src/analysis/build_dashboard_data.py src/backend/main.py
	$(PYTHON) scripts/smoke_imports.py
	@$(MAKE) validate-contracts-processed
	@$(MAKE) check-artifacts

test-smoke: analysis report neoenergia-diagnostico dashboard
	@$(MAKE) validate-contracts
	@$(MAKE) check-artifacts-full

test: test-fast

clean-analysis:
	rm -rf $(ANALYSIS_DIR)
