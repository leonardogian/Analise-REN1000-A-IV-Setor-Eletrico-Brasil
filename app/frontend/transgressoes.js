/**
 * Dashboard Transgressões (REN 414 vs REN 1000)
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Configurações e Estado
    let dashboardData = null;
    let chartInstance = null;
    const state = {
        selectedHoldings: ["neoenergia", "cpfl", "equatorial", "enel", "energisa"], // Principais por padrão
        selectedDistributors: [],
        ruralOnly: false
    };

    // Cores CSS Variables
    const colors = {
        neoenergia: "#3b82f6", // Pop Blue
        cpfl: "#10b981",       // Pop Green
        equatorial: "#f59e0b", // Pop Yellow/Amber
        enel: "#ef4444",       // Pop Red
        energisa: "#8b5cf6",   // Pop Violet
        cemig: "#f97316",      // Pop Orange
        copel: "#06b6d4",      // Pop Cyan
        edp: "#ec4899",        // Pop Pink
        celesc: "#14b8a6",     // Pop Teal
        outros: "#94a3b8"      // Pop Gray
    };

    const UI = {
        holdingSelect: document.getElementById('holding-select'),
        distributorSelect: document.getElementById('distributor-select'),
        ruralToggle: document.getElementById('rural-only-toggle'),
        insightContainer: document.getElementById('insight-container'),
        inflectionBadge: document.getElementById('inflection-badge'),
        inflectionMonth: document.getElementById('inflection-month'),
    };

    // Inicialização
    try {
        const response = await fetch('./dashboard_transgressoes.json');
        if (!response.ok) throw new Error("Não foi possível carregar os dados.");
        dashboardData = await response.json();

        initFilters();
        renderInsights();
        updateChart();

    } catch (error) {
        console.error("Erro ao inicializar dashboard:", error);
        UI.insightContainer.innerHTML = `<p class="error">Erro ao carregar dados: ${error.message}</p>`;
    }

    // --- Funções de Filtro ---

    function initFilters() {
        // 1. Popular Holdings
        const holdings = dashboardData.groups;
        UI.holdingSelect.innerHTML = "";

        holdings.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.label;
            if (state.selectedHoldings.includes(g.id)) option.selected = true;
            UI.holdingSelect.appendChild(option);
        });

        UI.holdingSelect.addEventListener('change', (e) => {
            state.selectedHoldings = Array.from(e.target.selectedOptions).map(opt => opt.value);
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
            updateChart();
        });
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
            UI.inflectionMonth.textContent = inflection_point.mes;

            html += `
        <div class="insight-block">
          <h3>Ponto de Inflexão (Transição para REN 1000)</h3>
          <p>O maior salto no volume de infrações ocorreu em <strong>${inflection_point.mes}</strong>, com um acréscimo de <strong>${inflection_point.salto_transgressoes.toLocaleString('pt-BR')}</strong> transgressões em relação ao mês anterior em nível nacional.</p>
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
                return `<li><strong>${groupName}</strong>: ${(g.rural_share * 100).toFixed(1)}% das compensações são rurais.</li>`;
            }).join('')}
          </ul>
          <p class="insight-meta">Estes grupos tendem a sofrer mais com a exigência de atendimento da REN 1000 devido à sua vasta extensão territorial.</p>
        </div>
      `;
        }

        UI.insightContainer.innerHTML = html;
    }

    // --- Renderização do Gráfico ---

    function updateChart() {
        const ctx = document.getElementById('transgressionsChart').getContext('2d');

        // Filtrar Séries Temporais
        let filteredSeries = dashboardData.series.filter(s => {
            // Filtrar por Rural
            if (state.ruralOnly && !s.is_rural) return false;

            // Filtrar por Holding
            if (state.selectedHoldings.length > 0 && !state.selectedHoldings.includes(s.holding)) return false;

            // Filtrar por Distribuidora (se houver alguma selecionada, senão pega todas da holding)
            if (state.selectedDistributors.length > 0 && !state.selectedDistributors.includes(s.distribuidora)) return false;

            return true;
        });

        // Precisamos montar os datasets. Vamos agregar por Holding para visualização macro, 
        // ou por Distribuidora se houver distribuidores específicos selecionados.

        // Obter array unificado de meses (Labels do X)
        const allMonths = [...new Set(dashboardData.series.map(s => s.mes))];

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
                return records.reduce((sum, r) => sum + r.valor_pago, 0);
            });

            // Dados para as Barras (Qtd Transgressões)
            const barData = allMonths.map(month => {
                const records = filteredSeries.filter(s => s.mes === month && s[aggregateBy] === groupId);
                return records.reduce((sum, r) => sum + r.qtd_transgressoes, 0);
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
                backgroundColor: color,
                borderWidth: 3,
                tension: 0.4,
                yAxisID: 'y',
                order: 1 // Desenhar por cima das barras
            });

            // Adicionar Barra de Fundo (Qtd)
            datasets.push({
                label: `${labelName} (Qtd Falhas)`,
                data: barData,
                type: 'bar',
                backgroundColor: bgColor,
                borderColor: 'transparent',
                yAxisID: 'y1',
                order: 2,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            });
        });

        if (chartInstance) {
            chartInstance.destroy();
        }

        // Configuração do Chart.js
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = "#94a3b8";

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
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 14, family: "'Outfit', sans-serif" },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
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
                            color: 'rgba(51, 65, 85, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            font: { size: 12 }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Compensações Pagas (R$)',
                            color: '#cbd5e1',
                            font: { family: "'Outfit', sans-serif", size: 14 }
                        },
                        grid: {
                            color: 'rgba(51, 65, 85, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function (value) {
                                if (value >= 1e6) return 'R$ ' + (value / 1e6).toFixed(1) + 'M';
                                if (value >= 1e3) return 'R$ ' + (value / 1e3).toFixed(0) + 'k';
                                return 'R$ ' + value;
                            }
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
                            drawOnChartArea: false, // Só mostrar grid do eixo principal
                        }
                    },
                }
            }
        });
    }

});
