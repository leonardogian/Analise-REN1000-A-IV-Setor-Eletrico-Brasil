/**
 * TCC REN 1000 — Interactive Dashboard
 * Chart.js + Vanilla JS
 */

/* ===================== THEME TOGGLE ===================== */
const dashboardState = { data: null };

function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initTheme() {
    applyTheme(getPreferredTheme());
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme, { rerender: true });
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const iconSpan = btn.querySelector('.icon') || btn;
        iconSpan.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

function updateChartTheme(theme) {
    if (theme === 'light') {
        Chart.defaults.color = '#475569';
        Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.05)';
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        Chart.defaults.plugins.tooltip.titleColor = '#0f172a';
        Chart.defaults.plugins.tooltip.bodyColor = '#475569';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 0, 0, 0.1)';
        return;
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(0, 164, 67, 0.08)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = '#fff';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 164, 67, 0.3)';
}

function applyTheme(theme, { rerender = false } = {}) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    updateChartTheme(theme);

    if (rerender && dashboardState.data) {
        destroyCharts();
        renderAll(dashboardState.data);
    }
}

// Expose for HTML button
window.toggleTheme = toggleTheme;

/* ===================== FORMATTERS (pt-BR) ===================== */
const fmtNum = (v, d = 0) => {
    if (v == null || isNaN(v)) return '—';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const fmtPct = (v, d = 2) => {
    if (v == null || isNaN(v)) return '—';
    return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
};

const fmtMoney = (v) => {
    if (v == null || isNaN(v)) return '—';
    if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
    if (Math.abs(v) >= 1e3) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'k';
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtMoneyFull = (v) => {
    if (v == null || isNaN(v)) return '—';
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ===================== CHART DEFAULTS ===================== */
const COLORS = {
    blue: '#00A443',
    blueLight: '#2fc66a',
    cyan: '#00843D',
    green: '#34d399',
    amber: '#F4A100',
    red: '#E63312',
    purple: '#00402A',
    rose: '#fb7185',
    slate: '#64748b',
};

const NEO_COLORS = {
    'Neoenergia Coelba': '#00A443',
    'Neoenergia Pernambuco': '#00843D',
    'Neoenergia Elektro': '#34d399',
    'Neoenergia Cosern': '#F4A100',
    'Neoenergia Brasilia': '#fb7185',
};

const CHART_FONT = { family: "'Inter', sans-serif", size: 12, weight: '500' };

Chart.defaults.font.family = CHART_FONT.family;
Chart.defaults.font.size = CHART_FONT.size;
Chart.defaults.plugins.tooltip.titleFont = { ...CHART_FONT, weight: '700', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = CHART_FONT;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.legend.labels.padding = 16;

const chartInstances = [];

function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances.length = 0;
}

function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, config);
    chartInstances.push(chart);
    return chart;
}

/* ===================== NAVIGATION ===================== */
function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            const panel = document.getElementById(target);
            if (!panel) return;
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            panel.classList.add('active');
        });
    });
}

