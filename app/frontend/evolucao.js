/**
 * Heatmap de Evolução Mensal (Holdings × Meses)
 */
document.addEventListener("DOMContentLoaded", async () => {
    let allData = [];
    const state = {
        metric: 'fora_prazo_por_100k_uc_mes',
        selectedHoldings: [],
        showSubsidiaries: false
    };

    // ID mappings: timeseries uses title-case ("Neoenergia"), filters use lowercase ("neoenergia")
    const idToGrupo = {};  // "neoenergia" → "Neoenergia"
    const grupoToId = {};  // "Neoenergia" → "neoenergia"

    // Hierarchy: parent_id → [franchise grupo names]
    let groupsHierarchy = {};
    // All groups for buildGroupTabs: { id, label }
    let allGroupsList = [];

    const fmtNum = v => window.fmtNum(v, 3);
    const fmtMoney = v => window.fmtMoneyPrecise(v, 4);

    const METRIC_LABELS = {
        fora_prazo_por_100k_uc_mes: 'Falhas / 100k UCs-mês',
        compensacao_rs_por_uc_mes: 'Compensação R$/UC-mês'
    };

    // REN 1000 boundary: April 2022 (vigência)
    const REN1000_BOUNDARY = '2022-04';

    // Iberdrola heatmap: green (low) → orange (mid) → red (high)
    function metricToColor(normalized) {
        const hue = 140 - normalized * 140;
        const sat = 70 + normalized * 30;
        const lit = 28 + normalized * 12;
        return `hsl(${hue}, ${sat}%, ${lit}%)`;
    }

    /** Truncate long franchise names: "Neoenergia Coelba — COMPANHIA..." → "Neoenergia Coelba" */
    function shortLabel(name) {
        const dashIdx = name.indexOf(' — ');
        return dashIdx > 0 ? name.substring(0, dashIdx) : name;
    }

    if (typeof showSkeleton === 'function') showSkeleton('heatmap-container', 420);
    try {
        const res = await fetch('./dashboard_timeseries.json');
        if (!res.ok) throw new Error('Falha ao carregar dashboard_timeseries.json');
        const json = await res.json();
        if (typeof hideSkeleton === 'function') hideSkeleton('heatmap-container');

        allData = (json.data || []).filter(d =>
            d.tipo === 'holding' || (d.tipo && d.tipo.startsWith('franquia'))
        );

        // Build hierarchy and ID mappings
        groupsHierarchy = {};
        const seenGroups = new Set();

        allData.forEach(d => {
            if (d.tipo === 'holding') {
                const id = window.normalizeGroupId(d.grupo);
                idToGrupo[id] = d.grupo;
                grupoToId[d.grupo] = id;
                if (!groupsHierarchy[id]) groupsHierarchy[id] = [];
                seenGroups.add(id);
            } else if (d.tipo && d.tipo.startsWith('franquia|')) {
                const parentId = d.tipo.split('|')[1];
                if (!groupsHierarchy[parentId]) groupsHierarchy[parentId] = [];
                const shortName = shortLabel(d.grupo);
                if (!groupsHierarchy[parentId].includes(shortName)) {
                    groupsHierarchy[parentId].push(shortName);
                }
                // Map franchise grupo name to parent id
                grupoToId[d.grupo] = parentId;
                // For cooperatives that are their own franchise
                if (!seenGroups.has(parentId)) {
                    idToGrupo[parentId] = shortName;
                    seenGroups.add(parentId);
                }
            }
        });

        // Build allGroupsList for buildGroupTabs
        allGroupsList = Array.from(seenGroups).map(id => ({
            id: id,
            label: idToGrupo[id] || id
        }));

        // Apply persisted global holding filter
        if (window.dashboardFilters && window.dashboardFilters.grupos.size > 0) {
            state.selectedHoldings = allGroupsList
                .filter(g => window.dashboardFilters.grupos.has(g.id))
                .map(g => g.id);
            if (state.selectedHoldings.length === 0) {
                // Fallback: select all holdings in current category
                state.selectedHoldings = allGroupsList
                    .filter(g => window.isHolding(g.id))
                    .map(g => g.id);
            }
        } else {
            state.selectedHoldings = allGroupsList
                .filter(g => window.isHolding(g.id))
                .map(g => g.id);
        }

        initFilters();
        renderHeatmap();

    } catch (err) {
        console.error(err);
        showError(document.getElementById('heatmap-container'), err.message);
    }

    // --- Listener de Filtro Global ---
    window.addEventListener('filters:change', (e) => {
        if (!e.detail || allData.length === 0) return;
        let needsUpdate = false;

        if (e.detail.grupos) {
            if (e.detail.grupos.size > 0) {
                // Map incoming lowercase IDs to our known groups
                state.selectedHoldings = allGroupsList
                    .filter(g => e.detail.grupos.has(g.id))
                    .map(g => g.id);
            } else {
                state.selectedHoldings = allGroupsList
                    .filter(g => window.isHolding(g.id))
                    .map(g => g.id);
            }
            const sel = document.getElementById('holding-select');
            if (sel) {
                Array.from(sel.options).forEach(opt => {
                    opt.selected = state.selectedHoldings.includes(opt.value);
                });
            }
            needsUpdate = true;
        }

        if (e.detail.period != null) {
            needsUpdate = true;
        }

        if (needsUpdate) renderHeatmap();
    });

    function initFilters() {
        const sel = document.getElementById('holding-select');
        const tabsEl = document.getElementById('group-tabs');

        // Use buildGroupTabs for category switching
        if (tabsEl && window.buildGroupTabs) {
            window.buildGroupTabs(tabsEl, sel, allGroupsList, {
                onPopulate: function (filtered) {
                    state.selectedHoldings = filtered
                        .filter(g => window.dashboardFilters.grupos.has(g.id))
                        .map(g => g.id);
                    if (state.selectedHoldings.length === 0) {
                        state.selectedHoldings = filtered.map(g => g.id);
                    }
                    renderHeatmap();
                }
            });
        }

        sel.addEventListener('change', e => {
            state.selectedHoldings = Array.from(e.target.selectedOptions).map(o => o.value);
            if (window.dashboardFilters) {
                window.dashboardFilters.grupos = new Set(state.selectedHoldings);
                if (window.saveFilters) window.saveFilters();
            }
            renderHeatmap();
        });

        // Metric radios
        document.querySelectorAll('input[name="metric-radio"]').forEach(r => {
            r.addEventListener('change', e => {
                state.metric = e.target.value;
                renderHeatmap();
            });
        });

        // Show subsidiaries toggle
        const subToggle = document.getElementById('show-subsidiaries');
        if (subToggle) {
            subToggle.addEventListener('change', e => {
                state.showSubsidiaries = e.target.checked;
                renderHeatmap();
            });
        }
    }

    function renderHeatmap() {
        const container = document.getElementById('heatmap-container');
        container.innerHTML = '';
        container.style.overflowX = 'auto';

        const period = window.dashboardFilters ? window.dashboardFilters.period : 'all';

        // Build list of grupo names to show
        let gruposToShow = [];

        state.selectedHoldings.forEach(id => {
            const grupoName = idToGrupo[id];
            if (!grupoName) return;

            // Check if this is a real holding (tipo=holding exists)
            const isRealHolding = allData.some(d => d.tipo === 'holding' && window.normalizeGroupId(d.grupo) === id);

            if (isRealHolding) {
                gruposToShow.push(grupoName);
                // Add subsidiaries if toggle is on
                if (state.showSubsidiaries && groupsHierarchy[id]) {
                    groupsHierarchy[id].forEach(franchiseName => {
                        // Find matching data grupo name (may be long)
                        const matchingGrupos = allData
                            .filter(d => d.tipo && d.tipo.startsWith('franquia|' + id))
                            .map(d => d.grupo);
                        const unique = [...new Set(matchingGrupos)];
                        unique.forEach(g => {
                            if (!gruposToShow.includes(g)) gruposToShow.push(g);
                        });
                    });
                }
            } else {
                // Cooperative: show its franchise data directly
                const matchingGrupos = allData
                    .filter(d => d.tipo === 'franquia|' + id)
                    .map(d => d.grupo);
                const unique = [...new Set(matchingGrupos)];
                unique.forEach(g => {
                    if (!gruposToShow.includes(g)) gruposToShow.push(g);
                });
            }
        });

        let filtered = allData.filter(d => gruposToShow.includes(d.grupo));

        // Apply period filter
        if (period === 'pre_2022') {
            filtered = filtered.filter(d => d.date < REN1000_BOUNDARY);
        } else if (period === 'pos_2022') {
            filtered = filtered.filter(d => d.date >= REN1000_BOUNDARY);
        }

        if (!filtered.length) {
            container.innerHTML = '<p style="padding:1rem; color:var(--text-muted)">Nenhum dado para os filtros selecionados.</p>';
            return;
        }

        const holdings = [...new Set(filtered.map(d => d.grupo))].sort();
        const months = [...new Set(allData.map(d => d.date))].sort();

        const lookup = {};
        filtered.forEach(d => {
            if (!lookup[d.grupo]) lookup[d.grupo] = {};
            lookup[d.grupo][d.date] = d[state.metric];
        });

        const values = filtered.map(d => d[state.metric]).filter(v => v != null && isFinite(v));
        const vMin = Math.min(...values);
        const vMax = Math.max(...values);
        const range = vMax - vMin || 1;

        // Detect peak and valley per holding
        const peakValley = {};
        holdings.forEach(holding => {
            let peak = null, valley = null;
            months.forEach(m => {
                const val = lookup[holding]?.[m];
                if (val == null || !isFinite(val)) return;
                if (!peak || val > peak.val) peak = { m, val };
                if (!valley || val < valley.val) valley = { m, val };
            });
            peakValley[holding] = { peak, valley };
        });

        // Find the REN 1000 boundary column index
        const boundaryIdx = months.findIndex(m => m >= REN1000_BOUNDARY);

        document.getElementById('heatmap-title').textContent =
            `Heatmap: ${METRIC_LABELS[state.metric]} por Mês`;

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        grid.style.gridTemplateColumns = `140px repeat(${months.length}, 35px)`;
        grid.style.minWidth = '800px';

        // Header row: corner + month labels
        grid.appendChild(document.createElement('div'));
        months.forEach((m, colIdx) => {
            const lbl = document.createElement('div');
            lbl.className = 'heatmap-axis-label';
            const [yr, mo] = m.split('-');

            if (colIdx === boundaryIdx) {
                lbl.textContent = 'REN 1000';
                lbl.style.color = '#1A8FE3';
                lbl.style.fontWeight = '700';
                lbl.style.fontSize = '0.6rem';
            } else {
                const mesesLabel = { '01': `Jan/${yr.slice(2)}`, '04': 'Abr', '07': 'Jul', '10': 'Out' };
                lbl.textContent = mesesLabel[mo] || '';
            }
            lbl.title = m;
            grid.appendChild(lbl);
        });

        // Data rows
        holdings.forEach(holding => {
            const rowLabel = document.createElement('div');
            rowLabel.className = 'heatmap-row-label';
            rowLabel.textContent = shortLabel(holding);
            rowLabel.title = holding;
            grid.appendChild(rowLabel);

            const pv = peakValley[holding] || {};

            months.forEach((m, colIdx) => {
                const val = lookup[holding]?.[m];
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                if (colIdx === boundaryIdx) {
                    cell.style.borderLeft = '2px solid #1A8FE3';
                }

                if (val != null && isFinite(val)) {
                    const norm = (val - vMin) / range;
                    cell.style.backgroundColor = metricToColor(norm);
                    cell.title = `${shortLabel(holding)} — ${m}: ${fmtNum(val)}`;

                    if (pv.peak && pv.peak.m === m) {
                        cell.style.outline = '2px solid #ef4444';
                        cell.style.outlineOffset = '-1px';
                        cell.style.zIndex = '1';
                        cell.title += ' [PICO]';
                    } else if (pv.valley && pv.valley.m === m) {
                        cell.style.outline = '2px solid #10b981';
                        cell.style.outlineOffset = '-1px';
                        cell.style.zIndex = '1';
                        cell.title += ' [VALE]';
                    }

                    cell.addEventListener('mouseenter', () => {
                        const fmt = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
                        let info = `${shortLabel(holding)} · ${m}: ${fmt(val)}`;
                        if (pv.peak && pv.peak.m === m) info += ' (pico)';
                        if (pv.valley && pv.valley.m === m) info += ' (vale)';
                        document.getElementById('heatmap-tooltip-info').textContent = info;
                    });
                } else {
                    cell.style.backgroundColor = 'rgba(255,255,255,0.03)';
                    cell.title = `${shortLabel(holding)} — ${m}: sem dados`;
                }
                grid.appendChild(cell);
            });
        });

        container.appendChild(grid);

        // Legend for peak/valley markers
        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex; gap:1.5rem; margin-top:0.75rem; font-size:0.75rem; color:var(--text-muted)';
        legend.innerHTML = `
            <span><span style="display:inline-block;width:10px;height:10px;border:2px solid #ef4444;margin-right:4px"></span>Pico</span>
            <span><span style="display:inline-block;width:10px;height:10px;border:2px solid #10b981;margin-right:4px"></span>Vale</span>
            <span><span style="display:inline-block;width:10px;height:2px;background:#1A8FE3;margin-right:4px;vertical-align:middle"></span>Início REN 1000</span>
        `;
        container.appendChild(legend);

        // Summary
        const avg = safeAvg(values) ?? 0;
        const maxEntry = filtered.reduce((a, b) => b[state.metric] > a[state.metric] ? b : a);
        const minEntry = filtered.reduce((a, b) => {
            const bVal = b[state.metric];
            const aVal = a[state.metric];
            if (bVal == null || !isFinite(bVal)) return a;
            if (aVal == null || !isFinite(aVal)) return b;
            return bVal < aVal ? b : a;
        });
        const fmtVal = state.metric.includes('compensacao') ? fmtMoney : fmtNum;
        document.getElementById('evolucao-summary').innerHTML = `
            <p>Média: <strong>${fmtNum(avg)}</strong></p>
            <p style="margin-top:0.5rem">Pico: <strong>${escapeHtml(shortLabel(maxEntry.grupo))}</strong> em ${escapeHtml(maxEntry.date)}<br>
            <strong style="color:#ef4444">${fmtVal(maxEntry[state.metric])}</strong></p>
            <p style="margin-top:0.5rem">Vale: <strong>${escapeHtml(shortLabel(minEntry.grupo))}</strong> em ${escapeHtml(minEntry.date)}<br>
            <strong style="color:#10b981">${fmtVal(minEntry[state.metric])}</strong></p>
        `;
    }

});
