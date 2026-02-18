"""
===============================================================================
📥 EXTRAÇÃO DE DADOS — ANEEL Dados Abertos
===============================================================================
OBJETIVO:
    Baixar os dados públicos de Qualidade Comercial e INDGER do portal
    dadosabertos.aneel.gov.br para a pasta data/raw/.

FONTES:
    1. Qualidade do Atendimento Comercial (prazos, transgressões, compensações)
    2. INDGER - Serviços Comerciais (quantidades, prazos, estoques, compensações)
    3. INDGER - Dados Comerciais (faturamento, danos elétricos, atendimento)
    4. Dicionários de dados e domínios (PDFs e CSVs auxiliares)

COMO RODAR:
    python -m src.etl.extract_aneel

PAGINAÇÃO:
    Os CSVs da ANEEL são arquivos únicos (não paginados). O portal CKAN
    disponibiliza cada recurso como download direto. Caso o arquivo mude de
    URL no futuro, use a CKAN API (package_show) para resolver dinamicamente.
===============================================================================
"""

import os
import sys
import zipfile
import requests
from pathlib import Path
from datetime import datetime

from src.etl.schema_contracts import validate_raw_contracts

# ==============================================================================
# CONFIGURAÇÃO — Catálogo de recursos do portal Dados Abertos ANEEL
# ==============================================================================
# Cada entrada tem: nome descritivo, nome do arquivo e URL de download direta.
# Se a ANEEL mudar as URLs, basta atualizar aqui.

CATALOGO = {
    # ---- Fonte 1: Qualidade do Atendimento Comercial ----
    "qualidade_comercial": {
        "descricao": "Qualidade do Atendimento Comercial (prazos e compensações)",
        "recursos": [
            {
                "nome": "qualidade-atendimento-comercial.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/b7b32b0c-4bac-4584-b9ec-76a32c05ca02/resource/11473878-1059-44f8-abf0-677212ff247b/download/qualidade-atendimento-comercial.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "dominio-indicadores.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/b7b32b0c-4bac-4584-b9ec-76a32c05ca02/resource/e3724332-7de8-4273-8f0d-b20ebb91bf7c/download/dominio-indicadores.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "dm-qualidade-do-atendimento-comercial.pdf",
                "url": "https://dadosabertos.aneel.gov.br/dataset/b7b32b0c-4bac-4584-b9ec-76a32c05ca02/resource/c9850994-5872-4c99-97f6-eca8f3cc42b5/download/dm-qualidade-do-atendimento-comercial.pdf",
                "tipo": "pdf",
                "destino": "data/docs",
            },
        ],
    },

    # ---- Fonte 2: INDGER — Indicadores Gerenciais da Distribuição ----
    "indger": {
        "descricao": "INDGER - Indicadores Gerenciais da Distribuição",
        "recursos": [
            {
                "nome": "indger-dados-servicos-comerciais.zip",
                "url": "https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/8dd3acbe-0d0f-40c4-bafc-da270c639ed9/download/indger-dados-servicos-comerciais.zip",
                "tipo": "zip",
                "destino": "data/raw",
            },
            {
                "nome": "indger-dados-comerciais.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/fd10c9d4-cb76-4020-a322-e79afb13eaf7/download/indger-dados-comerciais.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "dm-indger-dados-de-servicos-comerciais.pdf",
                "url": "https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/86e54795-42be-4938-9cb3-b77797d43980/download/dm-indger-dados-de-servicos-comerciais.pdf",
                "tipo": "pdf",
                "destino": "data/docs",
            },
            {
                "nome": "dm-indger-dados-comerciais.pdf",
                "url": "https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/756794aa-0828-4a3f-83f5-d36f863dd802/download/dm-indger-dados-comerciais.pdf",
                "tipo": "pdf",
                "destino": "data/docs",
            },
        ],
    },
}

# ==============================================================================
# FUNÇÕES DE DOWNLOAD
# ==============================================================================

# Diretório raiz do projeto (2 níveis acima de src/etl/)
RAIZ_PROJETO = Path(__file__).resolve().parent.parent.parent


