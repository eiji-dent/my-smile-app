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

  window.showAllPlots = true;
  const togglePlots = document.getElementById('toggle-all-plots');
  if (togglePlots) {
      togglePlots.addEventListener('change', (e) => {
          window.showAllPlots = e.target.checked;
          if (window.appCards) window.appCards.forEach(c => c.drawCanvas());
      });
  }

  // Initialize TrialManager if available
  if (window.TrialManager) {
      new window.TrialManager();
  }

  // Initialize all AnalysisCards
  const cardElements = document.querySelectorAll('.analysis-card:not(.lab-card), .analysis-unit'); 
  window.appCards = [];
  cardElements.forEach(el => window.appCards.push(new window.AnalysisCard(el)));

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

  // PDF Export Logic
  const exportBtn = document.getElementById('export-pdf-btn');
  const loadingOverlay = document.getElementById('pdf-loading-overlay');
  const progressStep = document.getElementById('pdf-progress-step');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      if (!window.jspdf) {
         alert('PDFライブラリが読み込まれていません。ネットワーク状況を確認してください。');
         return;
      }
      
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      loadingOverlay.classList.remove('hidden');
      document.body.classList.add('is-exporting'); // Disable animations for capture
      
      try {
        const cards = Array.from(document.querySelectorAll('.analysis-card'));
        let currentPageNum = 0;

        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          
          // Phase 9-B は 9-A の中で処理するためスキップ
          if (card.id === 'card-horizontal-bar-top') continue;

          // PDF用に一時的にUI非表示
          const hideUI = (c) => {
            const actions = c.querySelector('.card-actions');
            const slider = c.querySelector('.vertical-zoom-slider');
            if (actions) actions.style.display = 'none';
            if (slider) slider.style.display = 'none';
            return { actions, slider };
          };
          const showUI = (c, ui) => {
            if (ui.actions) ui.actions.style.display = '';
            if (ui.slider) ui.slider.style.display = '';
          };

          // --- Phase 8 (Special Case: Photo then Results) ---
          if (card.id === 'card-intraoral') {
             currentPageNum++;
             progressStep.textContent = currentPageNum;
             if (currentPageNum > 1) pdf.addPage();
             pdf.setFontSize(10);
             pdf.setTextColor(150);
             pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

             const ui = hideUI(card);
             const canvasWrapper = card.querySelector('.canvas-wrapper');
             const horizontalToolbar = card.querySelector('.horizontal-toolbar');
             const quickStats = card.querySelector('.quick-stats');
             const labForm = card.querySelector('.lab-form-container');

             // 1ページ目: 写真 (結果とフォームを隠す)
             if (quickStats) quickStats.style.display = 'none';
             if (labForm) labForm.style.display = 'none';
             const canvasP1 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
             
             // 2ページ目用準備: 写真エリアを隠し、結果を表示
             if (quickStats) quickStats.style.display = '';
             if (labForm) labForm.style.display = '';
             if (canvasWrapper) canvasWrapper.style.display = 'none';
             if (horizontalToolbar) horizontalToolbar.style.display = 'none';
             const canvasP2 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

             // 表示をすべて元に戻す
             showUI(card, ui);
             if (canvasWrapper) canvasWrapper.style.display = '';
             if (horizontalToolbar) horizontalToolbar.style.display = '';

             const imgDataP1 = canvasP1.toDataURL('image/jpeg', 0.7);
             const imgDataP2 = canvasP2.toDataURL('image/jpeg', 0.7);
             const hP1 = (canvasP1.height * contentWidth) / canvasP1.width;
             const hP2 = (canvasP2.height * contentWidth) / canvasP2.width;

             // 1ページ目: 写真
             pdf.addImage(imgDataP1, 'JPEG', margin, 15, contentWidth, hP1, undefined, 'FAST');
             pdf.setFontSize(9);
             pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
             
             // 2ページ目: 解析結果
             pdf.addPage();
             currentPageNum++;
             pdf.setFontSize(10);
             pdf.setTextColor(150);
             pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 8 Results & Form)`, margin, 8);
             pdf.addImage(imgDataP2, 'JPEG', margin, 15, contentWidth, hP2, undefined, 'FAST');
             pdf.setFontSize(9);
             pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });

             continue; // Phase 8 完了
          }

          // --- Standard Card Processing ---
          currentPageNum++;
          progressStep.textContent = currentPageNum;

          const ui1 = hideUI(card);
          const canvas = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
          showUI(card, ui1);

          if (currentPageNum > 1) pdf.addPage();

          // ヘッダー (文字化け防止のため英数字のみ)
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

          if (card.id === 'card-horizontal-bar-front') {
             // --- Phase 9: AとBを1ページに統合 ---
             const cardTop = document.getElementById('card-horizontal-bar-top');
             const ui2 = hideUI(cardTop);
             const canvasTop = await html2canvas(cardTop, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
             showUI(cardTop, ui2);

             const imgDataA = canvas.toDataURL('image/jpeg', 0.6);
             const imgDataB = canvasTop.toDataURL('image/jpeg', 0.6);
             const imgHeightA = (canvas.height * contentWidth) / canvas.width;
             const imgHeightB = (canvasTop.height * contentWidth) / canvasTop.width;

             pdf.addImage(imgDataA, 'JPEG', margin, 15, contentWidth, imgHeightA, undefined, 'FAST');
             pdf.addImage(imgDataB, 'JPEG', margin, 15 + imgHeightA + 5, contentWidth, imgHeightB, undefined, 'FAST');

          } else {
             // --- 通常のカード ---
             const imgData = canvas.toDataURL('image/jpeg', 0.6);
             const imgProps = pdf.getImageProperties(imgData);
             const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
             pdf.addImage(imgData, 'JPEG', margin, 15, contentWidth, imgHeight, undefined, 'FAST');
          }
          
          // フッター
          pdf.setFontSize(9);
          pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Smile_Analysis_Report_${dateStr}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
      } catch (err) {
        console.error('PDF Generation Error:', err);
        alert('PDFの生成中にエラーが発生しました。');
      } finally {
        loadingOverlay.classList.add('hidden');
        document.body.classList.remove('is-exporting');
      }
    });
  }

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
