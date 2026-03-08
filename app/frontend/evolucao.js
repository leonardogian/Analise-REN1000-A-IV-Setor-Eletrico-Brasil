/**
 * Heatmap de Evolução Mensal (Holdings × Meses)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let allData = [];
    const state = {
        metric: 'fora_prazo_por_100k_uc_mes',
        selectedHoldings: []
    };

    const fmtNum = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v);
    const fmtMoney = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(v);

    const METRIC_LABELS = {
        fora_prazo_por_100k_uc_mes: 'Falhas / 100k UCs-mês',
        compensacao_rs_por_uc_mes: 'Compensação R$/UC-mês'
    };

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

    // Cor da célula: ciano (baixo) → vermelho (alto)
    function metricToColor(normalized) {
        const hue = 180 - normalized * 180;
        const sat = 80 + normalized * 20;
        const lit = 35 + normalized * 15;
        return `hsl(${hue}, ${sat}%, ${lit}%)`;
    }

    try {
        const res = await fetch('./dashboard_timeseries.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_timeseries.json');
        const json = await res.json();

        allData = (json.data || []).filter(d => d.tipo === 'holding');
        const holdings = [...new Set(allData.map(d => d.grupo))].sort();
        state.selectedHoldings = [...holdings];

        initFilters(holdings);
        renderHeatmap();
        initThemeToggle();

    } catch (err) {
        console.error(err);
        document.getElementById('heatmap-container').innerHTML =
            `<p style="color:#ef4444; padding:1rem">${err.message}</p>`;
    }

    function initFilters(holdings) {
        const sel = document.getElementById('holding-select');
        holdings.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', e => {
            state.selectedHoldings = Array.from(e.target.selectedOptions).map(o => o.value);
            renderHeatmap();
        });
        document.querySelectorAll('input[name="metric-radio"]').forEach(r => {
            r.addEventListener('change', e => {
                state.metric = e.target.value;
                renderHeatmap();
            });
        });
    }

    function renderHeatmap() {
        const container = document.getElementById('heatmap-container');
        container.innerHTML = '';

        const filtered = allData.filter(d => state.selectedHoldings.includes(d.grupo));
        if (!filtered.length) {
            container.innerHTML = '<p style="padding:1rem; color:var(--text-muted)">Nenhum dado para os filtros selecionados.</p>';
            return;
        }

        const holdings = [...new Set(filtered.map(d => d.grupo))].sort();
        const months = [...new Set(allData.map(d => d.date))].sort();

        const lookup = {};
        filtered.forEach(d => {
            if (!lookup[d.grupo]) lookup[d.grupo] = {};
            lookup[d.grupo][d.date] = d[state.metric];
        });

        const values = filtered.map(d => d[state.metric]).filter(v => v != null && isFinite(v));
        const vMin = Math.min(...values);
        const vMax = Math.max(...values);
        const range = vMax - vMin || 1;

        document.getElementById('heatmap-title').textContent =
            `Heatmap: ${METRIC_LABELS[state.metric]} por Mês`;

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        grid.style.gridTemplateColumns = `160px repeat(${months.length}, minmax(20px, 1fr))`;

        // Header row: corner + month labels
        grid.appendChild(document.createElement('div'));
        months.forEach(m => {
            const lbl = document.createElement('div');
            lbl.className = 'heatmap-axis-label';
            const [yr, mo] = m.split('-');
            lbl.textContent = mo === '01' ? `Jan/${yr.slice(2)}` : (mo === '07' ? 'Jul' : '');
            lbl.title = m;
            grid.appendChild(lbl);
        });

        // Data rows
        holdings.forEach(holding => {
            const rowLabel = document.createElement('div');
            rowLabel.className = 'heatmap-row-label';
            rowLabel.textContent = holding;
            grid.appendChild(rowLabel);

            months.forEach(m => {
                const val = lookup[holding]?.[m];
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                if (val != null && isFinite(val)) {
                    const norm = (val - vMin) / range;
                    cell.style.backgroundColor = metricToColor(norm);
                    cell.title = `${holding} — ${m}: ${fmtNum(val)}`;
                    cell.addEventListener('mouseenter', () => {
                        const fmt = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
                        document.getElementById('heatmap-tooltip-info').textContent =
                            `${holding} · ${m}: ${fmt(val)}`;
                    });
                } else {
                    cell.style.backgroundColor = 'rgba(255,255,255,0.03)';
                    cell.title = `${holding} — ${m}: sem dados`;
                }
                grid.appendChild(cell);
            });
        });

        container.appendChild(grid);

        // Summary
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const maxEntry = filtered.reduce((a, b) => b[state.metric] > a[state.metric] ? b : a);
        const fmtVal = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
        document.getElementById('evolucao-summary').innerHTML = `
            <p>Média: <strong>${fmtNum(avg)}</strong></p>
            <p style="margin-top:0.5rem">Pico: <strong>${maxEntry.grupo}</strong> em ${maxEntry.date}<br>
            <strong>${fmtVal(maxEntry[state.metric])}</strong></p>
        `;
    }

    function initThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) icon.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
        btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'dark';
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙';
            renderHeatmap();
        });
    }
});
