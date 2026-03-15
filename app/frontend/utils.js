/**
 * utils.js — Shared formatting utilities (pt-BR)
 * Loaded before all page scripts. All functions are exposed on window.
 */
(function () {
    'use strict';

    /* ==================== NUMBER FORMATTERS ==================== */

    /** General number — d decimal places. Returns '—' for null/NaN. */
    window.fmtNum = function (v, d) {
        if (d === undefined) d = 0;
        if (v == null || isNaN(v)) return '—';
        return Number(v).toLocaleString('pt-BR', {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
        });
    };

    /** Percentage — input is 0–1, output is "12,34%". d = decimal places. */
    window.fmtPct = function (v, d) {
        if (d === undefined) d = 2;
        if (v == null || isNaN(v)) return '—';
        return (Number(v) * 100).toLocaleString('pt-BR', {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
        }) + '%';
    };

    /**
     * Abbreviated BRL money — for KPI totals.
     * e.g. R$ 1,5M | R$ 500k | R$ 123,45
     */
    window.fmtMoney = function (v) {
        if (v == null || isNaN(v)) return '—';
        if (Math.abs(v) >= 1e6)
            return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
        if (Math.abs(v) >= 1e3)
            return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'k';
        return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    /** Full BRL money — 2 decimal places, no abbreviation. */
    window.fmtMoneyFull = function (v) {
        if (v == null || isNaN(v)) return '—';
        return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    /**
     * High-precision BRL money — for per-UC rates (e.g. R$/UC-mês).
     * d defaults to 4 decimal places.
     */
    window.fmtMoneyPrecise = function (v, d) {
        if (d === undefined) d = 4;
        if (v == null || isNaN(v)) return '—';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: d,
            maximumFractionDigits: d,
        }).format(v);
    };

    /** Variation with explicit +/- sign, 1 decimal. e.g. "+3,2%" or "-1,0%". */
    window.fmtVar = function (v) {
        if (v == null || isNaN(v)) return '—';
        return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%';
    };

    /* ==================== SECURITY UTILITIES ==================== */

    /** Escape HTML entities to prevent XSS when inserting data into innerHTML. */
    window.escapeHtml = function (str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /** Safely display an error message in a container using textContent (no innerHTML). */
    window.showError = function (container, message) {
        if (!container) return;
        container.textContent = '';
        var p = document.createElement('p');
        p.className = 'error';
        p.style.color = '#ef4444';
        p.textContent = message;
        container.appendChild(p);
    };
})();
