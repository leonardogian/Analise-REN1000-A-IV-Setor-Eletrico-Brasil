/**
 * check-charts.js — Verifica erros de console JS e presença de charts em todas as páginas.
 *
 * Pré-requisito: make serve (servidor em localhost:8051)
 * Uso: node scripts/playwright/check-charts.js
 * Exit code: 0 se tudo OK, 1 se houver erros.
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8051';
const PAGES = [
    { file: 'index.html',         minCharts: 2 },
    { file: 'transgressoes.html', minCharts: 1 },
    { file: 'benchmark.html',     minCharts: 1 },
    { file: 'evolucao.html',      minCharts: 0 }, // heatmap em HTML puro
    { file: 'ranking.html',       minCharts: 1 },
    { file: 'mapa.html',          minCharts: 0 }, // mapa Leaflet
];

async function main() {
    const browser = await chromium.launch();
    let allOk = true;

    for (const { file, minCharts } of PAGES) {
        const page = await browser.newPage();
        const errors = [];

        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', err => errors.push(err.message));

        await page.goto(`${BASE_URL}/${file}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);

        const canvases = await page.locator('canvas').count();
        const pageOk = errors.length === 0 && canvases >= minCharts;

        if (pageOk) {
            const chartLabel = canvases > 0 ? `${canvases} chart(s) OK` : 'sem charts (esperado)';
            console.log(`OK ${file} - ${chartLabel}`);
        } else {
            allOk = false;
            if (errors.length > 0) {
                console.log(`ERRO ${file} - ${errors.length} erro(s) de console:`);
                errors.slice(0, 5).forEach(e => console.log(`   ${e}`));
                if (errors.length > 5) console.log(`   ... e mais ${errors.length - 5}`);
            }
            if (canvases < minCharts) {
                console.log(`ERRO ${file} - esperado ${minCharts} chart(s), encontrado ${canvases}`);
            }
        }

        await page.close();
    }

    await browser.close();

    if (allOk) {
        console.log('\nTodas as paginas OK');
    } else {
        console.log('\nErros encontrados - ver detalhes acima');
    }

    process.exit(allOk ? 0 : 1);
}

main().catch(err => {
    console.error('Erro fatal:', err.message);
    process.exit(1);
});
