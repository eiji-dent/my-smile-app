// Aesthetic Explanations (Moved to js/constants.js)
const TOOL_EXPLANATIONS = window.AESTHETIC_CONSTANTS.TOOL_EXPLANATIONS;

// --- AI (MediaPipe) Integration --- (Logic moved to js/ai-utils.js)
const initFaceLandmarker = window.initFaceLandmarker;
const absDist = window.absDist;

// Initialize Icons and Global Events
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Ensure the page starts at the top on load/refresh
  window.scrollTo(0, 0);

  window.showAllPlots = true;
  const togglePlots = document.getElementById('toggle-all-plots');
  if (togglePlots) {
      togglePlots.addEventListener('change', (e) => {
          window.showAllPlots = e.target.checked;
          if (window.appCards) window.appCards.forEach(c => c.drawCanvas());
      });
  }

  // TrialManager initialization removed

  // Initialize all AnalysisCards
  const cardElements = document.querySelectorAll('.analysis-card:not(.lab-card), .analysis-unit'); 
  window.appCards = [];
  cardElements.forEach(el => {
    const card = new window.AnalysisCard(el);
    window.appCards.push(card);
    // iPad/タッチデバイス向けハンドラの初期化（AnalysisCard内で統合管理されるため無効化）
    /*
    if (window.TouchHandler) {
      new window.TouchHandler(card);
    }
    */
  });

  // Global Zoom Slider Sync
  const zSlider = document.getElementById('global-zoom-slider');
  const zIn = document.getElementById('zoom-in-btn');
  const zOut = document.getElementById('zoom-out-btn');
  const zDisp = document.getElementById('zoom-value-display');

  const setGlobalZoom = (val) => {
    let z = Math.max(100, Math.min(val, 500));
    if(zSlider) zSlider.value = z;
    if(zDisp) zDisp.textContent = z + '%';
    window.appCards.forEach(c => {
       c.zoomLevel = z / 100;
       c.drawCanvas();
    });
  };

  if (zSlider) {
     zSlider.addEventListener('input', (e) => setGlobalZoom(parseInt(e.target.value)));
  }
  if (zIn) zIn.addEventListener('click', () => setGlobalZoom(parseInt(zSlider.value) + 10));
  if (zOut) zOut.addEventListener('click', () => setGlobalZoom(parseInt(zSlider.value) - 10));

  // PDF Export Logic (Moved to js/report/ReportEngine.js and PDFGenerator.js)


});

/**
 * Color Space Conversion Utils (Moved to js/ai-utils.js)
 */
const ColorSpace = window.ColorSpace;

/**
 * Comprehensive Shade Guide Data (Moved to js/ai-utils.js)
 */
const SHADE_GUIDES = window.SHADE_GUIDES;

/**
 * Handle image upload (Moved to js/ai-utils.js)
 */
window.handleFreeImageUpload = window.handleFreeImageUpload;
