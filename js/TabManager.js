/**
 * TabManager
 * Manages switching between Analysis View and Lab View.
 */
class TabManager {
    constructor() {
        this.activeTab = 'analysis'; // 'analysis' or 'lab'
        this.init();
    }

    init() {
        const analysisBtn = document.getElementById('tab-btn-analysis');
        const labBtn = document.getElementById('tab-btn-lab');
        const simBtn = document.getElementById('tab-btn-sim');

        if (analysisBtn) analysisBtn.addEventListener('click', () => this.switchTab('analysis'));
        if (labBtn) labBtn.addEventListener('click', () => this.switchTab('lab'));
        if (simBtn) simBtn.addEventListener('click', () => this.switchTab('sim'));

        // Listen for sidebar link clicks to switch tabs automatically
        this.setupSidebarInterception();

        // Listen for hash changes (back/forward or external links)
        window.addEventListener('hashchange', () => this.handleHashChange());
        
        // Check initial hash
        this.handleHashChange();
    }

    switchTab(tabId) {
        if (this.activeTab === tabId) return;

        this.activeTab = tabId;

        // Toggle visibility
        const views = {
            'analysis': document.getElementById('analysis-view'),
            'lab': document.getElementById('lab-view'),
            'sim': document.getElementById('simulation-view')
        };
        const buttons = {
            'analysis': document.getElementById('tab-btn-analysis'),
            'lab': document.getElementById('tab-btn-lab'),
            'sim': document.getElementById('tab-btn-sim')
        };

        Object.keys(views).forEach(key => {
            const view = views[key];
            const btn = buttons[key];
            if (view) view.classList.toggle('hidden', key !== tabId);
            if (btn) btn.classList.toggle('active', key === tabId);
        });

        // Re-initialize Lucide icons in new tab if needed
        if (window.lucide) window.lucide.createIcons();
    }

    setupSidebarInterception() {
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetId = href.substring(1);
                    this.switchTabByTargetId(targetId);
                }
            });
        });
    }

    switchTabByTargetId(targetId) {
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        // Check which container the target belongs to
        if (targetEl.closest('#simulation-view')) {
            this.switchTab('sim');
        } else if (targetEl.closest('#lab-view')) {
            this.switchTab('lab');
        } else if (targetEl.closest('#analysis-view')) {
            this.switchTab('analysis');
        }
    }

    handleHashChange() {
        const hash = window.location.hash;
        if (hash) {
            this.switchTabByTargetId(hash.substring(1));
        }
    }
}

// Export or initialize
window.tabManager = new TabManager();
