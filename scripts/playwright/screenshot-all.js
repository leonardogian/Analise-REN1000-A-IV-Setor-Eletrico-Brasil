/**
 * screenshot-all.js — Captura screenshots de todas as páginas do dashboard.
 *
 * Pré-requisito: make serve (servidor em localhost:8050)
 * Uso: node scripts/playwright/screenshot-all.js
 * Saída: output/screenshots/YYYY-MM-DD-HHMMSS/
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8050';
const PAGES = [
    'index.html',
    'transgressoes.html',
    'benchmark.html',
    'evolucao.html',
    'ranking.html',
    'mapa.html',
];

async function main() {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace('T', '-')
        .replace(/:/g, '')
        .slice(0, 15);
    const outDir = path.resolve('output', 'screenshots', timestamp);
    fs.mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const p of PAGES) {
        const url = `${BASE_URL}/${p}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500); // aguardar charts renderizarem
        const name = p.replace('.html', '');
        const dest = path.join(outDir, `${name}.png`);
        await page.screenshot({ path: dest, fullPage: true });
        console.log(`OK ${p} -> ${dest}`);
    }

    await browser.close();
    console.log(`\nScreenshots salvas em: ${outDir}`);
}

main().catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
});
