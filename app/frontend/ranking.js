/**
 * Ranking de Grupos Econômicos (REN 1000)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let data = [];
    let chartInstance = null;
    const state = { topN: 10, ascending: false, metric: null };

    const fmtNum = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v);
    const fmtPct = v => (v * 100).toFixed(2) + '%';
    const fmtMoney = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const METRIC_LABELS = {
        fora_prazo_por_100k_uc_mes: { label: 'Falhas / 100k UCs-mês', fmt: fmtNum, unit: 'falhas/100k UC' },
        taxa_fora_prazo: { label: 'Taxa Fora do Prazo', fmt: fmtPct, unit: '' },
        compensacao_rs_por_uc_mes: { label: 'Compensação R$/UC-mês', fmt: fmtMoney, unit: '' },
    };

    const GROUP_COLORS = [
        '#00f0ff', '#00ff66', '#ff0055', '#f59e0b', '#b026ff',
        '#00e5ff', '#ff3366', '#3b82f6', '#10b981', '#64748b'
    ];

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

    try {
        const res = await fetch('./dashboard_groups_ranking.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_groups_ranking.json — execute: python3 -m src.analysis.build_dashboard_data');
        const json = await res.json();
        data = json.data || [];

        const numericKeys = data.length > 0
            ? Object.keys(data[0]).filter(k => typeof data[0][k] === 'number' && k !== 'n_distribuidoras')
            : [];

        initFilters(numericKeys);
        render();
        initThemeToggle();

    } catch (err) {
        console.error(err);
        document.getElementById('ranking-summary').innerHTML =
            `<p style="color:#ef4444; font-size:0.85rem">${err.message}</p>`;
    }

    function initFilters(numericKeys) {
        const metricSelect = document.getElementById('metric-select');
        // Show known metrics first, then any extras
        const ordered = Object.keys(METRIC_LABELS).filter(k => numericKeys.includes(k))
            .concat(numericKeys.filter(k => !METRIC_LABELS[k]));

        ordered.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = METRIC_LABELS[k]?.label || k.replace(/_/g, ' ');
            metricSelect.appendChild(opt);
        });

        const preferred = ordered.find(k => k.includes('100k')) || ordered[0];
        if (preferred) { metricSelect.value = preferred; state.metric = preferred; }

        metricSelect.addEventListener('change', e => { state.metric = e.target.value; render(); });
        document.getElementById('topn-select').addEventListener('change', e => { state.topN = +e.target.value; render(); });
        document.getElementById('asc-toggle').addEventListener('change', e => { state.ascending = e.target.checked; render(); });
    }

    function render() {
        if (!state.metric || !data.length) return;

        const sorted = [...data]
            .filter(d => d[state.metric] != null)
            .sort((a, b) => state.ascending
                ? a[state.metric] - b[state.metric]
                : b[state.metric] - a[state.metric]);
        const sliced = state.topN >= 999 ? sorted : sorted.slice(0, state.topN);

        renderChart(sliced);
        renderTable(sliced);
        renderSummary(sorted);
    }

    function renderChart(sliced) {
        const ctx = document.getElementById('rankingChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum, unit: '' };

        document.getElementById('chart-title').textContent =
            `Ranking: ${METRIC_LABELS[state.metric]?.label || state.metric}`;

        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = isLight ? "#475569" : "#8a949e";
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sliced.map(d => d.grupo),
                datasets: [{
                    label: METRIC_LABELS[state.metric]?.label || state.metric,
                    data: sliced.map(d => d[state.metric]),
                    backgroundColor: sliced.map((_, i) => GROUP_COLORS[i % GROUP_COLORS.length] + '33'),
                    borderColor: sliced.map((_, i) => GROUP_COLORS[i % GROUP_COLORS.length]),
                    borderWidth: 2,
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.85)',
                        titleFont: { size: 13, family: "'Outfit', sans-serif", weight: '600' },
                        bodyFont: { size: 12, family: "'Inter', sans-serif" },
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(0,240,255,0.3)',
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => `${metaInfo.fmt(ctx.parsed.x)} ${metaInfo.unit}`.trim()
                        }
                    }
                },
                scales: {
                    x: { grid: { color: gridColor } },
                    y: { grid: { color: gridColor }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    function renderTable(sliced) {
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum, unit: '' };

        head.innerHTML = `<tr>
            <th>#</th>
            <th>Grupo Econômico</th>
            <th>${METRIC_LABELS[state.metric]?.label || state.metric}</th>
            <th>Distribuidoras</th>
            <th>Porte</th>
        </tr>`;

        body.innerHTML = sliced.map((d, i) => `
            <tr>
                <td><span class="rank-badge">${i + 1}</span></td>
                <td style="font-weight:500; color: var(--text-primary)">${d.grupo}</td>
                <td>${metaInfo.fmt(d[state.metric])} <small style="color:var(--text-muted)">${metaInfo.unit}</small></td>
                <td>${d.n_distribuidoras || '—'}</td>
                <td><span class="porte-badge ${d.porte || ''}">${d.porte || '—'}</span></td>
            </tr>
        `).join('');
    }

    function renderSummary(sorted) {
        if (!sorted.length) return;
        const best = sorted[sorted.length - 1];
        const worst = sorted[0];
        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum };
        document.getElementById('ranking-summary').innerHTML = `
            <div class="insight-block">
                <h3>Melhor Desempenho</h3>
                <p><strong>${best.grupo}</strong>: ${metaInfo.fmt(best[state.metric])}</p>
            </div>
            <div class="insight-block" style="margin-top:0.75rem; border-color: var(--pop-orange)">
                <h3>Pior Desempenho</h3>
                <p><strong>${worst.grupo}</strong>: ${metaInfo.fmt(worst[state.metric])}</p>
            </div>
            <p style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted)">${sorted.length} grupos analisados · Ano mais recente</p>
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
            render();
        });
    }
});
