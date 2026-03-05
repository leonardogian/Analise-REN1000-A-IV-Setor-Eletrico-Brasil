/**
 * TCC REN 1000 — Interactive Dashboard
 * Chart.js + Vanilla JS
 */

const dashboardState = {
    data: null,
    selectedDimensionId: null,
    selectedGroupId: null,
    selectedRegulatoryId: null,
    showSuppressed: false,
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
    Chart.defaults.color = '#8a949e';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.03)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.85)';
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 240, 255, 0.4)';
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
    blue: '#00f0ff',
    blueLight: '#00e5ff',
    cyan: '#00ffff',
    green: '#00ff66',
    amber: '#f59e0b',
    red: '#ff0055',
    purple: '#b026ff',
    rose: '#ff3366',
    slate: '#64748b',
};

const DISTRIBUTOR_PALETTE = [
    '#00f0ff',
    '#00ff66',
    '#ff0055',
    '#f59e0b',
    '#b026ff',
    '#00e5ff',
    '#ff3366',
    '#3b82f6',
    '#10b981',
    '#f43f5e',
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
    if (data.group_views && data.distributor_groups) {
        const groupDimensions = Array.isArray(data.group_dimensions) ? data.group_dimensions : [{
            dimension_id: 'economico',
            dimension_label: 'Grupo Econômico',
            default_selected: data.default_group_id || null,
            groups: (data.distributor_groups || []).map(group => ({
                id: group.group_id,
                label: group.group_label,
                selector_enabled: Boolean(group.selector_enabled),
                suppressed_low_volume: false,
                metrics: {
                    qtd_serv_realizado: null,
                    qtd_fora_prazo: null,
                    compensacao_rs: null,
                    taxa_fora_prazo: null,
                    fora_prazo_por_100k_uc_mes: null,
                    compensacao_rs_por_uc_mes: null,
                },
                period_compare: {
                    pre_2022: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                    pos_2022: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                    delta: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                },
            })),
        }];
        if (data.regulatory_groups && data.regulatory_views) {
            return {
                ...data,
                group_dimensions: groupDimensions,
                default_dimension_id: data.default_dimension_id || (groupDimensions[0] ? groupDimensions[0].dimension_id : null),
                cross_group_insights: data.cross_group_insights || {},
            };
        }
        const fallbackClassId = 'legacy';
        const fallbackView = data.group_views[data.default_group_id] || { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] };
        return {
            ...data,
            group_dimensions: groupDimensions,
            default_dimension_id: data.default_dimension_id || (groupDimensions[0] ? groupDimensions[0].dimension_id : null),
            cross_group_insights: data.cross_group_insights || {},
            regulatory_groups: [{
                class_id: fallbackClassId,
                class_label: 'Classe legada',
                distributor_count: fallbackView.anual.length,
                monthly_coverage: (fallbackView.mensal || []).length > 0,
                annual_coverage: (fallbackView.anual || []).length > 0,
                selector_enabled: true,
                years: [...new Set((fallbackView.anual || []).map(r => r.ano))].sort(),
            }],
            regulatory_views: { [fallbackClassId]: fallbackView },
            default_regulatory_id: fallbackClassId,
            top20_distributors: [],
            data_availability: {},
        };
    }

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
        group_dimensions: [{
            dimension_id: 'economico',
            dimension_label: 'Grupo Econômico',
            default_selected: 'neoenergia',
            groups: [{
                id: 'neoenergia',
                label: 'Grupo Neoenergia',
                selector_enabled: true,
                suppressed_low_volume: false,
                metrics: {
                    qtd_serv_realizado: null,
                    qtd_fora_prazo: null,
                    compensacao_rs: null,
                    taxa_fora_prazo: null,
                    fora_prazo_por_100k_uc_mes: null,
                    compensacao_rs_por_uc_mes: null,
                },
                period_compare: {
                    pre_2022: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                    pos_2022: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                    delta: { taxa_fora_prazo: null, compensacao_rs_por_uc_mes: null },
                },
            }],
        }],
        default_dimension_id: 'economico',
        cross_group_insights: {},
        regulatory_groups: [{
            class_id: 'legacy',
            class_label: 'Classe legada',
            distributor_count: neoView.anual.length ? new Set(neoView.anual.map(r => r.distributor_label)).size : 0,
            monthly_coverage: (neoView.mensal || []).length > 0,
            annual_coverage: (neoView.anual || []).length > 0,
            selector_enabled: true,
            years: [...new Set(neoView.anual.map(r => r.ano))].sort(),
        }],
        regulatory_views: { legacy: neoView },
        default_regulatory_id: 'legacy',
        top20_distributors: [],
        data_availability: {},
    };
}

