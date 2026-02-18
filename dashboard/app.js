/**
 * TCC REN 1000 — Interactive Dashboard
 * Chart.js + Vanilla JS
 */

const dashboardState = {
    data: null,
    selectedGroupId: null,
};

/* ===================== THEME TOGGLE ===================== */
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
    if (!btn) return;
    const iconSpan = btn.querySelector('.icon') || btn;
    iconSpan.textContent = theme === 'dark' ? '🌙' : '☀️';
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

window.toggleTheme = toggleTheme;

/* ===================== FORMATTERS (pt-BR) ===================== */
const fmtNum = (v, d = 0) => {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const fmtPct = (v, d = 2) => {
    if (v == null || isNaN(v)) return '—';
    return (Number(v) * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
};

const fmtMoney = (v) => {
    if (v == null || isNaN(v)) return '—';
    if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
    if (Math.abs(v) >= 1e3) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'k';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtMoneyFull = (v) => {
    if (v == null || isNaN(v)) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ===================== COLORS ===================== */
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

const DISTRIBUTOR_PALETTE = [
    '#00A443',
    '#00843D',
    '#34d399',
    '#F4A100',
    '#fb7185',
    '#0ea5e9',
    '#8b5cf6',
    '#f97316',
    '#a3e635',
    '#14b8a6',
];

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

/* ===================== CHART HELPERS ===================== */
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

/* ===================== PAYLOAD NORMALIZATION ===================== */
function normalizeDashboardPayload(data) {
    if (data.group_views && data.distributor_groups) return data;

    const neoView = {
        anual: (data.neo_anual || []).map(r => ({ ...r, distributor_label: r.neo_distribuidora, distributor_id: r.neo_distribuidora })),
        tendencia: (data.neo_tendencia || []).map(r => ({ ...r, distributor_label: r.neo_distribuidora, distributor_id: r.neo_distribuidora })),
        benchmark: (data.neo_benchmark || []).map(r => ({
            ...r,
            distributor_label: r.neo_distribuidora,
            distributor_id: r.neo_distribuidora,
            rank_porte_grupo: r.rank_porte_neo,
            indice_fora_vs_mediana_grupo: r.indice_fora_vs_mediana_neo,
            indice_comp_vs_mediana_grupo: r.indice_comp_vs_mediana_neo,
        })),
        classe_local: (data.neo_classe_local || []).map(r => ({ ...r, distributor_label: r.neo_distribuidora, distributor_id: r.neo_distribuidora })),
        longa_resumo: (data.neo_longa_resumo || []).map(r => ({ ...r, distributor_label: r.neo_distribuidora, distributor_id: r.neo_distribuidora })),
        mensal: (data.neo_mensal || []).map(r => ({ ...r, distributor_label: r.neo_distribuidora, distributor_id: r.neo_distribuidora })),
    };
    return {
        ...data,
        distributor_groups: [{
            group_id: 'neoenergia',
            group_label: 'Grupo Neoenergia',
            distributor_count: neoView.anual.length ? new Set(neoView.anual.map(r => r.distributor_label)).size : 0,
            selector_enabled: true,
            distributor_ids: [],
            distributor_names: [...new Set(neoView.anual.map(r => r.distributor_label))],
            years: [...new Set(neoView.anual.map(r => r.ano))].sort(),
        }],
        group_views: { neoenergia: neoView },
        default_group_id: 'neoenergia',
    };
}

function getGroupDefs(data) {
    const groups = Array.isArray(data.distributor_groups) ? data.distributor_groups : [];
    const enabled = groups.filter(g => g.selector_enabled);
    return enabled.length ? enabled : groups;
}

function getActiveGroupContext(data) {
    const groups = getGroupDefs(data);
    const views = data.group_views || {};
    if (!groups.length) {
        return {
            group: null,
            view: { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] },
        };
    }

    const preferred = dashboardState.selectedGroupId || localStorage.getItem('selected_group_id') || data.default_group_id;
    const validGroup = groups.find(g => g.group_id === preferred) || groups[0];
    dashboardState.selectedGroupId = validGroup.group_id;
    const view = views[validGroup.group_id] || { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] };
    return { group: validGroup, view };
}

function getDistributorMeta(view) {
    const map = new Map();
    const sections = ['anual', 'mensal', 'benchmark', 'tendencia', 'classe_local', 'longa_resumo'];
    sections.forEach(section => {
        (view[section] || []).forEach(row => {
            const key = row.distributor_id || row.sigagente || row.distributor_label;
            const label = row.distributor_label || row.nomagente || row.sigagente || key;
            if (!map.has(key)) map.set(key, { key, label });
        });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function makeColorMap(distributors) {
    const colors = {};
    distributors.forEach((dist, idx) => {
        colors[dist.key] = DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length];
    });
    return colors;
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

/* ===================== GROUP SELECTOR ===================== */
function initGroupSelector(data) {
    const selector = document.getElementById('group-selector');
    if (!selector) return;

    const groups = getGroupDefs(data);
    selector.innerHTML = groups
        .map(group => `<option value="${group.group_id}">${group.group_label} (${group.distributor_count})</option>`)
        .join('');

    const preferred = dashboardState.selectedGroupId || localStorage.getItem('selected_group_id') || data.default_group_id;
    const valid = groups.find(g => g.group_id === preferred) ? preferred : (groups[0] ? groups[0].group_id : null);
    if (valid) {
        dashboardState.selectedGroupId = valid;
        selector.value = valid;
    }

    selector.addEventListener('change', () => {
        dashboardState.selectedGroupId = selector.value;
        localStorage.setItem('selected_group_id', selector.value);
        destroyCharts();
        renderAll(dashboardState.data);
    });
}

function updateGroupTexts(group, view) {
    if (!group) return;
    const years = group.years && group.years.length
        ? group.years
        : [...new Set((view.anual || []).map(r => r.ano))].sort();
    const period = years.length ? `${years[0]}–${years[years.length - 1]}` : '—';

    const setters = [
        ['group-title-main', group.group_label],
        ['group-count-main', String(group.distributor_count || 0)],
        ['group-label-desc', group.group_label.toLowerCase()],
        ['group-title-reg', group.group_label],
        ['group-label-reg', group.group_label.toLowerCase()],
        ['group-label-diag', group.group_label.toLowerCase()],
        ['group-period-tag', period],
    ];
    setters.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

/* ===================== TAB 1: VISÃO GERAL ===================== */
function renderOverview(data) {
    const kpi = data.kpi_overview || {};
    const serie = data.serie_anual || [];

    document.getElementById('kpi-taxa-pre').textContent = fmtPct(kpi.pre_taxa_media);
    document.getElementById('kpi-taxa-pos').textContent = fmtPct(kpi.pos_taxa_media);
    document.getElementById('kpi-taxa-delta').textContent = fmtPct(kpi.delta_taxa);
    document.getElementById('kpi-taxa-delta').className = 'kpi-delta ' + ((kpi.delta_taxa ?? 0) <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-comp-pre').textContent = fmtMoney(kpi.pre_compensacao_total);
    document.getElementById('kpi-comp-pos').textContent = fmtMoney(kpi.pos_compensacao_total);
    document.getElementById('kpi-comp-delta').textContent = fmtMoney(kpi.delta_compensacao);
    document.getElementById('kpi-comp-delta').className = 'kpi-delta ' + ((kpi.delta_compensacao ?? 0) <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-serv-total').textContent = fmtNum((kpi.pre_servicos_total || 0) + (kpi.pos_servicos_total || 0));
    document.getElementById('kpi-fora-total').textContent = fmtNum((kpi.pre_fora_prazo_total || 0) + (kpi.pos_fora_prazo_total || 0));

    const years = serie.map(r => r.ano);
    const taxas = serie.map(r => (r.taxa_fora_prazo || 0) * 100);
    const comps = serie.map(r => r.compensacao_rs || 0);
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
            }],
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
                        },
                    },
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
                            },
                        },
                    },
                },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v.toFixed(1) + '%' },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });

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
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => fmtMoneyFull(ctx.parsed.y) } },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => fmtMoney(v) },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });
}

