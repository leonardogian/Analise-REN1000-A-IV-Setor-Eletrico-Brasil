#!/usr/bin/env python3
"""
qa_screenshots.py — Captura screenshots de todas as páginas do dashboard TCC ANEEL
Uso: python3 scripts/qa_screenshots.py
Saída: output/screenshots/YYYY-MM-DD_HHMMSS/
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8051"
PAGES = [
    "index.html",
    "transgressoes.html",
    "benchmark.html",
    "evolucao.html",
    "ranking.html",
    "mapa.html",
]

async def main():
    # Criar diretório de saída
    now = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out_dir = Path("output/screenshots") / now
    out_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        for page_name in PAGES:
            url = f"{BASE_URL}/{page_name}"
            print(f"📸 Capturando {page_name}...", end=" ", flush=True)

            try:
                await page.goto(url, wait_until="networkidle", timeout=15000)
                await page.wait_for_timeout(3000)  # Aguardar charts

                dest = out_dir / f"{page_name.replace('.html', '')}.png"
                await page.screenshot(path=str(dest), full_page=True)

                # Capturar console logs
                console_logs = []
                def log_console(msg):
                    console_logs.append(f"[{msg.type}] {msg.text}")
                page.on("console", log_console)

                print(f"✓ {dest.name}")
            except Exception as e:
                print(f"✗ Erro: {e}")
                sys.exit(1)

        await browser.close()

    print(f"\n✅ Screenshots salvos em: {out_dir}")
    print(f"Arquivos gerados:")
    for f in sorted(out_dir.glob("*.png")):
        print(f"  - {f.name} ({f.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    asyncio.run(main())
