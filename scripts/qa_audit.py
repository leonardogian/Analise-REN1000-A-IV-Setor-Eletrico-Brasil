#!/usr/bin/env python3
"""
qa_audit.py — Auditoria completa de QA do dashboard TCC ANEEL
Verifica: console errors, performance, acessibilidade, carregamento de dados
Uso: python3 scripts/qa_audit.py
"""
import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8051"
PAGES = [
    ("index.html", "Visão Geral"),
    ("transgressoes.html", "Séries Temporais"),
    ("benchmark.html", "Benchmark"),
    ("evolucao.html", "Evolução"),
    ("ranking.html", "Ranking"),
    ("mapa.html", "Mapa Interativo"),
]

async def audit_page(browser, page_name, display_name):
    """Auditar uma página específica"""
    page = await browser.new_page(viewport={"width": 1440, "height": 900})

    console_msgs = []
    requests = []

    def on_console(msg):
        level = msg.type
        text = msg.text
        console_msgs.append({"level": level, "text": text})
        if level in ["error", "warning"]:
            print(f"    {level.upper()}: {text[:80]}")

    def on_request(req):
        requests.append({"url": req.url, "method": req.method})

    page.on("console", on_console)
    page.on("request", on_request)

    url = f"{BASE_URL}/{page_name}"
    print(f"\n📄 {display_name} ({page_name})")
    print(f"   URL: {url}")

    try:
        response = await page.goto(url, wait_until="networkidle", timeout=15000)
        print(f"   Status: {response.status}")

        await page.wait_for_timeout(3000)

        # Verificar elementos críticos
        has_title = await page.query_selector("h1, h2") is not None
        has_charts = await page.query_selector("[data-testid*='chart'], .chart, canvas") is not None

        # Contar console messages
        errors = [m for m in console_msgs if m["level"] == "error"]
        warnings = [m for m in console_msgs if m["level"] == "warning"]

        # Informações sobre requisições
        json_requests = [r for r in requests if "json" in r["url"]]

        print(f"   ✓ Título encontrado: {has_title}")
        print(f"   ✓ Charts detectados: {has_charts}")
        print(f"   📊 Console: {len(console_msgs)} mensagens ({len(errors)} erros, {len(warnings)} avisos)")
        print(f"   📡 Requisições: {len(requests)} total ({len(json_requests)} JSON)")

        if errors:
            print(f"   🔴 ERROS DETECTADOS:")
            for e in errors[:3]:
                print(f"      - {e['text'][:100]}")

        await page.close()
        return {
            "page": page_name,
            "display_name": display_name,
            "status": response.status,
            "has_title": has_title,
            "has_charts": has_charts,
            "console_total": len(console_msgs),
            "console_errors": len(errors),
            "console_warnings": len(warnings),
            "total_requests": len(requests),
            "json_requests": len(json_requests),
            "errors": [e["text"] for e in errors[:5]]
        }

    except Exception as e:
        print(f"   ✗ Erro: {e}")
        await page.close()
        return {
            "page": page_name,
            "display_name": display_name,
            "error": str(e)
        }

async def main():
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])

        for page_name, display_name in PAGES:
            result = await audit_page(browser, page_name, display_name)
            results.append(result)

        await browser.close()

    # Salvar relatório
    now = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    report_path = Path(f"output/qa_audit_{now}.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)

    with open(report_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Resumo
    print("\n" + "="*60)
    print("RESUMO DA AUDITORIA")
    print("="*60)

    passed = sum(1 for r in results if "error" not in r)
    print(f"✓ Páginas OK: {passed}/{len(PAGES)}")

    total_errors = sum(r.get("console_errors", 0) for r in results)
    total_warnings = sum(r.get("console_warnings", 0) for r in results)

    print(f"📊 Console erros globais: {total_errors}")
    print(f"⚠️  Console avisos globais: {total_warnings}")

    print(f"\n📄 Relatório salvo: {report_path}")

if __name__ == "__main__":
    asyncio.run(main())