/* ===================== GROUP-BASED TABS ===================== */
function renderBenchmark(view, distributors, colors) {
    const anual = view.anual || [];
    const trend = view.tendencia || [];
    const bench = view.benchmark || [];
    if (!anual.length) return;

    const anos = [...new Set(anual.map(r => r.ano))].sort();
    const rowMap = new Map(
        anual.map(r => [`${r.distributor_id || r.sigagente || r.distributor_label}|${r.ano}`, r])
    );

    createChart('chart-neo-fora', {
        type: 'bar',
        data: {
            labels: anos,
            datasets: distributors.map(d => ({
                label: d.label,
                data: anos.map(a => {
                    const row = rowMap.get(`${d.key}|${a}`);
                    return row ? row.fora_prazo_por_100k_uc_mes : 0;
                }),
                backgroundColor: colors[d.key] + 'cc',
                borderColor: colors[d.key],
                borderWidth: 1.5,
                borderRadius: 4,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y, 2)} por 100k UC` } },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Fora prazo / 100k UC-mês', font: { size: 11 } },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });

    createChart('chart-neo-comp', {
        type: 'bar',
        data: {
            labels: anos,
            datasets: distributors.map(d => ({
                label: d.label,
                data: anos.map(a => {
                    const row = rowMap.get(`${d.key}|${a}`);
                    return row ? row.compensacao_rs_por_uc_mes : 0;
                }),
                backgroundColor: colors[d.key] + 'cc',
                borderColor: colors[d.key],
                borderWidth: 1.5,
                borderRadius: 4,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: R$ ${fmtNum(ctx.parsed.y, 4)} / UC` } },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Compensação R$ / UC-mês', font: { size: 11 } },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });

    if (bench.length) {
        const maxFora = Math.max(...bench.map(b => b.fora_prazo_por_100k_uc_mes || 0), 0);
        const maxComp = Math.max(...bench.map(b => b.compensacao_rs_por_uc_mes || 0), 0);
        const maxTaxa = Math.max(...bench.map(b => b.taxa_fora_prazo || 0), 0);

        createChart('chart-neo-radar', {
            type: 'radar',
            data: {
                labels: ['Fora prazo/100k UC', 'Compensação/UC', 'Taxa fora prazo', 'Índice vs mediana (fora)', 'Índice vs mediana (comp)'],
                datasets: bench.map(b => {
                    const key = b.distributor_id || b.distributor_label;
                    return {
                        label: b.distributor_label,
                        data: [
                            maxFora > 0 ? (b.fora_prazo_por_100k_uc_mes / maxFora) * 100 : 0,
                            maxComp > 0 ? (b.compensacao_rs_por_uc_mes / maxComp) * 100 : 0,
                            maxTaxa > 0 ? (b.taxa_fora_prazo / maxTaxa) * 100 : 0,
                            b.indice_fora_vs_mediana_grupo ? b.indice_fora_vs_mediana_grupo * 50 : 0,
                            b.indice_comp_vs_mediana_grupo ? b.indice_comp_vs_mediana_grupo * 25 : 0,
                        ],
                        borderColor: colors[key],
                        backgroundColor: colors[key] + '20',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: colors[key],
                    };
                }),
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
                    },
                },
            },
        });
    }

    const tbody = document.getElementById('trend-table-body');
    if (tbody) {
        tbody.innerHTML = trend.map(t => {
            const deltaPct = t.delta_fora_prazo_por_100k_uc_mes_pct;
            const deltaClass = deltaPct <= 0 ? 'positive' : 'negative';
            return `<tr>
                <td>${t.distributor_label}</td>
                <td class="num">${fmtNum(t.fora_prazo_por_100k_uc_mes_2023, 2)}</td>
                <td class="num">${fmtNum(t.fora_prazo_por_100k_uc_mes_2025, 2)}</td>
                <td class="num"><span class="kpi-delta ${deltaClass}">${deltaPct != null ? fmtPct(deltaPct) : '—'}</span></td>
                <td class="num">${fmtPct(t.taxa_fora_prazo_2023)}</td>
                <td class="num">${fmtPct(t.taxa_fora_prazo_2025)}</td>
            </tr>`;
        }).join('');
    }
}

