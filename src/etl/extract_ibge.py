"""
===============================================================================
EXTRAÇÃO DE DADOS — IBGE DTB (Divisão Territorial do Brasil)
===============================================================================
OBJETIVO
    Baixar o arquivo oficial DTB_2024.zip do IBGE para data/raw/ e extrair
    o relatório de municípios em .ods. Esse dado é dimensão (código IBGE →
    município → UF → rural/urbano) usada por análises que dependem de
    contexto territorial (ex.: mapa do dashboard, integração rural/urbano
    pré-2022 prevista em .ai/DATA_OVERVIEW.md §2.1).

FONTE
    IBGE FTP público — Divisão Territorial do Brasil:
    https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/divisao_territorial/2024/DTB_2024.zip

USO
    python3 -m src.etl.extract_ibge

IDEMPOTÊNCIA
    Se o ZIP já existe e tem tamanho plausível (> 1 MB), pula o download.
    Sempre re-extrai o conteúdo para garantir estado consistente.
===============================================================================
"""

import sys
import zipfile
from datetime import datetime
from pathlib import Path

from src.etl.extract_aneel import RAIZ_PROJETO, baixar_arquivo, descompactar_zip, salvar_provenance

CATALOGO_IBGE = {
    "ibge_dtb_2024": {
        "descricao": "IBGE DTB 2024 — Divisão Territorial do Brasil (municípios, distritos, subdistritos)",
        "tier": "nuclear",
        "dataset_url": "https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/23701-divisao-territorial-brasileira.html",
        "periodicidade": "anual",
        "tamanho_esperado_mb": 2,
        "cobertura_temporal": "versão 2024 (única)",
        "recursos": [
            {
                "nome": "DTB_2024.zip",
                "url": (
                    "https://geoftp.ibge.gov.br/organizacao_do_territorio/"
                    "estrutura_territorial/divisao_territorial/2024/DTB_2024.zip"
                ),
                "tipo": "zip",
                "destino": "data/raw",
            },
        ],
    },
}

# Mínimo esperado (em bytes) para considerar o ZIP válido sem refazer download.
TAMANHO_MINIMO_ZIP_BYTES = 1 * 1024 * 1024  # 1 MB


def _zip_ja_baixado(caminho_zip: Path) -> bool:
    """Heurística simples: arquivo existe e tem tamanho plausível."""
    return caminho_zip.exists() and caminho_zip.stat().st_size >= TAMANHO_MINIMO_ZIP_BYTES


def executar_extracao_ibge() -> bool:
    """Baixa (se necessário) e descompacta o DTB do IBGE."""
    print("=" * 70)
    print("EXTRAÇÃO DE DADOS — IBGE DTB")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    total_sucesso = 0
    total_falha = 0

    for fonte_id, fonte in CATALOGO_IBGE.items():
        print(f"\n[{fonte['tier']}] {fonte['descricao']}")
        print(f"  periodicidade: {fonte['periodicidade']}")
        print(f"  cobertura:     {fonte['cobertura_temporal']}")
        print("-" * 50)

        for recurso in fonte["recursos"]:
            pasta_destino = RAIZ_PROJETO / recurso["destino"]
            pasta_destino.mkdir(parents=True, exist_ok=True)
            caminho_arquivo = pasta_destino / recurso["nome"]

            if _zip_ja_baixado(caminho_arquivo):
                tamanho_mb = caminho_arquivo.stat().st_size / (1024 * 1024)
                print(f"  [cache] {caminho_arquivo.name} já presente ({tamanho_mb:.1f} MB) — pulando download")
                total_sucesso += 1
            else:
                if baixar_arquivo(recurso["url"], caminho_arquivo, tipo=recurso["tipo"]):
                    total_sucesso += 1
                else:
                    total_falha += 1
                    continue

            # Sempre re-extrai (descompactação é idempotente no destino).
            if recurso["tipo"] == "zip":
                try:
                    descompactar_zip(caminho_arquivo, pasta_destino)
                except zipfile.BadZipFile:
                    print(f"    ERRO: ZIP corrompido: {caminho_arquivo.name}")
                    total_falha += 1

    print("\n" + "=" * 70)
    print(f"RESUMO: {total_sucesso} OK | {total_falha} falhas")
    print("=" * 70)
    salvar_provenance()

    return total_falha == 0


if __name__ == "__main__":
    sucesso = executar_extracao_ibge()
    sys.exit(0 if sucesso else 1)
