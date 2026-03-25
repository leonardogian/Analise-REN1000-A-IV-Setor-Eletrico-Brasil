/**
 * Dashboard Transgressões (REN 414 vs REN 1000)
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Configurações e Estado
    let dashboardData = null;
    let chartInstance = null;
    const state = {
        selectedHoldings: Array.from(window.MAJOR_HOLDINGS),
        selectedDistributors: [],
        ruralOnly: false,
        viewMode: 'monthly'
    };

    // Cores Iberdrola Corporate
    const colors = {
        neoenergia: "#00C65A",
        cpfl: "#1A8FE3",
        equatorial: "#FF6B1A",
        enel: "#A8D96B",
        energisa: "#8b5cf6",
        cemig: "#ec4899",
        copel: "#4aa8ee",
        edp: "#ef4444",
        celesc: "#14b8a6",
        outros: "#4a6656"
    };

    const UI = {
        holdingSelect: document.getElementById('holding-select'),
        distributorSelect: document.getElementById('distributor-select'),
        ruralToggle: document.getElementById('rural-only-toggle'),
        insightContainer: document.getElementById('insight-container'),
        inflectionBadge: document.getElementById('inflection-badge'),
        inflectionMonth: document.getElementById('inflection-month')
    };

    // Inicialização
    if (typeof showSkeleton === 'function') showSkeleton('transgressions-chart-wrapper', 400);
    try {
        const response = await fetch('./dashboard_transgressoes.json');
        if (!response.ok) throw new Error("Não foi possível carregar os dados.");
        dashboardData = await response.json();
        if (typeof hideSkeleton === 'function') hideSkeleton('transgressions-chart-wrapper');

        // Apply persisted global holding filter if set on another page
        if (window.dashboardFilters && window.dashboardFilters.grupos.size > 0) {
            state.selectedHoldings = Array.from(window.dashboardFilters.grupos);
        }

        initFilters();
        renderInsights();
        updateChart();

    } catch (error) {
        console.error("Erro ao inicializar dashboard:", error);
        showError(UI.insightContainer, 'Erro ao carregar dados: ' + error.message);
    }

    // --- Listener de Filtro Global ---
    window.addEventListener('filters:change', (e) => {
        if (!e.detail || !dashboardData) return;
        let needsUpdate = false;

        if (e.detail.grupos) {
            if (e.detail.grupos.size > 0) {
                state.selectedHoldings = Array.from(e.detail.grupos);
            } else {
                // Empty set → reset to major holdings
                state.selectedHoldings = Array.from(window.MAJOR_HOLDINGS);
            }
            if (UI.holdingSelect) {
                Array.from(UI.holdingSelect.options).forEach(opt => {
                    opt.selected = state.selectedHoldings.includes(opt.value);
                });
            }
            updateDistributorList();
            needsUpdate = true;
        }

        // Period change also triggers re-render
        if (e.detail.period != null) {
            needsUpdate = true;
        }

        if (needsUpdate) updateChart();
    });

    // --- Funções de Filtro ---

    function initFilters() {
        // 1. Popular Holdings via buildGroupTabs
        const tabsEl = document.getElementById('group-tabs');
        const allGroups = dashboardData.groups.map(g => ({ id: g.id, label: g.label }));

        if (tabsEl && window.buildGroupTabs) {
            window.buildGroupTabs(tabsEl, UI.holdingSelect, allGroups, {
                onPopulate: function (filtered) {
                    // Sync state with what's visible in the select
                    state.selectedHoldings = filtered
                        .filter(g => window.dashboardFilters.grupos.has(g.id))
                        .map(g => g.id);
                    if (state.selectedHoldings.length === 0) {
                        state.selectedHoldings = filtered.map(g => g.id);
                    }
                    updateDistributorList();
                    updateChart();
                }
            });
        }

        UI.holdingSelect.addEventListener('change', (e) => {
            state.selectedHoldings = Array.from(e.target.selectedOptions).map(opt => opt.value);
            if (window.dashboardFilters) {
                window.dashboardFilters.grupos = new Set(state.selectedHoldings);
                if (window.saveFilters) window.saveFilters();
            }
            updateDistributorList();
            updateChart();
        });

        // 2. Popular Distributors based on Holdings
        updateDistributorList();

        UI.distributorSelect.addEventListener('change', (e) => {
            state.selectedDistributors = Array.from(e.target.selectedOptions).map(opt => opt.value);
            updateChart();
        });

        // 3. Rural Toggle
        UI.ruralToggle.addEventListener('change', (e) => {
            state.ruralOnly = e.target.checked;
            if (state.viewMode === 'monthly') updateChart();
        });

        // 4. View Mode Toggle (Mensal vs Histórico Anual)
        const viewModeSelect = document.getElementById('view-mode');
        if (viewModeSelect) {
            viewModeSelect.addEventListener('change', (e) => {
                state.viewMode = e.target.value;
                if (state.viewMode === 'annual') {
                    renderAnnualView();
                } else {
                    updateChart();
                }
            });
        }
    }

    function updateDistributorList() {
        UI.distributorSelect.innerHTML = "";
        state.selectedDistributors = []; // Reset on holding change for simplicity

        const activeGroups = dashboardData.groups.filter(g => state.selectedHoldings.includes(g.id));

        activeGroups.forEach(g => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = g.label;

            g.distribuidoras.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.label;
                optgroup.appendChild(option);
            });
            UI.distributorSelect.appendChild(optgroup);
        });
    }

    // --- Funções de Insights ---

    function renderInsights() {
        if (!dashboardData.insights) return;
        const { inflection_point, top_rural_groups } = dashboardData.insights;

        let html = "";

        if (inflection_point) {
            UI.inflectionBadge.classList.remove('hidden');
            // Data may have "mes" (string like "Dez/.0") or "ano_mes" (string like "2023-12")
            let mesFinal = '—';
            if (inflection_point.ano_mes) {
                let [ano, mes] = inflection_point.ano_mes.split('-');
                ano = ano.replace('.0', '');
                mes = mes.replace('.0', '');
                const mesFormatado = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
                mesFinal = mesFormatado.charAt(0).toUpperCase() + mesFormatado.slice(1) + '/' + ano.slice(-2);
            } else if (inflection_point.mes) {
                mesFinal = inflection_point.mes;
                if (mesFinal.includes('.0')) {
                    mesFinal = mesFinal.replace('.0', '20');
                }
            }
            UI.inflectionMonth.textContent = mesFinal;

            html += `
        <div class="insight-block">
          <h3>Ponto de Inflexão (Transição para REN 1000)</h3>
          <p>O maior salto no volume de infrações ocorreu em <strong>${escapeHtml(mesFinal)}</strong>, com um acréscimo de <strong>${(inflection_point.salto_transgressoes || 0).toLocaleString('pt-BR')}</strong> transgressões em relação ao mês anterior em nível nacional.</p>
        </div>
      `;
        }

        if (top_rural_groups && top_rural_groups.length > 0) {
            html += `
        <div class="insight-block">
          <h3>Top Holdings: Incidência de Multas Rurais</h3>
          <ul class="insight-list">
            ${top_rural_groups.map(g => {
                const groupName = dashboardData.groups.find(x => x.id === g.holding)?.label || g.holding;
                return `<li><strong>${escapeHtml(groupName)}</strong>: ${(g.rural_share * 100).toFixed(1)}% das compensações são rurais.</li>`;
            }).join('')}
          </ul>
          <p class="insight-meta">Estes grupos tendem a sofrer mais com a exigência de atendimento da REN 1000 devido à sua vasta extensão territorial.</p>
        </div>
      `;
        }

        UI.insightContainer.innerHTML = html;
    }

    // --- Renderização do Histórico Anual (2011-2023) ---

    async function renderAnnualView() {
        const ctx = document.getElementById('transgressionsChart').getContext('2d');
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

        try {
            const resp = await fetch('./dashboard_data.json');
            const fullData = await resp.json();
            const ha = fullData.historical_annual || {};
            const serie = ha.annual_series || fullData.serie_anual || [];

            if (serie.length === 0) {
                console.warn('Sem dados históricos anuais disponíveis');
                return;
            }

            const sorted = [...serie].sort((a, b) => a.ano - b.ano);
            const years = sorted.map(r => String(r.ano));
            const taxas = sorted.map(r => {
                const serv = r.qtd_serv || 0;
                const fora = r.qtd_fora_prazo || 0;
                return serv > 0 ? (fora / serv * 100) : 0;
            });
            const comps = sorted.map(r => r.compensacao_rs || 0);
            const bgColors = sorted.map(r => {
                const periodo = r.periodo_regulatorio || (r.ano < 2022 ? 'pre_2022' : 'pos_2022');
                return periodo === 'pre_2022' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(0, 198, 90, 0.6)';
            });
            const borderColors = sorted.map(r => {
                const periodo = r.periodo_regulatorio || (r.ano < 2022 ? 'pre_2022' : 'pos_2022');
                return periodo === 'pre_2022' ? '#3b82f6' : '#00C65A';
            });

            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.color = '#4a6656';
            const gridColor = 'rgba(19, 42, 26, 0.4)';

            chartInstance = new Chart(ctx, {
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Taxa Fora do Prazo (%)',
                            data: taxas,
                            type: 'line',
                            borderColor: '#fbbf24',
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            borderWidth: 3,
                            tension: 0.3,
                            yAxisID: 'y',
                            order: 1,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointBackgroundColor: borderColors,
                            pointBorderColor: borderColors,
                            fill: true,
                        },
                        {
                            label: 'Compensações (R$)',
                            data: comps,
                            type: 'bar',
                            backgroundColor: bgColors,
                            borderColor: borderColors,
                            borderWidth: 1.5,
                            borderRadius: 4,
                            yAxisID: 'y1',
                            order: 2,
                            barPercentage: 0.7,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: { family: "'Outfit', sans-serif", size: 13, weight: '500' },
                                generateLabels: function(chart) {
                                    const defaults = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    defaults.push(
                                        { text: 'Pré-REN 1000 (≤2021)', fillStyle: 'rgba(59, 130, 246, 0.6)', strokeStyle: '#3b82f6', lineWidth: 1, pointStyle: 'rect' },
                                        { text: 'Pós-REN 1000 (≥2022)', fillStyle: 'rgba(0, 198, 90, 0.6)', strokeStyle: '#00C65A', lineWidth: 1, pointStyle: 'rect' }
                                    );
                                    return defaults;
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(10, 26, 16, 0.95)',
                            titleFont: { size: 14, family: "'Inter', sans-serif", weight: '600' },
                            titleColor: '#F0FDF4',
                            bodyFont: { size: 13, family: "'Inter', sans-serif" },
                            bodyColor: '#94a3b8',
                            padding: 16,
                            cornerRadius: 12,
                            borderColor: 'rgba(0, 198, 90, 0.3)',
                            borderWidth: 1,
                            callbacks: {
                                afterTitle: function(items) {
                                    const idx = items[0].dataIndex;
                                    const r = sorted[idx];
                                    const periodo = r.periodo_regulatorio || (r.ano < 2022 ? 'pre_2022' : 'pos_2022');
                                    return periodo === 'pre_2022' ? 'Período: Pré-REN 1000 (REN 414)' : 'Período: Pós-REN 1000';
                                },
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    if (context.dataset.type === 'line') {
                                        return label + ': ' + context.parsed.y.toFixed(3) + '%';
                                    }
                                    return label + ': ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                }
                            }
                        },
                        annotation: {
                            annotations: {
                                ren1000Line: {
                                    type: 'line',
                                    xMin: '2021', xMax: '2021',
                                    borderColor: 'rgba(251, 191, 36, 0.7)',
                                    borderWidth: 2.5,
                                    borderDash: [6, 4],
                                    label: {
                                        display: true,
                                        content: 'REN 1000/2021',
                                        position: 'start',
                                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                        color: '#fbbf24',
                                        font: { size: 11, weight: '600' },
                                        padding: 4,
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor, drawBorder: false },
                            ticks: { font: { size: 12, family: "'Inter', sans-serif" } }
                        },
                        y: {
                            type: 'linear', display: true, position: 'left',
                            title: { display: true, text: 'Taxa Fora do Prazo (%)', color: '#fbbf24', font: { family: "'Outfit', sans-serif", size: 14 } },
                            grid: { color: gridColor, drawBorder: false },
                            ticks: {
                                callback: v => v.toFixed(1) + '%',
                                font: { family: "'Inter', sans-serif", size: 11 }
                            }
                        },
                        y1: {
                            type: 'linear', display: true, position: 'right',
                            title: { display: true, text: 'Compensações (R$)', color: '#94a3b8', font: { family: "'Outfit', sans-serif", size: 14 } },
                            grid: { drawOnChartArea: false },
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1e9) return 'R$ ' + (value / 1e9).toFixed(1) + 'B';
                                    if (value >= 1e6) return 'R$ ' + (value / 1e6).toFixed(1) + 'M';
                                    if (value >= 1e3) return 'R$ ' + (value / 1e3).toFixed(0) + 'k';
                                    return 'R$ ' + value;
                                },
                                font: { family: "'Inter', sans-serif", size: 11 }
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Erro ao carregar histórico anual:', err);
        }
    }

    // --- Renderização do Gráfico Mensal ---

    function updateChart() {
        if (state.viewMode === 'annual') return;
        // Destroy previous chart to ensure clean recreation (e.g. switching from annual view)
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        const ctx = document.getElementById('transgressionsChart').getContext('2d');

        // Filtrar Séries Temporais
        const period = window.dashboardFilters ? window.dashboardFilters.period : 'all';
        let filteredSeries = dashboardData.series.filter(s => {
            // Filtrar por Rural
            if (state.ruralOnly && !s.is_rural) return false;

            // Filtrar por Holding
            if (state.selectedHoldings.length > 0 && !state.selectedHoldings.includes(s.holding)) return false;

            // Filtrar por Distribuidora (se houver alguma selecionada, senão pega todas da holding)
            if (state.selectedDistributors.length > 0 && !state.selectedDistributors.includes(s.distribuidora)) return false;

            // Filtrar por Período (pré/pós REN 1000)
            if (period === 'pre_2022' && s.ano >= 2022) return false;
            if (period === 'pos_2022' && s.ano < 2022) return false;

            return true;
        });

        // Precisamos montar os datasets. Vamos agregar por Holding para visualização macro, 
        // ou por Distribuidora se houver distribuidores específicos selecionados.

        // Obter array unificado de meses do período filtrado (Labels do X), em ordem cronológica
        const sortedFiltered = [...filteredSeries].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes_num - b.mes_num);
        const allMonths = [...new Set(sortedFiltered.map(s => s.mes))];

        // Decidir o nível de agregação (Holding ou Distribuidora)
        const aggregateBy = state.selectedDistributors.length > 0 ? 'distribuidora' : 'holding';
        const groupsToRender = aggregateBy === 'holding' ? state.selectedHoldings : state.selectedDistributors;

        const datasets = [];

        groupsToRender.forEach(groupId => {
            // Obter cor
            let color = colors[groupId] || colors['outros'];
            if (aggregateBy === 'distribuidora') {
                // Se for distribuidora, pega a cor da holding pai
                const parentHolding = dashboardData.series.find(s => s.distribuidora === groupId)?.holding;
                color = colors[parentHolding] || colors['outros'];
            }

            const labelName = aggregateBy === 'holding'
                ? (dashboardData.groups.find(g => g.id === groupId)?.label || groupId)
                : (dashboardData.series.find(s => s.distribuidora === groupId)?.distribuidora_label || groupId);

            // Dados para a Curva (Valores Pagos R$)
            const lineData = allMonths.map(month => {
                const records = filteredSeries.filter(s => s.mes === month && s[aggregateBy] === groupId);
                return safeSum(records.map(r => r.valor_pago));
            });

            // Dados para as Barras (Qtd Transgressões)
            const barData = allMonths.map(month => {
                const records = filteredSeries.filter(s => s.mes === month && s[aggregateBy] === groupId);
                return safeSum(records.map(r => r.qtd_transgressoes));
            });

            // Converte cor hex para rgba com transparência
            let bgColor = "rgba(148, 163, 184, 0.2)"; // fallback
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                bgColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
            }

            // Adicionar Linha (R$)
            datasets.push({
                label: `${labelName} (R$)`,
                data: lineData,
                type: 'line',
                borderColor: color,
                backgroundColor: color, // Para a legenda
                borderWidth: 3,
                tension: 0.4,
                yAxisID: 'y',
                order: 1, // Desenhar por cima das barras
                pointRadius: 2,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 3,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: '#ffffff',
                hitRadius: 10,
                fill: false
            });

            // Adicionar Barra de Fundo (Qtd)
            datasets.push({
                label: `${labelName} (Qtd Falhas)`,
                data: barData,
                type: 'bar',
                backgroundColor: bgColor,
                hoverBackgroundColor: color, // Fica mais sólida no hover
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 4, // Bordas suavemente arredondadas
                yAxisID: 'y1',
                order: 2,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            });
        });

        // Update datasets without destroying chart (criterion #5)
        if (chartInstance) {
            chartInstance.data.labels = allMonths;
            chartInstance.data.datasets = datasets;
            chartInstance.update();
        } else {
            // Dark-only Iberdrola chart defaults
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.color = '#4a6656';
            Chart.defaults.borderColor = 'rgba(19, 42, 26, 0.6)';

            const gridColor = 'rgba(19, 42, 26, 0.4)';

            chartInstance = new Chart(ctx, {
                data: {
                    labels: allMonths,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: { family: "'Outfit', sans-serif", size: 13, weight: '500' }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(10, 26, 16, 0.95)',
                            titleFont: { size: 14, family: "'Inter', sans-serif", weight: '600' },
                            titleColor: '#F0FDF4',
                            bodyFont: { size: 13, family: "'Inter', sans-serif" },
                            bodyColor: '#94a3b8',
                            padding: 16,
                            cornerRadius: 12,
                            borderColor: 'rgba(0, 198, 90, 0.3)',
                            borderWidth: 1,
                            boxPadding: 4,
                            usePointStyle: true,
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.dataset.type === 'line') {
                                        label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                    } else {
                                        label += new Intl.NumberFormat('pt-BR').format(context.parsed.y) + ' ocorrências';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: gridColor,
                                drawBorder: false
                            },
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 12,
                                maxRotation: 45,
                                font: { size: 12, family: "'Inter', sans-serif" }
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Compensações Pagas (R$)',
                                color: '#F0FDF4',
                                font: { family: "'Outfit', sans-serif", size: 14 }
                            },
                            grid: {
                                color: gridColor,
                                drawBorder: false
                            },
                            ticks: {
                                callback: function (value) {
                                    if (value >= 1e6) return 'R$ ' + (value / 1e6).toFixed(1) + 'M';
                                    if (value >= 1e3) return 'R$ ' + (value / 1e3).toFixed(0) + 'k';
                                    return 'R$ ' + value;
                                },
                                font: { family: "'Inter', sans-serif", size: 11 }
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Qtd. Transgressões',
                                color: '#94a3b8',
                                font: { family: "'Outfit', sans-serif", size: 14 }
                            },
                            grid: {
                                drawOnChartArea: false,
                            }
                        },
                    }
                }
            });
        }
    }

});
