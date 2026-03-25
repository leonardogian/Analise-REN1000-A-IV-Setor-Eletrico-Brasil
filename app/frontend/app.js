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

/* ===================== THEME (DARK-ONLY, IBERDROLA) ===================== */
function initTheme() {
    if (typeof Chart === 'undefined') return;
    // Dark Premium — zinc-950 neutral palette
    Chart.defaults.color = '#71717a';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.07)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 17, 19, 0.97)';
    Chart.defaults.plugins.tooltip.titleColor = '#fafafa';
    Chart.defaults.plugins.tooltip.bodyColor = '#a1a1aa';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 198, 90, 0.35)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

/* fmtNum, fmtPct, fmtMoney, fmtMoneyFull — see utils.js */

/* ===================== COLORS (IBERDROLA CORPORATE) ===================== */
const COLORS = {
    blue: '#1A8FE3',
    blueLight: '#4aa8ee',
    cyan: '#1A8FE3',
    green: '#00C65A',
    amber: '#FF6B1A',
    red: '#ef4444',
    purple: '#8b5cf6',
    rose: '#ec4899',
    slate: '#4a6656',
    lime: '#A8D96B',
    orange: '#FF6B1A',
};

const DISTRIBUTOR_PALETTE = [
    '#00C65A',
    '#1A8FE3',
    '#FF6B1A',
    '#A8D96B',
    '#8b5cf6',
    '#ec4899',
    '#4aa8ee',
    '#ef4444',
    '#14b8a6',
    '#f59e0b',
];

/* ===================== SKELETON LOADING UTILITIES ===================== */
/**
 * Mostra um skeleton de loading num container.
 * @param {string} containerId — id do elemento que recebe o skeleton
 * @param {number} height — altura do skeleton em px (default 320)
 */
function showSkeleton(containerId, height = 320) {
    const el = document.getElementById(containerId);
    if (!el || !el.parentNode) return;
    const skId = `__sk_${containerId}`;
    if (!document.getElementById(skId)) {
        const sk = document.createElement('div');
        sk.id = skId;
        sk.className = 'skeleton';
        sk.style.cssText = `height:${height}px; width:100%;`;
        el.parentNode.insertBefore(sk, el);
    }
    el.style.display = 'none';
}

/**
 * Remove o skeleton de loading de um container.
 * @param {string} containerId
 */
function hideSkeleton(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const sk = document.getElementById(`__sk_${containerId}`);
    if (sk) sk.remove();
    el.style.display = '';
}

const CHART_FONT = { family: "'Inter', sans-serif", size: 12, weight: '500' };
if (typeof Chart !== 'undefined') {
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
}

/* ===================== CHART HELPERS ===================== */
const chartInstances = [];

function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances.length = 0;
}