function getDimensionDefs(data) {
    const dims = Array.isArray(data.group_dimensions) ? data.group_dimensions : [];
    return dims.filter(d => Array.isArray(d.groups) && d.groups.length > 0);
}

function getActiveDimensionContext(data) {
    const dimensions = getDimensionDefs(data);
    if (!dimensions.length) {
        return { dimension: null, groupsAll: [], groupsVisible: [], selectedGroup: null };
    }
    const preferredDimension = dashboardState.selectedDimensionId
        || localStorage.getItem('selected_dimension_id')
        || data.default_dimension_id
        || dimensions[0].dimension_id;
    const activeDimension = dimensions.find(d => d.dimension_id === preferredDimension) || dimensions[0];
    dashboardState.selectedDimensionId = activeDimension.dimension_id;

    const groupsAll = Array.isArray(activeDimension.groups) ? activeDimension.groups : [];
    const groupsVisible = dashboardState.showSuppressed ? groupsAll : groupsAll.filter(g => !g.suppressed_low_volume);
    const groupPool = groupsVisible.length ? groupsVisible : groupsAll;
    const preferredGroup = dashboardState.selectedGroupId
        || localStorage.getItem('selected_group_id')
        || activeDimension.default_selected;
    const selectedGroup = groupPool.find(g => g.id === preferredGroup) || groupPool[0] || null;
    dashboardState.selectedGroupId = selectedGroup ? selectedGroup.id : null;
    return { dimension: activeDimension, groupsAll, groupsVisible, selectedGroup };
}

function getRegulatoryDefs(data) {
    const classes = Array.isArray(data.regulatory_groups) ? data.regulatory_groups : [];
    return classes.length ? classes : [];
}

function getActiveRegulatoryContext(data) {
    const classes = getRegulatoryDefs(data);
    const views = data.regulatory_views || {};
    if (!classes.length) {
        return {
            regulatory: null,
            view: { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] },
        };
    }

    const preferred = dashboardState.selectedRegulatoryId
        || localStorage.getItem('selected_regulatory_id')
        || data.default_regulatory_id;
    const valid = classes.find(c => c.class_id === preferred) || classes[0];
    dashboardState.selectedRegulatoryId = valid.class_id;
    const view = views[valid.class_id] || { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] };
    return { regulatory: valid, view };
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

/* ===================== GROUP SELECTORS ===================== */
function initDimensionSelector(data) {
    const selector = document.getElementById('dimension-selector');
    if (!selector) return;

    const dimensions = getDimensionDefs(data);
    selector.innerHTML = dimensions
        .map(dim => `<option value="${dim.dimension_id}">${dim.dimension_label}</option>`)
        .join('');

    const preferred = dashboardState.selectedDimensionId
        || localStorage.getItem('selected_dimension_id')
        || data.default_dimension_id
        || (dimensions[0] ? dimensions[0].dimension_id : null);
    const valid = dimensions.find(d => d.dimension_id === preferred) ? preferred : (dimensions[0] ? dimensions[0].dimension_id : null);
    if (valid) {
        dashboardState.selectedDimensionId = valid;
        selector.value = valid;
    }

    selector.addEventListener('change', () => {
        dashboardState.selectedDimensionId = selector.value;
        localStorage.setItem('selected_dimension_id', selector.value);
        dashboardState.selectedGroupId = null;
        localStorage.removeItem('selected_group_id');
        initGroupSelector(dashboardState.data);
        destroyCharts();
        renderAll(dashboardState.data);
    });
}

