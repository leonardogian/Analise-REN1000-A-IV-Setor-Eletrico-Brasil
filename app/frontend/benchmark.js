/**
 * Benchmark de Distribuidoras (Bubble Chart)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let allData = [];
    let chartInstance = null;
    const state = { selectedPortes: new Set(), selectedRegra: 'REN 1000' };

    const fmtNum = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
    const fmtMoney = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(v);

    // Cores por porte (e fallback por regra se porte ausente)
    const PORTE_COLORS = {
        P:          { border: '#10b981', bg: 'rgba(16,185,129,0.45)' },
        M:          { border: '#f59e0b', bg: 'rgba(245,158,11,0.45)' },
        G:          { border: '#3b82f6', bg: 'rgba(59,130,246,0.45)' },
        GG:         { border: '#b026ff', bg: 'rgba(176,38,255,0.45)' },
        'REN 414':  { border: '#00f0ff', bg: 'rgba(0,240,255,0.4)' },
        'REN 1000': { border: '#ff0055', bg: 'rgba(255,0,85,0.4)' },
        N_A:        { border: '#64748b', bg: 'rgba(100,116,139,0.4)' },
    };

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

    try {
        const res = await fetch('./dashboard_scatter.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_scatter.json');
        const json = await res.json();
        allData = json.data || [];

        const hasPorte = allData.some(d => d.porte && d.porte !== 'N/A');
        const segmentKey = hasPorte ? 'porte' : 'regra';

        const segments = [...new Set(allData.map(d => d[segmentKey]))].filter(Boolean).sort();
        state.selectedPortes = new Set(segments);

        initFilters(segments, segmentKey);
        render(segmentKey);
        initThemeToggle(segmentKey);

    } catch (err) {
        console.error(err);
        document.getElementById('benchmark-summary').innerHTML =
            `<p style="color:#ef4444; font-size:0.85rem">${err.message}</p>`;
    }

    function initFilters(segments, segmentKey) {
        const container = document.getElementById('porte-checkboxes');
        const labelMap = {
            P: 'P — Pequeno', M: 'M — Médio', G: 'G — Grande', GG: 'GG — Muito Grande',
            'REN 414': 'REN 414 (pré-2022)', 'REN 1000': 'REN 1000 (pós-2022)',
        };

        segments.forEach(seg => {
            const colors = PORTE_COLORS[seg] || PORTE_COLORS['N_A'];
            const label = document.createElement('label');
            label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; cursor:pointer';
            label.innerHTML = `
                <input type="checkbox" value="${seg}" checked style="accent-color:${colors.border}">
                <span class="porte-badge ${seg.replace(/\s/g, '_')}"
                      style="background:${colors.bg}; color:${colors.border}; border:1px solid ${colors.border}4d">
                    ${labelMap[seg] || seg}
                </span>
            `;
            container.appendChild(label);
        });

        container.addEventListener('change', () => {
            state.selectedPortes = new Set(
                Array.from(container.querySelectorAll('input:checked')).map(i => i.value)
            );
            render(segmentKey);
        });

        document.getElementById('regra-select').addEventListener('change', e => {
            state.selectedRegra = e.target.value;
            render(segmentKey);
        });
    }

    function render(segmentKey) {
        const filtered = allData.filter(d => {
            if (!state.selectedPortes.has(d[segmentKey])) return false;
            if (state.selectedRegra !== 'all' && d.regra !== state.selectedRegra) return false;
            return true;
        });

        renderChart(filtered, segmentKey);
        renderSummaryCards(filtered, segmentKey);
    }

    function renderChart(filtered, segmentKey) {
        const ctx = document.getElementById('benchmarkChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        const segments = [...state.selectedPortes];
        const maxX = Math.max(...filtered.map(d => d.x), 1);

        const datasets = segments.map(seg => {
            const points = filtered.filter(d => d[segmentKey] === seg);
            const colors = PORTE_COLORS[seg] || PORTE_COLORS['N_A'];
            return {
                label: seg,
                data: points.map(d => ({
                    x: d.x,
                    y: d.y,
                    r: Math.max(4, Math.sqrt(d.x / maxX) * 22),
                    label: d.label
                })),
                backgroundColor: colors.bg,
                borderColor: colors.border,
                borderWidth: 1.5,
            };
        });

        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = isLight ? "#475569" : "#8a949e";

        chartInstance = new Chart(ctx, {
            type: 'bubble',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            font: { family: "'Outfit', sans-serif", size: 13, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.85)',
                        titleFont: { size: 13, family: "'Outfit', sans-serif", weight: '600' },
                        bodyFont: { size: 12, family: "'Inter', sans-serif" },
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(0,240,255,0.3)',
                        borderWidth: 1,
                        callbacks: {
                            title: ctx => ctx[0]?.raw?.label ? ctx[0].raw.label.split(' — ')[0] : '',
                            label: ctx => [
                                `Volume: ${fmtNum(ctx.raw.x)} serviços fora do prazo`,
                                `Compensação: ${fmtMoney(ctx.raw.y)}/UC-mês`
                            ]
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Total de serviços fora do prazo',
                            color: isLight ? '#1e293b' : '#cbd5e1',
                            font: { family: "'Outfit', sans-serif", size: 13 }
                        },
                        grid: { color: gridColor }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Compensação média R$/UC-mês',
                            color: isLight ? '#1e293b' : '#cbd5e1',
                            font: { family: "'Outfit', sans-serif", size: 13 }
                        },
                        grid: { color: gridColor },
                        ticks: { callback: v => `R$ ${Number(v).toFixed(3)}` }
                    }
                }
            }
        });
    }

    function renderSummaryCards(filtered, segmentKey) {
        const container = document.getElementById('summary-cards');
        const segments = [...state.selectedPortes];

        container.innerHTML = segments.map(seg => {
            const points = filtered.filter(d => d[segmentKey] === seg);
            if (!points.length) return '';
            const avgY = points.reduce((s, d) => s + d.y, 0) / points.length;
            const maxY = Math.max(...points.map(d => d.y));
            const minY = Math.min(...points.map(d => d.y));
            const colors = PORTE_COLORS[seg] || PORTE_COLORS['N_A'];
            return `
                <div class="summary-card" style="border-color:${colors.border}4d">
                    <div class="summary-card-title">
                        <span style="color:${colors.border}; font-weight:700">${seg}</span>
                    </div>
                    <div class="summary-card-value">${fmtMoney(avgY)}</div>
                    <div class="summary-card-meta">Média R$/UC-mês · ${points.length} distribuidoras</div>
                    <div class="summary-card-meta" style="margin-top:0.25rem">
                        Min: ${fmtMoney(minY)}<br>Max: ${fmtMoney(maxY)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function initThemeToggle(segmentKey) {
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
            render(segmentKey);
        });
    }
});
