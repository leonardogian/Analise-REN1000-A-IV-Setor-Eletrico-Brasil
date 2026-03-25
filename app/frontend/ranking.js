/**
 * Ranking de Grupos Econômicos (REN 1000)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let data = [];
    let headlines = {};
    let chartInstance = null;
    const state = { topN: 10, ascending: false, metric: null };

    const fmtNum = v => window.fmtNum(v, 2);
    const fmtPct = v => window.fmtPct(v, 2);
    const fmtMoney = v => window.fmtMoneyFull(v);
    const fmtVar = v => window.fmtVar(v);

    const METRIC_LABELS = {
        variacao_taxa_pct: { label: 'Variação Taxa (%) Pós-REN 1000', fmt: fmtVar, unit: '', isVariation: true },
        qtd_fora_prazo: { label: 'Qtd. Falhas Absolutas (Total)', fmt: fmtNum, unit: 'falhas' },
        fora_prazo_por_100k_uc_mes: { label: 'Falhas / 100k UCs-mês', fmt: fmtNum, unit: 'falhas/100k UC' },
        taxa_fora_prazo: { label: 'Taxa Fora do Prazo', fmt: fmtPct, unit: '' },
        compensacao_rs: { label: 'Compensação Absoluta (R$)', fmt: fmtMoney, unit: '' },
        compensacao_rs_por_uc_mes: { label: 'Compensação R$/UC-mês', fmt: fmtMoney, unit: '' },
    };

    const GROUP_COLORS = [
        '#00C65A', '#1A8FE3', '#FF6B1A', '#A8D96B', '#8b5cf6',
        '#ec4899', '#4aa8ee', '#ef4444', '#14b8a6', '#4a6656'
    ];



    if (typeof showSkeleton === 'function') showSkeleton('ranking-chart-wrapper', 360);
    try {
        const res = await fetch('./dashboard_groups_ranking.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_groups_ranking.json — execute: python3 -m src.analysis.build_dashboard_data');
        const json = await res.json();
        if (typeof hideSkeleton === 'function') hideSkeleton('ranking-chart-wrapper');
        data = json.data || [];
        headlines = json.headlines || {};

        const numericKeys = data.length > 0
            ? Object.keys(data[0]).filter(k => typeof data[0][k] === 'number' && k !== 'n_distribuidoras')
            : [];

        initFilters(numericKeys);
        render();

    } catch (err) {
        console.error(err);
        showError(document.getElementById('ranking-summary'), err.message);
    }

    function initFilters(numericKeys) {
        const metricSelect = document.getElementById('metric-select');
        // Show known metrics first (variation metrics at top), then any extras
        const ordered = Object.keys(METRIC_LABELS).filter(k => numericKeys.includes(k))
            .concat(numericKeys.filter(k => !METRIC_LABELS[k]));

        ordered.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = METRIC_LABELS[k]?.label || k.replace(/_/g, ' ');
            metricSelect.appendChild(opt);
        });

        // Default to variation metric if available, else fallback to 100k
        const preferred = ordered.find(k => k === 'variacao_taxa_pct')
            || ordered.find(k => k.includes('100k'))
            || ordered[0];
        if (preferred) { metricSelect.value = preferred; state.metric = preferred; }

        metricSelect.addEventListener('change', e => { state.metric = e.target.value; render(); });
        document.getElementById('topn-select').addEventListener('change', e => { state.topN = +e.target.value || 10; render(); });
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
        const container = document.getElementById('rankingChart').parentElement;
        container.style.minHeight = Math.max(350, sliced.length * 35) + 'px';

        if (chartInstance) chartInstance.destroy();


        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum, unit: '' };
        const isVariation = metaInfo.isVariation || false;

        let scaleType = 'linear';
        if (!isVariation) {
            const vals = sliced.map(d => d[state.metric]).filter(v => v > 0);
            if (vals.length > 0) {
                const max = Math.max(...vals);
                const min = Math.min(...vals);
                if (min > 0 && (max / min > 20)) scaleType = 'logarithmic';
            }
        }

        document.getElementById('chart-title').textContent =
            `Ranking: ${METRIC_LABELS[state.metric]?.label || state.metric}`;

        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#4a6656';
        const gridColor = 'rgba(19, 42, 26, 0.4)';

        // Color bars: green for improvement (negative variation), red for worsening (positive)
        const barBg = sliced.map((d, i) => {
            if (isVariation) {
                const val = d[state.metric];
                return val < 0
                    ? 'rgba(0,198,90,0.35)'
                    : 'rgba(239,68,68,0.35)';
            }
            return GROUP_COLORS[i % GROUP_COLORS.length] + '33';
        });
        const barBorder = sliced.map((d, i) => {
            if (isVariation) {
                return d[state.metric] < 0 ? '#10b981' : '#ef4444';
            }
            return GROUP_COLORS[i % GROUP_COLORS.length];
        });

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sliced.map(d => d.grupo),
                datasets: [{
                    label: METRIC_LABELS[state.metric]?.label || state.metric,
                    data: sliced.map(d => d[state.metric]),
                    backgroundColor: barBg,
                    borderColor: barBorder,
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
                        backgroundColor: 'rgba(10, 26, 16, 0.95)',
                        titleFont: { size: 13, family: "'Inter', sans-serif", weight: '600' },
                        titleColor: '#F0FDF4',
                        bodyFont: { size: 12, family: "'Inter', sans-serif" },
                        bodyColor: '#94a3b8',
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: 'rgba(0, 198, 90, 0.3)',
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => {
                                const val = ctx.parsed.x;
                                let text = `${metaInfo.fmt(val)} ${metaInfo.unit}`.trim();
                                if (isVariation) {
                                    const d = data.find(r => r.grupo === ctx.label);
                                    if (d) {
                                        const pre = d.pre_taxa != null ? fmtPct(d.pre_taxa) : '—';
                                        const pos = d.pos_taxa != null ? fmtPct(d.pos_taxa) : '—';
                                        text += ` (${pre} → ${pos})`;
                                    }
                                }
                                return text;
                            }
                        }
                    },
                    annotation: isVariation ? {
                        annotations: {
                            zeroLine: {
                                type: 'line',
                                xMin: 0, xMax: 0,
                                borderColor: 'rgba(251, 191, 36, 0.5)',
                                borderWidth: 2,
                                borderDash: [4, 4],
                                label: {
                                    display: true,
                                    content: 'Sem mudança',
                                    position: 'start',
                                    backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                    color: '#fbbf24',
                                    font: { size: 10 },
                                }
                            }
                        }
                    } : {}
                },
                scales: {
                    x: { type: scaleType, grid: { color: gridColor } },
                    y: { grid: { color: gridColor }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    function renderTable(sliced) {
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum, unit: '' };
        const isVariation = metaInfo.isVariation || false;

        head.innerHTML = `<tr>
            <th>#</th>
            <th>Grupo Econômico</th>
            <th>${METRIC_LABELS[state.metric]?.label || state.metric}</th>
            ${isVariation ? '<th>Pré-REN</th><th>Pós-REN</th>' : ''}
            <th>Distribuidoras</th>
            <th>Porte</th>
        </tr>`;

        body.innerHTML = sliced.map((d, i) => {
            const val = d[state.metric];
            const colorClass = isVariation ? (val < 0 ? 'color: #10b981' : 'color: #ef4444') : '';
            return `
            <tr>
                <td><span class="rank-badge">${i + 1}</span></td>
                <td style="font-weight:500; color: var(--text-primary)">${escapeHtml(d.grupo)}</td>
                <td style="${colorClass}; font-weight:600">${metaInfo.fmt(val)} <small style="color:var(--text-muted)">${metaInfo.unit}</small></td>
                ${isVariation ? `<td>${d.pre_taxa != null ? fmtPct(d.pre_taxa) : '—'}</td><td>${d.pos_taxa != null ? fmtPct(d.pos_taxa) : '—'}</td>` : ''}
                <td>${d.n_distribuidoras || '—'}</td>
                <td><span class="porte-badge ${d.porte || ''}">${d.porte || '—'}</span></td>
            </tr>`;
        }).join('');
    }

    function renderSummary(sorted) {
        if (!sorted.length) return;
        const metaInfo = METRIC_LABELS[state.metric] || { fmt: fmtNum };
        const isVariation = metaInfo.isVariation || false;

        // Show headline from Python-generated insights
        let headlineHtml = '';
        if (headlines.ranking) {
            headlineHtml = `<div class="insight-block" style="border-color: var(--pop-cyan); margin-bottom: 1rem">
                <p style="font-size: 0.95rem; font-weight: 600">${escapeHtml(headlines.ranking)}</p>
            </div>`;
        }

        if (isVariation) {
            const best = sorted.reduce((a, b) => a[state.metric] < b[state.metric] ? a : b);
            const worst = sorted.reduce((a, b) => a[state.metric] > b[state.metric] ? a : b);
            document.getElementById('ranking-summary').innerHTML = `
                ${headlineHtml}
                <div class="insight-block" style="border-color: #10b981">
                    <h3>Maior Melhoria</h3>
                    <p><strong>${escapeHtml(best.grupo)}</strong>: ${metaInfo.fmt(best[state.metric])}</p>
                </div>
                <div class="insight-block" style="margin-top:0.75rem; border-color: #ef4444">
                    <h3>Maior Piora</h3>
                    <p><strong>${escapeHtml(worst.grupo)}</strong>: ${metaInfo.fmt(worst[state.metric])}</p>
                </div>
                <p style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted)">${sorted.length} grupos analisados · Comparação REN 414 vs REN 1000</p>
            `;
        } else {
            const best = sorted[sorted.length - 1];
            const worst = sorted[0];
            document.getElementById('ranking-summary').innerHTML = `
                ${headlineHtml}
                <div class="insight-block">
                    <h3>Melhor Desempenho</h3>
                    <p><strong>${escapeHtml(best.grupo)}</strong>: ${metaInfo.fmt(best[state.metric])}</p>
                </div>
                <div class="insight-block" style="margin-top:0.75rem; border-color: var(--pop-orange)">
                    <h3>Pior Desempenho</h3>
                    <p><strong>${escapeHtml(worst.grupo)}</strong>: ${metaInfo.fmt(worst[state.metric])}</p>
                </div>
                <p style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted)">${sorted.length} grupos analisados · Ano mais recente</p>
            `;
        }
    }

});