function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    // Ensure no stale Chart.js instance is attached to this canvas
    try {
        const existing = Chart.getChart(canvas);
        if (existing) {
            existing.destroy();
            const idx = chartInstances.indexOf(existing);
            if (idx > -1) chartInstances.splice(idx, 1);
        }
    } catch (e) { /* Chart.getChart may fail on edge cases */ }
    // Clear canvas drawing context
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        .map(dim => `<option value="${escapeHtml(dim.dimension_id)}">${escapeHtml(dim.dimension_label)}</option>`)
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
            return `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label)}${tag}</option>`;
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
            return `<option value="${escapeHtml(item.class_id)}">${escapeHtml(item.class_label)} (${coverage})</option>`;
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
    // Aplicação dos Filtros Globais no nível de Visão Geral (Série Mensal)
    let rawData = data.serie_mensal_nacional || [];
    
    // Filtrar dados antes de agregar
    if (window.dashboardFilters) {
        const { period, base, grupos, porte } = window.dashboardFilters;
        
        let filtered = rawData.filter(d => {
            if (grupos.size > 0 && !grupos.has(d.group_id)) return false;
            // Porte
            if (porte.size > 0 && !porte.has(d.bucket_porte)) return false;
            return true;
        });
        
        // Base / Period filters
        if (base === 'ren1000') {
            filtered = filtered.filter(d => d.ano >= 2022);
        } else if (base === 'ren414') {
            filtered = filtered.filter(d => d.ano < 2022);
        }
        
        if (period === 'pre_2022') {
            filtered = filtered.filter(d => d.ano < 2022);
        } else if (period === 'pos_2022') {
            filtered = filtered.filter(d => d.ano >= 2022);
        }
        
        rawData = filtered;
    }
    
    // Recalcular KPIs 
    let pre_serv = 0, pos_serv = 0;
    let pre_fora = 0, pos_fora = 0;
    let pre_comp = 0, pos_comp = 0;

    rawData.forEach(d => {
        const isPre = d.ano < 2022;
        if (isPre) {
            pre_serv += (d.qtd_serv_realizado || 0);
            pre_fora += (d.qtd_fora_prazo || 0);
            pre_comp += (d.compensacao_rs || 0);
        } else {
            pos_serv += (d.qtd_serv_realizado || 0);
            pos_fora += (d.qtd_fora_prazo || 0);
            pos_comp += (d.compensacao_rs || 0);
        }
    });

    // rawData (serie_mensal_nacional) only covers 2023-2025 — fall back to
    // pre-computed kpi_overview for pre-2022 totals when not available.
    if (pre_serv === 0 && data.kpi_overview) {
        const ov = data.kpi_overview;
        pre_serv = ov.pre_servicos_total  || 0;
        pre_fora = ov.pre_fora_prazo_total || 0;
        pre_comp = ov.pre_compensacao_total || 0;
    }

    const pre_taxa = pre_serv > 0 ? pre_fora / pre_serv : 0;
    const pos_taxa = pos_serv > 0 ? pos_fora / pos_serv : 0;
    const delta_taxa = pos_taxa - pre_taxa;
    const delta_comp = pos_comp - pre_comp;

    document.getElementById('kpi-taxa-pre').textContent = fmtPct(pre_taxa);
    document.getElementById('kpi-taxa-pos').textContent = fmtPct(pos_taxa);
    document.getElementById('kpi-taxa-delta').textContent = fmtPct(delta_taxa);
    document.getElementById('kpi-taxa-delta').className = 'kpi-delta ' + (delta_taxa <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-comp-pre').textContent = fmtMoney(pre_comp);
    document.getElementById('kpi-comp-pos').textContent = fmtMoney(pos_comp);
    document.getElementById('kpi-comp-delta').textContent = fmtMoney(delta_comp);
    document.getElementById('kpi-comp-delta').className = 'kpi-delta ' + (delta_comp <= 0 ? 'positive' : 'negative');

    document.getElementById('kpi-serv-total').textContent = fmtNum(pre_serv + pos_serv);
    document.getElementById('kpi-fora-total').textContent = fmtNum(pre_fora + pos_fora);

    // Usar serie_anual pré-computada (2011-2023) quando disponível
    const serieAnual = data.serie_anual || [];
    let serieClean;
    if (serieAnual.length > 0) {
        serieClean = serieAnual
            .map(r => ({
                ano: r.ano,
                serv: r.qtd_serv || 0,
                fora: r.qtd_fora_prazo || 0,
                comp: r.compensacao_rs || 0,
                periodo_regulatorio: r.periodo_regulatorio || (r.ano < 2022 ? 'pre_2022' : 'pos_2022'),
            }))
            .sort((a, b) => a.ano - b.ano);
    } else {
        // Fallback: agregar da série mensal (comportamento anterior)
        const aggAnualItem = {};
        rawData.forEach(d => {
            if (!aggAnualItem[d.ano]) {
                aggAnualItem[d.ano] = { ano: d.ano, serv: 0, fora: 0, comp: 0, periodo_regulatorio: d.ano < 2022 ? 'pre_2022' : 'pos_2022' };
            }
            aggAnualItem[d.ano].serv += (d.qtd_serv_realizado || 0);
            aggAnualItem[d.ano].fora += (d.qtd_fora_prazo || 0);
            aggAnualItem[d.ano].comp += (d.compensacao_rs || 0);
        });
        serieClean = Object.values(aggAnualItem).sort((a,b) => a.ano - b.ano);
    }

    // Apply period/base filters to the annual chart too
    if (window.dashboardFilters) {
        const { period, base } = window.dashboardFilters;
        if (period === 'pre_2022' || base === 'ren414') {
            serieClean = serieClean.filter(r => r.ano < 2022);
        } else if (period === 'pos_2022' || base === 'ren1000') {
            serieClean = serieClean.filter(r => r.ano >= 2022);
        }
    }
    
    const years = serieClean.map(r => r.ano);
    const taxas = serieClean.map(r => r.serv > 0 ? (r.fora / r.serv * 100) : 0);
    const comps = serieClean.map(r => r.comp);
    const bgColors = serieClean.map(r => r.periodo_regulatorio === 'pre_2022' ? COLORS.blue : COLORS.cyan);

    /* ---- Combined Chart: Taxa (line, left axis) + Compensações (bar, right axis) ---- */
    let combinedMode = 'taxa'; // 'taxa' = line front, 'comp' = bars front
    let combinedChartInstance = null;

    function buildCombinedChart(mode) {
        if (combinedChartInstance) {
            combinedChartInstance.destroy();
            combinedChartInstance = null;
        }
        const isTaxa = mode === 'taxa';
        combinedChartInstance = createChart('chart-serie-combined', {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Compensação (R$)',
                        data: comps,
                        backgroundColor: isTaxa
                            ? bgColors.map(c => c + '22')
                            : bgColors.map(c => c + 'AA'),
                        borderColor: isTaxa
                            ? bgColors.map(c => c + '44')
                            : bgColors,
                        borderWidth: isTaxa ? 1 : 1.5,
                        borderRadius: 6,
                        borderSkipped: false,
                        yAxisID: 'yComp',
                        order: isTaxa ? 2 : 1,
                    },
                    {
                        type: 'line',
                        label: 'Taxa fora do prazo (%)',
                        data: taxas,
                        borderColor: isTaxa ? COLORS.blue : 'rgba(26,143,227,0.45)',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        pointRadius: isTaxa ? 5 : 3,
                        pointHoverRadius: 8,
                        pointBackgroundColor: bgColors,
                        pointBorderColor: bgColors,
                        borderWidth: isTaxa ? 3 : 1.5,
                        yAxisID: 'yTaxa',
                        order: isTaxa ? 1 : 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12, padding: 16, font: { size: 11 },
                            usePointStyle: true,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                if (ctx.dataset.yAxisID === 'yTaxa')
                                    return `Taxa: ${ctx.parsed.y.toFixed(3)}%`;
                                return `Compensação: ${fmtMoneyFull(ctx.parsed.y)}`;
                            },
                            afterLabel: ctx => {
                                if (ctx.dataset.yAxisID === 'yTaxa') {
                                    const r = serieClean[ctx.dataIndex];
                                    return `Período: ${r.periodo_regulatorio === 'pre_2022' ? 'Pré-REN 1000' : 'Pós-REN 1000'}`;
                                }
                                return '';
                            },
                        },
                    },
                    annotation: {
                        annotations: {
                            line1: {
                                type: 'line',
                                xMin: 2022, xMax: 2022,
                                borderColor: 'rgba(251, 191, 36, 0.7)',
                                borderWidth: 2.5,
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
                            box1: {
                                type: 'box',
                                xMin: 2022, xMax: 2025,
                                backgroundColor: 'rgba(0, 198, 90, 0.06)',
                                borderWidth: 0,
                            },
                        },
                    },
                },
                scales: {
                    x: { grid: { display: false } },
                    yTaxa: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Taxa fora do prazo (%)', color: '#64b5f6', font: { size: 11 } },
                        ticks: { callback: v => v.toFixed(1) + '%', color: '#64b5f6' },
                        grid: { color: isTaxa ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', drawBorder: false },
                    },
                    yComp: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        title: { display: true, text: 'Compensação (R$)', color: '#4ade80', font: { size: 11 } },
                        ticks: { callback: v => fmtMoney(v), color: '#4ade80' },
                        grid: { drawOnChartArea: false },
                    },
                },
            },
        });
    }

    buildCombinedChart(combinedMode);

    const btnToggle = document.getElementById('btn-toggle-metric');
    const btnLabel = document.getElementById('btn-toggle-label');
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            combinedMode = combinedMode === 'taxa' ? 'comp' : 'taxa';
            btnLabel.textContent = combinedMode === 'taxa' ? 'Destacar Compensações' : 'Destacar Taxa (%)';

            buildCombinedChart(combinedMode);
        });
    }
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

        const hexToRgba = (hex, alpha) => {
            if (!hex || !hex.startsWith('#')) return `rgba(100,100,100,${alpha})`;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

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
                        fill: true,
                        borderColor: colors[key],
                        backgroundColor: hexToRgba(colors[key], 0.2),
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
                <td>${escapeHtml(t.distributor_label)}</td>
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
                <td>${escapeHtml(g.label)}</td>
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
                <td>${escapeHtml(row.label)}</td>
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
            insightBest.innerHTML = `<strong>${escapeHtml(best.label)}</strong> tem a menor pressão normalizada: ${fmtNum(best.metrics?.fora_prazo_por_100k_uc_mes, 2)} por 100k UC-mês.`;
            insightWorst.innerHTML = `<strong>${escapeHtml(worst.label)}</strong> concentra a maior pressão normalizada: ${fmtNum(worst.metrics?.fora_prazo_por_100k_uc_mes, 2)} por 100k UC-mês.`;
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
                        autoSkip: true,
                        maxTicksLimit: 12,
                        maxRotation: 45,
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
                        autoSkip: true,
                        maxTicksLimit: 12,
                        maxRotation: 45,
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


const GROUP_COLORS = {
    'Grupo Cemig':       '#00E5FF',
    'Grupo ENEL':        '#FF4081',
    'Grupo Energisa':    '#FFD600',
    'Grupo Equatorial':  '#2979FF',
    'Grupo Neoenergia':  '#FF6D00',
    'Grupo CPFL':        '#AA00FF',
    'Grupo EDP':         '#00E676',
    'Grupo Light':       '#F50057',
};

async function renderAdvancedAnalytics() {
    try {
        const [heatmapRes, scatterRes, radarRes, tsRes] = await Promise.all([
            fetch('./dashboard_heatmap.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_scatter.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_radar.json').then(r => r.ok ? r.json() : { data: [] }),
            fetch('./dashboard_timeseries.json').then(r => r.ok ? r.json() : { data: [] })
        ]);

        // Read global filter state (grupos uses group_id like "neoenergia")
        const activeGrupos = window.dashboardFilters ? window.dashboardFilters.grupos : null;
        const totalGrupos = document.getElementById('filter-grupo')?.options.length || 0;
        // Only filter if some groups are deselected (not all selected)
        const shouldFilterGrupo = activeGrupos && activeGrupos.size > 0 && activeGrupos.size < totalGrupos;

        // Build label→id map for heatmap (x values are "Grupo Neoenergia" format)
        const labelToGroupId = {};
        (dashboardState.data.distributor_groups || []).forEach(g => {
            labelToGroupId[g.group_label] = g.group_id;
        });

        if (heatmapRes.data && heatmapRes.data.length > 0) {
            let data = heatmapRes.data;
            if (shouldFilterGrupo) {
                data = data.filter(d => activeGrupos.has(labelToGroupId[d.x] || d.x.replace(/^Grupo\s+/i, '').toLowerCase()));
            }
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
                            const ratio = maxVal > 0 ? value / maxVal : 0;
                            // 3-stop scale: cyan(0) -> blue(0.5) -> purple(1)
                            const alpha = 0.3 + ratio * 0.7;
                            if (ratio < 0.5) {
                                const t = ratio * 2;
                                return `rgba(${Math.round(0 + 41*t)}, ${Math.round(229 - 106*t)}, 255, ${alpha})`;
                            } else {
                                const t = (ratio - 0.5) * 2;
                                return `rgba(${Math.round(41 + 129*t)}, ${Math.round(123 - 123*t)}, 255, ${alpha})`;
                            }
                        },
                        hoverBackgroundColor: '#AA00FF',
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
            let data = scatterRes.data;
            // Map lowercase holding keys to major economic groups
            const MAJOR_HOLDINGS = {
                'neoenergia': { label: 'Neoenergia', color: '#FF6D00' },
                'cpfl':       { label: 'CPFL',       color: '#AA00FF' },
                'energisa':   { label: 'Energisa',   color: '#00E5FF' },
                'equatorial': { label: 'Equatorial', color: '#2979FF' },
                'enel':       { label: 'Enel',       color: '#00E676' },
                'cemig':      { label: 'Cemig',      color: '#FFD600' },
                'edp':        { label: 'EDP',        color: '#FF4081' },
                'light':      { label: 'Light',      color: '#F50057' },
            };
            if (shouldFilterGrupo) {
                data = data.filter(d => {
                    if (!d.holding) return true; // keep "outros"
                    return activeGrupos.has(d.holding);
                });
            }
            const grouped = {};
            data.forEach(d => {
                const key = MAJOR_HOLDINGS[d.holding] ? d.holding : '_outros';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(d);
            });
            const scatterDatasets = Object.entries(MAJOR_HOLDINGS)
                .filter(([k]) => grouped[k])
                .map(([k, v]) => ({
                    label: v.label,
                    data: grouped[k],
                    backgroundColor: v.color + '88',
                    borderColor: v.color,
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                }));
            if (grouped._outros) {
                scatterDatasets.push({
                    label: 'Outros',
                    data: grouped._outros,
                    backgroundColor: 'rgba(113, 113, 122, 0.4)',
                    borderColor: '#71717a',
                    borderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                });
            }
            createChart('chart-advanced-scatter', {
                type: 'scatter',
                data: { datasets: scatterDatasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
                        tooltip: { callbacks: { label: ctx => `${ctx.raw.label} (${ctx.dataset.label}): Abs=${ctx.raw.x}, R$${ctx.raw.y.toFixed(2)}/UC` } }
                    },
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
                'RelNorUb': 'Relig. Normal (Urb)',
                'VistBUb': 'Vistoria (Urb)',
                'VistBRb': 'Vistoria (Rur)',
                'Reclama': 'Reclamação',
                'AteCo': 'Atendimento',
                'RclDano': 'Recl. Dano',
                'ObraPrim': 'Obra Primária',
                'ObraSec': 'Obra Secundária',
                'EstProj': 'Estudo/Projeto',
            };

            const RADAR_COLORS = ['#FF6D00', '#AA00FF', '#00E676', '#2979FF', '#FF4081', '#FFD600', '#00E5FF', '#F50057'];
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            // Compute dynamic max for radar scale
            const allVals = radarRes.data.flatMap(d => services.map(s => d.metrics[s] || 0));
            const radarMax = Math.max(0.5, Math.ceil(Math.max(...allVals) * 10) / 10);

            // Shorten long distributor names for legend
            const shortenName = (name) => {
                const parts = name.split(' — ');
                return parts[0]; // keep only "Enel SP", "Neoenergia Coelba", etc.
            };

            createChart('chart-advanced-radar', {
                type: 'radar',
                data: {
                    labels: services.map(s => serviceMap[s] || s),
                    datasets: radarRes.data.map((d, i) => ({
                        label: shortenName(d.distributor_label),
                        data: services.map(s => d.metrics[s] || 0),
                        backgroundColor: hexToRgba(RADAR_COLORS[i % RADAR_COLORS.length], 0.18),
                        borderColor: RADAR_COLORS[i % RADAR_COLORS.length],
                        borderWidth: 2,
                        pointBackgroundColor: RADAR_COLORS[i % RADAR_COLORS.length],
                        pointBorderColor: '#fff',
                        pointHoverRadius: 7,
                        pointRadius: 3,
                        fill: true
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 10, padding: 12, font: { size: 11 }, usePointStyle: true }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(2)} /100k UC`
                            }
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            suggestedMax: radarMax,
                            ticks: {
                                display: true,
                                stepSize: radarMax > 1 ? 0.2 : 0.1,
                                color: '#64748b',
                                backdropColor: 'transparent',
                                font: { size: 9 },
                                callback: v => v.toFixed(1),
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.08)' },
                            angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                            pointLabels: {
                                color: '#cbd5e1',
                                font: { size: 12, weight: '600' },
                                padding: 8,
                            }
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
                'Média Nacional': '#FFD600',
                'Neoenergia':     '#FF6D00',
                'CPFL':           '#AA00FF',
                'Energisa':       '#00E5FF',
                'Equatorial':     '#2979FF',
                'Enel':           '#00E676',
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
                        borderWidth: isNacional ? 4 : 3,
                        borderDash: isNacional ? [] : [8, 4],
                        backgroundColor: isNacional ? 'rgba(255, 214, 0, 0.05)' : 'transparent',
                        fill: isNacional,
                        tension: 0.4,
                        yAxisID: 'y',
                        pointRadius: isNacional ? 3 : 1,
                        pointHoverRadius: 6
                    };
                });

                if (currentChart) {
                    currentChart.destroy();
                    const idx = chartInstances.indexOf(currentChart);
                    if (idx > -1) chartInstances.splice(idx, 1);
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
                            legend: { position: 'top', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
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

/* ===================== RENDER ALL ===================== */
function renderAll(data) {
    // Activate the first tab
    const firstTab = document.querySelector('.nav-tab[data-tab]');
    const firstPanel = firstTab ? document.getElementById(firstTab.dataset.tab) : null;
    if (firstTab) firstTab.classList.add('active');
    if (firstPanel) firstPanel.classList.add('active');

    // Tab 1: Overview KPIs & charts
    try { renderOverview(data); } catch (e) { console.error('renderOverview failed:', e); }

    // Group-based context
    const context = getActiveDimensionContext(data);
    if (context.selectedGroup) {
        const groupId = context.selectedGroup.id;
        const views = data.group_views || {};
        const view = views[groupId] || { anual: [], tendencia: [], benchmark: [], classe_local: [], longa_resumo: [], mensal: [] };
        const distributors = getDistributorMeta(view);
        const colors = makeColorMap(distributors);

        renderBenchmark(view, distributors, colors);
    }

    // Dimension-level analyses
    renderDimensionBenchmark(context);
    renderFeaturedGroupComparison(context);
    renderGroupInsights(context);

    // Regulatory context
    const regContext = getActiveRegulatoryContext(data);
    if (regContext.regulatory) {
        const view = regContext.view;
        const distributors = getDistributorMeta(view);
        const colors = makeColorMap(distributors);
        renderRegulatory(view, distributors, colors);
    }

    // Populate Grupo Economico filter from data (use group_id for values)
    const grupoSelect = document.getElementById('filter-grupo');
    const groupTabsEl = document.getElementById('group-tabs');
    if (grupoSelect && grupoSelect.options.length === 0 && data.distributor_groups) {
        const allGroups = [...new Map(data.distributor_groups.map(g => [g.group_id, g])).values()]
            .map(g => ({ id: g.group_id, label: g.group_label }));

        if (groupTabsEl && window.buildGroupTabs) {
            window.buildGroupTabs(groupTabsEl, grupoSelect, allGroups);
        } else {
            // Fallback: populate directly
            allGroups.sort((a, b) => a.label.localeCompare(b.label));
            const persistedGrupos = window.dashboardFilters.grupos;
            allGroups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.label;
                opt.selected = persistedGrupos.size > 0 ? persistedGrupos.has(g.id) : true;
                grupoSelect.appendChild(opt);
            });
            if (persistedGrupos.size === 0) {
                window.dashboardFilters.grupos = new Set(allGroups.map(g => g.id));
            }
        }
    }

    // Advanced analytics (tab 2)
    renderAdvancedAnalytics();
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

        // Dynamic data range pill
        const rangePill = document.getElementById('data-range-pill');
        if (rangePill && data.kpi_overview) {
            const allYears = [...(data.kpi_overview.anos_pre || []), ...(data.kpi_overview.anos_pos || [])];
            if (allYears.length) rangePill.textContent = '\u25cf Dados ' + Math.min(...allYears) + '\u2013' + Math.max(...allYears);
        }

        destroyCharts();
        renderAll(data);

        // Re-render all charts when global filters change
        window.addEventListener('filters:change', () => {
            destroyCharts();
            renderAll(data);
        });
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        var loadingEl = document.getElementById('loading');
        loadingEl.textContent = '';
        var errorDiv = document.createElement('div');
        errorDiv.className = 'loading-error';
        var h3 = document.createElement('h3');
        h3.textContent = '\u26A1 Erro ao carregar dados';
        var pMsg = document.createElement('p');
        pMsg.className = 'loading-error-message';
        pMsg.textContent = err.message;
        var pHint = document.createElement('p');
        pHint.className = 'loading-error-hint';
        pHint.innerHTML = 'O navegador bloqueia <code>fetch()</code> em <code>file://</code>.<br>Use o servidor local:';
        var pre = document.createElement('pre');
        pre.className = 'loading-error-command';
        pre.textContent = 'make serve';
        var pAlt = document.createElement('p');
        pAlt.className = 'loading-error-alt';
        pAlt.innerHTML = 'ou: <code>cd dashboard && python3 -m http.server 8080</code>';
        errorDiv.appendChild(h3);
        errorDiv.appendChild(pMsg);
        errorDiv.appendChild(pHint);
        errorDiv.appendChild(pre);
        errorDiv.appendChild(pAlt);
        loadingEl.appendChild(errorDiv);
    }
}

// Só inicializa o dashboard principal se os elementos do index.html existirem
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('loading')) init();
});
