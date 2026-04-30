/**
 * ShadeAnalysisCard (Phase 10: Shade Take)
 * Extends BaseAnalysisCard with shade analysis specific functionality.
 */
class ShadeAnalysisCard extends BaseAnalysisCard {
  constructor(cardElement) {
    super(cardElement);
  }

  // Override initUI to also initialize shade-specific UI
  initUI() {
    super.initUI();
    this.initShadeUI();
  }

  initShadeUI() {
    this.shadeSwatch = this.card.querySelector('#shade-color-swatch');
    this.shadeIdValue = this.card.querySelector('#shade-result-id');
    if (!this.dropZone) this.dropZone = this.card.querySelector('.drop-zone');
    if (!this.canvas) this.canvas = this.card.querySelector('.analysis-canvas');
    if (!this.fileInput) this.fileInput = this.card.querySelector('.file-input');

    this.isWaitingForAIClick = false;
    this.currentImage = null;
    this.shadeL = this.card.querySelector('#shade-lab-l');
    this.shadeA = this.card.querySelector('#shade-lab-a');
    this.shadeB = this.card.querySelector('#shade-lab-b');
    this.shadeDelta = this.card.querySelector('#shade-delta-e');
    this.shadeCalibRef = this.card.querySelector('#shade-calib-ref');
    this.shadeCalibResetBtn = this.card.querySelector('#shade-calib-reset-btn');
    this.shadePlotList = this.card.querySelector('#shade-plot-list');
    this.shadePalette = this.card.querySelector('#shade-palette');
    this.aiEnhanceBtn = this.card.querySelector('#btn-ai-enhance');
    this.shadeZoomCanvas = this.card.querySelector('#shade-zoom-canvas');
    this.shadeGuideSelect = this.card.querySelector('#shade-guide-select');
    this.shadeGuideDescription = this.card.querySelector('#shade-guide-description');

    this.shadeDiffA = null;
    this.shadeDiffB = null;
    this.shadeMapRect = null;

    this.currentShadeGuideId = 'vita-classical';
    this.currentCalibId = 'A2';

    this.shadeOffset = { l: 0, a: 0, b: 0 };
    this.calibPoints = [];
    this.shadeMatrixValues = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0";

    this.renderShadePalette();
    this.initShadeGuide();

    if (this.shadeCalibResetBtn) {
        this.shadeCalibResetBtn.addEventListener('click', () => {
            this.shadeOffset = { l: 0, a: 0, b: 0 };
            this.calibPoints = [];
            this.updateStats();
            this.drawCanvas();
            alert('色調補正をリセットしました。');
        });
    }

    if (this.aiEnhanceBtn) {
        this.aiEnhanceBtn.classList.remove('active');
        this.aiEnhanceBtn.addEventListener('click', () => {
            this.aiEnhanceBtn.classList.toggle('active');
            this.updateAutoCorrectionMatrix();
            this.drawCanvas();
        });
    }
  }

  solveAutoCorrection() {
      if (this.calibPoints.length === 0) {
          this.shadeMatrixValues = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"; return;
      }
      let sRI = 0, sRO = 0, sGI = 0, sGO = 0, sBI = 0, sBO = 0;
      this.calibPoints.forEach(p => {
          const ideal = ColorSpace.labToRgb(p.idealLab.l, p.idealLab.a, p.idealLab.b);
          sRI += p.sampledRGB.r; sRO += ideal.r; sGI += p.sampledRGB.g; sGO += ideal.g; sBI += p.sampledRGB.b; sBO += ideal.b;
      });
      const gR = Math.min(3, sRO / (sRI || 1)); const gG = Math.min(3, sGO / (sGI || 1)); const gB = Math.min(3, sBO / (sBI || 1));
      this.shadeMatrixValues = `${gR.toFixed(3)} 0 0 0 0  0 ${gG.toFixed(3)} 0 0 0  0 0 ${gB.toFixed(3)} 0 0  0 0 0 1 0`;
  }

  updateAutoCorrectionMatrix() {
      const matrix = document.getElementById('shade-auto-matrix');
      if (!matrix) return;
      if (this.aiEnhanceBtn && this.aiEnhanceBtn.classList.contains('active')) {
          this.solveAutoCorrection();
          matrix.setAttribute('values', this.shadeMatrixValues);
          this.canvas.style.filter = 'url(#shade-auto-filter)';
      } else this.canvas.style.filter = 'none';
  }