function renderRegulatory(view, distributors, colors) {
    const mensal = view.mensal || [];
    if (!mensal.length) return;
    const allMonths = [...new Set(mensal.map(r => `${r.ano}-${String(r.mes).padStart(2, '0')}`))].sort();

    createChart('chart-reg-mensal', {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: distributors.map(d => {
                const distData = mensal.filter(r => (r.distributor_id || r.distributor_label) === d.key);
                return {
                    label: d.label,
                    data: allMonths.map(m => {
                        const [y, mo] = m.split('-').map(Number);
                        const row = distData.find(r => r.ano === y && r.mes === mo);
                        return row ? row.taxa_fora_prazo * 100 : null;
                    }),
                    borderColor: colors[d.key],
                    backgroundColor: colors[d.key] + '15',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    fill: false,
                    spanGaps: true,
                };
            }),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? `${ctx.parsed.y.toFixed(4)}%` : '—'}` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 18,
                        callback: function (val) {
                            const label = this.getLabelForValue(val);
                            return label.endsWith('-01') ? label : '';
                        },
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => `${v.toFixed(2)}%` },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });

    createChart('chart-reg-comp-mensal', {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: distributors.map(d => {
                const distData = mensal.filter(r => (r.distributor_id || r.distributor_label) === d.key);
                return {
                    label: d.label,
                    data: allMonths.map(m => {
                        const [y, mo] = m.split('-').map(Number);
                        const row = distData.find(r => r.ano === y && r.mes === mo);
                        return row ? row.compensacao_rs : null;
                    }),
                    borderColor: colors[d.key],
                    backgroundColor: colors[d.key] + '30',
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    spanGaps: true,
                };
            }),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtMoneyFull(ctx.parsed.y)}` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 18,
                        callback: function (val) {
                            const label = this.getLabelForValue(val);
                            return label.endsWith('-01') ? label : '';
                        },
                    },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { callback: v => fmtMoney(v) },
                    grid: { color: 'rgba(0,164,67,0.06)' },
                },
            },
        },
    });
}

