/**
 * Heatmap de Evolução Mensal (Holdings × Meses)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let allData = [];
    const state = {
        metric: 'fora_prazo_por_100k_uc_mes',
        selectedHoldings: []
    };

    const fmtNum = v => window.fmtNum(v, 3);
    const fmtMoney = v => window.fmtMoneyPrecise(v, 4);

    const METRIC_LABELS = {
        fora_prazo_por_100k_uc_mes: 'Falhas / 100k UCs-mês',
        compensacao_rs_por_uc_mes: 'Compensação R$/UC-mês'
    };

    // REN 1000 boundary: April 2022 (vigência)
    const REN1000_BOUNDARY = '2022-04';



    // Iberdrola heatmap: green (low) → orange (mid) → red (high)
    function metricToColor(normalized) {
        const hue = 140 - normalized * 140; // 140=green → 0=red
        const sat = 70 + normalized * 30;
        const lit = 28 + normalized * 12;
        return `hsl(${hue}, ${sat}%, ${lit}%)`;
    }

    if (typeof showSkeleton === 'function') showSkeleton('heatmap-container', 420);
    try {
        const res = await fetch('./dashboard_timeseries.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_timeseries.json');
        const json = await res.json();
        if (typeof hideSkeleton === 'function') hideSkeleton('heatmap-container');

        allData = (json.data || []).filter(d => d.tipo === 'holding');
        const holdings = [...new Set(allData.map(d => d.grupo))].sort();

        // Apply persisted global holding filter if set on another page
        if (window.dashboardFilters && window.dashboardFilters.grupos.size > 0) {
            const filtered = holdings.filter(h => window.dashboardFilters.grupos.has(h));
            state.selectedHoldings = filtered.length > 0 ? filtered : [...holdings];
        } else {
            state.selectedHoldings = [...holdings];
        }

        initFilters(holdings);
        renderHeatmap();

    } catch (err) {
        console.error(err);
        showError(document.getElementById('heatmap-container'), err.message);
    }

    function initFilters(holdings) {
        const sel = document.getElementById('holding-select');
        holdings.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            opt.selected = state.selectedHoldings.includes(h);
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

        // Detect peak and valley per holding
        const peakValley = {};
        holdings.forEach(holding => {
            let peak = null, valley = null;
            months.forEach(m => {
                const val = lookup[holding]?.[m];
                if (val == null || !isFinite(val)) return;
                if (!peak || val > peak.val) peak = { m, val };
                if (!valley || val < valley.val) valley = { m, val };
            });
            peakValley[holding] = { peak, valley };
        });

        // Find the REN 1000 boundary column index
        const boundaryIdx = months.findIndex(m => m >= REN1000_BOUNDARY);

        document.getElementById('heatmap-title').textContent =
            `Heatmap: ${METRIC_LABELS[state.metric]} por Mês`;

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        grid.style.gridTemplateColumns = `140px repeat(${months.length}, 22px)`;

        // Header row: corner + month labels
        grid.appendChild(document.createElement('div'));
        months.forEach((m, colIdx) => {
            const lbl = document.createElement('div');
            lbl.className = 'heatmap-axis-label';
            const [yr, mo] = m.split('-');

            // Show REN 1000 label at boundary
            if (colIdx === boundaryIdx) {
                lbl.textContent = 'REN 1000';
                lbl.style.color = '#1A8FE3';
                lbl.style.fontWeight = '700';
                lbl.style.fontSize = '0.6rem';
            } else {
                lbl.textContent = mo === '01' ? `Jan/${yr.slice(2)}` : (mo === '07' ? 'Jul' : '');
            }
            lbl.title = m;
            grid.appendChild(lbl);
        });

        // Data rows
        holdings.forEach(holding => {
            const rowLabel = document.createElement('div');
            rowLabel.className = 'heatmap-row-label';
            rowLabel.textContent = holding;
            grid.appendChild(rowLabel);

            const pv = peakValley[holding] || {};

            months.forEach((m, colIdx) => {
                const val = lookup[holding]?.[m];
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                // Add REN 1000 boundary separator
                if (colIdx === boundaryIdx) {
                    cell.style.borderLeft = '2px solid #1A8FE3';
                }

                if (val != null && isFinite(val)) {
                    const norm = (val - vMin) / range;
                    cell.style.backgroundColor = metricToColor(norm);
                    cell.title = `${holding} — ${m}: ${fmtNum(val)}`;

                    // Highlight peak and valley
                    if (pv.peak && pv.peak.m === m) {
                        cell.style.outline = '2px solid #ef4444';
                        cell.style.outlineOffset = '-1px';
                        cell.style.zIndex = '1';
                        cell.title += ' [PICO]';
                    } else if (pv.valley && pv.valley.m === m) {
                        cell.style.outline = '2px solid #10b981';
                        cell.style.outlineOffset = '-1px';
                        cell.style.zIndex = '1';
                        cell.title += ' [VALE]';
                    }

                    cell.addEventListener('mouseenter', () => {
                        const fmt = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
                        let info = `${holding} · ${m}: ${fmt(val)}`;
                        if (pv.peak && pv.peak.m === m) info += ' (pico)';
                        if (pv.valley && pv.valley.m === m) info += ' (vale)';
                        document.getElementById('heatmap-tooltip-info').textContent = info;
                    });
                } else {
                    cell.style.backgroundColor = 'rgba(255,255,255,0.03)';
                    cell.title = `${holding} — ${m}: sem dados`;
                }
                grid.appendChild(cell);
            });
        });

        container.appendChild(grid);

        // Legend for peak/valley markers
        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex; gap:1.5rem; margin-top:0.75rem; font-size:0.75rem; color:var(--text-muted)';
        legend.innerHTML = `
            <span><span style="display:inline-block;width:10px;height:10px;border:2px solid #ef4444;margin-right:4px"></span>Pico</span>
            <span><span style="display:inline-block;width:10px;height:10px;border:2px solid #10b981;margin-right:4px"></span>Vale</span>
            <span><span style="display:inline-block;width:10px;height:2px;background:#1A8FE3;margin-right:4px;vertical-align:middle"></span>Início REN 1000</span>
        `;
        container.appendChild(legend);

        // Summary
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const maxEntry = filtered.reduce((a, b) => b[state.metric] > a[state.metric] ? b : a);
        const minEntry = filtered.reduce((a, b) => {
            const bVal = b[state.metric];
            const aVal = a[state.metric];
            if (bVal == null || !isFinite(bVal)) return a;
            if (aVal == null || !isFinite(aVal)) return b;
            return bVal < aVal ? b : a;
        });
        const fmtVal = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
        document.getElementById('evolucao-summary').innerHTML = `
            <p>Média: <strong>${fmtNum(avg)}</strong></p>
            <p style="margin-top:0.5rem">Pico: <strong>${escapeHtml(maxEntry.grupo)}</strong> em ${escapeHtml(maxEntry.date)}<br>
            <strong style="color:#ef4444">${fmtVal(maxEntry[state.metric])}</strong></p>
            <p style="margin-top:0.5rem">Vale: <strong>${escapeHtml(minEntry.grupo)}</strong> em ${escapeHtml(minEntry.date)}<br>
            <strong style="color:#10b981">${fmtVal(minEntry[state.metric])}</strong></p>
        `;
    }

});
