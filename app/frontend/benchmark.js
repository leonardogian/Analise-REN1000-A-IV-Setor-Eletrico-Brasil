/**
 * Benchmark de Distribuidoras — Grouped Bar + Radar (Iberdrola Dark)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let allData = [];
    let barChart = null;
    let radarChart = null;
    const state = { selectedPortes: new Set() };

    const fmtNum = v => window.fmtNum(v, 0);
    const fmtDec = v => window.fmtNum(v, 2);
    const fmtMoney = v => window.fmtMoneyPrecise(v, 4);

    // Iberdrola Porte Colors
    const PORTE_COLORS = {
        P: { border: '#00C65A', bg: 'rgba(0,198,90,0.35)' },
        M: { border: '#FF6B1A', bg: 'rgba(255,107,26,0.35)' },
        G: { border: '#1A8FE3', bg: 'rgba(26,143,227,0.35)' },
        GG: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.35)' },
        N_A: { border: '#4a6656', bg: 'rgba(74,102,86,0.35)' },
    };

    const PORTE_LABELS = {
        P: 'P — Pequeno', M: 'M — Médio', G: 'G — Grande', GG: 'GG — Muito Grande',
    };

    try {
        const res = await fetch('./dashboard_scatter.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_scatter.json');
        const json = await res.json();
        allData = json.data || [];

        const portes = [...new Set(allData.map(d => d.porte).filter(Boolean))].sort();

        // Apply persisted global porte filter if set on another page
        if (window.dashboardFilters && window.dashboardFilters.porte.size > 0) {
            const filtered = portes.filter(p => window.dashboardFilters.porte.has(p));
            state.selectedPortes = new Set(filtered.length > 0 ? filtered : portes);
        } else {
            state.selectedPortes = new Set(portes);
        }

        initFilters(portes);
        render();

    } catch (err) {
        console.error(err);
        document.getElementById('benchmark-summary').innerHTML =
            `<p style="color:#ef4444; font-size:0.85rem">${err.message}</p>`;
    }

    function initFilters(portes) {
        const container = document.getElementById('porte-checkboxes');

        portes.forEach(seg => {
            const isSelected = state.selectedPortes.has(seg);
            const colors = PORTE_COLORS[seg] || PORTE_COLORS['N_A'];
            const label = document.createElement('label');
            label.className = isSelected ? 'chip on' : 'chip';
            label.style.cursor = 'pointer';
            label.innerHTML = `
                <input type="checkbox" value="${seg}" ${isSelected ? 'checked' : ''} style="display:none;">
                <span style="color:${colors.border}">${PORTE_LABELS[seg] || seg}</span>
            `;
            label.addEventListener('click', function () {
                const cb = this.querySelector('input');
                cb.checked = !cb.checked;
                this.classList.toggle('on', cb.checked);
                state.selectedPortes = new Set(
                    Array.from(container.querySelectorAll('input:checked')).map(i => i.value)
                );
                render();
            });
            container.appendChild(label);
        });
    }

    function render() {
        const filtered = allData.filter(d => state.selectedPortes.has(d.porte));
        renderBarChart(filtered);
        renderRadarChart(filtered);
        renderSummary(filtered);
    }

    /* ── Grouped Horizontal Bar: Volume × Compensação ── */
    function renderBarChart(filtered) {
        const ctx = document.getElementById('benchmarkBarChart');
        if (!ctx) return;
        if (barChart) barChart.destroy();

        // Sort by total volume desc, take top 15 for readability
        const sorted = [...filtered].sort((a, b) => b.x - a.x).slice(0, 15);
        const labels = sorted.map(d => {
            const parts = d.label.split(' — ');
            return parts[0].length > 20 ? parts[0].substring(0, 20) + '…' : parts[0];
        });

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Volume Fora do Prazo',
                        data: sorted.map(d => d.x),
                        backgroundColor: sorted.map(d => (PORTE_COLORS[d.porte] || PORTE_COLORS.N_A).bg),
                        borderColor: sorted.map(d => (PORTE_COLORS[d.porte] || PORTE_COLORS.N_A).border),
                        borderWidth: 1.5,
                        borderRadius: 4,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Compensação R$/UC-mês',
                        data: sorted.map(d => d.y),
                        type: 'line',
                        borderColor: '#FF6B1A',
                        backgroundColor: 'rgba(255,107,26,0.15)',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#FF6B1A',
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            color: '#94a3b8',
                            font: { family: "'Inter', sans-serif", size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 26, 16, 0.95)',
                        titleFont: { size: 13, family: "'Inter', sans-serif", weight: '600' },
                        titleColor: '#F0FDF4',
                        bodyFont: { size: 12, family: "'Inter', sans-serif" },
                        bodyColor: '#94a3b8',
                        padding: 14,
                        cornerRadius: 10,
                        borderColor: 'rgba(0, 198, 90, 0.3)',
                        borderWidth: 1,
                        callbacks: {
                            title: ctx => {
                                const idx = ctx[0]?.dataIndex;
                                return sorted[idx]?.label || '';
                            },
                            label: ctx => {
                                if (ctx.datasetIndex === 0) return `Volume: ${fmtNum(ctx.parsed.x)} fora do prazo`;
                                return `Compensação: ${fmtMoney(ctx.parsed.x)}/UC-mês`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(19, 42, 26, 0.3)' },
                        ticks: { font: { size: 11 }, color: '#94a3b8' }
                    },
                    x: {
                        position: 'top',
                        title: {
                            display: true,
                            text: 'Total Fora do Prazo',
                            color: '#F0FDF4',
                            font: { family: "'Inter', sans-serif", size: 13 }
                        },
                        grid: { color: 'rgba(19, 42, 26, 0.3)' },
                    },
                    y1: {
                        position: 'right',
                        display: false,
                    }
                }
            }
        });
    }

    /* ── Radar: Top 5 Distribuidoras ── */
    function renderRadarChart(filtered) {
        const ctx = document.getElementById('benchmarkRadarChart');
        if (!ctx) return;
        if (radarChart) radarChart.destroy();

        if (filtered.length < 2) {
            radarChart = null;
            return;
        }

        // Pick top 5 by volume
        const top5 = [...filtered].sort((a, b) => b.x - a.x).slice(0, 5);

        // Normalize both axes to 0-100 for radar
        const maxX = Math.max(...filtered.map(d => d.x), 1);
        const maxY = Math.max(...filtered.map(d => d.y), 0.001);

        const radarLabels = ['Volume', 'Compensação', 'Eficiência'];
        const RADAR_COLORS = ['#00C65A', '#1A8FE3', '#FF6B1A', '#A8D96B', '#8b5cf6'];

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: top5.map((d, i) => {
                    const volNorm = (d.x / maxX) * 100;
                    const compNorm = (d.y / maxY) * 100;
                    const effNorm = volNorm > 0 ? Math.min(100, (compNorm / volNorm) * 50) : 0;
                    const parts = d.label.split(' — ');
                    const name = parts[0].length > 15 ? parts[0].substring(0, 15) + '…' : parts[0];

                    return {
                        label: name,
                        data: [volNorm, compNorm, effNorm],
                        borderColor: RADAR_COLORS[i],
                        backgroundColor: RADAR_COLORS[i] + '20',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: RADAR_COLORS[i],
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            usePointStyle: true,
                            padding: 12,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 26, 16, 0.95)',
                        titleColor: '#F0FDF4',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(0, 198, 90, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(19, 42, 26, 0.4)' },
                        grid: { color: 'rgba(19, 42, 26, 0.3)' },
                        pointLabels: {
                            color: '#94a3b8',
                            font: { size: 12, weight: '600' }
                        },
                        ticks: {
                            display: false,
                            beginAtZero: true,
                            max: 100,
                        },
                        suggestedMin: 0,
                        suggestedMax: 100,
                    }
                }
            }
        });
    }

    /* ── Summary by Porte ── */
    function renderSummary(filtered) {
        const summaryEl = document.getElementById('benchmark-summary');
        const cardsEl = document.getElementById('summary-cards');

        if (!filtered.length) {
            summaryEl.innerHTML = '<p style="color:var(--text-muted)">Nenhuma distribuidora selecionada.</p>';
            cardsEl.innerHTML = '';
            return;
        }

        const portes = [...state.selectedPortes];
        cardsEl.innerHTML = portes.map(seg => {
            const points = filtered.filter(d => d.porte === seg);
            if (!points.length) return '';
            const avgY = points.reduce((s, d) => s + d.y, 0) / points.length;
            const totalVol = points.reduce((s, d) => s + d.x, 0);
            const topDist = [...points].sort((a, b) => b.x - a.x)[0];
            const colors = PORTE_COLORS[seg] || PORTE_COLORS['N_A'];
            return `
                <div class="chart-card" style="border-top: 3px solid ${colors.border};">
                    <h3 class="chart-title" style="color:${colors.border}">${PORTE_LABELS[seg] || seg}</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;color:var(--text-secondary);">
                        <div>
                            <div style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">Distribuidoras</div>
                            <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${points.length}</div>
                        </div>
                        <div>
                            <div style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">Média R$/UC-mês</div>
                            <div style="font-size:1.1rem;font-weight:700;color:${colors.border}">${fmtMoney(avgY)}</div>
                        </div>
                        <div>
                            <div style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">Total Volume</div>
                            <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${fmtNum(totalVol)}</div>
                        </div>
                        <div>
                            <div style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">Maior Volume</div>
                            <div style="font-size:0.85rem;font-weight:600;color:var(--text-secondary)">${topDist.label.split(' — ')[0]}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Overall summary
        const totalDist = filtered.length;
        const avgComp = filtered.reduce((s, d) => s + d.y, 0) / totalDist;
        const totalVol = filtered.reduce((s, d) => s + d.x, 0);
        const worst = [...filtered].sort((a, b) => b.y - a.y)[0];
        const best = [...filtered].sort((a, b) => a.y - b.y)[0];

        summaryEl.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="insight-block" style="border-color:#00C65A;">
                    <h4 style="color:#00C65A;font-size:0.8rem;margin:0 0 4px;">Menor Compensação</h4>
                    <p style="margin:0;font-size:0.85rem;"><strong>${best.label.split(' — ')[0]}</strong> — ${fmtMoney(best.y)}/UC-mês</p>
                </div>
                <div class="insight-block" style="border-color:#ef4444;">
                    <h4 style="color:#ef4444;font-size:0.8rem;margin:0 0 4px;">Maior Compensação</h4>
                    <p style="margin:0;font-size:0.85rem;"><strong>${worst.label.split(' — ')[0]}</strong> — ${fmtMoney(worst.y)}/UC-mês</p>
                </div>
            </div>
            <p style="margin-top:10px;font-size:0.78rem;color:var(--text-muted);">
                ${totalDist} distribuidoras · Média: ${fmtMoney(avgComp)}/UC-mês · Volume total: ${fmtNum(totalVol)} serviços fora do prazo
            </p>
        `;
    }
});
