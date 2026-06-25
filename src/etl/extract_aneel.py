"""
===============================================================================
EXTRAÇÃO DE DADOS — ANEEL Dados Abertos
===============================================================================
OBJETIVO
    Baixar os dados públicos do portal dadosabertos.aneel.gov.br para data/raw/
    e data/docs/, respeitando dois níveis de escopo:

      - tier "nuclear":     fontes consumidas pelo pipeline analítico do TCC.
      - tier "complementar": fontes de contexto (não entram nas métricas
                              nucleares). Baixadas só com --with-complementares.

FONTES
    NUCLEAR
      1. Qualidade do Atendimento Comercial — métrica nuclear pré-2022
         (CSV anual + CSV domínio de indicadores + PDF dicionário)
      2. INDGER — Indicadores Gerenciais da Distribuição — métrica nuclear
         pós-2022 (ZIP com CSVs mensais + CSV consolidado + PDFs)

    COMPLEMENTAR (baixadas apenas com --with-complementares)
      3. Autos de Infração — penalidades e multas ANEEL
      4. Reclamações nos 1º e 2º Níveis da Distribuidora — contexto

USO
    python3 -m src.etl.extract_aneel                 # só nuclear (padrão)
    python3 -m src.etl.extract_aneel --with-complementares  # nuclear + comp.

CATÁLOGO E METADADOS
    Cada fonte declara `tier`, `dataset_url` (landing page CKAN),
    `periodicidade` e `tamanho_esperado_mb`. Esses campos servem à
    documentação e à mensageria; a lógica de download usa só `url`,
    `nome`, `tipo` e `destino`.

    Se a ANEEL substituir um recurso mantendo o dataset, acesse o
    `dataset_url` da fonte, pegue o novo resource_id, atualize aqui.

VALIDAÇÃO
    Após extração bem-sucedida, os contratos mínimos de schema dos CSVs
    brutos nucleares são verificados via src.etl.schema_contracts.
    Arquivos complementares ausentes são ignorados silenciosamente pelo
    validador (política: nuclear é obrigatório, complementar é opcional).
===============================================================================
"""

import argparse
import json
import sys
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.etl.schema_contracts import validate_raw_contracts

# ==============================================================================
# CONFIGURAÇÃO — Catálogo de recursos do portal Dados Abertos ANEEL
# ==============================================================================