function renderDiagnostico(view, distributors, colors) {
    const classe = view.classe_local || [];
    const longa = view.longa_resumo || [];
    const trend = view.tendencia || [];
    const benchmark = view.benchmark || [];

    const donutContainer = document.getElementById('diagnostico-donuts');
    if (donutContainer) {
        donutContainer.innerHTML = '';
        distributors.forEach((dist, idx) => {
            const rows = classe.filter(r => (r.distributor_id || r.distributor_label) === dist.key);
            const card = document.createElement('div');
            card.className = 'chart-card chart-card-compact';
            card.innerHTML = `
                <div class="chart-title chart-title-compact">${dist.label}</div>
                <div class="chart-canvas-wrapper chart-canvas-wrapper-small">
                    <canvas id="chart-donut-${idx}"></canvas>
                </div>
            `;
            donutContainer.appendChild(card);
            if (!rows.length) return;
            createChart(`chart-donut-${idx}`, {
                type: 'doughnut',
                data: {
                    labels: rows.map(r => r.classe_local_servico),
                    datasets: [{
                        data: rows.map(r => (r.share_fora_prazo || 0) * 100),
                        backgroundColor: [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.rose, COLORS.purple],
                        borderColor: '#0a0e1a',
                        borderWidth: 3,
                        hoverOffset: 8,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 8 } },
                        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtNum(ctx.parsed, 1)}% das transgressões` } },
                    },
                },
            });
        });
    }

    const longaTable = document.getElementById('longa-table-body');
    if (longaTable) {
        longaTable.innerHTML = longa.map(r => {
            const deltaClass = r.delta_taxa_pct <= 0 ? 'positive' : 'negative';
            return `<tr>
                <td>${r.distributor_label}</td>
                <td class="num">${r.ano_inicio}</td>
                <td class="num">${r.ano_fim}</td>
                <td class="num">${fmtPct(r.taxa_inicio)}</td>
                <td class="num">${fmtPct(r.taxa_fim)}</td>
                <td class="num"><span class="kpi-delta ${deltaClass}">${fmtPct(r.delta_taxa_pct)}</span></td>
            </tr>`;
        }).join('');
    }

    if (longa.length) {
        createChart('chart-longa-bar', {
            type: 'bar',
            data: {
                labels: longa.map(r => r.distributor_label),
                datasets: [
                    {
                        label: 'Taxa 2011',
                        data: longa.map(r => (r.taxa_inicio || 0) * 100),
                        backgroundColor: COLORS.blue + 'cc',
                        borderColor: COLORS.blue,
                        borderWidth: 1.5,
                        borderRadius: 4,
                    },
                    {
                        label: 'Taxa 2023',
                        data: longa.map(r => (r.taxa_fim || 0) * 100),
                        backgroundColor: COLORS.cyan + 'cc',
                        borderColor: COLORS.cyan,
                        borderWidth: 1.5,
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y, 2)}%` } },
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => `${v.toFixed(1)}%` },
                        grid: { color: 'rgba(0,164,67,0.06)' },
                    },
                },
            },
        });
    }

    const insightBest = document.getElementById('diag-insight-best');
    const insightWorst = document.getElementById('diag-insight-worst');
    const insightTrend = document.getElementById('diag-insight-trend');

    if (insightBest && insightWorst) {
        if (benchmark.length) {
            const best = [...benchmark].sort((a, b) => (a.fora_prazo_por_100k_uc_mes || 0) - (b.fora_prazo_por_100k_uc_mes || 0))[0];
            const worst = [...benchmark].sort((a, b) => (b.fora_prazo_por_100k_uc_mes || 0) - (a.fora_prazo_por_100k_uc_mes || 0))[0];
            insightBest.innerHTML = `<strong>${best.distributor_label}</strong> apresenta a menor pressão normalizada: ${fmtNum(best.fora_prazo_por_100k_uc_mes, 2)} transgressões por 100k UC-mês.`;
            insightWorst.innerHTML = `<strong>${worst.distributor_label}</strong> concentra a maior pressão normalizada: ${fmtNum(worst.fora_prazo_por_100k_uc_mes, 2)} transgressões por 100k UC-mês.`;
        } else {
            insightBest.textContent = 'Sem dados suficientes para calcular a melhor distribuidora no período.';
            insightWorst.textContent = 'Sem dados suficientes para calcular a maior pressão normalizada.';
        }
    }

    if (insightTrend) {
        if (trend.length) {
            const comparable = trend.filter(t => t.delta_fora_prazo_por_100k_uc_mes_pct != null && !isNaN(t.delta_fora_prazo_por_100k_uc_mes_pct));
            const improved = comparable.filter(t => t.delta_fora_prazo_por_100k_uc_mes_pct <= 0);
            insightTrend.innerHTML = `<strong>${improved.length} de ${comparable.length}</strong> distribuidoras reduziram a taxa normalizada de transgressões entre 2023 e 2025.`;
        } else {
            insightTrend.textContent = 'Sem dados de tendência suficientes para o grupo selecionado.';
        }
    }
}

function renderAll(data) {
    renderOverview(data);
    const { group, view } = getActiveGroupContext(data);
    updateGroupTexts(group, view);
    const distributors = getDistributorMeta(view);
    const colors = makeColorMap(distributors);
    renderBenchmark(view, distributors, colors);
    renderRegulatory(view, distributors, colors);
    renderDiagnostico(view, distributors, colors);
}

/* ===================== MAIN ===================== */
async function loadData() {
    try {
        const res = await fetch('dashboard_data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (_fetchErr) {
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
        const rawData = await loadData();
        const data = normalizeDashboardPayload(rawData);
        dashboardState.data = data;

        initGroupSelector(data);

        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';

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