function initGroupSelector(data) {
    const selector = document.getElementById('group-selector');
    if (!selector) return;

    const { groupsVisible, groupsAll } = getActiveDimensionContext(data);
    const groups = groupsVisible.length ? groupsVisible : groupsAll;
    selector.innerHTML = groups
        .map(group => {
            const tag = group.suppressed_low_volume ? ' (suprimido)' : '';
            return `<option value="${group.id}">${group.label}${tag}</option>`;
        })
        .join('');

    const activeDimension = getDimensionDefs(data).find(d => d.dimension_id === dashboardState.selectedDimensionId);
    const preferred = dashboardState.selectedGroupId || localStorage.getItem('selected_group_id') || activeDimension?.default_selected;
    const valid = groups.find(g => g.id === preferred) ? preferred : (groups[0] ? groups[0].id : null);
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

function initSuppressedToggle() {
    const toggle = document.getElementById('show-suppressed-toggle');
    if (!toggle) return;
    const saved = localStorage.getItem('show_suppressed_groups');
    dashboardState.showSuppressed = saved === '1';
    toggle.checked = dashboardState.showSuppressed;
    toggle.addEventListener('change', () => {
        dashboardState.showSuppressed = toggle.checked;
        localStorage.setItem('show_suppressed_groups', toggle.checked ? '1' : '0');
        dashboardState.selectedGroupId = null;
        localStorage.removeItem('selected_group_id');
        initGroupSelector(dashboardState.data);
        destroyCharts();
        renderAll(dashboardState.data);
    });
}

function initRegulatorySelector(data) {
    const selector = document.getElementById('regulatory-selector');
    if (!selector) return;

    const classes = getRegulatoryDefs(data);
    selector.innerHTML = classes
        .map(item => {
            const coverage = item.monthly_coverage ? 'mensal' : (item.annual_coverage ? 'anual' : 'sem cobertura');
            return `<option value="${item.class_id}">${item.class_label} (${coverage})</option>`;
        })
        .join('');

    const preferred = dashboardState.selectedRegulatoryId
        || localStorage.getItem('selected_regulatory_id')
        || data.default_regulatory_id;
    const valid = classes.find(c => c.class_id === preferred) ? preferred : (classes[0] ? classes[0].class_id : null);
    if (valid) {
        dashboardState.selectedRegulatoryId = valid;
        selector.value = valid;
    }

    selector.addEventListener('change', () => {
        dashboardState.selectedRegulatoryId = selector.value;
        localStorage.setItem('selected_regulatory_id', selector.value);
        destroyCharts();
        renderAll(dashboardState.data);
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
                    grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
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

function renderDimensionBenchmark(context) {
    const groups = (context.groupsVisible || []).filter(g => g.selector_enabled);
    if (!groups.length) return;
    const top = [...groups]
        .sort((a, b) => (b.metrics?.qtd_serv_realizado || 0) - (a.metrics?.qtd_serv_realizado || 0))
        .slice(0, 10);
    const labels = top.map(g => g.label);
    const colors = labels.map((_, idx) => DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length]);

    createChart('chart-neo-fora', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Fora prazo / 100k UC-mês',
                data: top.map(g => g.metrics?.fora_prazo_por_100k_uc_mes ?? null),
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 1.5,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,164,67,0.06)' } } },
        },
    });

    createChart('chart-neo-comp', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Compensação R$ / UC-mês',
                data: top.map(g => g.metrics?.compensacao_rs_por_uc_mes ?? null),
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 1.5,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,164,67,0.06)' } } },
        },
    });

    const maxFora = Math.max(...top.map(g => g.metrics?.fora_prazo_por_100k_uc_mes || 0), 0);
    const maxComp = Math.max(...top.map(g => g.metrics?.compensacao_rs_por_uc_mes || 0), 0);
    createChart('chart-neo-radar', {
        type: 'radar',
        data: {
            labels: ['Taxa op.', 'Fora/100k', 'R$/UC', 'Delta taxa'],
            datasets: top.slice(0, 6).map((g, idx) => ({
                label: g.label,
                data: [
                    (g.metrics?.taxa_fora_prazo ?? 0) * 100,
                    maxFora > 0 ? ((g.metrics?.fora_prazo_por_100k_uc_mes ?? 0) / maxFora) * 100 : 0,
                    maxComp > 0 ? ((g.metrics?.compensacao_rs_por_uc_mes ?? 0) / maxComp) * 100 : 0,
                    Math.abs((g.period_compare?.delta?.taxa_fora_prazo ?? 0) * 100),
                ],
                borderColor: DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length],
                backgroundColor: DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length] + '20',
                borderWidth: 2,
                pointRadius: 3,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { r: { beginAtZero: true, ticks: { display: false }, grid: { color: 'rgba(0,164,67,0.1)' }, angleLines: { color: 'rgba(0,164,67,0.1)' } } },
        },
    });

    const tbody = document.getElementById('trend-table-body');
    if (tbody) {
        tbody.innerHTML = top.map(g => {
            const pre = g.period_compare?.pre_2022?.taxa_fora_prazo;
            const pos = g.period_compare?.pos_2022?.taxa_fora_prazo;
            const delta = g.period_compare?.delta?.taxa_fora_prazo;
            const deltaClass = (delta ?? 0) <= 0 ? 'positive' : 'negative';
            return `<tr>
                <td>${g.label}</td>
                <td class="num">${fmtPct(pre, 3)}</td>
                <td class="num">${fmtPct(pos, 3)}</td>
                <td class="num"><span class="kpi-delta ${deltaClass}">${fmtPct(delta, 3)}</span></td>
                <td class="num">${fmtNum(g.metrics?.fora_prazo_por_100k_uc_mes, 2)}</td>
                <td class="num">${fmtNum(g.metrics?.compensacao_rs_por_uc_mes, 4)}</td>
            </tr>`;
        }).join('');
    }
}

