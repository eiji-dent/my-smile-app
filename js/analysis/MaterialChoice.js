window.MaterialChoice = {
    // Core Elements
    canvasA: null, canvasB: null,
    ctxA: null, ctxB: null,
    offCanvasA: null, offCanvasB: null,
    
    // State (4 Points for Normalization)
    imageA: null, imageB: null,
    refA: null, targetA: null,
    refB: null, targetB: null,
    
    // UI State
    zoomLevel: 1.0, panX: 0, panY: 0,
    isPanning: false,
    draggingPoint: null, // Track which point is being moved
    dragType: '',        // 'a' or 'b'
    dragKind: '',        // 'ref' or 'target'
    lastPanPt: { x: 0, y: 0 },
    initialized: false,

    // Step-by-step plotting guide
    // 0: Wait image | 1: Pick Ref A | 2: Pick Target A | 3: Pick Ref B | 4: Pick Target B | 5: Done
    plottingStep: 1, 

    /**
     * Initializes the precision analysis engine
     */
    init() {
        this.container = document.getElementById('chapter-material');
        if (!this.container) return;

        this.canvasA = document.getElementById('material-canvas-a');
        this.canvasB = document.getElementById('material-canvas-b');
        if (!this.canvasA || !this.canvasB) return;

        this.ctxA = this.canvasA.getContext('2d', { willReadFrequently: true });
        this.ctxB = this.canvasB.getContext('2d', { willReadFrequently: true });

        // Buffers for exact L*a*b* sampling
        this.offCanvasA = document.createElement('canvas');
        this.offCtxA = this.offCanvasA.getContext('2d', { willReadFrequently: true });
        this.offCanvasB = document.createElement('canvas');
        this.offCtxB = this.offCanvasB.getContext('2d', { willReadFrequently: true });

        this.scoreEl = document.getElementById('material-score');
        this.tpEl = document.getElementById('material-tp');
        this.recommendationEl = document.getElementById('material-recommendation');
        this.guideEl = document.getElementById('plotting-guide');
        this.rightGuideEl = document.getElementById('aesthetic-explanation'); // Global right guide
        this.zoomSlider = document.getElementById('material-zoom-slider');
        
        this.loupeCanvas = document.getElementById('loupe-canvas');
        if (this.loupeCanvas) this.loupeCtx = this.loupeCanvas.getContext('2d');

        this.setupEventListeners();
        this.updateStatusIndicator('ready');
        this.updateGuide();
        this.initialized = true;
        
        requestAnimationFrame(() => this.redraw());
        console.log("MaterialChoice: 4-Point Normalization Sync Enabled.");
    },

    setupEventListeners() {
        // Dynamic Uploads
        const triggers = this.container.querySelectorAll('.btn-upload-trigger');
        triggers.forEach(trig => {
            const slot = trig.dataset.slot;
            const input = trig.querySelector('.file-input');
            trig.onclick = (e) => { if (e.target !== input) input.click(); };
            input.onchange = (e) => { if (e.target.files[0]) this.handleUpload(e.target.files[0], slot); };
        });

        // Click logic for A and B
        ['a', 'b'].forEach(type => {
            const item = document.getElementById(`material-item-${type}`);
            if (!item) return;

            item.onmousedown = (e) => {
                const img = type === 'a' ? this.imageA : this.imageB;
                if (!img) {
                    const bt = this.container.querySelector(`.btn-upload-trigger[data-slot="${type.toUpperCase()}"]`);
                    if (bt) bt.click();
                } else {
                    this.handleMouseDown(e, type);
                }
            };

            item.onmousemove = (e) => this.handleMouseMove(e, type);
            window.addEventListener('mouseup', () => this.handleMouseUp());
            item.onmouseleave = () => { this.hideLoupe(); };
            
            const cv = document.getElementById(`material-canvas-${type}`);
            if (cv) cv.oncontextmenu = (e) => e.preventDefault();
        });

        if (this.zoomSlider) {
            this.zoomSlider.oninput = (e) => {
                this.zoomLevel = parseInt(e.target.value) / 100;
                this.redraw();
            };
        }

        const rst = this.container.querySelector('.btn-reset');
        if (rst) rst.onclick = (e) => { e.preventDefault(); this.reset(); };
    },

    handleUpload(file, slot) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const s = slot.toLowerCase();
                if (s === 'a') {
                    this.imageA = img;
                    this.offCanvasA.width = img.width; this.offCanvasA.height = img.height;
                    this.offCtxA.drawImage(img, 0, 0);
                    document.getElementById('material-item-a').classList.add('has-image');
                } else {
                    this.imageB = img;
                    this.offCanvasB.width = img.width; this.offCanvasB.height = img.height;
                    this.offCtxB.drawImage(img, 0, 0);
                    document.getElementById('material-item-b').classList.add('has-image');
                }
                this.checkStatus(); this.redraw();
                if (window.lucide) window.lucide.createIcons();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    updateGuide() {
        let text = "";
        let rightText = "";
        switch(this.plottingStep) {
            case 1: 
                text = "画像A：背景（口腔内黒）を選択"; 
                rightText = "【マテリアル選択】 まず、画像A（左）の口腔内の最も暗い部分をプロットして基準黒を設定してください。";
                break;
            case 2: 
                text = "画像A：計測点を選択"; 
                rightText = "【マテリアル選択】 次に、画像Aの解析したい歯面の中央（切縁付近など）をプロットしてください。";
                break;
            case 3: 
                text = "画像B：背景（下顎前歯白）を選択"; 
                rightText = "【マテリアル選択】 続いて、画像B（右）の下顎前歯など、背景となる白い歯面部分をプロパットしてください。";
                break;
            case 4: 
                text = "画像B：計測点を選択"; 
                rightText = "【マテリアル選択】 最後に、画像Bの解析したい歯面（画像Aと同じ位置）をプロットしてください。";
                break;
            default: 
                text = "解析完了"; 
                rightText = "【マテリアル選択】 点をドラッグして微調整が可能です。不透明度スコアと推奨マテリアルを確認してください。";
                break;
        }
        if (this.guideEl) this.guideEl.textContent = text;
        if (this.rightGuideEl) this.rightGuideEl.textContent = rightText;
    },

    getMouseImgCoords(e, type) {
        const canvas = type === 'a' ? this.canvasA : this.canvasB;
        const img = type === 'a' ? this.imageA : this.imageB;
        if (!img) return null;

        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / img.width, rect.height / img.height) * this.zoomLevel;
        const cx = (rect.width / 2) + this.panX;
        const cy = (rect.height / 2) + this.panY;
        
        return {
            ix: (e.clientX - rect.left - cx) / scale + (img.width / 2),
            iy: (e.clientY - rect.top - cy) / scale + (img.height / 2),
            scale: scale,
            cx: cx,
            cy: cy
        };
    },

    findNearbyTarget(ix, iy, type, scale) {
        const threshold = 20 / scale; // Screen-space threshold (approx 20px)
        const points = type === 'a' 
            ? [{p: this.targetA, k: 'target'}, {p: this.refA, k: 'ref'}]
            : [{p: this.targetB, k: 'target'}, {p: this.refB, k: 'ref'}];
            
        for (const item of points) {
            if (!item.p) continue;
            const dist = Math.sqrt(Math.pow(item.p.x - ix, 2) + Math.pow(item.p.y - iy, 2));
            if (dist < threshold) return item;
        }
        return null;
    },

    handleMouseDown(e, type) {
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            this.isPanning = true; this.lastPanPt = { x: e.clientX, y: e.clientY };
            e.preventDefault(); return;
        }
        
        if (e.button === 0) {
            const coords = this.getMouseImgCoords(e, type);
            if (!coords) return;

            // Check if clicking on an existing point to drag
            const nearby = this.findNearbyTarget(coords.ix, coords.iy, type, coords.scale);
            if (nearby) {
                this.draggingPoint = nearby.p;
                this.dragType = type;
                this.dragKind = nearby.k;
                return;
            }

            // Normal sequential plotting
            const rgb = this.getAverageColor(type, coords.ix, coords.iy, 5);
            if (rgb) {
                const lab = window.ColorSpace.rgbToLab(rgb.r, rgb.g, rgb.b);
                const p = { x: coords.ix, y: coords.iy, lab, rgb };
                
                if (type === 'a') {
                    if (this.plottingStep <= 2) {
                        if (this.plottingStep === 1) { this.refA = p; this.plottingStep = 2; }
                        else { this.targetA = p; this.plottingStep = 3; }
                    } else { this.targetA = p; }
                } else {
                    if (this.plottingStep >= 3) {
                        if (this.plottingStep === 3) { this.refB = p; this.plottingStep = 4; }
                        else { this.targetB = p; this.plottingStep = 5; }
                    } else { this.refB = p; }
                }

                this.updateUI(); this.analyze(); this.redraw(); this.updateGuide();
            }
        }
    },

    updateUI() {
        const updateRow = (cardId, prefix, p) => {
            const card = document.getElementById(cardId);
            if (!card || !p) return;
            const row = card.querySelector(`.${prefix === 'ref' ? 'ref-row' : 'target-row'}`);
            if (row) {
                row.querySelector(`.${prefix === 'ref' ? 'ref-l' : 'val-l'}`).textContent = p.lab.l.toFixed(1);
                row.querySelector(`.${prefix === 'ref' ? 'ref-a' : 'val-a'}`).textContent = p.lab.a.toFixed(1);
                row.querySelector(`.${prefix === 'ref' ? 'ref-b' : 'val-b'}`).textContent = p.lab.b.toFixed(1);
                
                // Update Swatch
                const swatchId = `material-swatch-${cardId.split('-')[1]}-${prefix === 'ref' ? 'ref' : 'target'}`;
                const swatch = document.getElementById(swatchId);
                if (swatch) {
                    swatch.style.backgroundColor = `rgb(${p.rgb.r},${p.rgb.g},${p.rgb.b})`;
                }
            }
        };
        updateRow('sample-a-card', 'ref', this.refA);
        updateRow('sample-a-card', 'val', this.targetA);
        updateRow('sample-b-card', 'ref', this.refB);
        updateRow('sample-b-card', 'val', this.targetB);
    },

    analyze() {
        if (!this.refA || !this.targetA || !this.refB || !this.targetB) return;

        // Formula: Transparency = (L_T,W - L_T,B) / (L_R,W - L_R,B)
        const denominator = Math.max(1.0, this.refB.lab.l - this.refA.lab.l);
        const numerator = this.targetB.lab.l - this.targetA.lab.l;
        
        let transparency = numerator / denominator;
        // Clamp 0-1
        transparency = Math.max(0, Math.min(1, transparency));
        
        const opacityScore = (1 - transparency) * 100;
        this.scoreEl.textContent = opacityScore.toFixed(1) + "%";

        // TP Calculation (Standard Delta E between Targets)
        const dL = this.targetB.lab.l - this.targetA.lab.l;
        const da = this.targetB.lab.a - this.targetA.lab.a;
        const db = this.targetB.lab.b - this.targetA.lab.b;
        const tpScore = Math.sqrt(dL*dL + da*da + db*db);
        if (this.tpEl) this.tpEl.textContent = tpScore.toFixed(1);

        this.updateRecommendation(opacityScore, tpScore);
    },

    updateRecommendation(opacity, tp) {
        const container = document.getElementById('material-recommendation-container');
        const content = document.getElementById('material-recommendation-content');
        if (!container || !content) return;

        let zone = 4;
        let material = "";
        let reason = "";

        // Triage based on academic criteria (OR logic)
        if (tp >= 17.0 || opacity < 55) {
            zone = 1;
            material = "長石系陶材（レイヤリング法）";
            reason = "天然歯エナメル質と同等の極めて高い透明感が求められるため、陶材の築盛による再現が最適です。";
        } else if (tp >= 14.0 || opacity < 65) {
            zone = 2;
            material = "高透光性ジルコニア(5Y) / 二ケイ酸リチウム(HT)";
            reason = "高い透明性を持ち、モノリシック＋ステイン法でも十分に前歯部へ適応可能な範囲です。";
        } else if (tp >= 10.0 || opacity < 75) {
            zone = 3;
            material = "二ケイ酸リチウム(LT)";
            reason = "中程度の遮蔽性があり、象牙質の再現や、支台歯の色調の影響を抑えたい場合に適しています。";
        } else {
            zone = 4;
            material = "従来型ジルコニア(3Y) / ジルコニアフレーム＋築盛";
            reason = "遮蔽性が非常に高いため、変色歯（メタルコア等）の確実なマスキングや、臼歯部の強度を最優先するケースに最適です。";
        }

        // Apply UI updates
        container.className = `material-recommendation-card recommendation-zone-${zone}`;
        content.innerHTML = `
            <span class="rec-material-name">${material}</span>
            <span class="rec-reason">${reason}</span>
        `;
    },

    redraw() {
        this.renderCanvas(this.canvasA, this.ctxA, this.imageA, this.refA, this.targetA);
        this.renderCanvas(this.canvasB, this.ctxB, this.imageB, this.refB, this.targetB);
    },

    renderCanvas(canvas, ctx, img, ref, target) {
        if (!canvas) return;
        const rect = canvas.parentNode.getBoundingClientRect();
        if (rect.width === 0) return;
        
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!img) return;

        const scale = Math.min(canvas.width/img.width, canvas.height/img.height) * this.zoomLevel;
        const cx = (canvas.width/2) + this.panX;
        const cy = (canvas.height/2) + this.panY;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.drawImage(img, (-img.width/2)*scale, (-img.height/2)*scale, img.width*scale, img.height*scale);
        ctx.restore();

        // Draw Ref Points (Dots)
        if (ref) {
            const rx = (ref.x - img.width/2) * scale + cx;
            const ry = (ref.y - img.height/2) * scale + cy;
            this.drawMarker(ctx, rx, ry, true);
        }
        // Draw Target Points (Cross)
        if (target) {
            const tx = (target.x - img.width/2) * scale + cx;
            const ty = (target.y - img.height/2) * scale + cy;
            this.drawMarker(ctx, tx, ty, false);
        }
    },

    drawMarker(ctx, x, y, isRef) {
        ctx.lineWidth = 2;
        if (isRef) {
            // Background Reference Marker (Circle)
            ctx.strokeStyle = '#94a3b8';
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'; ctx.fill();
        } else {
            // Target Point Marker (Cross)
            ctx.strokeStyle = '#f59e0b';
            ctx.beginPath(); ctx.moveTo(x-15, y); ctx.lineTo(x+15, y); ctx.moveTo(x, y-15); ctx.lineTo(x, y+15); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.stroke();
        }
    },

    handleMouseMove(e, type) {
        if (this.isPanning) {
            this.panX += e.clientX - this.lastPanPt.x; this.panY += e.clientY - this.lastPanPt.y;
            this.lastPanPt = { x: e.clientX, y: e.clientY }; this.redraw();
            return;
        }

        const coords = this.getMouseImgCoords(e, type);
        if (!coords) return;

        // Manage Dragging
        const item = document.getElementById(`material-item-${type}`);
        if (this.draggingPoint) {
            this.draggingPoint.x = coords.ix;
            this.draggingPoint.y = coords.iy;

            if (item) item.style.cursor = 'grabbing'; // Grabbing hand icon

            // Re-sample at new position
            const rgb = this.getAverageColor(this.dragType, coords.ix, coords.iy, 5);
            if (rgb) {
                this.draggingPoint.rgb = rgb;
                this.draggingPoint.lab = window.ColorSpace.rgbToLab(rgb.r, rgb.g, rgb.b);
            }

            this.updateUI(); this.analyze(); this.redraw();
            return;
        }

        // Update Cursor feedback
        const nearby = this.findNearbyTarget(coords.ix, coords.iy, type, coords.scale);
        const canvas = type === 'a' ? this.canvasA : this.canvasB;
        if (this.draggingPoint) {
            if (item) item.style.cursor = 'grabbing';
            if (canvas) canvas.style.cursor = 'grabbing';
        } else if (nearby) {
            if (item) item.style.cursor = 'grab';
            if (canvas) canvas.style.cursor = 'grab';
        } else {
            if (item) item.style.cursor = 'crosshair';
            if (canvas) canvas.style.cursor = 'crosshair';
        }

        // Manage Loupe
        const img = type === 'a' ? this.imageA : this.imageB;
        if (img && this.loupeCtx) {
            this.updateLoupe(img, coords.ix, coords.iy);
        }
    },

    handleMouseUp() { 
        this.isPanning = false; 
        this.draggingPoint = null;
        this.dragType = '';
        this.dragKind = '';
    },

    updateLoupe(img, x, y) {
        const s = this.loupeCanvas.width; const src = s/12;
        this.loupeCtx.clearRect(0, 0, s, s); this.loupeCtx.imageSmoothingEnabled = false;
        try { this.loupeCtx.drawImage(img, x-src/2, y-src/2, src, src, 0, 0, s, s); } catch(e) {}
        this.drawMarker(this.loupeCtx, s/2, s/2, false);
    },

    hideLoupe() { if (this.loupeCtx) this.loupeCtx.clearRect(0, 0, this.loupeCanvas.width, this.loupeCanvas.height); },

    getAverageColor(type, ix, iy, size) {
        const ctx = type === 'a' ? this.offCtxA : this.offCtxB;
        const canv = type === 'a' ? this.offCanvasA : this.offCanvasB;
        if (ix < 0 || iy < 0 || ix >= canv.width || iy >= canv.height) return null;
        try {
            const d = ctx.getImageData(Math.floor(ix-size/2), Math.floor(iy-size/2), size, size).data;
            let r=0, g=0, b=0, c=0;
            for(let i=0; i<d.length; i+=4) { if(d[i+3]===0) continue; r+=d[i]; g+=d[i+1]; b+=d[i+2]; c++; }
            return c > 0 ? { r: Math.round(r/c), g: Math.round(g/c), b: Math.round(b/c) } : null;
        } catch(e) { return null; }
    },

    updateStatusIndicator(st) { const i = this.container.querySelector('.status-indicator'); if (i) i.className = 'status-indicator ' + st; },
    checkStatus() { if (this.imageA && this.imageB) this.updateStatusIndicator('active'); },

    reset() {
        this.imageA=null; this.imageB=null; 
        this.refA=null; this.targetA=null; this.refB=null; this.targetB=null;
        this.plottingStep = 1; this.zoomLevel=1.0; this.panX=0; this.panY=0;
        if (this.zoomSlider) this.zoomSlider.value=100;
        ['a','b'].forEach(t => {
            const it = document.getElementById(`material-item-${t}`); if(it) it.classList.remove('has-image');
            const card = document.getElementById(`sample-${t}-card`);
            if(card) {
                card.querySelectorAll('.lab-val').forEach(el => el.textContent = '--');
            }
        });
        this.scoreEl.textContent="--"; this.recommendationEl.textContent="解析を開始してください。";
        this.updateStatusIndicator('ready'); this.updateGuide(); this.redraw();
    }
};

window.addEventListener('load', () => window.MaterialChoice.init());
if (document.readyState === 'complete' || document.readyState === 'interactive') window.MaterialChoice.init();
if (window.App) {
    const os = window.App.switchView;
    window.App.switchView = function(v) {
        os.call(this, v); if (v === 'laboratory' || v === 'chapter-material') setTimeout(() => window.MaterialChoice.init(), 150);
    };
}
