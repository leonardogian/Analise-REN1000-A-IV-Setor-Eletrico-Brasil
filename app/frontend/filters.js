/**
 * filters.js — Global filter state, chip interactions & group tabs
 * Noite Corporativa Iberdrola
 */
(function () {
    'use strict';

    /* ==================== HOLDINGS REGISTRY ==================== */
    const MAJOR_HOLDINGS = new Set([
        'neoenergia', 'cpfl', 'equatorial', 'enel', 'energisa',
        'cemig_d', 'edp', 'celesc_dis', 'light', 'copel_dis', 'rge'
    ]);

    window.MAJOR_HOLDINGS = MAJOR_HOLDINGS;
    window.isHolding = function (id) { return MAJOR_HOLDINGS.has(id); };
    window.normalizeGroupId = function (raw) {
        return String(raw).toLowerCase().replace(/[\s-]+/g, '_');
    };

    /* ==================== PERSISTENCE ==================== */
    const STORAGE_KEY = 'dashboardFilters_v2';

    function saveFilters() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                period: window.dashboardFilters.period,
                base: window.dashboardFilters.base,
                grupos: Array.from(window.dashboardFilters.grupos),
                porte: Array.from(window.dashboardFilters.porte),
                category: window.dashboardFilters.category,
            }));
        } catch (e) { /* storage unavailable */ }
    }

    function loadFilters() {
        try {
            // Migrate from v1 key
            var raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) {
                raw = sessionStorage.getItem('dashboardFilters');
                if (raw) sessionStorage.removeItem('dashboardFilters');
            }
            if (!raw) return;
            var saved = JSON.parse(raw);
            if (saved.period) window.dashboardFilters.period = saved.period;
            if (saved.base) window.dashboardFilters.base = saved.base;
            if (Array.isArray(saved.grupos)) window.dashboardFilters.grupos = new Set(saved.grupos);
            if (Array.isArray(saved.porte)) window.dashboardFilters.porte = new Set(saved.porte);
            if (saved.category) window.dashboardFilters.category = saved.category;
        } catch (e) { /* corrupt storage */ }
    }

    window.saveFilters = saveFilters;
    window.loadFilters = loadFilters;

    /* ==================== GLOBAL STATE ==================== */
    window.dashboardFilters = {
        period: 'all',
        base: 'all',
        grupos: new Set(),
        porte: new Set(),
        category: 'holdings',
    };

    // Restore state from previous page navigation
    loadFilters();

    /* ==================== BUILD GROUP TABS ==================== */
    /**
     * buildGroupTabs — Renders Holdings/Pequenos/Todos tabs and populates a <select>.
     *
     * @param {HTMLElement} tabsContainer — div where tab buttons are rendered
     * @param {HTMLElement} selectEl — <select multiple> to populate
     * @param {Array<{id:string, label:string}>} allGroups — full group list
     * @param {object} [opts] — { onPopulate(filteredGroups), defaultSelected }
     * @returns {{ refresh(), getFilteredGroups() }}
     */
    window.buildGroupTabs = function (tabsContainer, selectEl, allGroups, opts) {
        opts = opts || {};
        var currentCategory = window.dashboardFilters.category || 'holdings';

        function filterByCategory(cat) {
            if (cat === 'holdings') return allGroups.filter(function (g) { return window.isHolding(g.id); });
            if (cat === 'pequenos') return allGroups.filter(function (g) { return !window.isHolding(g.id); });
            return allGroups.slice(); // 'all'
        }

        function populateSelect(cat) {
            var filtered = filterByCategory(cat);
            filtered.sort(function (a, b) { return a.label.localeCompare(b.label); });
            selectEl.innerHTML = '';

            var currentGrupos = window.dashboardFilters.grupos;
            var hasSelection = currentGrupos.size > 0;

            filtered.forEach(function (g) {
                var opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.label;
                // Pre-select if in persisted state, or select all if no persisted state
                if (hasSelection) {
                    opt.selected = currentGrupos.has(g.id);
                } else {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
            });

            if (opts.onPopulate) opts.onPopulate(filtered);
            return filtered;
        }

        function renderTabs() {
            tabsContainer.innerHTML = '';
            tabsContainer.className = 'filter-group-tabs';

            var tabs = [
                { key: 'holdings', label: 'Holdings' },
                { key: 'pequenos', label: 'Pequenos' },
                { key: 'all', label: 'Todos' }
            ];

            tabs.forEach(function (t) {
                var btn = document.createElement('button');
                btn.className = 'filter-tab' + (currentCategory === t.key ? ' active' : '');
                btn.dataset.category = t.key;
                btn.textContent = t.label;
                btn.type = 'button';

                btn.addEventListener('click', function () {
                    currentCategory = t.key;
                    window.dashboardFilters.category = t.key;

                    // Update active tab
                    tabsContainer.querySelectorAll('.filter-tab').forEach(function (b) {
                        b.classList.toggle('active', b.dataset.category === t.key);
                    });

                    // Repopulate and update selection
                    var filtered = populateSelect(t.key);
                    window.dashboardFilters.grupos = new Set(filtered.map(function (g) { return g.id; }));
                    saveFilters();
                    dispatchFilterChange();
                });

                tabsContainer.appendChild(btn);
            });
        }

        renderTabs();
        var initialFiltered = populateSelect(currentCategory);

        // If no persisted grupos, default to all visible in current tab
        if (window.dashboardFilters.grupos.size === 0) {
            window.dashboardFilters.grupos = new Set(initialFiltered.map(function (g) { return g.id; }));
            saveFilters();
        }

        return {
            refresh: function () {
                populateSelect(currentCategory);
            },
            getFilteredGroups: function () {
                return filterByCategory(currentCategory);
            }
        };
    };

    /* ==================== CHIP TOGGLE ==================== */
    function toggleChip(el) {
        if (!el || !el.classList.contains('chip')) return;

        var group = el.dataset.grupo || el.dataset.porte || el.dataset.value || '';
        var setName = el.dataset.grupo ? 'grupos' : (el.dataset.porte ? 'porte' : null);

        el.classList.toggle('on');

        if (setName && group) {
            var filterSet = window.dashboardFilters[setName];
            if (el.classList.contains('on')) {
                filterSet.add(group);
            } else {
                filterSet.delete(group);
            }
        }

        dispatchFilterChange();

        if (window.showToast) {
            var label = el.textContent.trim().replace(/\s*×\s*$/, '');
            var action = el.classList.contains('on') ? 'ativado' : 'desativado';
            window.showToast(label + ' ' + action, 'green');
        }
    }

    window.toggleChip = toggleChip;

    /* ==================== SELECT HANDLERS ==================== */
    function initFilterSelects() {
        var periodSelect = document.getElementById('filter-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', function () {
                window.dashboardFilters.period = this.value;
                dispatchFilterChange();
                if (window.showToast) window.showToast('Período: ' + this.options[this.selectedIndex].text, 'blue');
            });
        }

        var baseSelect = document.getElementById('filter-base');
        if (baseSelect) {
            baseSelect.addEventListener('change', function () {
                window.dashboardFilters.base = this.value;
                dispatchFilterChange();
                if (window.showToast) window.showToast('Base: ' + this.options[this.selectedIndex].text, 'blue');
            });
        }

        var grupoSelect = document.getElementById('filter-grupo');
        if (grupoSelect) {
            grupoSelect.addEventListener('change', function () {
                window.dashboardFilters.grupos = new Set(
                    Array.from(this.selectedOptions).map(function (o) { return o.value; })
                );
                dispatchFilterChange();
                if (window.showToast) window.showToast('Filtro de grupo atualizado', 'green');
            });
        }
    }

    /* ==================== CHIP CLICK DELEGATION ==================== */
    function initChipClicks() {
        document.addEventListener('click', function (e) {
            var chip = e.target.closest('.chip[data-grupo], .chip[data-porte], .chip[data-value]');
            if (chip) {
                toggleChip(chip);
            }
        });
    }

    /* ==================== DISPATCH (debounced 150ms) ==================== */
    var _filterTimer = null;
    function dispatchFilterChange() {
        saveFilters();
        if (_filterTimer) clearTimeout(_filterTimer);
        _filterTimer = setTimeout(function () {
            _filterTimer = null;
            window.dispatchEvent(new CustomEvent('filters:change', {
                detail: {
                    period: window.dashboardFilters.period,
                    base: window.dashboardFilters.base,
                    grupos: new Set(window.dashboardFilters.grupos),
                    porte: new Set(window.dashboardFilters.porte),
                    category: window.dashboardFilters.category,
                }
            }));
        }, 150);
    }

    window.dispatchFilterChange = dispatchFilterChange;

    /* ==================== INIT ==================== */
    function init() {
        initFilterSelects();
        initChipClicks();

        // Initialize chips that start with .on (only if no persisted state)
        var hadSavedState = sessionStorage.getItem(STORAGE_KEY) !== null;
        if (!hadSavedState) {
            document.querySelectorAll('.chip.on[data-grupo]').forEach(function (chip) {
                window.dashboardFilters.grupos.add(chip.dataset.grupo);
            });
            document.querySelectorAll('.chip.on[data-porte]').forEach(function (chip) {
                window.dashboardFilters.porte.add(chip.dataset.porte);
            });
        }

        // Restore select elements to persisted state
        var periodSelect = document.getElementById('filter-period');
        if (periodSelect && window.dashboardFilters.period !== 'all') {
            periodSelect.value = window.dashboardFilters.period;
        }
        var baseSelect = document.getElementById('filter-base');
        if (baseSelect && window.dashboardFilters.base !== 'all') {
            baseSelect.value = window.dashboardFilters.base;
        }

        // Restore chip .on state from persisted grupos/porte
        document.querySelectorAll('.chip[data-grupo]').forEach(function (chip) {
            chip.classList.toggle('on', window.dashboardFilters.grupos.has(chip.dataset.grupo));
        });
        document.querySelectorAll('.chip[data-porte]').forEach(function (chip) {
            chip.classList.toggle('on', window.dashboardFilters.porte.has(chip.dataset.porte));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
