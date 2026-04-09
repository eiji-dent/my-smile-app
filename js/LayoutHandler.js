/**
 * LayoutHandler.js
 * Manages sidebars (left/right) toggle states and responsive behavior.
 */

const LayoutHandler = {
  init() {
    this.sidebarToggle = document.getElementById('sidebar-toggle');
    this.rightToggle = document.getElementById('right-panel-toggle');
    this.overlay = document.getElementById('sidebar-overlay');
    this.appContainer = document.querySelector('.app-container');

    if (!this.appContainer) return;

    this.bindEvents();
    this.loadInitialState();
  },

  bindEvents() {
    if (this.sidebarToggle) {
      this.sidebarToggle.addEventListener('click', () => this.toggleLeftSidebar());
    }

    if (this.rightToggle) {
      this.rightToggle.addEventListener('click', () => this.toggleRightPanel());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        // Overlay closes whatever is open on mobile/tablet
        this.updateLeftSidebar(true);
        this.updateRightPanel(true);
      });
    }

    // Optional: Close overlay on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.updateLeftSidebar(true);
        this.updateRightPanel(true);
      }
    });
  },

  loadInitialState() {
    const leftCollapsed = localStorage.getItem('sidebar-collapsed');
    const rightCollapsed = localStorage.getItem('right-panel-collapsed');

    // Default behavior for mobile/tablet (<= 1024px)
    if (window.innerWidth <= 1024) {
      this.updateLeftSidebar(true, false); // Collapsed by default on mobile
      this.updateRightPanel(true, false);
    } else {
      // Desktop: Restore from local storage or default to open
      this.updateLeftSidebar(leftCollapsed === 'true', false);
      this.updateRightPanel(rightCollapsed === 'true', false);
    }
  },

  toggleLeftSidebar() {
    const isCurrentlyCollapsed = this.appContainer.classList.contains('sidebar-collapsed');
    this.updateLeftSidebar(!isCurrentlyCollapsed);
  },

  toggleRightPanel() {
    const isCurrentlyCollapsed = this.appContainer.classList.contains('right-panel-collapsed');
    this.updateRightPanel(!isCurrentlyCollapsed);
  },

  updateLeftSidebar(isCollapsed, shouldSave = true) {
    if (isCollapsed) {
      this.appContainer.classList.add('sidebar-collapsed');
    } else {
      this.appContainer.classList.remove('sidebar-collapsed');
      // On mobile, if we open left, we might want to close right
      if (window.innerWidth <= 1024) this.updateRightPanel(true, false);
    }

    if (shouldSave) localStorage.setItem('sidebar-collapsed', isCollapsed);
    this.triggerResize();
  },

  updateRightPanel(isCollapsed, shouldSave = true) {
    if (isCollapsed) {
      this.appContainer.classList.add('right-panel-collapsed');
    } else {
      this.appContainer.classList.remove('right-panel-collapsed');
      // On mobile, if we open right, we might want to close left
      if (window.innerWidth <= 1024) this.updateLeftSidebar(true, false);
    }

    if (shouldSave) localStorage.setItem('right-panel-collapsed', isCollapsed);
    this.triggerResize();
  },

  triggerResize() {
    // Small delay to allow CSS transitions to finish before redrawing canvases
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      // Force redraw of any active AnalysisCards
      if (window.appCards) {
        window.appCards.forEach(card => card.drawCanvas());
      }
    }, 350);
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    LayoutHandler.init();
});

window.LayoutHandler = LayoutHandler;
