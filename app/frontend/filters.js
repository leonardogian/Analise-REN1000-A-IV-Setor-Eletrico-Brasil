/**
 * filters.js — Global filter state & chip interactions
 * Noite Corporativa Iberdrola
 */
(function () {
    'use strict';

    /* ==================== PERSISTENCE ==================== */
    const STORAGE_KEY = 'dashboardFilters';

    function saveFilters() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                period: window.dashboardFilters.period,
                base: window.dashboardFilters.base,
                grupos: Array.from(window.dashboardFilters.grupos),
                porte: Array.from(window.dashboardFilters.porte),
            }));
        } catch (e) { /* storage unavailable */ }
    }

    function loadFilters() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.period) window.dashboardFilters.period = saved.period;
            if (saved.base) window.dashboardFilters.base = saved.base;
            if (Array.isArray(saved.grupos)) saved.grupos.forEach(g => window.dashboardFilters.grupos.add(g));
            if (Array.isArray(saved.porte)) saved.porte.forEach(p => window.dashboardFilters.porte.add(p));
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
    };

    // Restore state from previous page navigation
    loadFilters();

    /* ==================== CHIP TOGGLE ==================== */
    function toggleChip(el) {
        if (!el || !el.classList.contains('chip')) return;

        const group = el.dataset.grupo || el.dataset.porte || el.dataset.value || '';
        const setName = el.dataset.grupo ? 'grupos' : (el.dataset.porte ? 'porte' : null);

        el.classList.toggle('on');

        if (setName && group) {
            const filterSet = window.dashboardFilters[setName];
            if (el.classList.contains('on')) {
                filterSet.add(group);
            } else {
                filterSet.delete(group);
            }
        }

        dispatchFilterChange();

        if (window.showToast) {
            const label = el.textContent.trim().replace(/\s*×\s*$/, '');
            const action = el.classList.contains('on') ? 'ativado' : 'desativado';
            window.showToast(label + ' ' + action, 'green');
        }
    }

    window.toggleChip = toggleChip;

    /* ==================== SELECT HANDLERS ==================== */
    function initFilterSelects() {
        const periodSelect = document.getElementById('filter-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', function () {
                window.dashboardFilters.period = this.value;
                dispatchFilterChange();
                if (window.showToast) window.showToast('Período: ' + this.options[this.selectedIndex].text, 'blue');
            });
        }

        const baseSelect = document.getElementById('filter-base');
        if (baseSelect) {
            baseSelect.addEventListener('change', function () {
                window.dashboardFilters.base = this.value;
                dispatchFilterChange();
                if (window.showToast) window.showToast('Base: ' + this.options[this.selectedIndex].text, 'blue');
            });
        }
    }

    /* ==================== CHIP CLICK DELEGATION ==================== */
    function initChipClicks() {
        document.addEventListener('click', function (e) {
            const chip = e.target.closest('.chip[data-grupo], .chip[data-porte], .chip[data-value]');
            if (chip) {
                toggleChip(chip);
            }
        });
    }

    /* ==================== DISPATCH ==================== */
    function dispatchFilterChange() {
        saveFilters();
        window.dispatchEvent(new CustomEvent('filters:change', {
            detail: {
                period: window.dashboardFilters.period,
                base: window.dashboardFilters.base,
                grupos: new Set(window.dashboardFilters.grupos),
                porte: new Set(window.dashboardFilters.porte),
            }
        }));
    }

    window.dispatchFilterChange = dispatchFilterChange;

    /* ==================== INIT ==================== */
    function init() {
        initFilterSelects();
        initChipClicks();

        // Initialize chips that start with .on
        document.querySelectorAll('.chip.on[data-grupo]').forEach(chip => {
            window.dashboardFilters.grupos.add(chip.dataset.grupo);
        });
        document.querySelectorAll('.chip.on[data-porte]').forEach(chip => {
            window.dashboardFilters.porte.add(chip.dataset.porte);
        });

        // Restore select elements to persisted state
        const periodSelect = document.getElementById('filter-period');
        if (periodSelect && window.dashboardFilters.period !== 'all') {
            periodSelect.value = window.dashboardFilters.period;
        }
        const baseSelect = document.getElementById('filter-base');
        if (baseSelect && window.dashboardFilters.base !== 'all') {
            baseSelect.value = window.dashboardFilters.base;
        }

        // Restore chip .on state from persisted grupos/porte
        document.querySelectorAll('.chip[data-grupo]').forEach(chip => {
            if (window.dashboardFilters.grupos.has(chip.dataset.grupo)) chip.classList.add('on');
        });
        document.querySelectorAll('.chip[data-porte]').forEach(chip => {
            if (window.dashboardFilters.porte.has(chip.dataset.porte)) chip.classList.add('on');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