function renderFeaturedGroupComparison(context) {
    const groups = (context.groupsVisible || []).filter(g => g.selector_enabled);
    if (!groups.length) return;
    const topGroups = [...groups]
        .sort((a, b) => (b.metrics?.qtd_serv_realizado || 0) - (a.metrics?.qtd_serv_realizado || 0))
        .slice(0, 8);

    createChart('chart-featured-groups', {
        type: 'line',
        data: {
            labels: ['Pré-2022', 'Pós-2022'],
            datasets: topGroups.map((g, idx) => ({
                label: g.label,
                data: [
                    (g.period_compare?.pre_2022?.taxa_fora_prazo ?? null) != null ? (g.period_compare.pre_2022.taxa_fora_prazo * 100) : null,
                    (g.period_compare?.pos_2022?.taxa_fora_prazo ?? null) != null ? (g.period_compare.pos_2022.taxa_fora_prazo * 100) : null,
                ],
                borderColor: DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length],
                backgroundColor: DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length] + '1a',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: false,
                tension: 0.2,
                spanGaps: true,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? `${ctx.parsed.y.toFixed(3)}%` : '—'}` } },
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, title: { display: true, text: 'Taxa fora do prazo (%)', font: { size: 11 } }, grid: { color: 'rgba(0,164,67,0.06)' } },
            },
        },
    });

    const yearTag = document.getElementById('featured-latest-year');
    if (yearTag) yearTag.textContent = context.dimension?.dimension_label || '—';

    const ranked = [...groups].sort((a, b) => (a.metrics?.fora_prazo_por_100k_uc_mes || Infinity) - (b.metrics?.fora_prazo_por_100k_uc_mes || Infinity));
    const tbody = document.getElementById('featured-groups-table-body');
    if (tbody) {
        tbody.innerHTML = ranked.slice(0, 10).map((row, idx) => {
            return `<tr>
                <td>${row.label}</td>
                <td class="num">${fmtNum(row.metrics?.fora_prazo_por_100k_uc_mes, 2)}</td>
                <td class="num">${fmtNum(row.metrics?.compensacao_rs_por_uc_mes, 4)}</td>
                <td class="num">${idx + 1}</td>
                <td class="num">${fmtPct(row.period_compare?.delta?.taxa_fora_prazo, 2)}</td>
            </tr>`;
        }).join('');
    }
}

function renderGroupInsights(context) {
    const groups = (context.groupsVisible || []).filter(g => g.selector_enabled);
    const insightBest = document.getElementById('group-insight-best');
    const insightWorst = document.getElementById('group-insight-worst');
    const insightTrend = document.getElementById('group-insight-trend');

    if (insightBest && insightWorst) {
        if (groups.length) {
            const best = [...groups].sort((a, b) => (a.metrics?.fora_prazo_por_100k_uc_mes || 0) - (b.metrics?.fora_prazo_por_100k_uc_mes || 0))[0];
            const worst = [...groups].sort((a, b) => (b.metrics?.fora_prazo_por_100k_uc_mes || 0) - (a.metrics?.fora_prazo_por_100k_uc_mes || 0))[0];
            insightBest.innerHTML = `<strong>${best.label}</strong> tem a menor pressão normalizada: ${fmtNum(best.metrics?.fora_prazo_por_100k_uc_mes, 2)} por 100k UC-mês.`;
            insightWorst.innerHTML = `<strong>${worst.label}</strong> concentra a maior pressão normalizada: ${fmtNum(worst.metrics?.fora_prazo_por_100k_uc_mes, 2)} por 100k UC-mês.`;
        } else {
            insightBest.textContent = 'Sem dados suficientes para identificar o melhor grupo na dimensão selecionada.';
            insightWorst.textContent = 'Sem dados suficientes para identificar o pior grupo na dimensão selecionada.';
        }
    }

    if (insightTrend) {
        const comparable = groups.filter(g => g.period_compare?.delta?.taxa_fora_prazo != null && !isNaN(g.period_compare.delta.taxa_fora_prazo));
        if (comparable.length) {
            const improved = comparable.filter(g => g.period_compare.delta.taxa_fora_prazo <= 0);
            insightTrend.innerHTML = `<strong>${improved.length} de ${comparable.length}</strong> grupos reduziram a taxa entre pré e pós REN 1000.`;
        } else {
            insightTrend.textContent = 'Sem dados comparáveis suficientes entre pré e pós REN 1000.';
        }
    }

    const comparePre = document.getElementById('group-compare-pre');
    const comparePos = document.getElementById('group-compare-pos');
    const compareDelta = document.getElementById('group-compare-delta');
    if (context.selectedGroup && comparePre && comparePos && compareDelta) {
        const pre = context.selectedGroup.period_compare?.pre_2022?.taxa_fora_prazo;
        const pos = context.selectedGroup.period_compare?.pos_2022?.taxa_fora_prazo;
        const delta = context.selectedGroup.period_compare?.delta?.taxa_fora_prazo;
        comparePre.textContent = fmtPct(pre, 3);
        comparePos.textContent = fmtPct(pos, 3);
        compareDelta.textContent = fmtPct(delta, 3);
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


async function renderAdvancedAnalytics() {
    try {
        const [heatmapRes, scatterRes, radarRes, tsRes] = await Promise.all([
            fetch('./dashboard_heatmap.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_scatter.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_radar.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_timeseries.json').then(r => r.ok ? r.json() : { data: [] })
        ]);

        if (heatmapRes.data && heatmapRes.data.length > 0) {
            const data = heatmapRes.data;
            const xLabels = [...new Set(data.map(d => d.x))];
            const yLabels = [...new Set(data.map(d => d.y))];
            createChart('chart-advanced-heatmap', {
                type: 'matrix',
                data: {
                    datasets: [{
                        label: 'Transgressões/100k UC',
                        data: data,
                        backgroundColor(context) {
                            const value = context.dataset.data[context.dataIndex]?.v || 0;
                            const maxVal = Math.max(...context.dataset.data.map(d => d.v));
                            const alpha = maxVal > 0 ? Math.min(Math.max((value / maxVal), 0.15), 1) : 0.15;
                            return `rgba(0, 164, 67, ${alpha})`;
                        },
                        hoverBackgroundColor: '#00A443',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderRadius: 4,
                        width: ({ chart }) => (chart.chartArea || {}).width / xLabels.length - 2,
                        height: ({ chart }) => (chart.chartArea || {}).height / yLabels.length - 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { title: ctx => `${ctx[0].raw.x} - ${ctx[0].raw.y}`, label: ctx => `Transgressões: ${ctx.raw.v} / 100k UC` } }
                    },
                    scales: {
                        x: { type: 'category', labels: xLabels, grid: { display: false }, ticks: { autoSkip: false } },
                        y: { type: 'category', labels: yLabels, grid: { display: false } }
                    }
                }
            });
        }

        if (scatterRes.data && scatterRes.data.length > 0) {
            const data = scatterRes.data;
            createChart('chart-advanced-scatter', {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'REN 414', data: data.filter(d => d.regra === 'REN 414'), backgroundColor: 'rgba(0, 164, 67, 0.4)', borderColor: '#00A443', borderWidth: 2, pointRadius: 7, pointHoverRadius: 10 },
                        { label: 'REN 1000', data: data.filter(d => d.regra === 'REN 1000'), backgroundColor: 'rgba(230, 51, 18, 0.4)', borderColor: '#E63312', borderWidth: 2, pointRadius: 7, pointHoverRadius: 10 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.label} (${ctx.dataset.label}): Abs=${ctx.raw.x}, R$${ctx.raw.y.toFixed(2)}/UC` } } },
                    scales: {
                        x: { title: { display: true, text: 'Transgressões Absolutas' }, type: 'logarithmic' },
                        y: { title: { display: true, text: 'Compensação R$/UC' } }
                    }
                }
            });
        }

        if (radarRes.data && radarRes.data.length > 0) {
            const services = radarRes.services;

            const serviceMap = {
                'LigBUb': 'Ligação (Urb)',
                'LigBRb': 'Ligação (Rur)',
                'ReligUb': 'Religação (Urb)',
                'ReligRb': 'Religação (Rur)',
                'VistBUb': 'Vistoria (Urb)',
                'VistBRb': 'Vistoria (Rur)',
                'Reclama': 'Reclamação',
                'AteCo': 'Atendimento'
            };

            createChart('chart-advanced-radar', {
                type: 'radar',
                data: {
                    labels: services.map(s => serviceMap[s] || s),
                    datasets: radarRes.data.map((d, i) => ({
                        label: d.distributor_label,
                        data: services.map(s => d.metrics[s] || 0),
                        backgroundColor: DISTRIBUTOR_PALETTE[i % DISTRIBUTOR_PALETTE.length] + '44',
                        borderColor: DISTRIBUTOR_PALETTE[i % DISTRIBUTOR_PALETTE.length],
                        borderWidth: 2,
                        pointBackgroundColor: DISTRIBUTOR_PALETTE[i % DISTRIBUTOR_PALETTE.length],
                        pointBorderColor: '#fff',
                        pointHoverRadius: 6,
                        pointRadius: 3,
                        fill: true
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } }
                    },
                    scales: {
                        r: {
                            ticks: { display: false },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { color: '#94a3b8', font: { size: 11 } }
                        }
                    }
                }
            });
        }

        if (tsRes.data && tsRes.data.length > 0) {
            const tsData = tsRes.data;
            const labelsSet = new Set();
            const allGroups = new Map();

            tsData.forEach(d => {
                labelsSet.add(d.date);
                if (d.tipo && d.grupo !== 'Média Nacional') {
                    allGroups.set(d.grupo, d.tipo);
                } else if (!d.tipo && d.grupo !== 'Média Nacional') {
                    allGroups.set(d.grupo, ['Neoenergia', 'CPFL', 'Energisa', 'Equatorial', 'Enel'].includes(d.grupo) ? 'holding' : 'franquia');
                }
            });
            const labels = Array.from(labelsSet).sort();

            const selectEl = document.getElementById('adv-timeseries-filter');
            if (selectEl) {
                selectEl.innerHTML = '';

                const holdings = Array.from(allGroups.keys()).filter(k => allGroups.get(k) === 'holding').sort();
                const franquias = Array.from(allGroups.keys()).filter(k => allGroups.get(k) === 'franquia').sort();

                const optgHolding = document.createElement('optgroup');
                optgHolding.label = 'Holdings Principais';
                holdings.forEach(h => {
                    const opt = document.createElement('option');
                    opt.value = h;
                    opt.textContent = h;
                    opt.selected = true; // Select holdings by default
                    optgHolding.appendChild(opt);
                });
                selectEl.appendChild(optgHolding);

                const optgFranquias = document.createElement('optgroup');
                optgFranquias.label = 'Franquias (Distribuidoras)';
                franquias.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = f;
                    optgFranquias.appendChild(opt);
                });
                selectEl.appendChild(optgFranquias);

                selectEl.addEventListener('change', () => {
                    const selected = Array.from(selectEl.selectedOptions).map(o => o.value);
                    renderTsChart(selected);
                });
            }

            const groupColors = {
                'Média Nacional': '#F4A100', // yellow
                'Neoenergia': '#00A859', // light green
                'CPFL': '#005F27', // dark green
                'Energisa': '#E63312', // red
                'Equatorial': '#0A0E1A', // black
                'Enel': '#00843D' // default green
            };

            let currentChart = null;

            function renderTsChart(selectedGroups) {
                const gruposData = {};
                tsData.forEach(d => {
                    if (d.grupo === 'Média Nacional' || selectedGroups.includes(d.grupo)) {
                        if (!gruposData[d.grupo]) gruposData[d.grupo] = {};
                        gruposData[d.grupo][d.date] = d.fora_prazo_por_100k_uc_mes;
                    }
                });

                const datasets = Object.keys(gruposData).map((grupo, idx) => {
                    const dataPoints = labels.map(l => gruposData[grupo][l] ?? null);
                    let color = groupColors[grupo] || DISTRIBUTOR_PALETTE[idx % DISTRIBUTOR_PALETTE.length];
                    let isNacional = grupo === 'Média Nacional';
                    return {
                        label: grupo,
                        data: dataPoints,
                        borderColor: color,
                        borderWidth: isNacional ? 4 : 2,
                        borderDash: isNacional ? [] : [4, 4],
                        backgroundColor: isNacional ? 'rgba(244, 161, 0, 0.05)' : 'transparent',
                        fill: isNacional,
                        tension: 0.4,
                        yAxisID: 'y',
                        pointRadius: isNacional ? 3 : 0,
                        pointHoverRadius: 6
                    };
                });

                if (currentChart && window.appCharts && window.appCharts['chart-advanced-timeseries']) {
                    window.appCharts['chart-advanced-timeseries'].destroy();
                }

                currentChart = createChart('chart-advanced-timeseries', {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                        plugins: {
                            annotation: {
                                annotations: {
                                    line1: {
                                        scaleID: 'x', value: '2022-04-01',
                                        borderColor: 'rgba(230, 51, 18, 0.8)', borderDash: [6, 6], borderWidth: 2,
                                        label: { content: 'Fronteira REN 1000', display: true, position: 'start', color: '#E63312', backgroundColor: 'rgba(255,255,255,0.8)' }
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { maxTicksLimit: 12 }
                            },
                            y: { type: 'linear', position: 'left', title: { display: true, text: 'Fora / 100k UC' } },
                            y1: { type: 'linear', position: 'right', title: { display: true, text: 'R$ / UC' }, grid: { drawOnChartArea: false } }
                        }
                    }
                });
            }

            const initialSelected = selectEl ? Array.from(selectEl.selectedOptions).map(o => o.value) : ['Neoenergia', 'CPFL', 'Energisa', 'Equatorial', 'Enel'];
            renderTsChart(initialSelected);
        }
    } catch (e) {
        console.error("Advanced analytics load failed", e);
    }
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
        dashboardState.showSuppressed = localStorage.getItem('show_suppressed_groups') === '1';

        initDimensionSelector(data);
        initGroupSelector(data);
        initSuppressedToggle();
        initRegulatorySelector(data);

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
