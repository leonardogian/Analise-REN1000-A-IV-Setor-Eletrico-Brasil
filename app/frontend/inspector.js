/**
 * inspector.js — Ferramenta Lupa/Inspetor do Dashboard
 * Painel flutuante que exibe dados contextuais do elemento sob o cursor.
 * Ativação: botão FAB 🔍 ou Ctrl+Shift+I
 */
(function () {
    'use strict';

    /* ==================== STATE ==================== */
    let active = false;
    let panelEl = null;
    let fabEl = null;
    let lastTarget = null;

    /* ==================== DOM CREATION ==================== */
    function createFAB() {
        const btn = document.createElement('button');
        btn.id = 'inspector-fab';
        btn.className = 'inspector-fab';
        btn.title = 'Ativar Lupa/Inspetor (Ctrl+Shift+I)';
        btn.setAttribute('aria-label', 'Ativar modo inspetor');
        btn.innerHTML = '<span class="inspector-fab-icon">🔍</span><span class="inspector-fab-label">Inspetor</span>';
        btn.addEventListener('click', toggle);
        document.body.appendChild(btn);
        fabEl = btn;
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'inspector-panel';
        panel.className = 'inspector-panel';
        panel.innerHTML = `
            <div class="inspector-header">
                <span class="inspector-header-icon">🔍</span>
                <span class="inspector-header-title">Inspetor de Dados</span>
                <button class="inspector-close" title="Fechar">&times;</button>
            </div>
            <div class="inspector-body">
                <div class="inspector-hint">Passe o mouse sobre os elementos do dashboard para inspecionar.</div>
            </div>
        `;
        panel.style.display = 'none';
        panel.querySelector('.inspector-close').addEventListener('click', deactivate);
        document.body.appendChild(panel);
        panelEl = panel;
    }

    /* ==================== TOGGLE ==================== */
    function toggle() {
        if (active) deactivate();
        else activate();
    }

    function activate() {
        active = true;
        document.body.classList.add('inspector-active');
        fabEl.classList.add('on');
        panelEl.style.display = '';
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('scroll', onScroll, { passive: true, capture: true });
        if (window.showToast) showToast('Inspetor ativado — passe o mouse sobre o dashboard', 'green');
    }

    function deactivate() {
        active = false;
        document.body.classList.remove('inspector-active');
        fabEl.classList.remove('on');
        panelEl.style.display = 'none';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('scroll', onScroll, { capture: true });
        clearHighlight();
        lastTarget = null;
    }

    /* ==================== MOUSE TRACKING ==================== */
    function onMouseMove(e) {
        if (!active) return;
        positionPanel(e.clientX, e.clientY);
        inspect(e.clientX, e.clientY);
    }

    function onScroll() {
        // Hide panel briefly during scroll to avoid jank
        if (panelEl) panelEl.style.opacity = '0.3';
        clearTimeout(onScroll._t);
        onScroll._t = setTimeout(() => { if (panelEl) panelEl.style.opacity = ''; }, 150);
    }

    function positionPanel(mx, my) {
        const pw = 340, ph = panelEl.offsetHeight || 300;
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = mx + 24;
        let top = my - 20;

        // Flip horizontally if near right edge
        if (left + pw > vw - 16) left = mx - pw - 24;
        // Clamp vertically
        if (top + ph > vh - 16) top = vh - ph - 16;
        if (top < 8) top = 8;

        panelEl.style.left = left + 'px';
        panelEl.style.top = top + 'px';
    }

    /* ==================== HIGHLIGHT ==================== */
    let highlightEl = null;

    function showHighlight(target) {
        if (!highlightEl) {
            highlightEl = document.createElement('div');
            highlightEl.className = 'inspector-highlight';
            document.body.appendChild(highlightEl);
        }
        const rect = target.getBoundingClientRect();
        highlightEl.style.cssText = `
            position: fixed; z-index: 99998; pointer-events: none;
            left: ${rect.left - 2}px; top: ${rect.top - 2}px;
            width: ${rect.width + 4}px; height: ${rect.height + 4}px;
            border: 2px solid rgba(0, 198, 90, 0.7);
            border-radius: 8px;
            background: rgba(0, 198, 90, 0.06);
            transition: all 0.12s ease;
        `;
        highlightEl.style.display = '';
    }

    function clearHighlight() {
        if (highlightEl) highlightEl.style.display = 'none';
    }

    /* ==================== DATA INSPECTION ==================== */
    function inspect(mx, my) {
        // Hide panel from elementFromPoint temporarily
        panelEl.style.pointerEvents = 'none';
        if (highlightEl) highlightEl.style.display = 'none';

        const el = document.elementFromPoint(mx, my);

        panelEl.style.pointerEvents = '';

        if (!el || el === document.body || el === document.documentElement) {
            clearHighlight();
            setBody('<div class="inspector-hint">Passe o mouse sobre os elementos do dashboard para inspecionar.</div>');
            lastTarget = null;
            return;
        }

        // Find the meaningful ancestor
        const info = extractInfo(el, mx, my);
        const target = info.target || el;

        if (target === lastTarget) return;
        lastTarget = target;
        showHighlight(target);
        setBody(info.html);
    }

    function setBody(html) {
        const body = panelEl.querySelector('.inspector-body');
        if (body) body.innerHTML = html;
    }

    /* ==================== INFO EXTRACTION ==================== */
    function extractInfo(el, mx, my) {
        // 1. KPI Card
        const kpiCard = el.closest('.kpi-card');
        if (kpiCard) return extractKPI(kpiCard);

        // 2. Chart.js canvas
        if (el.tagName === 'CANVAS') return extractChart(el, mx, my);

        // 3. Table cell
        const td = el.closest('td');
        if (td) return extractTableCell(td);
        const th = el.closest('th');
        if (th) return extractTableHeader(th);

        // 4. Insight card
        const insightCard = el.closest('.insight-card');
        if (insightCard) return extractInsight(insightCard);

        // 5. Chart card (title/subtitle)
        const chartCard = el.closest('.chart-card');
        if (chartCard) return extractChartCard(chartCard);

        // 6. Filter/pill
        const pill = el.closest('.pill');
        if (pill) return { target: pill, html: row('Tipo', 'Pill / Badge') + row('Texto', pill.textContent.trim()) };

        // 7. Nav link
        const navLink = el.closest('.nav-link');
        if (navLink) return { target: navLink, html: row('Tipo', 'Navegação') + row('Página', navLink.textContent.trim()) + row('Link', navLink.getAttribute('href') || '—') };

        // 8. Generic: show tag + classes + text snippet
        return extractGeneric(el);
    }

    /* ---- KPI ---- */
    function extractKPI(card) {
        const label = card.querySelector('.kpi-label');
        const value = card.querySelector('.kpi-value, .kpi-val');
        const note = card.querySelector('.kpi-note');
        const delta = card.querySelector('.kpi-delta');

        let html = sectionTitle('📊 KPI Card');
        html += row('Indicador', label ? label.textContent.trim() : '—');
        html += row('Valor', value ? value.textContent.trim() : '—', 'highlight');
        if (delta && delta.textContent.trim() !== '—') {
            const cls = delta.classList.contains('positive') ? 'positive' : 'negative';
            html += row('Variação', delta.textContent.trim(), cls);
        }
        if (note) html += row('Nota', note.textContent.trim(), 'dim');
        return { target: card, html };
    }

    /* ---- Chart.js ---- */
    function extractChart(canvas, mx, my) {
        const chart = Chart.getChart(canvas);
        if (!chart) return { target: canvas, html: sectionTitle('📈 Gráfico') + row('Info', 'Canvas sem Chart.js associado') };

        let html = sectionTitle('📈 Gráfico Chart.js');
        html += row('Tipo', chart.config.type || '—');

        // Get datasets info
        const datasets = chart.data.datasets || [];
        html += row('Datasets', datasets.length.toString());

        // Get nearest element
        const rect = canvas.getBoundingClientRect();
        const canvasX = mx - rect.left;
        const canvasY = my - rect.top;
        const evt = { x: canvasX, y: canvasY };

        try {
            const elements = chart.getElementsAtEventForMode(
                { native: { clientX: mx, clientY: my }, x: canvasX, y: canvasY },
                'nearest', { intersect: false }, true
            );

            if (elements.length > 0) {
                const first = elements[0];
                const ds = datasets[first.datasetIndex];
                const label = (chart.data.labels || [])[first.index];
                const val = ds.data[first.index];

                html += '<div class="inspector-divider"></div>';
                html += sectionTitle('🎯 Ponto Mais Próximo');
                html += row('Dataset', ds.label || `Dataset ${first.datasetIndex}`);
                if (label !== undefined) html += row('Eixo X', String(label));
                html += row('Valor', formatInspectorValue(val, ds), 'highlight');
            }

            // Show all dataset labels
            if (datasets.length > 1) {
                html += '<div class="inspector-divider"></div>';
                html += sectionTitle('📋 Datasets');
                datasets.forEach((ds, i) => {
                    const color = ds.borderColor || ds.backgroundColor || '#888';
                    const colorHex = Array.isArray(color) ? color[0] : color;
                    html += `<div class="inspector-dataset-row">
                        <span class="inspector-dot" style="background:${escapeHtml(String(colorHex))}"></span>
                        <span>${escapeHtml(ds.label || 'Dataset ' + i)}</span>
                    </div>`;
                });
            }
        } catch (e) {
            html += row('Detalhe', 'Mova o cursor para ver pontos');
        }

        // Chart card title
        const chartCard = canvas.closest('.chart-card');
        if (chartCard) {
            const title = chartCard.querySelector('.chart-title');
            if (title) html += row('Título', title.textContent.trim(), 'dim');
        }

        return { target: canvas, html };
    }

    function formatInspectorValue(val, ds) {
        if (val == null) return '—';
        // Try to detect the value type from axis or label
        const label = (ds.label || '').toLowerCase();
        if (label.includes('r$') || label.includes('compensaç')) {
            return typeof fmtMoneyFull === 'function' ? fmtMoneyFull(val) : 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (label.includes('taxa') || label.includes('%')) {
            return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
        }
        if (typeof val === 'number') {
            return Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
        }
        return String(val);
    }

    /* ---- Table ---- */
    function extractTableCell(td) {
        const table = td.closest('table');
        const tr = td.closest('tr');
        const colIdx = Array.from(tr.children).indexOf(td);
        const header = table ? table.querySelector(`thead th:nth-child(${colIdx + 1}), tr:first-child th:nth-child(${colIdx + 1})`) : null;

        let html = sectionTitle('📋 Célula de Tabela');
        if (header) html += row('Coluna', header.textContent.trim());
        html += row('Valor', td.textContent.trim(), 'highlight');

        // Row context
        const firstCell = tr ? tr.querySelector('td:first-child') : null;
        if (firstCell && firstCell !== td) html += row('Linha', firstCell.textContent.trim(), 'dim');

        return { target: td, html };
    }

    function extractTableHeader(th) {
        let html = sectionTitle('📋 Cabeçalho de Tabela');
        html += row('Coluna', th.textContent.trim(), 'highlight');
        return { target: th, html };
    }

    /* ---- Insight Card ---- */
    function extractInsight(card) {
        const icon = card.querySelector('.insight-icon');
        const text = card.querySelector('.insight-text');
        let html = sectionTitle('💡 Insight');
        if (icon) html += row('Ícone', icon.textContent.trim());
        if (text) html += row('Texto', text.textContent.trim().substring(0, 150) + (text.textContent.length > 150 ? '…' : ''));
        return { target: card, html };
    }

    /* ---- Chart Card (header/meta) ---- */
    function extractChartCard(card) {
        const title = card.querySelector('.chart-title');
        const subtitle = card.querySelector('.chart-subtitle');
        const tag = card.querySelector('.chart-tag');
        let html = sectionTitle('📊 Card de Gráfico');
        if (title) html += row('Título', title.textContent.trim());
        if (subtitle) html += row('Subtítulo', subtitle.textContent.trim(), 'dim');
        if (tag) html += row('Período', tag.textContent.trim());
        return { target: card, html };
    }

    /* ---- Generic ---- */
    function extractGeneric(el) {
        const tag = el.tagName.toLowerCase();
        const classes = el.className ? String(el.className).split(' ').filter(c => c).slice(0, 3).join(', ') : '—';
        const text = el.textContent ? el.textContent.trim().substring(0, 80) : '';
        let html = sectionTitle('🏷️ Elemento');
        html += row('Tag', `<${tag}>`);
        html += row('Classes', classes, 'dim');
        if (text) html += row('Texto', text + (el.textContent.length > 80 ? '…' : ''));
        return { target: el, html };
    }

    /* ==================== HTML HELPERS ==================== */
    function sectionTitle(text) {
        return `<div class="inspector-section-title">${text}</div>`;
    }

    function row(label, value, cls) {
        cls = cls || '';
        return `<div class="inspector-row">
            <span class="inspector-label">${escapeHtml(label)}</span>
            <span class="inspector-value ${cls}">${escapeHtml(value)}</span>
        </div>`;
    }

    /* ==================== KEYBOARD SHORTCUT ==================== */
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            // Only intercept our own shortcut, not browser DevTools (which is Ctrl+Shift+I on some browsers)
            // We use a less conflicting combo check
        }
        // Use Ctrl+Shift+L for "Lupa" to avoid conflict with DevTools
        if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
            e.preventDefault();
            toggle();
        }
    });

    /* ==================== INIT ==================== */
    function init() {
        createFAB();
        createPanel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