CATALOGO = {
    # ---- Fonte 1: Qualidade do Atendimento Comercial (NUCLEAR) ----
    "qualidade_comercial": {
        "descricao": "Qualidade do Atendimento Comercial (prazos e compensações)",
        "tier": "nuclear",
        "dataset_url": "https://dadosabertos.aneel.gov.br/dataset/qualidade-do-atendimento-comercial",
        "periodicidade": "anual",
        "tamanho_esperado_mb": 0.1,
        "cobertura_temporal": "2011–2023 (anual, pode ser atualizado)",
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

    # ---- Fonte 2: INDGER — Indicadores Gerenciais da Distribuição (NUCLEAR) ----
    "indger": {
        "descricao": "INDGER — Indicadores Gerenciais da Distribuição",
        "tier": "nuclear",
        "dataset_url": "https://dadosabertos.aneel.gov.br/dataset/indger-indicadores-gerenciais-da-distribuicao",
        "periodicidade": "mensal",
        "tamanho_esperado_mb": 7500,  # ZIP descompacta em dezenas de CSVs mensais; cresce conforme novas safras
        "cobertura_temporal": "desde 2023-01 (mensal). Atualizado continuamente; meses novos são aceitos se contíguos.",
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

    # ---- Fonte 3: Autos de Infração (COMPLEMENTAR) ----
    "autos_infracao": {
        "descricao": "Autos de Infração (penalidades e multas ANEEL)",
        "tier": "complementar",
        "dataset_url": "https://dadosabertos.aneel.gov.br/dataset/auto-de-infracao",
        "periodicidade": "contínua (acumulativo)",
        "tamanho_esperado_mb": None,  # não baixado localmente
        "cobertura_temporal": "contínua desde 2000+ (verificar no portal)",
        "recursos": [
            {
                "nome": "auto-infracao.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/4d690c9d-8158-4b04-ae44-7d3de8616271/resource/f221158a-93a3-423f-b794-4312b6985a24/download/auto-infracao.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "dm-auto-de-infracao.pdf",
                "url": "https://dadosabertos.aneel.gov.br/dataset/4d690c9d-8158-4b04-ae44-7d3de8616271/resource/3e8feb4d-5d33-4b1f-8c19-a1e89f127c12/download/dm-auto-de-infracao.pdf",
                "tipo": "pdf",
                "destino": "data/docs",
            },
        ],
    },

    # ---- Fonte 4: Reclamações 1º e 2º Níveis (COMPLEMENTAR) ----
    "reclamacoes": {
        "descricao": "Reclamações nos 1º e 2º Níveis da Distribuidora",
        "tier": "complementar",
        "dataset_url": "https://dadosabertos.aneel.gov.br/dataset/reclamacoes-no-1o-e-2o-niveis-da-distribuidora",
        "periodicidade": "anual (particionado por ano)",
        "tamanho_esperado_mb": None,  # não baixado localmente
        "cobertura_temporal": "2010–2025 (consolidado 2010–2022 + um CSV por ano posterior)",
        "recursos": [
            {
                "nome": "reclamacoes-n1e2-distribuidoras-2010-2022.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/364859a2-7cb8-45ea-9c88-b4392516a6ba/resource/6c3e074c-d9ab-4840-8c6c-7993faa36ddb/download/reclamacoes-n1e2-distribuidoras-2010-2022.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "reclamacoes-n1e2-distribuidoras-2023.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/364859a2-7cb8-45ea-9c88-b4392516a6ba/resource/426f4fb2-6a89-452a-8236-cc48153ee607/download/reclamacoes-n1e2-distribuidoras-2023.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "reclamacoes-n1e2-distribuidoras-2024.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/364859a2-7cb8-45ea-9c88-b4392516a6ba/resource/4af32411-da8b-492c-ae15-8f615e35d2e2/download/reclamacoes-n1e2-distribuidoras-2024.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "reclamacoes-n1e2-distribuidoras-2025.csv",
                "url": "https://dadosabertos.aneel.gov.br/dataset/364859a2-7cb8-45ea-9c88-b4392516a6ba/resource/83839c4e-78f9-4f68-bcb7-51dcfcf05c9c/download/reclamacoes-n1e2-distribuidoras-2025.csv",
                "tipo": "csv",
                "destino": "data/raw",
            },
            {
                "nome": "dm-reclamacoes-nos-1o-e-2o-niveis-da-distribuidora.pdf",
                "url": "https://dadosabertos.aneel.gov.br/dataset/364859a2-7cb8-45ea-9c88-b4392516a6ba/resource/928f6910-1a40-41a2-8bf1-7965a5fe4ca7/download/dm-reclamacoes-nos-1o-e-2o-niveis-da-distribuidora.pdf",
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
PROVENANCE_RECORDS: list[dict[str, object]] = []


def _requests_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def _git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=RAIZ_PROJETO,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


def _registrar_provenance(
    *,
    url: str,
    caminho_destino: Path,
    tipo: str,
    response: requests.Response,
    bytes_baixados: int,
) -> None:
    PROVENANCE_RECORDS.append(
        {
            "downloaded_at": datetime.now().isoformat(timespec="seconds"),
            "git_sha": _git_sha(),
            "url": url,
            "path": str(caminho_destino.relative_to(RAIZ_PROJETO)),
            "tipo": tipo,
            "status_code": response.status_code,
            "content_type": response.headers.get("Content-Type", ""),
            "content_length": response.headers.get("Content-Length", ""),
            "last_modified": response.headers.get("Last-Modified", ""),
            "etag": response.headers.get("ETag", ""),
            "bytes_baixados": bytes_baixados,
        }
    )


def salvar_provenance() -> None:
    if not PROVENANCE_RECORDS:
        return
    out_dir = RAIZ_PROJETO / "data" / "_provenance"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"extract_aneel_{stamp}.json"
    out_path.write_text(json.dumps(PROVENANCE_RECORDS, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nProvenance salvo em: {out_path.relative_to(RAIZ_PROJETO)}")


def baixar_arquivo(
    url: str,
    caminho_destino: Path,
    *,
    tipo: str = "csv",
    timeout: tuple[int, int] = (15, 120),
) -> bool:
    """
    Baixa um arquivo da URL e salva no caminho indicado.

    Usa streaming para não carregar arquivos grandes inteiramente na memória.
    Exibe progresso no terminal quando o Content-Length está disponível.

    Retorna True se o download foi bem-sucedido.
    """
    try:
        print(f"  ↓ Baixando: {caminho_destino.name}...", end=" ", flush=True)

        session = _requests_session()
        response = session.get(url, stream=True, timeout=timeout)
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "").lower()
        if "text/html" in content_type:
            raise RuntimeError(f"servidor retornou HTML em vez de {tipo}: {content_type}")

        expected = response.headers.get("Content-Length")
        expected_bytes = int(expected) if expected and expected.isdigit() else None

        bytes_baixados = 0
        partial_path = caminho_destino.with_suffix(caminho_destino.suffix + ".part")
        partial_path.unlink(missing_ok=True)
        with open(partial_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    bytes_baixados += len(chunk)

        if expected_bytes is not None and bytes_baixados != expected_bytes:
            partial_path.unlink(missing_ok=True)
            raise RuntimeError(
                f"download truncado: esperado {expected_bytes} bytes, recebeu {bytes_baixados}"
            )

        partial_path.replace(caminho_destino)
        _registrar_provenance(
            url=url,
            caminho_destino=caminho_destino,
            tipo=tipo,
            response=response,
            bytes_baixados=bytes_baixados,
        )

        tamanho_mb = bytes_baixados / (1024 * 1024)
        print(f"OK {tamanho_mb:.1f} MB")
        return True

    except requests.exceptions.ConnectionError:
        print("ERRO de conexão. Verifique sua internet.")
        return False
    except requests.exceptions.Timeout:
        print(f"TIMEOUT ({timeout}s). O servidor demorou demais.")
        return False
    except requests.exceptions.HTTPError as e:
        print(f"ERRO HTTP: {e.response.status_code}")
        caminho_destino.with_suffix(caminho_destino.suffix + ".part").unlink(missing_ok=True)
        return False
    except Exception as e:
        print(f"ERRO inesperado: {e}")
        caminho_destino.with_suffix(caminho_destino.suffix + ".part").unlink(missing_ok=True)
        return False


def descompactar_zip(caminho_zip: Path, destino: Path) -> list[str]:
    """Descompacta ZIP e extrai membros para destino. Retorna lista de arquivos extraídos."""
    arquivos_extraidos = []
    try:
        destino_resolvido = destino.resolve()
        with zipfile.ZipFile(caminho_zip, "r") as zf:
            for membro in zf.namelist():
                target = (destino / membro).resolve()
                try:
                    target.relative_to(destino_resolvido)
                except ValueError as exc:
                    raise RuntimeError(f"entrada ZIP insegura fora do destino: {membro}") from exc
                zf.extract(membro, destino)
                arquivos_extraidos.append(membro)
                print(f"    [zip] Extraído: {membro}")
    except zipfile.BadZipFile:
        print(f"    ERRO: ZIP corrompido: {caminho_zip.name}")
    return arquivos_extraidos


# ==============================================================================
# FUNÇÃO PRINCIPAL
# ==============================================================================

def executar_extracao(incluir_complementares: bool = False) -> bool:
    """
    Percorre o catálogo e baixa os recursos das fontes selecionadas.

    Args:
        incluir_complementares: Se True, baixa também fontes de tier
            "complementar" (autos de infração, reclamações). Por padrão,
            apenas nucleares (qualidade_comercial, indger).

    Returns:
        True se todos os downloads tentados forem bem-sucedidos e os
        contratos raw de fontes nucleares validarem.
    """
    print("=" * 70)
    print("EXTRAÇÃO DE DADOS — ANEEL Dados Abertos")
    print(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    tier_label = "nuclear + complementar" if incluir_complementares else "apenas nuclear"
    print(f"Escopo: {tier_label}")
    print("=" * 70)

    total_sucesso = 0
    total_falha = 0
    total_pulado = 0
    contrato_ok = False

    for fonte_id, fonte in CATALOGO.items():
        tier = fonte.get("tier", "nuclear")

        if tier == "complementar" and not incluir_complementares:
            print(f"\n[skip] {fonte['descricao']} (tier=complementar; use --with-complementares)")
            total_pulado += len(fonte["recursos"])
            continue

        print(f"\n[{tier}] {fonte['descricao']}")
        if "periodicidade" in fonte:
            print(f"  periodicidade: {fonte['periodicidade']}")
        if "cobertura_temporal" in fonte:
            print(f"  cobertura:     {fonte['cobertura_temporal']}")
        print("-" * 50)

        for recurso in fonte["recursos"]:
            pasta_destino = RAIZ_PROJETO / recurso["destino"]
            pasta_destino.mkdir(parents=True, exist_ok=True)
            caminho_arquivo = pasta_destino / recurso["nome"]

            sucesso = baixar_arquivo(recurso["url"], caminho_arquivo, tipo=recurso["tipo"])

            if sucesso:
                total_sucesso += 1
                if recurso["tipo"] == "zip":
                    descompactar_zip(caminho_arquivo, pasta_destino)
            else:
                total_falha += 1

    # Validação de contratos (apenas nuclear é exigido; complementar é opcional)
    if total_falha == 0:
        erros_contrato = validate_raw_contracts(
            RAIZ_PROJETO / "data" / "raw",
            incluir_complementares=incluir_complementares,
        )
        if erros_contrato:
            print("\nFALHA na validação de contratos dos dados brutos:")
            for erro in erros_contrato:
                print(f"   - {erro}")
            total_falha += len(erros_contrato)
        else:
            contrato_ok = True

    print("\n" + "=" * 70)
    print(
        f"RESUMO: {total_sucesso} downloads OK | {total_falha} falhas"
        + (f" | {total_pulado} pulados (complementar)" if total_pulado else "")
    )
    print(f"Contratos de schema bruto: {'OK' if contrato_ok else 'FALHOU'}")
    print("=" * 70)
    salvar_provenance()

    if total_falha == 0 and contrato_ok:
        print("\nTodos os arquivos foram baixados com sucesso.")
        print("Próximo passo: python3 -m src.etl.transform_aneel")
    else:
        print("\nExtração concluída com falhas.")
        print("Verifique downloads e contratos de schema antes de seguir.")

    return total_falha == 0 and contrato_ok


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python3 -m src.etl.extract_aneel",
        description=(
            "Baixa dados públicos da ANEEL para data/raw/ e data/docs/. "
            "Por padrão apenas fontes nucleares (qualidade_comercial, indger)."
        ),
    )
    parser.add_argument(
        "--with-complementares",
        action="store_true",
        help="Incluir fontes complementares (autos_infracao, reclamacoes).",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    sucesso = executar_extracao(incluir_complementares=args.with_complementares)
    sys.exit(0 if sucesso else 1)
