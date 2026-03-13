/**
 * nav.js — Sidebar navigation & toast system
 * Noite Corporativa Iberdrola
 */
(function () {
    'use strict';

    /* ==================== ACTIVE LINK DETECTION ==================== */
    function initSidebarNav() {
        const links = document.querySelectorAll('.nav-link[data-page]');
        if (!links.length) return;

        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop() || 'index.html';

        links.forEach(link => {
            const href = link.getAttribute('href') || '';
            const linkFile = href.split('/').pop() || 'index.html';

            if (linkFile === currentFile) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /* ==================== SIDEBAR MOBILE TOGGLE ==================== */
    function initSidebarToggle() {
        const toggle = document.querySelector('.sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        if (!toggle || !sidebar) return;

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar on click outside (mobile)
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) &&
                !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    /* ==================== BREADCRUMB ==================== */
    function initBreadcrumb() {
        const el = document.querySelector('.breadcrumb');
        if (!el) return;

        const activeLink = document.querySelector('.nav-link.active');
        if (activeLink) {
            const pageName = activeLink.textContent.trim().replace(/^[^\w]*/, '');
            el.innerHTML = `Dashboard / <span class="active">${pageName}</span>`;
        }
    }

    /* ==================== TOAST SYSTEM ==================== */
    let toastContainer = null;

    function ensureToastContainer() {
        if (toastContainer) return toastContainer;
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    function showToast(msg, type) {
        type = type || 'green';
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = msg;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 2200);
    }

    // Expose globally
    window.showToast = showToast;

    /* ==================== INIT ==================== */
    function init() {
        initSidebarNav();
        initSidebarToggle();
        initBreadcrumb();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
