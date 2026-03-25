/**
 * qualidade.js — Data Quality, Audit & Complementary Data
 * Fetches dashboard_audit.json, dashboard_infractions.json, dashboard_reclamacoes.json
 * and renders coverage chart, KPIs, and complementary data sections.
 */
(function () {
    'use strict';

    // ========================================================================
    // AUDIT SECTION
    // ========================================================================

    async function loadAudit() {
        try {
            const res = await fetch('./dashboard_audit.json');
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    function renderAuditKPIs(audit) {
        var datasets = audit.datasets || [];
        var found = datasets.filter(function (d) { return d.exists; });
        var totalRows = 0;
        var covSum = 0;
        var maxDist = 0;

        for (var i = 0; i < found.length; i++) {
            totalRows += found[i].rows;
            covSum += found[i].coverage_pct;
            if (found[i].n_distributors > maxDist) maxDist = found[i].n_distributors;
        }

        var avgCov = found.length > 0 ? (covSum / found.length) : 0;

        var el = document.getElementById('audit-total-rows');
        if (el) el.textContent = typeof fmtNum === 'function' ? fmtNum(totalRows, 0) : totalRows.toLocaleString('pt-BR');

        el = document.getElementById('audit-datasets-found');
        if (el) el.textContent = found.length + ' / ' + datasets.length;

        el = document.getElementById('audit-avg-coverage');
        if (el) el.textContent = avgCov.toFixed(0) + '%';

        el = document.getElementById('audit-max-distributors');
        if (el) el.textContent = maxDist > 0 ? String(maxDist) : '—';
    }

    function renderCoverageChart(audit) {
        var canvas = document.getElementById('audit-coverage-chart');
        if (!canvas) return;

        var datasets = (audit.datasets || []).filter(function (d) { return d.exists; });
        if (datasets.length === 0) return;

        var labels = [];
        var barData = [];
        var barColors = [];

        var minYear = 2010;
        var maxYear = 2025;

        for (var i = 0; i < datasets.length; i++) {
            var ds = datasets[i];
            labels.push(ds.name);

            var rangeMin = ds.temporal_range.min || minYear;
            var rangeMax = ds.temporal_range.max || maxYear;

            barData.push([rangeMin, rangeMax]);

            // Color by coverage
            if (ds.coverage_pct >= 90) {
                barColors.push('rgba(0, 198, 90, 0.7)');   // green
            } else if (ds.coverage_pct >= 50) {
                barColors.push('rgba(255, 107, 26, 0.7)'); // orange
            } else {
                barColors.push('rgba(239, 68, 68, 0.7)');  // red
            }
        }

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cobertura Temporal',
                    data: barData,
                    backgroundColor: barColors,
                    borderColor: barColors.map(function (c) { return c.replace('0.7', '1'); }),
                    borderWidth: 1,
                    borderSkipped: false,
                    barPercentage: 0.6,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        min: minYear,
                        max: maxYear + 1,
                        ticks: {
                            stepSize: 1,
                            callback: function (v) { return String(v); }
                        },
                        title: { display: true, text: 'Ano' }
                    },
                    y: {
                        ticks: { font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var d = ctx.raw;
                                return d[0] + ' – ' + d[1];
                            }
                        }
                    }
                }
            }
        });
    }

    // ========================================================================
    // COMPLEMENTARY: INFRACTIONS
    // ========================================================================

    async function loadInfractions() {
        try {
            var res = await fetch('./dashboard_infractions.json');
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    function renderInfractions(data) {
        if (!data) {
            var section = document.getElementById('infractions-section');
            if (section) section.style.display = 'none';
            return;
        }

        var el = document.getElementById('infractions-total');
        if (el) el.textContent = typeof fmtNum === 'function' ? fmtNum(data.total, 0) : data.total.toLocaleString('pt-BR');

        el = document.getElementById('infractions-value');
        if (el) {
            var val = data.value_summary ? data.value_summary.total : 0;
            el.textContent = typeof fmtMoney === 'function' ? fmtMoney(val) : 'R$ ' + val.toLocaleString('pt-BR');
        }

        el = document.getElementById('infractions-period');
        if (el && data.temporal_range) {
            el.textContent = (data.temporal_range.min || '?') + ' a ' + (data.temporal_range.max || '?');
        }

        // Bar chart by year
        renderYearlyBarChart('infractions-chart', data.by_year, 'rgba(255, 107, 26, 0.7)', 'Autos de Infração');
    }

    // ========================================================================
    // COMPLEMENTARY: RECLAMAÇÕES
    // ========================================================================

    async function loadReclamacoes() {
        try {
            var res = await fetch('./dashboard_reclamacoes.json');
            if (!res.ok) return null;
            return await res.json();
        } catch { return null; }
    }

    function renderReclamacoes(data) {
        if (!data) {
            var section = document.getElementById('reclamacoes-section');
            if (section) section.style.display = 'none';
            return;
        }

        var el = document.getElementById('reclamacoes-total');
        if (el) el.textContent = typeof fmtNum === 'function' ? fmtNum(data.total, 0) : data.total.toLocaleString('pt-BR');

        el = document.getElementById('reclamacoes-distributors');
        if (el) {
            var top = data.top_distributors || [];
            el.textContent = top.length > 0 ? String(top.length) + '+' : '—';
        }

        el = document.getElementById('reclamacoes-period');
        if (el && data.temporal_range) {
            el.textContent = (data.temporal_range.min || '?') + ' a ' + (data.temporal_range.max || '?');
        }

        // Bar chart by year
        renderYearlyBarChart('reclamacoes-chart', data.by_year, 'rgba(0, 198, 90, 0.7)', 'Reclamações');
    }

    // ========================================================================
    // SHARED: Yearly bar chart
    // ========================================================================

    function renderYearlyBarChart(canvasId, byYear, color, label) {
        var canvas = document.getElementById(canvasId);
        if (!canvas || !byYear || byYear.length === 0) return;

        var labels = [];
        var values = [];
        for (var i = 0; i < byYear.length; i++) {
            labels.push(String(byYear[i].year));
            values.push(byYear[i].count);
        }

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: color,
                    borderColor: color.replace('0.7', '1'),
                    borderWidth: 1,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (v) {
                                return typeof fmtNum === 'function' ? fmtNum(v, 0) : v.toLocaleString('pt-BR');
                            }
                        }
                    },
                    x: {
                        ticks: { font: { size: 10 }, maxRotation: 45 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return typeof fmtNum === 'function' ? fmtNum(ctx.raw, 0) : ctx.raw.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        });
    }

    // ========================================================================
    // INIT
    // ========================================================================

    document.addEventListener('DOMContentLoaded', async function () {
        // Load all 3 JSONs in parallel
        var results = await Promise.allSettled([
            loadAudit(),
            loadInfractions(),
            loadReclamacoes(),
        ]);

        var audit = results[0].status === 'fulfilled' ? results[0].value : null;
        var infractions = results[1].status === 'fulfilled' ? results[1].value : null;
        var reclamacoes = results[2].status === 'fulfilled' ? results[2].value : null;

        // Render audit section
        if (audit) {
            renderAuditKPIs(audit);
            renderCoverageChart(audit);
        }

        // Render complementary sections
        renderInfractions(infractions);
        renderReclamacoes(reclamacoes);
    });

})();
