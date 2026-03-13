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
        inflectionMonth: document.getElementById('inflection-month'),
        btnGenerateAi: document.getElementById('btn-generate-ai'),
        aiInsightContainer: document.getElementById('ai-insight-container')
    };

    // Inicialização
    try {
        const response = await fetch('./dashboard_transgressoes.json');
        if (!response.ok) throw new Error("Não foi possível carregar os dados.");
        dashboardData = await response.json();

        // Apply persisted global holding filter if set on another page
        if (window.dashboardFilters && window.dashboardFilters.grupos.size > 0) {
            state.selectedHoldings = Array.from(window.dashboardFilters.grupos);
        }

        initFilters();
        renderInsights();
        updateChart();
        initAI();

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
            // Data may have "mes" (string like "Dez/.0") or "ano_mes" (string like "2023-12")
            let mesFinal = '—';
            if (inflection_point.ano_mes) {
                let [ano, mes] = inflection_point.ano_mes.split('-');
                const mesFormatado = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
                mesFinal = mesFormatado.charAt(0).toUpperCase() + mesFormatado.slice(1) + '/' + ano.slice(-2);
            } else if (inflection_point.mes) {
                mesFinal = inflection_point.mes;
            }
            UI.inflectionMonth.textContent = mesFinal;

            html += `
        <div class="insight-block">
          <h3>Ponto de Inflexão (Transição para REN 1000)</h3>
          <p>O maior salto no volume de infrações ocorreu em <strong>${mesFinal}</strong>, com um acréscimo de <strong>${(inflection_point.salto_transgressoes || 0).toLocaleString('pt-BR')}</strong> transgressões em relação ao mês anterior em nível nacional.</p>
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

        if (chartInstance) {
            chartInstance.destroy();
        }

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
                        position: 'top',
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
                            drawOnChartArea: false, // Só mostrar grid do eixo principal
                        }
                    },
                }
            }
        });
    }

    // --- Funções de IA ---
    function initAI() {
        if (!UI.btnGenerateAi) return;

        UI.btnGenerateAi.addEventListener('click', async () => {
            UI.btnGenerateAi.disabled = true;
            UI.btnGenerateAi.textContent = "Gerando Análise... ⏳";
            UI.aiInsightContainer.style.display = "block";
            UI.aiInsightContainer.innerHTML = "<p>Pensando e estruturando a análise baseada no contexto atual...</p>";

            const customPromptStr = document.getElementById('ai-custom-prompt') ? document.getElementById('ai-custom-prompt').value : "";

            // Build Context
            const filters = {
                holdingsAtivas: state.selectedHoldings,
                distribuidorasAtivas: state.selectedDistributors,
                apenasRural: state.ruralOnly
            };

            let totalFinanceiro = 0;
            let totalTransgressoes = 0;

            const aggregateBy = state.selectedDistributors.length > 0 ? 'distribuidora' : 'holding';
            const activeGroups = state.selectedDistributors.length > 0 ? state.selectedDistributors : state.selectedHoldings;

            let groupMetrics = {};
            activeGroups.forEach(groupId => {
                groupMetrics[groupId] = { valor_pago: 0, qtd_transgressoes: 0 };
            });

            const filteredSeries = dashboardData.series.filter(s => {
                if (state.ruralOnly && !s.is_rural) return false;
                if (state.selectedHoldings.length > 0 && !state.selectedHoldings.includes(s.holding)) return false;
                if (state.selectedDistributors.length > 0 && !state.selectedDistributors.includes(s.distribuidora)) return false;
                return true;
            });

            filteredSeries.forEach(s => {
                const id = s[aggregateBy];
                if (groupMetrics[id]) {
                    groupMetrics[id].valor_pago += s.valor_pago;
                    groupMetrics[id].qtd_transgressoes += s.qtd_transgressoes;
                    totalFinanceiro += s.valor_pago;
                    totalTransgressoes += s.qtd_transgressoes;
                }
            });

            // Format numbers slightly for better AI comprehension
            const formatMoney = v => "R$ " + (v / 1e6).toFixed(2) + "M";

            const metrics = {
                totalGeralFinanceiro: formatMoney(totalFinanceiro),
                totalGeralTransgressoes: totalTransgressoes,
                detalhamentoFinanceiro: {}
            };

            activeGroups.forEach(id => {
                metrics.detalhamentoFinanceiro[id] = formatMoney(groupMetrics[id].valor_pago) + " (" + groupMetrics[id].qtd_transgressoes + " transgressões)";
            });

            try {
                // If the static html is opened locally, it might run on 5500 via live server
                // But the FastAPI backend will run on 8000. Let's point to localhost:8000 for this demo.
                const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? `http://127.0.0.1:8000/api/v1/ai-insights`
                    : '/api/v1/ai-insights';

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filters, metrics, prompt: customPromptStr })
                });

                if (!response.ok) {
                    const errorObj = await response.json().catch(() => ({}));
                    throw new Error(errorObj.detail || "Erro na solicitação. O backend FastAPI está rodando e a OPENROUTER_API_KEY no .env?");
                }

                const data = await response.json();

                // Markdown visual parsing
                let htmlContent = data.insight
                    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong style="color: white;">$1</strong>')
                    .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                    .replace(/^- (.*)$/gm, '<li style="margin-left: 1.5rem;">$1</li>')
                    .replace(/\n/g, '<br/>');

                UI.aiInsightContainer.innerHTML = htmlContent;

            } catch (error) {
                console.error("AI Insight Error:", error);
                UI.aiInsightContainer.innerHTML = `<p style="color: #ef4444;">Erro ao gerar insight: ${error.message}</p>`;
            } finally {
                UI.btnGenerateAi.disabled = false;
                UI.btnGenerateAi.textContent = "✨ Gerar Nova Análise IA";
            }
        });
    }

});
