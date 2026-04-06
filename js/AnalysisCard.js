/**
 * AnalysisCard Class
 * Handles individual analysis cards/units for each diagnostic phase.
 */
class AnalysisCard {
  constructor(cardElement) {
    this.card = cardElement;
    this.phase = cardElement.dataset.phase;

    // --- Authentication & Expiry Logic (Gatekeeper) ---
    if (this.phase === 'intraoral') { 
        this.initIntraoralAuth();
    }
    
    this.dropZone = cardElement.querySelector('.drop-zone');
    this.fileInput = cardElement.querySelector('.file-input');
    this.canvas = cardElement.querySelector('.analysis-canvas');
    this.placeholder = cardElement.querySelector('.canvas-placeholder');
    this.btnReset = cardElement.querySelector('.btn-reset');
    this.toolRadios = cardElement.querySelectorAll('.tool-radio');
    this.tooltip = cardElement.querySelector('.instruction-tooltip'); 
    
    this.ctx = this.canvas.getContext('2d');
    
    this.currentImage = null;
    this.activeTool = null;
    this.drawState = 'idle'; 
    this.tempStart = null;
    this.tempEnd = null;
    this.tempPoints = []; 
    
    this.lines = {}; 
    this.guidedMode = false;
    this.pxToMm = 0.075; 

    // Constants from window.AESTHETIC_CONSTANTS
    const C = window.AESTHETIC_CONSTANTS;
    this.STEPS = C.STEPS;
    this.TOOL_EXPLANATIONS = C.TOOL_EXPLANATIONS;
    this.LOUPE_SETTINGS = C.LOUPE;

    this.initToolbar();
    
    this.hoveredPoint = null;
    this.draggingPoint = null;
    
    this.isPanning = false;
    this.lastPanPt = { x: 0, y: 0 };

    // Shared offscreen canvas for processing (Static)
    if (!AnalysisCard.offScreenCanvas) {
      AnalysisCard.offScreenCanvas = document.createElement('canvas');
      AnalysisCard.offScreenCtx = AnalysisCard.offScreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    this.lastPanPt = null;
    this.imgRotation = 0; 

    this.initUI();
    this.initEventListeners();
    
    // Cache Loupe elements for performance
    this.loupeContainer = document.getElementById('loupe-container');
    this.loupeCanvas = document.getElementById('loupe-canvas');
    if (this.loupeCanvas) this.loupeCtx = this.loupeCanvas.getContext('2d', { alpha: false });
  }

  initIntraoralAuth() {
    const authModal = document.getElementById('auth-modal');
    const privacyModal = document.getElementById('privacy-modal');
    const passwordInput = document.getElementById('auth-password');
    const submitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error-msg');
    const expiryError = document.getElementById('expiry-error-msg');

    const expiryDate = new Date('2026-06-01T00:00:00');
    const now = new Date();
    const isExpired = now >= expiryDate;

    if (isExpired) {
        authModal.classList.remove('hidden');
        expiryError.classList.remove('hidden');
        if (passwordInput) passwordInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        const isAuthenticated = sessionStorage.getItem('app-auth') === 'true';
        if (isAuthenticated) {
            authModal.classList.add('hidden');
            this.checkPrivacyModal(privacyModal);
        } else {
            authModal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        submitBtn?.addEventListener('click', () => {
            if (passwordInput.value === 'shibata-beta') {
                sessionStorage.setItem('app-auth', 'true');
                authModal.classList.add('hidden');
                authError.classList.add('hidden');
                this.checkPrivacyModal(privacyModal);
            } else {
                authError.classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
            }
        });
    }
  }

  initToolbar() {
    const mmPhases = ['lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound', 'intraoral'];
    const tSelector = this.card.querySelector('.tool-selector');
    if (tSelector && mmPhases.includes(this.phase)) {
      const calId = 'tool-calib-' + this.phase;
      if (!document.getElementById(calId)) {
          const rd = document.createElement('input'); rd.type = 'radio'; rd.name = 'tool-'+this.phase; rd.id = calId; rd.value = 'calib'; rd.className = 'tool-radio';
          const lb = document.createElement('label'); lb.htmlFor = calId; lb.className = 'tool-label'; lb.style.marginRight = 'auto'; 
          lb.innerHTML = '<i data-lucide="ruler"></i> 実寸キャリブ';
          tSelector.prepend(lb); tSelector.prepend(rd);
          if(window.lucide) window.lucide.createIcons({root: lb});
      }
    }
    this.toolRadios = this.card.querySelectorAll('.tool-radio');
    const checkedRadio = this.card.querySelector('.tool-radio:checked');
    if (checkedRadio) this.activeTool = checkedRadio.value;
  }

  initUI() {
    this.showPlots = true;
    const toggle = this.card.querySelector('.card-plot-toggle');
    if (toggle) {
      toggle.checked = true;
      toggle.addEventListener('change', (e) => {
        this.showPlots = e.target.checked;
        this.drawCanvas();
      });
    }

    if (this.phase === 'shade-take') {
      this.initShadeUI();
    }
  }

  initShadeUI() {
    this.shadeSwatch = this.card.querySelector('#shade-color-swatch');
    this.shadeIdValue = this.card.querySelector('#shade-result-id');
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

  checkPrivacyModal(privacyModal) {
      const agreeBtn = document.getElementById('agree-button');
      if (privacyModal && agreeBtn) {
          privacyModal.classList.remove('hidden');
          if (window.lucide) lucide.createIcons();

          if (!agreeBtn.hasListener) {
              agreeBtn.addEventListener('click', () => {
                  privacyModal.classList.add('hidden');
                  if (window.lucide) lucide.createIcons();
              });
              agreeBtn.hasListener = true;
          }
      }
  }

  initEventListeners() {
      const handleToolChange = (toolValue) => {
          this.activeTool = toolValue;
          this.tempStart = null;
          this.tempPoints = [];
          
          const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
          if (multiHndls.includes(this.activeTool)) {
            this.drawState = 'multi-point';
            const s = this.STEPS;
            if(this.activeTool === 'vertical-proportions') this.showTooltip(s.PROPORTION[0]);
            else if(this.activeTool === 'eline') this.showTooltip(s.ELINE[0]);
            else if(this.activeTool === 'nla') this.showTooltip(s.NLA[0]);
            else if(this.activeTool === 'convexity') this.showTooltip(s.CONVEXITY[0]);
            else if(this.activeTool === 'wl-ratio') this.showTooltip(s.WL[0]);
            else if(this.activeTool === 'red-prop') this.showTooltip(s.RED[0]);
            else if(this.activeTool === 'pink-esth') this.showTooltip(s.PINK[0]);
            else if(this.activeTool === 'smile-arc') this.showTooltip(s.ARC[0]);
            else if(this.activeTool === 'corridor') this.showTooltip(s.CORRIDOR[0]);
            else if(this.activeTool === 'gingival') this.showTooltip(s.GINGIVAL[0]);
            else if(this.activeTool === 'axial-incl') this.showTooltip(s.AXIAL[0]);
            else if(this.activeTool === 'papilla') this.showTooltip(s.PAPILLA[0]);
          } else if (this.activeTool === 'hbar-ref') {
            this.drawState = 'idle'; this.showTooltip(this.STEPS.HBAR_REF[0]);
          } else if (this.activeTool === 'hbar-bar') {
            this.drawState = 'idle'; this.showTooltip(this.STEPS.HBAR_BAR[0]);
          } else if (this.activeTool === 'calib') {
            this.drawState = 'idle'; 
            this.showTooltip(this.STEPS.CALIB[0]);
          } else {
            this.drawState = 'idle';
            this.hideTooltip();
          }

          if (this.phase === 'shade-take' && this.shadePalette) {
            const container = this.shadePalette.closest('.palette-container');
            if (container) {
              if (this.activeTool === 'shade-calibrator') container.classList.add('open');
              else container.classList.remove('open');
            }
          }
          this.drawCanvas();
      };

      this.toolRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.checked) handleToolChange(e.target.value);
        });
      });

      const initialChecked = this.card.querySelector('.tool-radio:checked');
      if (initialChecked) handleToolChange(initialChecked.value);

      if (this.btnReset) {
        this.btnReset.addEventListener('click', () => {
          this.lines = {}; this.tempStart = null; this.tempPoints = [];
          const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
          if (multiHndls.includes(this.activeTool)) {
             this.drawState = 'multi-point';
             const s = this.STEPS;
             if(this.activeTool === 'vertical-proportions') this.showTooltip(s.PROPORTION[0]);
             else if(this.activeTool === 'eline') this.showTooltip(s.ELINE[0]);
             else if(this.activeTool === 'nla') this.showTooltip(s.NLA[0]);
             else if(this.activeTool === 'convexity') this.showTooltip(s.CONVEXITY[0]);
             else if(this.activeTool === 'wl-ratio') this.showTooltip(s.WL[0]);
             else if(this.activeTool === 'red-prop') this.showTooltip(s.RED[0]);
             else if(this.activeTool === 'pink-esth') this.showTooltip(s.PINK[0]);
             else if(this.activeTool === 'smile-arc') this.showTooltip(s.ARC[0]);
             else if(this.activeTool === 'corridor') this.showTooltip(s.CORRIDOR[0]);
             else if(this.activeTool === 'gingival') this.showTooltip(s.GINGIVAL[0]);
             else if(this.activeTool === 'axial-incl') this.showTooltip(s.AXIAL[0]);
             else if(this.activeTool === 'papilla') this.showTooltip(s.PAPILLA[0]);
          } else if(this.activeTool === 'hbar-ref') {
             this.drawState = 'idle'; this.showTooltip(this.STEPS.HBAR_REF[0]);
          } else if(this.activeTool === 'hbar-bar') {
             this.drawState = 'idle'; this.showTooltip(this.STEPS.HBAR_BAR[0]);
          } else if(this.activeTool === 'calib') { 
             this.drawState = 'idle'; this.showTooltip(this.STEPS.CALIB[0]); 
          } else { 
             this.drawState = 'idle'; this.hideTooltip(); 
          }
          this.drawCanvas(); this.updateStats();
        });
      }

      const aiBtn = this.card.querySelector('.ai-analyze-btn');
      if (aiBtn) aiBtn.addEventListener('click', () => this.runAIAnalysis());

      this.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
      this.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); this.dropZone.classList.remove('drag-over'); });
      this.dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); this.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) this.handleImage(e.dataTransfer.files[0]);
      });
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) this.handleImage(e.target.files[0]);
      });
      window.addEventListener('resize', () => { if (this.currentImage) this.resizeCanvas(); });

      this.canvas.addEventListener('mousedown', (e) => {
        if (!this.currentImage) return;
        if (this.guidedMode) {
            const coords = this.getMouseCoords(e);
            this.analyzeFromNoseClick(coords.realX, coords.realY);
            return;
        }
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            this.isPanning = true;
            this.lastPanPt = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        if (!this.activeTool) return;
        const coords = this.getMouseCoords(e);
        if (this.hoveredPoint) {
           this.draggingPoint = this.hoveredPoint;
           this.canvas.style.cursor = 'grabbing';
           return;
        }
        if (this.activeTool === 'calib') {
           if (this.drawState === 'idle') {
             this.drawState = 'pt1-placed'; this.tempStart = coords; this.tempEnd = coords;
             this.showTooltip(this.STEPS.CALIB[1]);
             this.drawCanvas();
           } else if (this.drawState === 'pt1-placed') {
             this.tempEnd = coords;
             const distPx = Math.hypot(this.tempEnd.realX - this.tempStart.realX, this.tempEnd.realY - this.tempStart.realY);
             this.drawCanvas(); 
             requestAnimationFrame(() => {
                const actualMm = window.prompt("この2点間の実際の長さ(mm)を入力してください：\n※キャンセルか空欄でリセット(0.075mm/px)されます。", "10.0");
                if (actualMm && !isNaN(parseFloat(actualMm))) {
                   this.pxToMm = parseFloat(actualMm) / distPx;
                   this.showTooltip(`キャリブレーション完了（1px = ${this.pxToMm.toFixed(4)} mm）。他のツールを選択してください。`);
                } else {
                   this.pxToMm = 0.075;
                   this.showTooltip(`キャリブレーションをリセットしました（1px = 0.075 mm）。`);
                }
                const statusEl = this.card.querySelector('.calib-status');
                if(statusEl) statusEl.textContent = `[1px = ${this.pxToMm.toFixed(4)}mm]`;
                this.tempStart = null; this.tempEnd = null;
                this.drawState = 'idle';
                this.updateStats();
                this.drawCanvas();
             });
           }
           return;
        }
        if (this.activeTool === 'shade-picker' || this.activeTool === 'shade-diff') {
          this.updateShade(coords.realX, coords.realY);
          return;
        }
        if (this.activeTool === 'shade-calibrator') {
          this.calibrateShade(coords.realX, coords.realY);
          return;
        }
        if (this.drawState === 'multi-point') {
           const s = this.STEPS;
           const map = {
               'vertical-proportions': { limits: 6, texts: s.PROPORTION, key: 'verticalProportions' },
               'eline': { limits: 4, texts: s.ELINE, key: 'eLine' },
               'nla': { limits: 3, texts: s.NLA, key: 'nla' },
               'convexity': { limits: 3, texts: s.CONVEXITY, key: 'convexity' },
               'wl-ratio': { limits: 8, texts: s.WL, key: 'wlRatio' },
               'red-prop': { limits: 7, texts: s.RED, key: 'redProp' },
               'pink-esth': { limits: 6, texts: s.PINK, key: 'pinkEsth' },
               'smile-arc': { limits: 6, texts: s.ARC, key: 'smileArc' },
               'corridor': { limits: 4, texts: s.CORRIDOR, key: 'corridor' },
               'gingival': { limits: 4, texts: s.GINGIVAL, key: 'gingival' },
               'axial-incl': { limits: 14, texts: s.AXIAL, key: 'axialIncl' },
               'papilla': { limits: 5, texts: s.PAPILLA, key: 'papilla' }
           };
           const cfg = map[this.activeTool];
           if(!cfg) return;
           if (this.tempPoints.length < cfg.limits) {
              this.tempPoints.push({ x: coords.realX, y: coords.realY });
              if (this.tempPoints.length < cfg.limits) this.showTooltip(cfg.texts[this.tempPoints.length]);
              else {
                 this.lines[cfg.key] = [...this.tempPoints];
                 this.drawState = 'idle';
                 this.hideTooltip();
                 this.showTooltip(cfg.texts[cfg.limits]);
                 setTimeout(() => this.hideTooltip(), 3000);
                 this.updateStats();
              }
              this.drawCanvas();
           }
           return;
        }
        if (this.activeTool === 'shade-map') {
            this.shadeMapRect = { x1: coords.realX, y1: coords.realY, x2: coords.realX, y2: coords.realY, active: true, finalized: false };
            this.drawCanvas();
            return;
        }
        if (this.drawState === 'idle') {
          this.drawState = 'pt1-placed'; this.tempStart = coords; this.tempEnd = coords; this.drawCanvas();
        } else if (this.drawState === 'pt1-placed') {
          this.drawState = 'idle'; this.tempEnd = coords;
          this.lines[this.activeTool] = { startX: this.tempStart.realX, startY: this.tempStart.realY, endX: this.tempEnd.realX, endY: this.tempEnd.realY };
          if (this.activeTool === 'hbar-ref') this.showTooltip(this.STEPS.HBAR_REF[2]);
          else if (this.activeTool === 'hbar-bar') this.showTooltip(this.STEPS.HBAR_BAR[2]);
          this.tempStart = null; this.tempEnd = null; this.drawCanvas(); this.updateStats();
        }
      });

      this.canvas.addEventListener('mousemove', (e) => {
        if (!this.currentImage) return;
        if (this.isPanning) {
            this.panX += e.clientX - this.lastPanPt.x;
            this.panY += e.clientY - this.lastPanPt.y;
            this.lastPanPt = { x: e.clientX, y: e.clientY };
            this.drawCanvas();
            return;
        }
        const coords = this.getMouseCoords(e);
        if (this.activeTool) this.updateMagnifier(e);
        if (this.draggingPoint) {
            const dp = this.draggingPoint;
            if (dp.mode === 'multi' || dp.mode === 'array') { dp.pt.x = coords.realX; dp.pt.y = coords.realY; }
            else if (dp.mode === 'start') { dp.pt.startX = coords.realX; dp.pt.startY = coords.realY; }
            else if (dp.mode === 'end') { dp.pt.endX = coords.realX; dp.pt.endY = coords.realY; }
            else if (dp.mode === 'shade' || dp.mode === 'shade-diff') {
                dp.pt.x = coords.realX; dp.pt.y = coords.realY;
                const newColor = this.sampleColorAt(coords.realX, coords.realY);
                dp.pt.r = newColor.r; dp.pt.g = newColor.g; dp.pt.b = newColor.b;
            }
            this.drawCanvas(); this.updateStats();
            return;
        }
        this.hoveredPoint = this.findHoverPoint(coords);
        this.canvas.style.cursor = this.hoveredPoint ? 'grab' : 'crosshair';
        if (this.activeTool === 'shade-map' && this.shadeMapRect && this.shadeMapRect.active) {
            const dx = coords.realX - this.shadeMapRect.x1;
            const dy = coords.realY - this.shadeMapRect.y1;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            this.shadeMapRect.x2 = this.shadeMapRect.x1 + (dx >= 0 ? side : -side);
            this.shadeMapRect.y2 = this.shadeMapRect.y1 + (dy >= 0 ? side : -side);
            this.drawCanvas();
        }
        if (this.drawState === 'multi-point' && this.tempPoints.length > 0) { this.tempEnd = coords; this.drawCanvas(); }
        if (this.drawState === 'pt1-placed') { this.tempEnd = coords; this.drawCanvas(); }
      });
      
      window.addEventListener('mouseup', () => {
         if (this.shadeMapRect && this.shadeMapRect.active) {
             this.shadeMapRect.active = false; this.shadeMapRect.finalized = true;
             this.drawCanvas(); this.updateStats();
         }
         if (this.isPanning) {
             this.isPanning = false;
             if(this.canvas) this.canvas.style.cursor = 'crosshair';
         }
         if (this.draggingPoint) {
            if (this.phase === 'lateral' && ['eLine', 'nla', 'convexity'].includes(this.draggingPoint.key)) this.saveProfilePattern();
            this.draggingPoint = null;
            if (this.canvas) this.canvas.style.cursor = this.hoveredPoint ? 'grab' : 'crosshair';
         }
      });
      
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());
      this.canvas.addEventListener('wheel', (e) => {
          if (!this.currentImage) return;
          e.preventDefault();
          this.panX -= e.deltaX; this.panY -= e.deltaY;
          this.drawCanvas();
      });
      
      const vSlider = this.card.querySelector('.vertical-zoom-slider');
      if (vSlider) {
          vSlider.addEventListener('input', (e) => {
             this.zoomLevel = parseInt(e.target.value) / 100;
             if (this.zoomLevel <= 1.0) { this.panX = 0; this.panY = 0; }
             this.drawCanvas();
          });
      }

      this.canvas.addEventListener('mouseleave', () => { 
        const lc = document.getElementById('loupe-container');
        if(lc) lc.classList.add('hidden'); 
      });
      this.canvas.addEventListener('mouseenter', (e) => {
         const lc = document.getElementById('loupe-container');
         if (this.currentImage && this.activeTool && lc) { lc.classList.remove('hidden'); this.updateMagnifier(e); }
      });

       const btnRotInter = this.card.querySelector('.rotate-inter-btn');
       if (btnRotInter) {
          btnRotInter.addEventListener('click', () => {
             const line = this.lines['interpupillary'] || this.lines['interpupillary-e'];
             if (line) {
                 let cx = line.endX - line.startX; let cy = line.endY - line.startY;
                 if (cx < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = -Math.atan2(cy, cx);
                 this.drawCanvas();
             } else alert('基準となる瞳孔間線がプロットされていません。');
          });
       }

       const btnRotMid = this.card.querySelector('.rotate-mid-btn');
       if (btnRotMid) {
          btnRotMid.addEventListener('click', () => {
             const line = this.lines['midline'] || this.lines['f-midline'];
             if (line) {
                 let cx = line.endX - line.startX; let cy = line.endY - line.startY;
                 if (cy < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = (Math.PI / 2) - Math.atan2(cy, cx);
                 this.drawCanvas();
             } else alert('基準となる顔貌正中線がプロットされていません。');
          });
       }

       const btnApplyP3Mid = this.card.querySelector('.apply-p3-mid-btn');
       if (btnApplyP3Mid) {
          btnApplyP3Mid.addEventListener('click', () => {
             const phase3Card = window.appCards.find(c => c.phase === 'e-midline');
             if (phase3Card && phase3Card.lines['f-midline']) {
                 const line = phase3Card.lines['f-midline'];
                 let cx = line.endX - line.startX; let cy = line.endY - line.startY;
                 if (cy < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = (Math.PI / 2) - Math.atan2(cy, cx);
                 this.drawCanvas();
                 alert('Phase 3の顔貌正中線の傾き（補正量）を適用しました。');
             } else alert('Phase 3 (E音発音時) で顔貌正中線がプロットされていません。');
          });
       }

       const btnRotHBarRef = this.card.querySelector(".rotate-hbar-ref-btn");
       if (btnRotHBarRef) {
          btnRotHBarRef.addEventListener("click", () => {
             const line = this.lines["hbar-ref"];
             if (line) {
                 let cx = line.endX - line.startX; let cy = line.endY - line.startY;
                 if (cx < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = -Math.atan2(cy, cx);
                 this.drawCanvas(); this.updateStats();
             } else alert("基準となる水平基準プロットが引かれていません。");
          });
       }
  }

  showTooltip(text) { 
      const gInfo = document.getElementById('global-tooltip');
      if(gInfo) { gInfo.textContent = text; gInfo.classList.remove('hidden'); }
      const aest = document.getElementById('aesthetic-explanation');
      if(aest) aest.textContent = this.TOOL_EXPLANATIONS[this.activeTool] || 'ツールの評価目的がここに表示されます。';
  }
  hideTooltip() { 
      const gInfo = document.getElementById('global-tooltip');
      if(gInfo) gInfo.classList.add('hidden'); 
  }

  async runAIAnalysis() {
      if (!this.currentImage) return alert("先に画像を読み込んでください。");
      const aiBtn = this.card.querySelector('.ai-analyze-btn');
      const originalHTML = aiBtn.innerHTML;
      if (this.phase === 'lateral') {
          if (this.guidedMode) {
              this.guidedMode = false; aiBtn.innerHTML = originalHTML;
              this.hideTooltip(); return;
          }
          this.guidedMode = true;
          aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">鼻先をクリック...</span>';
          this.showTooltip("画像上の「鼻の先端」を1回クリックしてください。AIが輪郭を自動抽出します。");
          return;
      }
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">AIモデル読込中...</span>';
      this.card.classList.add('ai-scanning');
      try {
          console.log("AI Analysis started...");
          const landmarker = await window.initFaceLandmarker();
          if (!landmarker) throw new Error("AIモデルの初期化に失敗しました。");
          
          aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">特徴点検出中...</span>';
          this.prepareOffScreenCanvas();
          const result = landmarker.detect(AnalysisCard.offScreenCanvas);
          
          if (this.phase !== 'frontal' && this.pxToMm === 0.075) {
              const frontalCard = window.appCards.find(c => c.phase === 'frontal');
              if (frontalCard && frontalCard.pxToMm !== 0.075) this.pxToMm = frontalCard.pxToMm;
          }
          if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
              alert("顔が検出されませんでした。正面を向いた鮮明な画像でお試しください。");
          } else {
              this.applyLandmarksToPlots(result.faceLandmarks[0], AnalysisCard.offScreenCanvas.width, AnalysisCard.offScreenCanvas.height);
              console.log("AI Landmark detection successful.");
          }
      } catch (err) {
          console.error("AI Error:", err); 
          alert("解析中にエラーが発生しました：\n" + (err.message || "不明なエラー"));
      } finally {
          aiBtn.disabled = false; aiBtn.innerHTML = originalHTML;
          this.card.classList.remove('ai-scanning');
          if (window.lucide) window.lucide.createIcons({ root: aiBtn });
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

  findHoverPoint(coords) {
      if (this.drawState !== 'idle' && this.drawState !== 'multi-point') return null;
      const threshold = 20 / coords.scale; 
      for(let i=0; i<this.tempPoints.length; i++) if(Math.hypot(this.tempPoints[i].x - coords.realX, this.tempPoints[i].y - coords.realY) < threshold) return { key:'tempPoints', index:i, pt:this.tempPoints[i], mode:'multi' };
      for (const key in this.lines) {
         const v = this.lines[key];
        if (key === 'shadeSample' && v && this.activeTool === 'shade-picker' && Math.hypot(v.x - coords.realX, v.y - coords.realY) < threshold) return { key:'shadeSample', pt:v, mode:'shade' };
        if(Array.isArray(v)) {
           for(let i=0; i<v.length; i++) if(Math.hypot(v[i].x - coords.realX, v[i].y - coords.realY) < threshold) return { key, index:i, pt:v[i], mode:'array' };
        } else if (v && v.startX !== undefined) {
           if(Math.hypot(v.startX - coords.realX, v.startY - coords.realY) < threshold) return { key, index:'start', pt:v, mode:'start' };
           if(Math.hypot(v.endX - coords.realX, v.endY - coords.realY) < threshold) return { key, index:'end', pt:v, mode:'end' };
        }
     }
     if (this.phase === 'shade-take' && this.activeTool === 'shade-diff') {
         if (this.shadeDiffA && Math.hypot(this.shadeDiffA.x - coords.realX, this.shadeDiffA.y - coords.realY) < threshold) return { key: 'shadeDiffA', pt: this.shadeDiffA, mode: 'shade-diff' };
         if (this.shadeDiffB && Math.hypot(this.shadeDiffB.x - coords.realX, this.shadeDiffB.y - coords.realY) < threshold) return { key: 'shadeDiffB', pt: this.shadeDiffB, mode: 'shade-diff' };
     }
     return null;
  }

  snapPointToEdge(pt, data, imgW, bgLum, radius = 40) {
      const getLum = (x, y) => {
          const idx = (Math.floor(y) * imgW + Math.floor(x)) * 4;
          return (data.data[idx] + data.data[idx+1] + data.data[idx+2]) / 3;
      };
      let maxRightX = -1;
      for(let y = Math.max(0, pt.y - 10); y < Math.min(data.height - 1, pt.y + 10); y += 2) {
          for(let x = Math.min(imgW - 1, pt.x + radius); x > pt.x - radius; x -= 2) {
              if(Math.abs(getLum(x, y) - bgLum) > 30) { if(x > maxRightX) maxRightX = x; break; }
          }
      }
      return maxRightX > 0 ? { x: maxRightX, y: pt.y } : pt;
  }

  saveProfilePattern() {
     if (!this.lines.eLine || this.lines.eLine.length < 4) return;
     const pn = this.lines.eLine[0];
     const pattern = {
        offsets: {
           pg: { dx: this.lines.eLine[1].x - pn.x, dy: this.lines.eLine[1].y - pn.y },
           ls: { dx: this.lines.eLine[2].x - pn.x, dy: this.lines.eLine[2].y - pn.y },
           li: { dx: this.lines.eLine[3].x - pn.x, dy: this.lines.eLine[3].y - pn.y },
           sn: (this.lines.nla && this.lines.nla[1]) ? { dx: this.lines.nla[1].x - pn.x, dy: this.lines.nla[1].y - pn.y } : null
        },
        imgH: this.currentImage.height
     };
     localStorage.setItem('aesthetic_profile_pattern', JSON.stringify(pattern));
  }

  loadProfilePattern() {
     const saved = localStorage.getItem('aesthetic_profile_pattern'); return saved ? JSON.parse(saved) : null;
  }

  analyzeFromNoseClick(startX, startY) {
      this.guidedMode = false;
      const aiBtn = this.card.querySelector('.ai-analyze-btn');
      if (aiBtn) { aiBtn.innerHTML = '<i data-lucide="sparkles"></i> AI自動解析'; if (window.lucide) window.lucide.createIcons({ root: aiBtn }); }
      this.hideTooltip();
      const canvas = document.createElement('canvas'); canvas.width = this.currentImage.width; canvas.height = this.currentImage.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(this.currentImage, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const getLum = (x, y) => { const idx = (Math.floor(y)*canvas.width + Math.floor(x))*4; return (data.data[idx]+data.data[idx+1]+data.data[idx+2])/3; };
      let bgLum = 0; for(let i=0; i<10; i++) bgLum += getLum(canvas.width - 10 - i, 10 + i);
      bgLum /= 10;
      let pn = { x: startX, y: startY }; let maxRightX = startX;
      for(let y = startY - 20; y < startY + 20; y += 2) {
          if(y < 0 || y >= canvas.height) continue;
          for(let x = Math.min(canvas.width - 1, startX + 100); x > startX - 20; x -= 2) {
              if(Math.abs(getLum(x, y) - bgLum) > 30) { if(x > maxRightX) { maxRightX = x; pn = { x: x, y: y }; } break; }
          }
      }
      const pattern = this.loadProfilePattern();
      let pg, ls, li, sn;
      if (pattern) {
          const s = canvas.height / pattern.imgH;
          pg = { x: pn.x + pattern.offsets.pg.dx*s, y: pn.y + pattern.offsets.pg.dy*s };
          ls = { x: pn.x + pattern.offsets.ls.dx*s, y: pn.y + pattern.offsets.ls.dy*s };
          li = { x: pn.x + pattern.offsets.li.dx*s, y: pn.y + pattern.offsets.li.dy*s };
          sn = pattern.offsets.sn ? { x: pn.x+pattern.offsets.sn.dx*s, y: pn.y+pattern.offsets.sn.dy*s } : { x:(pn.x+ls.x)/2, y:(pn.y+ls.y)/2 };
      } else {
          pg = { x: pn.x - 20, y: pn.y + canvas.height*0.25 }; ls = { x: pn.x - 30, y: pn.y + canvas.height*0.08 };
          li = { x: pn.x - 25, y: pn.y + canvas.height*0.16 }; sn = { x: (pn.x+ls.x)/2, y: (pn.y+ls.y)/2 };
      }
      pg = this.snapPointToEdge(pg, data, canvas.width, bgLum, 60); ls = this.snapPointToEdge(ls, data, canvas.width, bgLum, 30);
      li = this.snapPointToEdge(li, data, canvas.width, bgLum, 30); sn = this.snapPointToEdge(sn, data, canvas.width, bgLum, 30);
      this.lines.eLine = [pn, pg, ls, li]; this.lines.nla = [{x: pn.x, y: pn.y+15}, sn, ls]; this.lines.convexity = [{x: pn.x, y: pn.y-60}, sn, pg];
      this.updateStats(); this.drawCanvas();
      this.showTooltip("自動解析が完了しました。微調整が必要な場合は点をドラッグしてください。");
  }

  applyLandmarksToPlots(landmarks, imgW, imgH) {
      const getPt = (idx) => ({ x: landmarks[idx].x * imgW, y: landmarks[idx].y * imgH });
      if (this.phase === 'frontal' || this.phase === 'e-midline') {
          const rE = getPt(468), lE = getPt(473), mT = getPt(168), mB = getPt(152), lM = getPt(61), rM = getPt(291);
          if (this.phase === 'frontal') {
              this.lines.interpupillary = { startX: lE.x, startY: lE.y, endX: rE.x, endY: rE.y };
              this.lines.midline = { startX: mT.x, startY: mT.y, endX: mB.x, endY: mB.y };
              this.lines.commissural = { startX: lM.x, startY: lM.y, endX: rM.x, endY: rM.y };
              
              // NEW: 6-point vertical proportions
              this.lines.verticalProportions = [
                  getPt(10),   // 1. Hairline
                  getPt(168),  // 2. Glabella
                  { x: (lE.x+rE.x)/2, y: (lE.y+rE.y)/2 }, // 3. Pupil line level
                  getPt(2),    // 4. Subnasale (Nose bottom)
                  getPt(13),   // 5. Stomion (Where lips meet)
                  getPt(152)   // 6. Menton (Chin bottom)
              ];
          } else if (this.phase === 'e-midline') {
              this.lines['interpupillary-e'] = { startX: lE.x, startY: lE.y, endX: rE.x, endY: rE.y };
              this.lines['f-midline'] = { startX: mT.x, startY: mT.y, endX: mB.x, endY: mB.y };
          }
      } else if (this.phase === 'lateral') {
          const pn = getPt(1), sn = getPt(2), g = getPt(168), pg = getPt(152), ls = getPt(0), li = getPt(17), col = getPt(4);
          this.lines.eLine = [pn, pg, ls, li]; this.lines.nla = [col, sn, ls]; this.lines.convexity = [g, sn, pg];
      } else if (this.phase === 'e-sound') {
          const lc = getPt(61), rc = getPt(291), ut = getPt(13), lt = getPt(14);
          this.lines.smileArc = [{x:(rc.x+ut.x)/2, y:(rc.y+ut.y)/2}, ut, {x:(lc.x+ut.x)/2, y:(lc.y+ut.y)/2}, {x:(rc.x+lt.x)/2, y:(rc.y+lt.y)/2+10}, lt, {x:(lc.x+lt.x)/2, y:(lc.y+lt.y)/2+10}];
          this.lines.corridor = [rc, {x:rc.x-20, y:rc.y}, {x:lc.x+20, y:lc.y}, lc];
          this.lines.gingival = [getPt(164), {x:ut.x, y:ut.y-5}, ut, lt];
      } 
      this.updateStats(); this.drawCanvas();
  }

  handleImage(file) {
    if (!file.type.match('image.*')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Clear previous image safely to free memory
        if (this.currentImage) {
            this.currentImage.onload = null;
            this.currentImage.src = '';
            this.currentImage = null;
        }
        this.currentImage = img; 
        this.placeholder.style.display = 'none'; 
        this.lines = {}; 
        this.tempPoints = [];
        const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
        if (multiHndls.includes(this.activeTool)) {
            this.drawState = 'multi-point';
            const s = this.STEPS;
            if(this.activeTool === 'vertical-proportions') this.showTooltip(s.PROPORTION[0]);
            else if(this.activeTool === 'eline') this.showTooltip(s.ELINE[0]);
            else if(this.activeTool === 'nla') this.showTooltip(s.NLA[0]);
            else if(this.activeTool === 'convexity') this.showTooltip(s.CONVEXITY[0]);
            else if(this.activeTool === 'wl-ratio') this.showTooltip(s.WL[0]);
            else if(this.activeTool === 'red-prop') this.showTooltip(s.RED[0]);
            else if(this.activeTool === 'pink-esth') this.showTooltip(s.PINK[0]);
            else if(this.activeTool === 'smile-arc') this.showTooltip(s.ARC[0]);
            else if(this.activeTool === 'corridor') this.showTooltip(s.CORRIDOR[0]);
            else if(this.activeTool === 'gingival') this.showTooltip(s.GINGIVAL[0]);
            else if(this.activeTool === 'axial-incl') this.showTooltip(s.AXIAL[0]);
            else if(this.activeTool === 'papilla') this.showTooltip(s.PAPILLA[0]);
        } else this.drawState = 'idle';
        
        // Reset scale/pan for new image
        this.zoomLevel = 1.0; this.panX = 0; this.panY = 0; this.imgRotation = 0;
        
        // Force redraw on main and clear shared cache
        this.resizeCanvas(); 
        this.updateStats();
        AnalysisCard.lastRenderedImage = null;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  resizeCanvas() {
    const rect = this.dropZone.getBoundingClientRect();
    this.canvas.width = rect.width; this.canvas.height = rect.height;
    this.drawCanvas();
  }

  getMouseCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mX = e.clientX - rect.left; const mY = e.clientY - rect.top;
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
    const xO = (this.canvas.width / 2) + this.panX; const yO = (this.canvas.height / 2) + this.panY;
    const dx = mX - xO; const dy = mY - yO;
    const cos = Math.cos(-this.imgRotation); const sin = Math.sin(-this.imgRotation);
    const rx = dx * cos - dy * sin; const ry = dx * sin + dy * cos;
    const realX = rx / scale + (this.currentImage.width / 2); const realY = ry / scale + (this.currentImage.height / 2);
    return { realX, realY, mouseX: mX, mouseY: mY, scale, xOffset: xO, yOffset: yO };
  }

  updateMagnifier(e) {
    if(!this.loupeCanvas || !this.loupeCtx) return;
    const coords = this.getMouseCoords(e);
    const S = this.LOUPE_SETTINGS;
    
    // Performance: Only redraw if there is an actual image
    if (!this.currentImage) {
        if(this.loupeContainer) this.loupeContainer.classList.add('hidden');
        return;
    }

    this.loupeCtx.fillStyle = '#eef2f6';
    this.loupeCtx.fillRect(0, 0, S.LOUPE_SIZE_W, S.LOUPE_SIZE_H);
    
    const vW = (S.LOUPE_SIZE_W / 2) / S.MAGNIFICATION; 
    const vH = (S.LOUPE_SIZE_H / 2) / S.MAGNIFICATION;
    
    try { 
        this.loupeCtx.drawImage(this.currentImage, coords.realX - vW, coords.realY - vH, vW * 2, vH * 2, 0, 0, S.LOUPE_SIZE_W, S.LOUPE_SIZE_H); 
    } catch(err) {} 
    
    if(this.loupeContainer) this.loupeContainer.classList.remove('hidden');
  }

  drawCanvas() {
    if (!this.currentImage) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
    const cX = (this.canvas.width / 2) + this.panX; const cY = (this.canvas.height / 2) + this.panY;
    this.ctx.save(); this.ctx.translate(cX, cY); this.ctx.rotate(this.imgRotation);
    this.ctx.drawImage(this.currentImage, -(this.currentImage.width / 2)*scale, -(this.currentImage.height / 2)*scale, this.currentImage.width*scale, this.currentImage.height*scale);
    this.ctx.restore();
    const mapC = (nx, ny) => {
       const sx = (nx - this.currentImage.width/2)*scale; const sy = (ny - this.currentImage.height/2)*scale;
       const c = Math.cos(this.imgRotation); const s = Math.sin(this.imgRotation);
       return { x: sx*c - sy*s + cX, y: sx*s + sy*c + cY };
    };
    if (!this.showPlots) return;
    if (['frontal', 'lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound'].includes(this.phase)) FacialHandlers.drawPhase(this, mapC);
    else if (this.phase === 'intraoral') DentalHandlers.drawIntraoral(this, mapC);
    else if (this.phase === 'shade-take') ShadeHandlers.drawShade(this, mapC);
    else if (this.phase.startsWith('horizontal-bar')) {
        if (this.lines['hbar-ref']) this.drawLineSpec(this.lines['hbar-ref'], 'hbar-ref', mapC);
        if (this.lines['hbar-bar']) this.drawLineSpec(this.lines['hbar-bar'], 'hbar-bar', mapC);
    }
    if (this.drawState === 'pt1-placed' && this.tempStart && this.tempEnd) {
      const tempLine = { startX: this.tempStart.realX, startY: this.tempStart.realY, endX: this.tempEnd.realX, endY: this.tempEnd.realY };
      this.drawLineSpec(tempLine, this.activeTool, mapC, true);
    }
  }

  drawLineSpec(lineCoord, toolType, mapC, isPreview = false) {
    const s = mapC(lineCoord.startX, lineCoord.startY); const e = mapC(lineCoord.endX, lineCoord.endY);
    this.ctx.beginPath(); this.ctx.lineWidth = 1;
    const ext = ['midline', 'interpupillary', 'f-midline', 'commissural', 'd-midline', 'interpupillary-e', 'incisal-edge'];
    if (ext.includes(toolType)) {
        const dx = e.x - s.x; const dy = e.y - s.y; const len = Math.hypot(dx, dy);
        if(len > 0) { const nx = dx/len; const ny = dy/len; const m = 5000; this.ctx.moveTo(s.x - nx*m, s.y - ny*m); this.ctx.lineTo(s.x + nx*m, s.y + ny*m); }
        else { this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(e.x, e.y); }
    } else { this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(e.x, e.y); }
    if (isPreview) { this.ctx.strokeStyle = '#94a3b8'; this.ctx.setLineDash([5, 5]); }
    else { 
      this.ctx.setLineDash([]); 
      if(toolType === 'sline') this.ctx.strokeStyle = '#8b5cf6';
      else if(['emeasure', 'mmeasure', 'smeasure'].includes(toolType)) this.ctx.strokeStyle = '#3b82f6';
      else if(toolType === 'f-midline') { this.ctx.strokeStyle = '#06b6d4'; this.ctx.setLineDash([5,5]); }
      else if(toolType === 'd-midline') { this.ctx.strokeStyle = '#db2777'; this.ctx.setLineDash([5,5]); }
      else if(toolType === 'hbar-ref') { this.ctx.strokeStyle = '#10b981'; this.ctx.setLineDash([5,5]); }
      else if(toolType === 'hbar-bar') this.ctx.strokeStyle = '#f59e0b';
      else this.ctx.strokeStyle = '#ef4444'; 
    }
    this.ctx.stroke(); this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.beginPath(); this.ctx.arc(s.x, s.y, 4, 0, 7); this.ctx.fill();
    this.ctx.beginPath(); this.ctx.arc(e.x, e.y, 4, 0, 7); this.ctx.fill();
  }

  getLineLengthMm(lineName) {
      if (!this.lines[lineName]) return null;
      const l = this.lines[lineName];
      return (Math.sqrt(Math.pow(l.endX-l.startX,2)+Math.pow(l.endY-l.startY,2))*this.pxToMm).toFixed(1);
  }

  updateStats() {
    if (['frontal', 'lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound'].includes(this.phase)) FacialHandlers.updateStats(this);
    else if (this.phase === 'intraoral') DentalHandlers.updateStats(this);
    else if (this.phase === 'shade-take') ShadeHandlers.updateShadeStats(this);
  }

  calibrateShade(rX, rY) {
      if (!this.currentImage) return;
      const c = this.sampleColorAt(rX, rY);
      const sLab = ColorSpace.rgbToLab(c.r, c.g, c.b);
      const tId = this.currentCalibId || 'A2';
      const g = SHADE_GUIDES[this.currentShadeGuideId];
      const tS = g ? g.shades.find(sh => sh.id === tId) : null;
      if (tS) {
          const off = { l: tS.l - sLab.l, a: tS.a - sLab.a, b: tS.b - sLab.b };
          this.calibPoints.push({ id: tId, sampledRGB: c, idealLab: { l: tS.l, a: tS.a, b: tS.b }, offset: off, x: rX, y: rY });
          let sL = 0, sA = 0, sB = 0;
          this.calibPoints.forEach(p => { sL += p.offset.l; sA += p.offset.a; sB += p.offset.b; });
          this.shadeOffset = { l: sL/this.calibPoints.length, a: sA/this.calibPoints.length, b: sB/this.calibPoints.length };
          this.updateStats(); this.drawCanvas();
          this.showShadeToast(`${tId} としてプロットしました。`);
      }
  }

  initShadeGuide() {
      if (this.shadeGuideSelect) this.shadeGuideSelect.addEventListener('change', (e) => { this.currentShadeGuideId = e.target.value; this.renderShadePalette(); this.updateStats(); });
      if (this.shadePalette) this.shadePalette.addEventListener('click', (e) => {
          const btn = e.target.closest('.shade-btn'); if (!btn) return;
          this.shadePalette.querySelectorAll('.shade-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
          this.currentCalibId = btn.dataset.shade;
          const cal = this.card.querySelector('#tool-shade-calibrator');
          if (cal) { cal.checked = true; this.activeTool = 'shade-calibrator'; const con = this.shadePalette.closest('.palette-container'); if (con) con.classList.add('open'); }
      });
  }

  renderShadePalette() {
      if (!this.shadePalette) return; const g = SHADE_GUIDES[this.currentShadeGuideId]; if (!g) return;
      this.shadePalette.innerHTML = '';
      g.shades.forEach(s => {
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'shade-btn'; if (s.id === this.currentCalibId) btn.classList.add('active');
          btn.dataset.shade = s.id; btn.textContent = s.id;
          const rgb = ColorSpace.labToRgb(s.l, s.a, s.b); btn.style.setProperty('--shade-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
          this.shadePalette.appendChild(btn);
      });
  }

  showShadeToast(msg) {
      let t = document.getElementById('shade-toast');
      if (!t) { t = document.createElement('div'); t.id = 'shade-toast'; t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(37,99,235,0.9); color:white; padding:10px 20px; border-radius:30px; z-index:9999;'; document.body.appendChild(t); }
      t.textContent = msg; t.style.opacity = '1'; setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  prepareOffScreenCanvas() {
      if (!this.currentImage) return;
      if (AnalysisCard.lastRenderedImage === this.currentImage) return;
      
      const canvas = AnalysisCard.offScreenCanvas;
      const ctx = AnalysisCard.offScreenCtx;
      canvas.width = this.currentImage.width;
      canvas.height = this.currentImage.height;
      ctx.drawImage(this.currentImage, 0, 0);
      AnalysisCard.lastRenderedImage = this.currentImage;
  }

  sampleColorAt(rX, rY) {
      if (!this.currentImage) return { r: 0, g: 0, b: 0 };
      this.prepareOffScreenCanvas();
      const ctx = AnalysisCard.offScreenCtx;
      const data = ctx.getImageData(rX - 2, rY - 2, 5, 5).data;
      let r = 0, g = 0, b = 0; for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
      return { r: Math.round(r/25), g: Math.round(g/25), b: Math.round(b/25) };
  }

  updateShade(rX, rY) {
      const c = this.sampleColorAt(rX, rY);
      if (this.activeTool === 'shade-diff') {
          if (!this.shadeDiffA || (this.shadeDiffA && this.shadeDiffB)) { this.shadeDiffA = { x: rX, y: rY, ...c }; this.shadeDiffB = null; }
          else this.shadeDiffB = { x: rX, y: rY, ...c };
      } else this.lines['shadeSample'] = { x: rX, y: rY, ...c };
      this.updateStats(); this.drawCanvas();
  }
}
window.AnalysisCard = AnalysisCard;
