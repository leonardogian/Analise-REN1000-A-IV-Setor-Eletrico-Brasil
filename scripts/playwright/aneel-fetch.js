/**
 * aneel-fetch.js — Download de CSVs do portal de dados abertos da ANEEL.
 *
 * Uso: node scripts/playwright/aneel-fetch.js <indicador> <ano>
 * Exemplo: node scripts/playwright/aneel-fetch.js DIC 2023
 *
 * Indicadores suportados: DIC, FIC, DMIC, DICRI, DICRD
 * Anos suportados: 2011-2023
 */
const { chromium } = require('playwright');
const path = require('path');

const ANEEL_URL = 'https://dadosabertos.aneel.gov.br/dataset/indicadores-de-qualidade-da-distribuicao-de-energia-eletrica';

async function main() {
    const [indicador, ano] = process.argv.slice(2);

    if (!indicador || !ano) {
        console.error('Uso: node aneel-fetch.js <indicador> <ano>');
        console.error('Exemplo: node aneel-fetch.js DIC 2023');
        process.exit(1);
    }

    const destDir = path.resolve('data', 'raw');
    console.log(`Buscando ${indicador} ${ano} em dadosabertos.aneel.gov.br...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        acceptDownloads: true,
    });
    const page = await context.newPage();

    await page.goto(ANEEL_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Procurar link de download com o indicador e ano no nome
    const pattern = new RegExp(`${indicador}.*${ano}|${ano}.*${indicador}`, 'i');
    const links = await page.locator('a[href*=".csv"]').all();

    let found = false;
    for (const link of links) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        if (pattern.test(text) || pattern.test(href)) {
            console.log(`Encontrado: ${text || href}`);
            const download = await Promise.all([
                page.waitForEvent('download'),
                link.click(),
            ]).then(([dl]) => dl);
            const dest = path.join(destDir, await download.suggestedFilename());
            await download.saveAs(dest);
            console.log(`Salvo em: ${dest}`);
            found = true;
            break;
        }
    }

    if (!found) {
        console.log(`Nenhum CSV encontrado para ${indicador} ${ano}`);
        console.log('Verifique o portal manualmente:', ANEEL_URL);
    }

    await browser.close();
    process.exit(found ? 0 : 1);
}

main().catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
});