/* ===================== TAB 1: VISÃO GERAL ===================== */
function renderOverview(data) {
    const kpi = data.kpi_overview;
    const serie = data.serie_anual;

    // KPI Cards
    document.getElementById('kpi-taxa-pre').textContent = fmtPct(kpi.pre_taxa_media);
    document.getElementById('kpi-taxa-pos').textContent = fmtPct(kpi.pos_taxa_media);
    document.getElementById('kpi-taxa-delta').textContent = fmtPct(kpi.delta_taxa);
    document.getElementById('kpi-taxa-delta').className = 'kpi-delta ' + (kpi.delta_taxa <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-comp-pre').textContent = fmtMoney(kpi.pre_compensacao_total);
    document.getElementById('kpi-comp-pos').textContent = fmtMoney(kpi.pos_compensacao_total);
    document.getElementById('kpi-comp-delta').textContent = fmtMoney(kpi.delta_compensacao);
    document.getElementById('kpi-comp-delta').className = 'kpi-delta ' + (kpi.delta_compensacao <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-serv-total').textContent = fmtNum(kpi.pre_servicos_total + kpi.pos_servicos_total);
    document.getElementById('kpi-fora-total').textContent = fmtNum(kpi.pre_fora_prazo_total + kpi.pos_fora_prazo_total);

    // Serie anual — Line chart (taxa fora do prazo)
    const years = serie.map(r => r.ano);
    const taxas = serie.map(r => r.taxa_fora_prazo * 100);
    const comps = serie.map(r => r.compensacao_rs);
    const bgColors = serie.map(r => r.periodo_regulatorio === 'pre_2022' ? COLORS.blue : COLORS.cyan);

    createChart('chart-serie-taxa', {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Taxa fora do prazo (%)',
                data: taxas,
                borderColor: COLORS.blue,
                backgroundColor: 'rgba(0, 164, 67, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: bgColors,
                pointBorderColor: bgColors,
                borderWidth: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Taxa: ${ctx.parsed.y.toFixed(3)}%`,
                        afterLabel: ctx => {
                            const r = serie[ctx.dataIndex];
                            return `Período: ${r.periodo_regulatorio === 'pre_2022' ? 'Pré-REN 1000' : 'Pós-REN 1000'}`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: '2022',
                            xMax: '2022',
                            borderColor: 'rgba(251, 191, 36, 0.5)',
                            borderWidth: 2,
                            borderDash: [6, 4],
                            label: {
                                display: true,
                                content: 'REN 1000',
                                position: 'start',
                                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                color: '#fbbf24',
                                font: { size: 11, weight: '600' },
                            }
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v.toFixed(1) + '%' },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });

    // Bar chart (compensação)
    createChart('chart-serie-comp', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Compensação (R$)',
                data: comps,
                backgroundColor: bgColors.map(c => c + '99'),
                borderColor: bgColors,
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => fmtMoneyFull(ctx.parsed.y)
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => fmtMoney(v) },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });
}

/* ===================== TAB 2: NEOENERGIA ===================== */
function renderNeoenergia(data) {
    const neo = data.neo_anual;
    const trend = data.neo_tendencia;
    const bench = data.neo_benchmark;

    if (!neo.length) return;

    const distribuidoras = [...new Set(neo.map(r => r.neo_distribuidora))];
    const anos = [...new Set(neo.map(r => r.ano))].sort();

    // Grouped bar: fora_prazo_por_100k_uc_mes by year
    createChart('chart-neo-fora', {
        type: 'bar',
        data: {
            labels: anos,
            datasets: distribuidoras.map(d => ({
                label: d.replace('Neoenergia ', ''),
                data: anos.map(a => {
                    const row = neo.find(r => r.neo_distribuidora === d && r.ano === a);
                    return row ? row.fora_prazo_por_100k_uc_mes : 0;
                }),
                backgroundColor: NEO_COLORS[d] + 'cc',
                borderColor: NEO_COLORS[d],
                borderWidth: 1.5,
                borderRadius: 4,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y, 2)} por 100k UC`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Fora prazo / 100k UC-mês', font: { size: 11 } },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });

    // Compensação por UC grouped bar
    createChart('chart-neo-comp', {
        type: 'bar',
        data: {
            labels: anos,
            datasets: distribuidoras.map(d => ({
                label: d.replace('Neoenergia ', ''),
                data: anos.map(a => {
                    const row = neo.find(r => r.neo_distribuidora === d && r.ano === a);
                    return row ? row.compensacao_rs_por_uc_mes : 0;
                }),
                backgroundColor: NEO_COLORS[d] + 'cc',
                borderColor: NEO_COLORS[d],
                borderWidth: 1.5,
                borderRadius: 4,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: R$ ${fmtNum(ctx.parsed.y, 4)} / UC`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Compensação R$ / UC-mês', font: { size: 11 } },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });

    // Radar benchmark (latest year)
    if (bench.length) {
        const maxFora = Math.max(...bench.map(b => b.fora_prazo_por_100k_uc_mes));
        const maxComp = Math.max(...bench.map(b => b.compensacao_rs_por_uc_mes));
        const maxTaxa = Math.max(...bench.map(b => b.taxa_fora_prazo));

        createChart('chart-neo-radar', {
            type: 'radar',
            data: {
                labels: ['Fora prazo/100k UC', 'Compensação/UC', 'Taxa fora prazo', 'Índice vs mediana (fora)', 'Índice vs mediana (comp)'],
                datasets: bench.map(b => ({
                    label: b.neo_distribuidora.replace('Neoenergia ', ''),
                    data: [
                        maxFora > 0 ? b.fora_prazo_por_100k_uc_mes / maxFora * 100 : 0,
                        maxComp > 0 ? b.compensacao_rs_por_uc_mes / maxComp * 100 : 0,
                        maxTaxa > 0 ? b.taxa_fora_prazo / maxTaxa * 100 : 0,
                        b.indice_fora_vs_mediana_neo ? b.indice_fora_vs_mediana_neo * 50 : 0,
                        b.indice_comp_vs_mediana_neo ? b.indice_comp_vs_mediana_neo * 25 : 0,
                    ],
                    borderColor: NEO_COLORS[b.neo_distribuidora],
                    backgroundColor: NEO_COLORS[b.neo_distribuidora] + '20',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: NEO_COLORS[b.neo_distribuidora],
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,164,67,0.1)' },
                        angleLines: { color: 'rgba(0,164,67,0.1)' },
                        pointLabels: { font: { size: 10 } },
                        ticks: { display: false },
                    }
                }
            }
        });
    }

    // Trend table
    if (trend.length) {
        const tbody = document.getElementById('trend-table-body');
        tbody.innerHTML = trend.map(t => {
            const deltaPct = t.delta_fora_prazo_por_100k_uc_mes_pct;
            const deltaClass = deltaPct <= 0 ? 'positive' : 'negative';
            return `<tr>
        <td>${t.neo_distribuidora.replace('Neoenergia ', '')}</td>
        <td class="num">${fmtNum(t.fora_prazo_por_100k_uc_mes_2023, 2)}</td>
        <td class="num">${fmtNum(t.fora_prazo_por_100k_uc_mes_2025, 2)}</td>
        <td class="num"><span class="kpi-delta ${deltaClass}">${deltaPct != null ? fmtPct(deltaPct) : '—'}</span></td>
        <td class="num">${fmtPct(t.taxa_fora_prazo_2023)}</td>
        <td class="num">${fmtPct(t.taxa_fora_prazo_2025)}</td>
      </tr>`;
        }).join('');
    }
}

/* ===================== TAB 3: ANÁLISE REGULATÓRIA ===================== */
function renderRegulatory(data) {
    const mensal = data.neo_mensal;
    if (!mensal.length) return;

    const distribuidoras = [...new Set(mensal.map(r => r.neo_distribuidora))];

    // Multi-line: taxa fora do prazo mensal por Neoenergia
    const allMonths = [...new Set(mensal.map(r => `${r.ano}-${String(r.mes).padStart(2, '0')}`))].sort();

    createChart('chart-reg-mensal', {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: distribuidoras.map(d => {
                const dData = mensal.filter(r => r.neo_distribuidora === d);
                return {
                    label: d.replace('Neoenergia ', ''),
                    data: allMonths.map(m => {
                        const [y, mo] = m.split('-').map(Number);
                        const row = dData.find(r => r.ano === y && r.mes === mo);
                        return row ? row.taxa_fora_prazo * 100 : null;
                    }),
                    borderColor: NEO_COLORS[d],
                    backgroundColor: NEO_COLORS[d] + '15',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    fill: false,
                    spanGaps: true,
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(4) + '%' : '—'}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 18,
                        callback: function (val, idx) {
                            const label = this.getLabelForValue(val);
                            return label.endsWith('-01') ? label : '';
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v.toFixed(2) + '%' },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });

    // Stacked area: compensação mensal
    createChart('chart-reg-comp-mensal', {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: distribuidoras.map(d => {
                const dData = mensal.filter(r => r.neo_distribuidora === d);
                return {
                    label: d.replace('Neoenergia ', ''),
                    data: allMonths.map(m => {
                        const [y, mo] = m.split('-').map(Number);
                        const row = dData.find(r => r.ano === y && r.mes === mo);
                        return row ? row.compensacao_rs : null;
                    }),
                    borderColor: NEO_COLORS[d],
                    backgroundColor: NEO_COLORS[d] + '30',
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    spanGaps: true,
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${fmtMoneyFull(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 18,
                        callback: function (val) {
                            const label = this.getLabelForValue(val);
                            return label.endsWith('-01') ? label : '';
                        }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { callback: v => fmtMoney(v) },
                    grid: { color: 'rgba(0,164,67,0.06)' }
                }
            }
        }
    });
}

/* ===================== TAB 4: DIAGNÓSTICO DETALHADO ===================== */
function renderDiagnostico(data) {
    const classe = data.neo_classe_local;
    const longa = data.neo_longa_resumo;

    // Donut charts per distributor (classe/local)
    if (classe.length) {
        const distribuidoras = [...new Set(classe.map(r => r.neo_distribuidora))];

        distribuidoras.forEach((d, idx) => {
            const canvasId = `chart-donut-${idx}`;
            const rows = classe.filter(r => r.neo_distribuidora === d);

            createChart(canvasId, {
                type: 'doughnut',
                data: {
                    labels: rows.map(r => r.classe_local_servico),
                    datasets: [{
                        data: rows.map(r => r.share_fora_prazo * 100),
                        backgroundColor: [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.rose, COLORS.purple],
                        borderColor: '#0a0e1a',
                        borderWidth: 3,
                        hoverOffset: 8,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 8 } },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.label}: ${fmtNum(ctx.parsed, 1)}% das transgressões`
                            }
                        }
                    }
                }
            });
        });
    }

    // Serie longa table
    if (longa.length) {
        const tbody = document.getElementById('longa-table-body');
        tbody.innerHTML = longa.map(r => {
            const deltaClass = r.delta_taxa_pct <= 0 ? 'positive' : 'negative';
            return `<tr>
        <td>${r.neo_distribuidora.replace('Neoenergia ', '')}</td>
        <td class="num">${r.ano_inicio}</td>
        <td class="num">${r.ano_fim}</td>
        <td class="num">${fmtPct(r.taxa_inicio)}</td>
        <td class="num">${fmtPct(r.taxa_fim)}</td>
        <td class="num"><span class="kpi-delta ${deltaClass}">${fmtPct(r.delta_taxa_pct)}</span></td>
      </tr>`;
        }).join('');
    }

    // Serie longa bar chart
    if (longa.length) {
        createChart('chart-longa-bar', {
            type: 'bar',
            data: {
                labels: longa.map(r => r.neo_distribuidora.replace('Neoenergia ', '')),
                datasets: [
                    {
                        label: 'Taxa 2011',
                        data: longa.map(r => r.taxa_inicio * 100),
                        backgroundColor: COLORS.blue + 'cc',
                        borderColor: COLORS.blue,
                        borderWidth: 1.5,
                        borderRadius: 4,
                    },
                    {
                        label: 'Taxa 2023',
                        data: longa.map(r => r.taxa_fim * 100),
                        backgroundColor: COLORS.cyan + 'cc',
                        borderColor: COLORS.cyan,
                        borderWidth: 1.5,
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y, 2)}%` }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => v.toFixed(1) + '%' },
                        grid: { color: 'rgba(0,164,67,0.06)' }
                    }
                }
            }
        });
    }
}

function renderAll(data) {
    renderOverview(data);
    renderNeoenergia(data);
    renderRegulatory(data);
    renderDiagnostico(data);
}

/* ===================== MAIN ===================== */
async function loadData() {
    // Try fetch first (works when served via HTTP)
    try {
        const res = await fetch('dashboard_data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (_fetchErr) {
        // Fallback: try XMLHttpRequest (works on file:// in some browsers)
        try {
            return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'dashboard_data.json', true);
                xhr.onload = () => {
                    if (xhr.status === 0 || xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`XHR ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('XHR failed'));
                xhr.send();
            });
        } catch (_xhrErr) {
            // Check for globally embedded data (set by build script)
            if (typeof DASHBOARD_DATA !== 'undefined') {
                return DASHBOARD_DATA;
            }
            throw new Error('Não foi possível carregar dashboard_data.json. Use: make serve');
        }
    }
}

async function init() {
    initNavigation();
    initTheme();

    try {
        const data = await loadData();
        dashboardState.data = data;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';

        // Update generation timestamp
        const ts = data.meta?.generated_at;
        if (ts) {
            const d = new Date(ts);
            document.getElementById('gen-time').textContent = d.toLocaleString('pt-BR');
        }

        destroyCharts();
        renderAll(data);

    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        document.getElementById('loading').innerHTML = `
      <div class="loading-error">
        <h3>⚡ Erro ao carregar dados</h3>
        <p class="loading-error-message">${err.message}</p>
        <p class="loading-error-hint">
          O navegador bloqueia <code>fetch()</code> em <code>file://</code>.
          <br>Use o servidor local:
        </p>
        <pre class="loading-error-command">make serve</pre>
        <p class="loading-error-alt">
          ou: <code>cd dashboard && python3 -m http.server 8080</code>
        </p>
      </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);
