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
        // Create tab buttons if they don't exist in HTML (or handle existing ones)
        const analysisBtn = document.getElementById('tab-btn-analysis');
        const labBtn = document.getElementById('tab-btn-lab');

        if (analysisBtn && labBtn) {
            analysisBtn.addEventListener('click', () => this.switchTab('analysis'));
            labBtn.addEventListener('click', () => this.switchTab('lab'));
        }

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
        const analysisView = document.getElementById('analysis-view');
        const labView = document.getElementById('lab-view');
        const analysisBtn = document.getElementById('tab-btn-analysis');
        const labBtn = document.getElementById('tab-btn-lab');

        if (tabId === 'analysis') {
            analysisView.classList.remove('hidden');
            labView.classList.add('hidden');
            analysisBtn.classList.add('active');
            labBtn.classList.remove('active');
        } else {
            analysisView.classList.add('hidden');
            labView.classList.remove('hidden');
            analysisBtn.classList.remove('active');
            labBtn.classList.add('active');
        }

        // Re-initialize Lucide icons in new tab if needed (mostly static here)
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
        if (targetEl.closest('#lab-view')) {
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
