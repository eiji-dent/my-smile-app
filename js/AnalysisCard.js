/**
 * BaseAnalysisCard Class
 * Core engine for all analysis cards/units.
 * Handles: canvas, drag & drop, zoom/pan, tool management,
 * mouse/touch events, AI dispatch, and data export.
 * Phase-specific subclasses extend this class.
 */
class BaseAnalysisCard {
  constructor(cardElement) {
    this.card = cardElement;
    this.phase = cardElement.dataset.phase;
    
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
    this.isWaitingForAIClick = false; // 1クリック誘導AI待ち状態
    this.isDataSent = false; // 送信済みフラグ（初期値：非表示）
    this.tempStart = null;
    this.tempEnd = null;
    this.tempPoints = []; 
    
    this.pxToMm = 0.075; 
    
    // --- Landmarks State ---
    this._lines = {}; // Internal storage
    this.lines = new Proxy(this._lines, {
        set: (target, key, value) => {
            target[key] = value;
            this.updateToolbarStatus(); // Auto-update toolbar UI when data changes
            return true;
        },
        get: (target, key) => target[key]
    });

    this.calibBadge = cardElement.querySelector('.calibration-status-badge');

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
    if (!BaseAnalysisCard.offScreenCanvas) {
      BaseAnalysisCard.offScreenCanvas = document.createElement('canvas');
      BaseAnalysisCard.offScreenCtx = BaseAnalysisCard.offScreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    this.lastPanPt = null;
    this.imgRotation = 0; 

    this.initUI();
    this.initEventListeners();
    
    // Cache Loupe elements for performance
    this.loupeContainer = document.getElementById('loupe-container');
    this.loupeCanvas = document.getElementById('loupe-canvas');
    if (this.loupeCanvas) this.loupeCtx = this.loupeCanvas.getContext('2d', { alpha: false });
    if (this.fileInput) this.fileInput.value = ''; // Ensure clean state
  }



  initToolbar() {
    const mmPhases = ['lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound', 'intraoral'];
    const tSelector = this.card.querySelector('.tool-selector');
    if (tSelector && mmPhases.includes(this.phase)) {
      const calId = 'tool-calib-' + this.phase;
      if (!document.getElementById(calId)) {
          const rd = document.createElement('input'); rd.type = 'radio'; rd.name = 'tool-'+this.phase; rd.id = calId; rd.value = 'calib'; rd.className = 'tool-radio';
          const lb = document.createElement('label'); lb.htmlFor = calId; lb.className = 'tool-label'; 
          lb.innerHTML = '<i data-lucide="ruler"></i> 実寸キャリブ';
          tSelector.prepend(lb); tSelector.prepend(rd);
          if(window.lucide) window.lucide.createIcons({root: lb});
      }
    }
    this.toolRadios = this.card.querySelectorAll('.tool-radio');
    this.toolRadios.forEach(r => { r.checked = false; }); // 全解除（白の状態にする）
    this.activeTool = null;
    this.updateToolbarStatus();
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
  }

  prepareOffScreenCanvas() {
    if (!this.currentImage) return;
    const canvas = BaseAnalysisCard.offScreenCanvas;
    const ctx = BaseAnalysisCard.offScreenCtx;
    
    // Use original image dimensions
    canvas.width = this.currentImage.width;
    canvas.height = this.currentImage.height;
    
    ctx.save();
    // Move to center, rotate, and draw
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(this.imgRotation);
    ctx.drawImage(this.currentImage, -this.currentImage.width / 2, -this.currentImage.height / 2);
    ctx.restore();
    console.log("[BaseAnalysisCard] Offscreen canvas prepared for AI");
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
            this.updateStats(); // Ensure magnifier toggles
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
          } else { this.drawState = 'idle'; this.hideTooltip(); }
          this.updateStats();
          this.drawCanvas();
        });
      }

      const aiBtn = this.card.querySelector('.ai-analyze-btn');
      if (aiBtn) aiBtn.addEventListener('click', () => this.runAIAnalysis());

      const sendBtn = this.card.querySelector('.send-data-btn');
      if (sendBtn) sendBtn.addEventListener('click', () => this.sendAnalysisData());

      if (this.dropZone) {
          this.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
          this.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); this.dropZone.classList.remove('drag-over'); });
          this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) this.handleImage(e.dataTransfer.files[0]);
          });
      }
      if (this.fileInput) {
          console.log(`[AnalysisCard] Registered change listener for ${this.phase} fileInput`, this.fileInput);
          this.fileInput.addEventListener('change', (e) => {
            console.log(`[AnalysisCard] fileInput change detected for ${this.phase}`, e.target.files);
            if (e.target.files && e.target.files.length > 0) this.handleImage(e.target.files[0]);
          });
      }
      window.addEventListener('resize', () => { if (this.currentImage) this.resizeCanvas(); });
      if (this.canvas) {
          this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
          this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      }
      window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    this.initAdvancedListeners();
  }

  initAdvancedListeners() {
      if (this.canvas) {
          this.canvas.addEventListener('contextmenu', e => e.preventDefault());
          this.canvas.addEventListener('wheel', (e) => {
          if (!this.currentImage) return;
          e.preventDefault();
          this.panX -= e.deltaX; this.panY -= e.deltaY;
          this.constrainPan();
          this.drawCanvas();
      }, { passive: false });

      // --- Native iPad/Touch Support ---
      this.canvas.addEventListener('touchstart', (e) => {
          if (!this.currentImage || e.touches.length > 1) return;
          const coords = this.getMouseCoords(e);
          this.hoveredPoint = this.findHoverPoint(coords, true);
          
          if (this.hoveredPoint) {
              const isDrawingInProgress = (this.drawState !== 'idle' && this.drawState !== 'multi-point') || this.tempPoints.length > 0;
              if (!isDrawingInProgress) {
                  e.preventDefault(); // Start drag, stop scroll
                  this.draggingPoint = this.hoveredPoint;
                  this.updateMagnifier(e);
                  this.drawCanvas();
                  return;
              }
          }
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
          if (!this.currentImage || e.touches.length > 1) return;
          if (this.draggingPoint) {
              e.preventDefault();
              this.handleMouseMove(e);
          }
      }, { passive: false });

      this.canvas.addEventListener('touchend', (e) => {
          if (this.draggingPoint) {
              e.preventDefault();
              this.handleMouseUp(e);
          } else {
              const touch = e.changedTouches[0];
              const dx = touch.clientX - this.touchStartX;
              const dy = touch.clientY - this.touchStartY;
              if (Math.hypot(dx, dy) < 10) {
                  e.preventDefault(); // Stop synthetic ghost mousedown
                  this.handleMouseDown(e);
                  setTimeout(() => this.handleMouseUp(e), 50);
              }
          }
      }, { passive: false });

       // Other advanced interactions (rotation, sync, etc.)
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
             // --- トグル / リセット機能 ---
             if (this.activeTool === 'align-p3' || this.lines['align-p3']) {
                 this.imgRotation = 0; // 傾きを元に戻す
                 delete this.lines['align-p3']; // プロットを削除
                 this.deselectTool();
                 const indicator = this.card.querySelector('.alignment-indicator');
                 if (indicator) indicator.classList.add('hidden');
                 this.drawCanvas();
                 this.updateStats();
                 return;
             }

             const phase3Card = window.appCards.find(c => c.phase === 'e-midline');
             if (phase3Card && phase3Card.lines['interpupillary-e'] && phase3Card.lines['d-midline']) {
                 this.activeTool = 'align-p3';
                 this.drawState = 'idle'; // 最初は待機状態
                 this.tempPoints = [];
                 
                 const indicator = this.card.querySelector('.alignment-indicator');
                 if (indicator) {
                    const p3Pupil = phase3Card.lines['interpupillary-e'];
                    const p3Dental = phase3Card.lines['d-midline'];
                    const ang = window.AlignmentHelper ? 
                        (Math.atan2(p3Dental.endY-p3Dental.startY, p3Dental.endX-p3Dental.startX) - 
                         Math.atan2(p3Pupil.endY-p3Pupil.startY, p3Pupil.endX-p3Pupil.startX)) * 180/Math.PI : 0;
                    
                    const angVal = indicator.querySelector('.p3-angle-val');
                    if(angVal) angVal.textContent = Math.abs(ang).toFixed(1);

                    indicator.classList.remove('hidden');
                    const actions = indicator.querySelector('.align-actions');
                    if (actions) actions.classList.remove('hidden');
                    
                    // 「はい」ボタン
                    const yesBtn = indicator.querySelector('.align-yes-btn');
                    if (yesBtn && !yesBtn.hasListener) {
                        yesBtn.addEventListener('click', () => {
                            this.drawState = 'multi-point';
                            const p3AngleText = ang ? ` (基準角: ${Math.abs(ang).toFixed(1)}°)` : '';
                            this.showTooltip(window.AESTHETIC_CONSTANTS.STEPS.ALIGN_P3[0] + p3AngleText);
                            indicator.classList.add('hidden'); // ウィンドウ全体を隠す
                            this.drawCanvas();
                        });
                        yesBtn.hasListener = true;
                    }
                    // 「中止」ボタン
                    const cancelBtn = indicator.querySelector('.align-cancel-btn');
                    if (cancelBtn && !cancelBtn.hasListener) {
                        cancelBtn.addEventListener('click', () => {
                            this.deselectTool();
                            indicator.classList.add('hidden');
                            this.drawCanvas();
                        });
                        cancelBtn.hasListener = true;
                    }

                    if (window.lucide) window.lucide.createIcons({ root: indicator });
                 }
                 
                 this.drawCanvas();
             } else {
                 alert('Phase 3 (E音発音時) で「瞳孔間線」と「歯列正中」の両方がプロットされている必要があります。');
             }
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

       const vSlider = this.card.querySelector('.vertical-zoom-slider');
       if (vSlider) {
           vSlider.addEventListener('input', (e) => {
              this.zoomLevel = parseInt(e.target.value) / 100;
              if (this.zoomLevel <= 1.0) { this.panX = 0; this.panY = 0; }
              this.drawCanvas();
           });
       }

    this.constrainPan();
    }
  }

  handleMouseDown(e) {
        if (!this.currentImage) return;
        const coords = this.getMouseCoords(e);
        
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            this.isPanning = true;
            this.lastPanPt = { x: e.clientX, y: e.clientY };
            if (this.canvas) this.canvas.style.cursor = 'grabbing';
            return;
        }

        // --- Dragging existing points (High Priority) ---
        // 作図中の誤操作を防ぐため、以下の時のみドラッグを許可
        // 1. 待機状態 (idle) または 作図開始前 (multi-point かつ 0点)
        // 2. さらに、ツール選択中の場合はそのツールの点のみを許可、ツール未選択ならすべての点を許可
        const isDrawingInProgress = (this.drawState !== 'idle' && this.drawState !== 'multi-point') || this.tempPoints.length > 0;
        
        if (!isDrawingInProgress && this.hoveredPoint) {
            this.draggingPoint = this.hoveredPoint;
            if (this.canvas) this.canvas.style.cursor = 'grabbing';
            this.updateMagnifier(e);
            return;
        }

        if (!this.activeTool) return;

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
                   this.updatePxToMm(parseFloat(actualMm) / distPx);
                   this.showTooltip(`キャリブレーション完了（1px = ${this.pxToMm.toFixed(4)} mm）。他のツールを選択してください。`);
                } else {
                   this.updatePxToMm(0.075);
                   this.showTooltip(`キャリブレーションをリセットしました（1px = 0.075 mm）。`);
                }
                const statusEl = this.card.querySelector('.calib-status');
                if(statusEl) statusEl.textContent = `[1px = ${this.pxToMm.toFixed(4)}mm]`;
                this.tempStart = null; this.tempEnd = null;
                this.deselectTool();
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
               'papilla': { limits: 10, texts: s.PAPILLA, key: 'papilla' },
               'align-p3': { limits: 2, texts: s.ALIGN_P3, key: 'align-p3' }
           };
           const cfg = map[this.activeTool];
           if(!cfg) return;
           if (this.tempPoints.length < cfg.limits) {
              this.tempPoints.push({ x: coords.realX, y: coords.realY });
              if (this.tempPoints.length < cfg.limits) this.showTooltip(cfg.texts[this.tempPoints.length]);
              else {
                 if (this.activeTool === 'align-p3') {
                    this.executeAlignP3(this.tempPoints);
                 } else {
                    this.lines[cfg.key] = [...this.tempPoints];
                 }
                 this.tempPoints = [];
                 this.deselectTool();
                 this.showTooltip(cfg.texts[cfg.limits] || "完了しました");
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
            this.updateStats();
            return;
        }
        if (this.drawState === 'idle') {
          this.drawState = 'pt1-placed'; this.tempStart = coords; this.tempEnd = coords; this.drawCanvas();
        } else if (this.drawState === 'pt1-placed') {
          this.tempEnd = coords;
          this.lines[this.activeTool] = { startX: this.tempStart.realX, startY: this.tempStart.realY, endX: this.tempEnd.realX, endY: this.tempEnd.realY };
          const finishedTool = this.activeTool;
          this.deselectTool();
          if (finishedTool === 'hbar-ref') this.showTooltip(this.STEPS.HBAR_REF[2]);
          else if (finishedTool === 'hbar-bar') this.showTooltip(this.STEPS.HBAR_BAR[2]);
          this.tempStart = null; this.tempEnd = null; this.drawCanvas(); this.updateStats();
        }
    }

    handleMouseMove(e) {
        if (!this.currentImage) return;
        if (this.isPanning) {
            this.panX += e.clientX - this.lastPanPt.x;
            this.panY += e.clientY - this.lastPanPt.y;
            this.lastPanPt = { x: e.clientX, y: e.clientY };
            this.constrainPan();
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
            this.drawCanvas(); 
            this.updateStats();
            this.updateDragGuidance();
            return;
        }
        this.hoveredPoint = this.findHoverPoint(coords);
        const canDrag = (this.drawState === 'idle' || this.drawState === 'multi-point') && this.tempPoints.length === 0;
        this.canvas.style.cursor = (this.hoveredPoint && canDrag) ? 'grab' : 'crosshair';
        if (this.activeTool === 'shade-map' && this.shadeMapRect && this.shadeMapRect.active) {
            const dx = coords.realX - this.shadeMapRect.x1;
            const dy = coords.realY - this.shadeMapRect.y1;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            this.shadeMapRect.x2 = this.shadeMapRect.x1 + (dx >= 0 ? side : -side);
            this.shadeMapRect.y2 = this.shadeMapRect.y1 + (dy >= 0 ? side : -side);
            this.drawCanvas();
            this.updateStats();
        }
        if (this.drawState === 'multi-point' && this.tempPoints.length > 0) { this.tempEnd = coords; this.drawCanvas(); }
        if (this.drawState === 'pt1-placed') { this.tempEnd = coords; this.drawCanvas(); }
    }

    handleMouseUp(e) {
        if (this.shadeMapRect && this.shadeMapRect.active) {
            this.shadeMapRect.active = false; this.shadeMapRect.finalized = true;
            this.drawCanvas(); this.updateStats();
        }
        if (this.isPanning) {
            this.isPanning = false;
            this.draggingPoint = null;
            if(this.canvas) this.canvas.style.cursor = 'crosshair';
        }
        if (this.draggingPoint) {
            this.draggingPoint = null;
            this.hideTooltip();
            if (this.canvas) this.canvas.style.cursor = this.hoveredPoint ? 'grab' : 'crosshair';
        }
    }

  constrainPan() {
    if (!this.currentImage) return;
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
    const imgW = this.currentImage.width * scale;
    const imgH = this.currentImage.height * scale;
    
    // キャンバス内に最低限残すマージン (ピクセル)
    const margin = 100;
    
    // 画像の端が反対側のマージンを超えないように制限
    const limitX = (this.canvas.width / 2) + (imgW / 2) - margin;
    const limitY = (this.canvas.height / 2) + (imgH / 2) - margin;
    
    this.panX = Math.max(-limitX, Math.min(this.panX, limitX));
    this.panY = Math.max(-limitY, Math.min(this.panY, limitY));
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
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">AIエンジンの準備中...</span>';
      this.card.classList.add('ai-scanning');
      
      try {
          console.log(`Dispatching AI analysis for phase: ${this.phase}`);
          this.prepareOffScreenCanvas();
          const canvas = BaseAnalysisCard.offScreenCanvas;

          let result = { success: false, message: "このフェーズにはまだ対応していません。" };

          // --- AI Engine Dispatcher ---
          if (this.phase === 'frontal') {
              // Phase 1: Keep as is (Standard FaceLandmarker)
              const landmarker = await window.initFaceLandmarker();
              const mpResult = landmarker.detect(canvas);
              if (mpResult && mpResult.faceLandmarks?.length > 0) {
                  this.applyAILandmarks(mpResult);
                  result = { success: true, message: "正面顔貌の計測が完了しました。" };
              }
          } else if (this.phase === 'lateral' && window.Phase2Engine) {
              result = await window.Phase2Engine.analyze(this, canvas);
              if (result.success && result.landmarks) {
                  this.lateralLandmarks = result.landmarks;
              }
          } else if (this.phase === 'e-midline' && window.Phase3Engine) {
              result = await window.Phase3Engine.analyze(this, canvas);
          } else if (this.phase === 'e-sound' && window.Phase4Engine) {
              result = await window.Phase4Engine.analyze(this, canvas);
          } else if (this.phase === 's-sound' && window.Phase5Engine) {
              result = await window.Phase5Engine.analyze(this, canvas);
          } else if (this.phase === 'm-sound' && window.Phase6Engine) {
              result = await window.Phase6Engine.analyze(this, canvas);
          } else if (this.phase === 'fv-sound' && window.Phase7Engine) {
              result = await window.Phase7Engine.analyze(this, canvas);
          } else if ((this.phase === 'golden-prop' || this.phase === 'intraoral') && window.Phase8Engine) {
              result = await window.Phase8Engine.analyze(this, canvas);
          }

          if (result.success) {
              this.showTooltip(result.message || "計測が完了しました。");
              this.drawCanvas(); // Force redraw with new landmarks
          } else if (result.message) {
              alert(result.message);
          }

      } catch (err) {
          console.error("Specialized AI Error:", err); 
          alert("計測中にエラーが発生しました：\n" + (err.message || "不明なエラー"));
      } finally {
          aiBtn.disabled = false; aiBtn.innerHTML = originalHTML;
          this.card.classList.remove('ai-scanning');
          this.drawState = 'idle';
          if (window.lucide) window.lucide.createIcons({ root: aiBtn });
      }
  }

  /**
   * FaceLandmarker(正面・E音等)の結果を各ランドマークに適用
   */
  applyAILandmarks(result) {
      if (!result || !result.faceLandmarks || !result.faceLandmarks[0]) return;
      const landmarks = result.faceLandmarks[0];
      this.applyLandmarksToPlots(landmarks, this.currentImage.width, this.currentImage.height);
  }

  applyLateralLandmarks(pts) {
      if (!pts) return;
      this.lines.eLine = [pts.prn, pts.pg, pts.ls, pts.li];
      this.lines.nla = [pts.col, pts.sn, pts.ls];
      this.lines.convexity = [pts.g, pts.sn, pts.pg];
      this.updateStats();
      this.drawCanvas();
  }



  /**
   * Phase 8の歯列正中プロットを基に、Phase 3の基準角を再現する回転を適用する
   */
  executeAlignP3(pts) {
      if (!window.appCards) return;
      const phase3Card = window.appCards.find(c => c.phase === 'e-midline');
      if (!phase3Card) return alert('Phase 3 (E音発音時) のカードが見つかりません。');

      const pupil = phase3Card.lines['interpupillary-e'];
      const dental = phase3Card.lines['d-midline'];

      if (!pupil || !dental) {
          return alert('Phase 3 で「瞳孔間線」と「歯列正中」の両方をプロットしてから実行してください。');
      }

      if (window.AlignmentHelper) {
          this.imgRotation = window.AlignmentHelper.calculateRotationFromP3(pupil, dental, pts);
          this.lines['align-p3'] = [...pts]; // Save points for persistent display
          this.drawCanvas();
          this.updateStats();
          
          const indicator = this.card.querySelector('.alignment-indicator');
          if (indicator) indicator.classList.add('hidden');
          
          console.log(`Phase 8 alignment executed. New rotation: ${this.imgRotation} rad`);
      } else {
          console.error("AlignmentHelper not found");
      }
  }

  deselectTool() {
      this.activeTool = null;
      this.drawState = 'idle';
      this.toolRadios.forEach(r => { r.checked = false; });
      this.updateToolbarStatus();
  }

  getToolDataKey(toolValue) {
      if (!toolValue) return null;
      const map = {
          'vertical-proportions': 'verticalProportions',
          'eline': 'eLine',
          'wl-ratio': 'wlRatio',
          'red-prop': 'redProp',
          'pink-esth': 'pinkEsth',
          'smile-arc': 'smileArc',
          'corridor': 'corridor',
          'gingival': 'gingival',
          'axial-incl': 'axialIncl',
          'papilla': 'papilla'
      };
      return map[toolValue] || toolValue;
  }

  findHoverPoint(coords, isTouch = false) {
      const baseThreshold = isTouch ? 30 : 15;
      const threshold = baseThreshold / coords.scale; 
      for(let i=0; i<this.tempPoints.length; i++) {
          if(Math.hypot(this.tempPoints[i].x - coords.realX, this.tempPoints[i].y - coords.realY) < threshold) {
              return { key:'tempPoints', index:i, pt:this.tempPoints[i], mode:'multi' };
          }
      }
      for (const key in this.lines) {
          // プロットツール選択中の場合、そのツール以外の点は無視する（誤操作防止）
          if (this.activeTool) {
              const activeKey = this.getToolDataKey(this.activeTool);
              if (key !== activeKey && key !== 'shadeSample' && key !== 'shadeDiffA' && key !== 'shadeDiffB') continue;
          }
          const v = this.lines[key];
          if (key === 'shadeSample' && v && this.activeTool === 'shade-picker' && Math.hypot(v.x - coords.realX, v.y - coords.realY) < threshold) {
              return { key:'shadeSample', pt:v, mode:'shade' };
          }
          if(Array.isArray(v)) {
              for(let i=0; i<v.length; i++) {
                  if(Math.hypot(v[i].x - coords.realX, v[i].y - coords.realY) < threshold) return { key, index:i, pt:v[i], mode:'array' };
              }
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

  /**
   * ドラッグ中のプロットに応じたガイダンスを表示
   */
  updateDragGuidance() {
    if (!this.draggingPoint) return;
    const dp = this.draggingPoint;
    const s = window.AESTHETIC_CONSTANTS.STEPS;
    
    // ツール名とステップ配列の紐付け
    const toolStepMap = {
        'verticalProportions': s.PROPORTION,
        'eLine': s.ELINE,
        'nla': s.NLA,
        'convexity': s.CONVEXITY,
        'wlRatio': s.WL,
        'redProp': s.RED,
        'pinkEsth': s.PINK,
        'smileArc': s.ARC,
        'corridor': s.CORRIDOR,
        'gingival': s.GINGIVAL,
        'axialIncl': s.AXIAL,
        'papilla': s.PAPILLA,
        'interpupillary': ['1点目: 左瞳孔', '2点目: 右瞳孔'],
        'midline': ['1点目: 眉間', '2点目: 頤'],
        'commissural': ['1点目: 左口角', '2点目: 右口角'],
        'f-midline': ['1点目: 眉間', '2点目: 頤'],
        'd-midline': ['1点目: 上顎歯列正中上端', '2点目: 下端'],
        'interpupillary-e': ['1点目: 左瞳孔', '2点目: 右瞳孔']
    };

    const steps = toolStepMap[dp.key];
    if (steps) {
        let idx = dp.index;
        if (idx === 'start') idx = 0;
        if (idx === 'end') idx = 1;
        if (steps[idx]) {
            this.showTooltip(steps[idx]);
            return;
        }
    }

    // ステップ固有の説明がない場合の汎用名
    const nameMap = {
        'verticalProportions': '垂直バランス',
        'eLine': 'E-Line',
        'nla': '鼻唇角',
        'convexity': '側貌凸型度',
        'wlRatio': 'W/L比',
        'redProp': 'RED Proportions',
        'pinkEsth': 'Pink Esthetic',
        'smileArc': 'Smile Arc',
        'corridor': 'バッカルコリドー',
        'gingival': 'ガミースマイル/E位',
        'axialIncl': '歯軸傾斜',
        'papilla': '歯間乳頭',
        'interpupillary': '瞳孔間線',
        'midline': '顔貌正中線',
        'f-midline': '顔貌正中線',
        'd-midline': '歯列正中線',
        'commissural': '口角間線',
        'interpupillary-e': '瞳孔間線'
    };

    const toolName = nameMap[dp.key] || 'プロット';
    this.showTooltip(toolName);
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

  applyLandmarksToPlots(landmarks, imgW, imgH) {
      const getPt = (idx) => {
          if (!landmarks[idx]) return { x: 0, y: 0 };
          return { x: landmarks[idx].x * imgW, y: landmarks[idx].y * imgH };
      };

      if (this.phase === 'frontal' || this.phase === 'e-midline') {
          // 虹彩(468, 473)が取得できない場合のフォールバックとして目の中央付近を使用
          const rE = landmarks[468] ? getPt(468) : getPt(386); // 右瞳
          const lE = landmarks[473] ? getPt(473) : getPt(159); // 左瞳
          const mT = getPt(9);   // 眉間 (Midline Top) - インデックス 9番(眉の間)に変更
          const mB = getPt(152); // 頤 (Midline Bottom)
          const lM = getPt(61);  // 左口角
          const rM = getPt(291); // 右口角

          if (this.phase === 'frontal') {
              this.lines.interpupillary = { startX: lE.x, startY: lE.y, endX: rE.x, endY: rE.y };
              this.lines.midline = { startX: mT.x, startY: mT.y, endX: mB.x, endY: mB.y };
              this.lines.commissural = { startX: lM.x, startY: lM.y, endX: rM.x, endY: rM.y };
              
              // 垂直6点計測 (Vertical Proportions)
              this.lines.verticalProportions = [
                  getPt(10),   // 1. 髪際 (Hairline)
                  getPt(9),    // 2. 眉間 (Glabella)
                  { x: (lE.x + rE.x) / 2, y: (lE.y + rE.y) / 2 }, // 3. 瞳孔間線レベル
                  getPt(2),    // 4. 鼻下点 (Subnasale) - ユーザーの希望により鼻の先端(index 2)に戻す
                  getPt(13),   // 5. 口裂点 (Stomion)
                  getPt(152)   // 6. 頤下点 (Menton)
              ];
          } else if (this.phase === 'e-midline') {
              this.lines['interpupillary-e'] = { startX: lE.x, startY: lE.y, endX: rE.x, endY: rE.y };
              this.lines['f-midline'] = { startX: mT.x, startY: mT.y, endX: mB.x, endY: mB.y };
          }
      } else if (this.phase === 'e-sound') {
          const lc = getPt(61), rc = getPt(291), ut = getPt(13), lt = getPt(14);
          this.lines.smileArc = [{x:(rc.x+ut.x)/2, y:(rc.y+ut.y)/2}, ut, {x:(lc.x+ut.x)/2, y:(lc.y+ut.y)/2}, {x:(rc.x+lt.x)/2, y:(rc.y+lt.y)/2+10}, lt, {x:(lc.x+lt.x)/2, y:(lc.y+lt.y)/2+10}];
          this.lines.corridor = [rc, {x:rc.x-20, y:rc.y}, {x:lc.x+20, y:lc.y}, lc];
          this.lines.gingival = [getPt(164), {x:ut.x, y:ut.y-5}, ut, lt];
      } 
      this.updateStats(); 
      this.drawState = 'idle'; // AI実行後も既存プロットを動かせるようにする
      this.drawCanvas();
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
        this._lines = {}; 
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
        BaseAnalysisCard.lastRenderedImage = null;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  resizeCanvas() {
    if (!this.dropZone || !this.canvas) return;
    const rect = this.dropZone.getBoundingClientRect();
    
    // Set internal canvas resolution to match its display size
    // Note: We could use devicePixelRatio here, but for simplicity and performance 
    // with current drawing logic, matching the bounding rect is safer.
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.drawCanvas();
  }

  getMouseCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    let cX, cY;
    
    // Support both mouse and touch events
    if (e.touches && e.touches.length > 0) {
        cX = e.touches[0].clientX;
        cY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        cX = e.changedTouches[0].clientX;
        cY = e.changedTouches[0].clientY;
    } else {
        cX = e.clientX;
        cY = e.clientY;
    }

    const mX = (cX - rect.left) * (this.canvas.width / rect.width);
    const mY = (cY - rect.top) * (this.canvas.height / rect.height);
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
    const xO = (this.canvas.width / 2) + this.panX; const yO = (this.canvas.height / 2) + this.panY;
    const dx = mX - xO; const dy = mY - yO;
    const cos = Math.cos(-this.imgRotation); const sin = Math.sin(-this.imgRotation);
    const rx = dx * cos - dy * sin; const ry = dx * sin + dy * cos;
    const realX = rx / scale + (this.currentImage.width / 2); const realY = ry / scale + (this.currentImage.height / 2);
    return { realX, realY, mouseX: mX, mouseY: mY, scale, xOffset: xO, yOffset: yO };
  }

  sampleColorAt(x, y) {
      if (!this.currentImage) return { r: 255, g: 255, b: 255 };
      if (!BaseAnalysisCard.sampleCanvas) {
          BaseAnalysisCard.sampleCanvas = document.createElement('canvas');
          BaseAnalysisCard.sampleCanvas.width = 1;
          BaseAnalysisCard.sampleCanvas.height = 1;
          BaseAnalysisCard.sampleCtx = BaseAnalysisCard.sampleCanvas.getContext('2d', { willReadFrequently: true });
      }
      const sx = Math.max(0, Math.min(Math.round(x), this.currentImage.width - 1));
      const sy = Math.max(0, Math.min(Math.round(y), this.currentImage.height - 1));
      BaseAnalysisCard.sampleCtx.clearRect(0, 0, 1, 1);
      BaseAnalysisCard.sampleCtx.drawImage(this.currentImage, sx, sy, 1, 1, 0, 0, 1, 1);
      const data = BaseAnalysisCard.sampleCtx.getImageData(0, 0, 1, 1).data;
      return { r: data[0], g: data[1], b: data[2] };
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
      else if(toolType === 'hbar-bar') this.ctx.strokeStyle = 'var(--warning)';
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
    const ph = this.phase || '';
    if (['frontal', 'lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound'].includes(ph) || ph.includes('horizontal-bar')) {
        FacialHandlers.updateStats(this);
    } else if (ph === 'intraoral') DentalHandlers.updateStats(this);
    else if (this.phase === 'shade-take') ShadeHandlers.updateShadeStats(this);
    this.updateToolbarStatus();
  }

  /**
   * Updates the pixel-to-mm scale and synchronizes it with other cards 
   * IF their scale is currently at the default value.
   */
  updatePxToMm(val, skipSync = false) {
    this.pxToMm = val;
    
    // Update visual badge in card header
    if (this.calibBadge) {
      if (val === 0.075) {
        this.calibBadge.textContent = '';
        this.calibBadge.classList.add('hidden');
      } else {
        this.calibBadge.textContent = `1mm = ${(1/val).toFixed(1)}px`;
        this.calibBadge.classList.remove('hidden');
      }
    }

    // Update any individual tool status text
    const statusEl = this.card.querySelector('.calib-status');
    if (statusEl) statusEl.textContent = `[1px = ${this.pxToMm.toFixed(4)}mm]`;

    // Synchronization removed: Each card now manages its own scale independently
    
    // Trigger redraw for current measurements
    this.updateStats();
  }

  updateToolbarStatus() {
    if (!this.toolRadios) return;
    this.toolRadios.forEach(radio => {
      const label = this.card.querySelector(`label[for="${radio.id}"]`);
      if (!label) return;
      const val = radio.value;
      const L = this.lines || {};
      let isDone = false;
      switch(val) {
        case 'interpupillary': isDone = !!L.interpupillary; break;
        case 'midline': isDone = !!L.midline; break;
        case 'commissural': isDone = !!L.commissural; break;
        case 'vertical-proportions': isDone = (L.verticalProportions && L.verticalProportions.length === 6); break;
        case 'eline': isDone = (L.eLine && L.eLine.length === 4); break;
        case 'nla': isDone = (L.nla && L.nla.length === 3); break;
        case 'convexity': isDone = (L.convexity && L.convexity.length === 3); break;
        case 'f-midline': isDone = !!L['f-midline']; break;
        case 'd-midline': isDone = !!L['d-midline']; break;
        case 'interpupillary-e': isDone = !!L['interpupillary-e']; break;
        case 'incisal-edge': isDone = !!L['incisal-edge']; break;
        case 'smile-arc': isDone = (L.smileArc && L.smileArc.length === 6); break;
        case 'corridor': isDone = (L.corridor && L.corridor.length === 4); break;
        case 'gingival': isDone = (L.gingival && L.gingival.length === 4); break;
        case 'shade-sample': isDone = !!L.shadeSample; break;
        case 'shade-diff': isDone = !!(this.shadeDiffA && this.shadeDiffB); break;
        case 'calib': isDone = this.pxToMm !== 0.075; break;
        // 追加: 技工ツール & 各種計測ツール
        case 'hbar-ref': isDone = !!L['hbar-ref']; break;
        case 'hbar-bar': isDone = !!L['hbar-bar']; break;
        case 'wl-ratio': isDone = (L.wlRatio && L.wlRatio.length === 8); break;
        case 'red-prop': isDone = (L.redProp && L.redProp.length === 7); break;
        case 'pink-esth': isDone = (L.pinkEsth && L.pinkEsth.length === 6); break;
        case 'axial-incl': isDone = (L.axialIncl && L.axialIncl.length === 14); break;
        case 'papilla': isDone = (L.papilla && L.papilla.length === 10); break;
        case 'mmeasure': isDone = !!L.mmeasure; break;
        case 'smeasure': isDone = !!L.smeasure; break;
        case 'fvmeasure': isDone = !!L.fvmeasure; break;
      }
      if (isDone) label.classList.add('completed');
      else label.classList.remove('completed');
    });
  }


  // --- Data Export Methods (for AI Training) ---
  
  // --- Data Export Methods (for AI Training) ---
  
  /**
   * Returns structured plot data for the current phase.
   */
  getPlotData() {
      if (!this.currentImage) return null;
      return {
          phase: this.phase,
          imageWidth: this.currentImage.width,
          imageHeight: this.currentImage.height,
          pxToMm: this.pxToMm,
          landmarks: JSON.parse(JSON.stringify(this.lines)), // Deep copy
          metrics: this.lastStats || {} // Use cached stats if available
      };
  }

  /**
   * Captures the current image as a DataURL (Base64). 
   * Useful for bundling images into a JSON dataset.
   * @param {number} maxSize - Maximum dimension (width or height) to resize to.
   */
  async getImageDataURL(maxSize = 1024) {
      if (!this.currentImage) return null;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = this.currentImage.width;
      let height = this.currentImage.height;
      
      if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width *= ratio;
          height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(this.currentImage, 0, 0, width, height);
      
      return canvas.toDataURL('image/jpeg', 0.85); // JPEG format for better compression
  }

  /**
   * Sends analysis data with a 2-step confirmation modal
   */
  /**
   * 解析データをサーバーへ送信（学習データ自動収集）
   */
  async sendAnalysisData() {
      if (!this.currentImage) return alert("計測する画像がありません。");
      
      // 確認ダイアログを追加
      if (!confirm("プロットは正確ですか？\nこのまま計測を確定してもよろしいですか？")) {
          return; // キャンセルされた場合は中断
      }

      const sendBtn = this.card.querySelector('.send-data-btn');
      if (sendBtn) sendBtn.disabled = true;

      // 1. 即座に最新の計算結果を画面（DOM）に表示
      this.isDataSent = true;
      this.updateStats();

      // 2. トースト通知を表示
      this.showToast("計測データを送信しました");

      try {
          // 3. 元画像（無加工）のBase64取得
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = this.currentImage.width;
          tmpCanvas.height = this.currentImage.height;
          const tmpCtx = tmpCanvas.getContext('2d');
          tmpCtx.drawImage(this.currentImage, 0, 0);
          const base64Image = tmpCanvas.toDataURL('image/jpeg', 0.9); // サイズ抑制のためJPEG

          // 4. 解析計算値の抽出（DOMからテキストとして取得）
          const statsObj = {};
          const statItems = this.card.querySelectorAll('.stat-value, .cant-value, .dev-value, .prop-thirds-value, .prop-willis-value, .prop-lower-value, [class$="-val"]');
          statItems.forEach(el => {
              // クラス名から主ラベルを推測
              const label = el.className.split(' ').find(c => c.includes('-value') || c.includes('-val')) || 'stat';
              statsObj[label] = el.textContent.trim();
          });

          const payload = {
              phase: this.phase,
              image: base64Image,
              lines: this.lines,
              stats: statsObj,
              timestamp: new Date().toISOString()
          };

          // 5. バックグラウンドで送信（Vercel Serverless Function 経由）
          fetch('/api/save-training-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          }).then(res => {
              if (res.ok) {
                  console.log("Data successfully sent to API");
                  // 送信成功後、デバッグパネルが表示されていれば最新の統計に更新
                  if (this.card.querySelector('.ai-debug-panel')) {
                      this.showAiDebugInfoAsync(this.lastFeatures || {}, "Data Sent", "Recent");
                  }
              } else {
                  console.error("Server save failed", res.status);
                  alert("サーバーへの保存に失敗しました。環境変数や接続を確認してください。");
              }
          }).catch(e => {
              console.error("Data send failed", e);
              alert("送信エラーが発生しました。ローカルサーバーが起動しているか確認してください。");
          });

      } catch (err) {
          console.error("Preparation for send failed", err);
      }
  }

  showToast(message) {
      let container = document.getElementById('toast-container');
      if (!container) {
          container = document.createElement('div');
          container.id = 'toast-container';
          document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = 'toast-item';
      toast.innerHTML = `<i data-lucide="check-circle"></i> <span>${message}</span>`;
      container.appendChild(toast);
      if (window.lucide) lucide.createIcons({ root: toast });

      setTimeout(() => {
          toast.classList.add('fade-out');
          setTimeout(() => toast.remove(), 500);
      }, 3000);
  }

  /**
   * Visualizes the AI's internal representation of the image and checks the DB.
   */
  async showAiDebugInfoAsync(features, score, matchId) {
      if (!features) return;
      
      let debugPanel = this.card.querySelector('.ai-debug-panel');
      if (!debugPanel) {
          debugPanel = document.createElement('div');
          debugPanel.className = 'ai-debug-panel';
          debugPanel.style.cssText = `
              margin-top: 15px; padding: 15px; background: #1e293b; color: #10b981; 
              border-radius: 8px; font-family: monospace; font-size: 0.8rem;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); word-wrap: break-word;
          `;
          const contentArea = this.card.querySelector('.card-content');
          contentArea.appendChild(debugPanel);
      }

      let html = `<h4 style="color: #60a5fa; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 5px;">🤖 AI Visualizer & DB State</h4>`;
      
      html += `<div style="display: flex; flex-wrap: wrap; gap: 20px;">`;
      
      // --- Column 1: Current Image Data ---
      html += `<div style="flex: 1; min-width: 250px;">`;
      html += `<strong style="color:#f8fafc">【Current Query Image】</strong><br>`;
      if (features.visualHash) {
          html += `Visual Fingerprint:<br>`;
          const rawHash = features.visualHash;
          for (let i=0; i<8; i++) {
              html += `<span style="color:#cbd5e1; background:#334155; padding:2px; margin:1px; display:inline-block">${rawHash.substr(i*8, 8)}</span><br>`;
          }
      } else {
          html += `<strong style="color:#ef4444;">No Visual Fingerprint extracted!</strong><br>`;
      }
      html += `<br><strong>Latest Match Score:</strong> <span style="color:#fbbf24">${score !== undefined ? score : 'N/A'}</span>`;
      html += `</div>`;

      // --- Column 2: Database Check ---
      html += `<div style="flex: 1; min-width: 250px;">`;
      html += `<strong style="color:#f8fafc">【Cloud DB (Recent 3 Saves)】</strong><br>`;
      
      try {
          if (window.db) {
              const snap = await window.db.collection('analyses').where('phase', '==', this.phase).limit(15).get();
              if (snap.empty) {
                  html += `<span style="color:#94a3b8">No cases found in DB.</span><br>`;
              } else {
                  // Sort in JS
                  const docs = snap.docs.sort((a, b) => {
                      const ta = a.data().timestamp?.seconds || 0;
                      const tb = b.data().timestamp?.seconds || 0;
                      return tb - ta;
                  }).slice(0, 3); // Take top 3

                  docs.forEach(doc => {
                      const d = doc.data();
                      const hasHash = d.features && d.features.visualHash;
                      const isMatch = hasHash && d.features.visualHash === features.visualHash;
                      const hasPlots = d.results?.landmarks ? "YES" : "NO";
                      
                      html += `<div style="padding: 5px; margin-bottom: 5px; border-left: 3px solid ${isMatch ? '#10b981' : '#475569'}; background: #0f172a;">`;
                      html += `ID: ${doc.id.substring(0,6)}... | Plots: <strong style="color:${hasPlots==='YES'?'#10b981':'#ef4444'}">${hasPlots}</strong><br>`;
                      html += `Hash: ${hasHash ? (isMatch ? "MATCH!" : "Different") : "Missing"}<br>`;
                      if(isMatch && hasPlots === 'NO') {
                          html += `<span style="color:#ef4444; font-size:0.75rem;">(Skipped by AI: No plots saved)</span>`;
                      }
                      html += `</div>`;
                  });
              }
          }
      } catch (e) {
          html += `<span style="color:#ef4444">DB Error: ${e.message}</span>`;
      }
      html += `</div>`;
      
      // --- Column 3: AI Stats Debug ---
      html += `<div style="flex: 1; min-width: 250px;">`;
      html += `<strong style="color:#f8fafc">【Learning Progress Stats】</strong><br>`;
      try {
          if (window.IntelligenceService) {
              const counts = await window.IntelligenceService.getPhaseCounts();
              const myCount = counts[this.phase] || 0;
              html += `Phase (${this.phase}): <strong style="color:#10b981">${myCount}</strong><br>`;
              html += `<span style="color:#94a3b8; font-size:0.75rem;">Raw DB Aggregation:</span><br>`;
              Object.keys(counts).forEach(k => {
                  html += `<span style="color:#cbd5e1">- ${k}: ${counts[k]}</span><br>`;
              });
          }
      } catch(e) {
          html += `<span style="color:#ef4444">Stats Error: ${e.message}</span>`;
      }
      html += `</div>`;

      html += `</div>`;

      debugPanel.innerHTML = html;
  }
  // Static cache for offscreen canvas (shared across all subclass instances)
  static get offScreenCanvas() { return BaseAnalysisCard._offScreenCanvas; }
  static set offScreenCanvas(v) { BaseAnalysisCard._offScreenCanvas = v; }
  static get offScreenCtx() { return BaseAnalysisCard._offScreenCtx; }
  static set offScreenCtx(v) { BaseAnalysisCard._offScreenCtx = v; }
  static get lastRenderedImage() { return BaseAnalysisCard._lastRenderedImage; }
  static set lastRenderedImage(v) { BaseAnalysisCard._lastRenderedImage = v; }
}
window.BaseAnalysisCard = BaseAnalysisCard;
