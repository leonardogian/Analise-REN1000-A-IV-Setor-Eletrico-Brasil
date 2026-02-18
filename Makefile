SHELL := /bin/bash

# Usa .venv/bin/python quando disponível; fallback para python3.
PYTHON ?= $(shell if [ -x .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)
PIP ?= $(PYTHON) -m pip

ANALYSIS_DIR := data/processed/analysis

.PHONY: help venv install extract transform update-data analysis report pipeline \
	check-artifacts test-fast test-smoke test clean-analysis

help:
	@echo "Targets disponíveis:"
	@echo "  make venv            - cria ambiente virtual .venv"
	@echo "  make install         - instala dependências em requirements.txt"
	@echo "  make extract         - baixa dados da ANEEL"
	@echo "  make transform       - transforma dados brutos"
	@echo "  make update-data     - extract + transform"
	@echo "  make analysis        - gera tabelas analíticas"
	@echo "  make report          - gera relatório markdown"
	@echo "  make pipeline        - update-data + analysis + report"
	@echo "  make check-artifacts - valida se saídas principais existem"
	@echo "  make test-fast       - testes rápidos (compilação + imports + artefatos)"
	@echo "  make test-smoke      - smoke test completo (analysis + report + validação)"
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

pipeline: update-data analysis report

check-artifacts:
	$(PYTHON) scripts/check_artifacts.py

test-fast:
	$(PYTHON) -m py_compile src/etl/extract_aneel.py src/etl/transform_aneel.py src/analysis/build_analysis_tables.py src/analysis/build_report.py
	$(PYTHON) scripts/smoke_imports.py
	@$(MAKE) check-artifacts

test-smoke: analysis report
	@$(MAKE) check-artifacts

test: test-fast

clean-analysis:
	rm -rf $(ANALYSIS_DIR)