def baixar_arquivo(url: str, caminho_destino: Path, timeout: int = 120) -> bool:
    """
    Baixa um arquivo da URL e salva no caminho indicado.

    Usa streaming para não carregar arquivos grandes inteiramente na memória.
    Exibe progresso no terminal quando o Content-Length está disponível.

    Retorna True se o download foi bem-sucedido.
    """
    try:
        print(f"  ↓ Baixando: {caminho_destino.name}...", end=" ", flush=True)

        response = requests.get(url, stream=True, timeout=timeout)
        response.raise_for_status()

        # Tamanho total (nem sempre disponível)
        tamanho_total = response.headers.get("Content-Length")
        tamanho_total = int(tamanho_total) if tamanho_total else None

        # Salvamento com streaming (chunks de 8KB)
        bytes_baixados = 0
        with open(caminho_destino, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                bytes_baixados += len(chunk)

        # Feedback
        tamanho_mb = bytes_baixados / (1024 * 1024)
        print(f"✅ {tamanho_mb:.1f} MB")
        return True

    except requests.exceptions.ConnectionError:
        print("❌ ERRO de conexão. Verifique sua internet.")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT ({timeout}s). O servidor demorou demais.")
        return False
    except requests.exceptions.HTTPError as e:
        print(f"❌ ERRO HTTP: {e.response.status_code}")
        return False
    except Exception as e:
        print(f"❌ ERRO inesperado: {e}")
        return False


def descompactar_zip(caminho_zip: Path, destino: Path) -> list[str]:
    """
    Descompacta um arquivo ZIP, extrai CSVs para o destino.
    Retorna a lista de arquivos extraídos.
    """
    arquivos_extraidos = []
    try:
        with zipfile.ZipFile(caminho_zip, "r") as zf:
            for membro in zf.namelist():
                zf.extract(membro, destino)
                arquivos_extraidos.append(membro)
                print(f"    📦 Extraído: {membro}")
    except zipfile.BadZipFile:
        print(f"    ❌ Arquivo ZIP corrompido: {caminho_zip.name}")
    return arquivos_extraidos


# ==============================================================================
# FUNÇÃO PRINCIPAL
# ==============================================================================

def executar_extracao():
    """
    Percorre o catálogo de recursos e baixa cada um para a pasta correta.
    Descompacta ZIPs automaticamente.
    """
    print("=" * 70)
    print("📥 EXTRAÇÃO DE DADOS — ANEEL Dados Abertos")
    print(f"   Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    total_sucesso = 0
    total_falha = 0
    contrato_ok = False

    for fonte_id, fonte in CATALOGO.items():
        print(f"\n🔹 {fonte['descricao']}")
        print("-" * 50)

        for recurso in fonte["recursos"]:
            # Monta o caminho de destino
            pasta_destino = RAIZ_PROJETO / recurso["destino"]
            pasta_destino.mkdir(parents=True, exist_ok=True)
            caminho_arquivo = pasta_destino / recurso["nome"]

            # Baixa o arquivo
            sucesso = baixar_arquivo(recurso["url"], caminho_arquivo)

            if sucesso:
                total_sucesso += 1

                # Se for ZIP, descompacta automaticamente na mesma pasta
                if recurso["tipo"] == "zip":
                    descompactar_zip(caminho_arquivo, pasta_destino)
            else:
                total_falha += 1

    if total_falha == 0:
        erros_contrato = validate_raw_contracts(RAIZ_PROJETO / "data" / "raw")
        if erros_contrato:
            print("\n❌ Falha na validação de contratos dos dados brutos:")
            for erro in erros_contrato:
                print(f"   - {erro}")
            total_falha += len(erros_contrato)
        else:
            contrato_ok = True

    # Resumo final
    print("\n" + "=" * 70)
    print(f"📊 RESUMO: {total_sucesso} downloads OK | {total_falha} falhas")
    print(f"🔎 Contratos de schema bruto: {'OK' if contrato_ok else 'FALHOU'}")
    print("=" * 70)

    if total_falha == 0 and contrato_ok:
        print("\n✅ Todos os arquivos foram baixados com sucesso!")
        print("   Próximo passo: python -m src.etl.transform_aneel")
    else:
        print("\n⚠️  Extração concluída com falhas.")
        print("   Verifique downloads e contratos de schema antes de seguir.")

    return total_falha == 0 and contrato_ok


# ==============================================================================
# PONTO DE ENTRADA
# ==============================================================================

if __name__ == "__main__":
    sucesso = executar_extracao()
    sys.exit(0 if sucesso else 1)