  calibrateShade(rX, rY) {
      if (!this.currentImage || !window.ColorSpace || !window.SHADE_GUIDES) return;
      const c = this.sampleColorAt(rX, rY);
      this.lastSampledColor = c;
      const sLab = window.ColorSpace.rgbToLab(c.r, c.g, c.b);
      const tId = this.currentCalibId || 'A2';
      const g = window.SHADE_GUIDES[this.currentShadeGuideId];
      const tS = g ? g.shades.find(sh => sh.id === tId) : null;
      let tLab = tS ? { l: tS.l, a: tS.a, b: tS.b } : null;
      if (tId && tLab) {
          const off = { l: tLab.l - sLab.l, a: tLab.a - sLab.a, b: tLab.b - sLab.b };
          this.calibPoints.push({ id: tId, sampledRGB: c, idealLab: tLab, offset: off, x: rX, y: rY });
          let sL = 0, sA = 0, sB = 0;
          this.calibPoints.forEach(p => { sL += p.offset.l; sA += p.offset.a; sB += p.offset.b; });
          this.shadeOffset = { l: sL/this.calibPoints.length, a: sA/this.calibPoints.length, b: sB/this.calibPoints.length };
          this.updateStats(); this.drawCanvas();
          this.showShadeToast(`${tId} としてプロットしました。`);
      }
  }

  initShadeGuide() {
      const select = this.card.querySelector('#shade-guide-select');
      if (select) {
          select.addEventListener('change', (e) => {
              const newId = e.target.value;
              this.currentShadeGuideId = newId;
              const g = window.SHADE_GUIDES[newId];
              if (g) {
                  if (this.shadeGuideDescription) this.shadeGuideDescription.textContent = g.description;
                  if (g.shades && g.shades.length > 0) this.currentCalibId = g.shades[0].id;
                  this.renderShadePalette();
                  this.updateStats();
              }
          });
      }
      if (this.shadePalette) {
          this.shadePalette.addEventListener('click', (e) => {
              const btn = e.target.closest('.shade-btn'); if (!btn) return;
              this.shadePalette.querySelectorAll('.shade-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
              this.currentCalibId = btn.dataset.shade;
              const cal = this.card.querySelector('#tool-shade-calibrator');
              if (cal) { cal.checked = true; this.activeTool = 'shade-calibrator'; const con = this.shadePalette.closest('.palette-container'); if (con) con.classList.add('open'); }
          });
      }
  }

  renderShadePalette() {
      if (!this.shadePalette || !window.SHADE_GUIDES || !window.ColorSpace) return;
      const g = window.SHADE_GUIDES[this.currentShadeGuideId];
      if (!g) return;
      this.shadePalette.innerHTML = '';
      if (!g.shades.find(s => s.id === this.currentCalibId)) {
          if (g.shades.length > 0) this.currentCalibId = g.shades[0].id;
      }
      g.shades.forEach(s => {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'shade-btn';
          if (s.id === this.currentCalibId) btn.classList.add('active');
          btn.dataset.shade = s.id; btn.textContent = s.id;
          if (s.label) btn.title = s.label;
          const rgb = window.ColorSpace.labToRgb(s.l, s.a, s.b);
          btn.style.setProperty('--shade-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
          this.shadePalette.appendChild(btn);
      });
  }

  showShadeToast(msg) {
      let t = document.getElementById('shade-toast');
      if (!t) { t = document.createElement('div'); t.id = 'shade-toast'; t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(37,99,235,0.9); color:white; padding:10px 20px; border-radius:30px; z-index:9999;'; document.body.appendChild(t); }
      t.textContent = msg; t.style.opacity = '1'; setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  updateShade(rX, rY) {
      const c = this.sampleColorAt(rX, rY);
      this.lastSampledColor = c;
      if (this.activeTool === 'shade-diff') {
          if (!this.shadeDiffA || (this.shadeDiffA && this.shadeDiffB)) { this.shadeDiffA = { x: rX, y: rY, ...c }; this.shadeDiffB = null; }
          else this.shadeDiffB = { x: rX, y: rY, ...c };
      } else {
          this.lines['shadeSample'] = { x: rX, y: rY, ...c };
      }
      this.updateStats(); this.drawCanvas();
  }
}

window.ShadeAnalysisCard = ShadeAnalysisCard;
