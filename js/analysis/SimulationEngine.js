/**
 * SimulationEngine.js - Chapter 14: Clinical Simulation (DSD)
 * 
 * Architecture:
 *  - Triple Canvas: bgCanvas (original image) / fgCanvas (extracted tooth) / uiCanvas (interaction handles)
 *  - Game Loop: requestAnimationFrame で毎フレーム uiCanvas を再描画
 *  - All events go to uiCanvas, hit-testing done in JS
 *  - Pixel extraction uses Bounding Box approach → low memory footprint for Safari/iOS
 */
window.SimulationEngine = {

    // ------------------------------------------------------------------ STATE
    /** @type {HTMLElement} */
    container: null,
    /** @type {HTMLCanvasElement} */
    bgCanvas: null, fgCanvas: null, uiCanvas: null,
    bgCtx: null, fgCtx: null, uiCtx: null,

    /** @type {HTMLImageElement|null} */
    image: null,
    /** image-space to canvas-space scale + offset */
    imgScale: 1, imgOffX: 0, imgOffY: 0,

    // Polygon plotting state
    /** @type {{x:number, y:number}[]} polygon points in image-space */
    polyPoints: [],
    polygonClosed: false,

    // Extraction data
    /** @type {HTMLCanvasElement|null} Bounding-box extracted offscreen canvas */
    extractedCanvas: null,
    /** @type {DOMRect} bounding box in image-space */
    extractBBox: null,

    // Transform state (image-space for the extracted piece's origin)
    /** @type {{x:number, y:number}} center of extracted piece on image coords */
    simPos: { x: 0, y: 0 },
    simScaleX: 1.0,
    simScaleY: 1.0,
    simRotation: 0,  // radians
    simOpacity: 1.0,

    // Interaction
    /** 'upload' | 'extract' | 'ai_extract' | 'simulate' */
    mode: 'upload',
    _isAIInitialized: false,
    isDragging: false,
    dragStart: null,       // { scx, scy, px, py } screen + simPos snapshot
    rotateHandle: null,    // screen coords of rotate knob
    isRotating: false,
    rotateStart: null,     // { angle, simRotation }
    isScaling: false,
    scaleHandlePos: 'br',  // which corner
    scaleStart: null,

    // Animation loop
    _rafId: null,
    _dirty: true,           // flag: uiCanvas needs redraw
    _isInitialized: false,

    // Debugging / Hinting AI
    _debugPt: null,         // Legacy single click debug
    aiHintPoints: [],       // Array of {x, y} in image space
    isAIRunning: false,

    // ---------------------------------------------------------------- INIT
    init() {
        if (this._isInitialized) return;
        this.container = document.getElementById('chapter-simulation');
        if (!this.container) return;

        this.bgCanvas = document.getElementById('sim-bg-canvas');
        this.fgCanvas = document.getElementById('sim-fg-canvas');
        this.uiCanvas = document.getElementById('sim-ui-canvas');
        if (!this.bgCanvas || !this.fgCanvas || !this.uiCanvas) return;

        this.bgCtx = this.bgCanvas.getContext('2d');
        this.fgCtx = this.fgCanvas.getContext('2d');
        this.uiCtx = this.uiCanvas.getContext('2d');

        this._onResize = this._onResize.bind(this);
        this._tick = this._tick.bind(this);

        this._setupFileHandling();
        this._setupEventListeners();
        this._startLoop();
        this._updateBanner();
        this._updateToolbarState();

        this._isInitialized = true;
        console.log('[SimulationEngine] Initialized.');
    },

    _setupFileHandling() {
        const fileInput = document.getElementById('sim-file-input');
        const area = this.container.querySelector('.sim-canvas-area');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this._loadImage(file);
                }
                // Small delay before reset to prevent synchronous clearing issues
                setTimeout(() => { e.target.value = ''; }, 100);
            });
        }
        if (area) {
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('drag-over');
            });
            area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
                if (e.dataTransfer.files[0]) this._loadImage(e.dataTransfer.files[0]);
            });
        }
    },

    _loadImage(file) {
        console.log('[SimulationEngine] Attempting to load file:', file.name, file.type, file.size);
        if (!file || !file.type.startsWith('image/')) {
            console.error('[SimulationEngine] Invalid file type:', file);
            alert('画像ファイルを選択してください。');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('[SimulationEngine] FileReader loaded.');
            const img = new Image();
            img.onload = () => {
                console.log('[SimulationEngine] Image object created:', img.width, 'x', img.height);
                this.image = img;
                this.reset(true); // reset state but KEEP the new image
                this._resizeCanvases();
                this._drawBackground();
                const area = this.container.querySelector('.sim-canvas-area');
                if (area) area.classList.add('has-image');
                this.mode = 'extract';
                this._updateBanner();
                this._updateToolbarState();
                this._dirty = true;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // --------------------------------------------------------------- RESIZE
    _resizeCanvases() {
        if (!this.image) return;
        const area = this.container.querySelector('.sim-canvas-area');
        const W = area.clientWidth;
        const maxH = Math.min(window.innerHeight * 0.70, W * (this.image.height / this.image.width));
        const H = maxH || 400; // Fallback height if maxH is 0
        area.style.height = H + 'px';

        console.log(`[SimulationEngine] _resizeCanvases: Computed W=${W}, H=${H}, img=${this.image.width}x${this.image.height}`);

        [this.bgCanvas, this.fgCanvas, this.uiCanvas].forEach(c => {
            if (c) {
                // Changing width/height clears the canvas automatically
                c.width = W;
                c.height = H;
                // Force CSS dimensions explicitly to prevent flexbox collapsing
                c.style.width = W + 'px';
                c.style.height = H + 'px';
            }
        });

        // Compute scale/offset (letter-box fit)
        const scaleX = W / this.image.width;
        const scaleY = H / this.image.height;
        this.imgScale = Math.min(scaleX, scaleY);
        this.imgOffX = (W - this.image.width * this.imgScale) / 2;
        this.imgOffY = (H - this.image.height * this.imgScale) / 2;

        this._drawBackground();
        this._dirty = true;
    },

    _onResize() {
        if (this.image) this._resizeCanvases();
    },

    // --------------------------------------------------------------- DRAW BG
    _drawBackground() {
        if (!this.image) return;
        const { bgCtx: ctx, bgCanvas: c, image: img, imgScale: s, imgOffX: ox, imgOffY: oy } = this;
        console.log(`[SimulationEngine] _drawBackground: c.width=${c.width}, c.height=${c.height}, s=${s}, ox=${ox}, oy=${oy}`);
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
        console.log('[SimulationEngine] _drawBackground complete.');
    },

    // --------------------------------------------------------------- EXTRACTION
    /**
     * Execute polygon extraction.
     * Uses Bounding Box approach: only extracts the rect around the polygon,
     * then applies a clipping mask. Keeps memory minimal for Safari.
     */
    _extractPolygon() {
        if (this.polyPoints.length < 3) return false;

        // 1. Compute bounding box in image space
        const xs = this.polyPoints.map(p => p.x);
        const ys = this.polyPoints.map(p => p.y);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxX = Math.min(this.image.width,  Math.ceil(Math.max(...xs)));
        const maxY = Math.min(this.image.height, Math.ceil(Math.max(...ys)));
        const bw = maxX - minX;
        const bh = maxY - minY;

        this.extractBBox = { x: minX, y: minY, width: bw, height: bh };

        // 2. Offscreen canvas (bounding-box size only)
        const off = document.createElement('canvas');
        off.width = bw; off.height = bh;
        const octx = off.getContext('2d');

        // 2a. Draw the source image fragment
        octx.drawImage(this.image, minX, minY, bw, bh, 0, 0, bw, bh);

        // 2b. Build clipping mask: polygon coords shifted to bbox-local space
        octx.globalCompositeOperation = 'destination-in';
        octx.beginPath();
        this.polyPoints.forEach((pt, i) => {
            const lx = pt.x - minX;
            const ly = pt.y - minY;
            if (i === 0) octx.moveTo(lx, ly);
            else octx.lineTo(lx, ly);
        });
        octx.closePath();
        octx.fillStyle = 'rgba(0,0,0,1)';
        octx.fill();
        octx.globalCompositeOperation = 'source-over';

        this.extractedCanvas = off;

        // 3. Initial simPos = center of bbox in image space
        this.simPos = {
            x: minX + bw / 2,
            y: minY + bh / 2,
        };
        this.simScaleX = 1.0;
        this.simScaleY = 1.0;
        this.simRotation = 0;
        this.simOpacity = 1.0;

        return true;
    },

    // --------------------------------------------------------------- GAME LOOP
    _startLoop() {
        if (this._rafId) return;
        this._tick();
    },

    _tick() {
        this._rafId = requestAnimationFrame(this._tick);
        if (!this._dirty) return;
        this._dirty = false;
        this._renderFG();
        this._renderUI();
    },

    /** Draw the transformed extracted tooth onto fgCanvas */
    _renderFG() {
        const { fgCtx: ctx, fgCanvas: c } = this;
        ctx.clearRect(0, 0, c.width, c.height);

        if (!this.extractedCanvas || this.mode !== 'simulate') return;

        const { extractBBox: bb, imgScale: s, imgOffX: ox, imgOffY: oy } = this;
        const bw = bb.width * s;
        const bh = bb.height * s;

        // simPos in canvas space (center of piece)
        const cx = ox + this.simPos.x * s;
        const cy = oy + this.simPos.y * s;

        ctx.save();
        ctx.globalAlpha = this.simOpacity;
        ctx.translate(cx, cy);
        ctx.rotate(this.simRotation);
        ctx.scale(this.simScaleX, this.simScaleY);
        ctx.drawImage(this.extractedCanvas, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
    },

    /** Draw polygon in-progress, transform handles, etc. onto uiCanvas */
    _renderUI() {
        const { uiCtx: ctx, uiCanvas: c } = this;
        ctx.clearRect(0, 0, c.width, c.height);

        if (this.mode === 'extract') {
            this._drawPolygon(ctx);
        } else if (this.mode === 'ai_extract') {
            // Draw multi-point hint guides
            if (this.aiHintPoints.length > 0) {
                const s = this.imgScale;
                const ox = this.imgOffX, oy = this.imgOffY;
                
                // Draw polygon area
                if (this.aiHintPoints.length >= 3) {
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
                    ctx.beginPath();
                    this.aiHintPoints.forEach((pt, i) => {
                        if (i === 0) ctx.moveTo(ox + pt.x * s, oy + pt.y * s);
                        else ctx.lineTo(ox + pt.x * s, oy + pt.y * s);
                    });
                    ctx.closePath();
                    ctx.fill();
                }

                // Draw lines and dots
                ctx.strokeStyle = '#38bdf8';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                this.aiHintPoints.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(ox + pt.x * s, oy + pt.y * s);
                    else ctx.lineTo(ox + pt.x * s, oy + pt.y * s);
                });
                if (this.aiHintPoints.length >= 3) ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                this.aiHintPoints.forEach(pt => {
                    ctx.fillStyle = '#38bdf8';
                    ctx.beginPath();
                    ctx.arc(ox + pt.x * s, oy + pt.y * s, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                });
            }
        } else if (this.mode === 'simulate') {
            this._drawTransformHandles(ctx);
        }
    },

    _drawPolygon(ctx) {
        if (this.polyPoints.length === 0) return;
        const { imgScale: s, imgOffX: ox, imgOffY: oy } = this;

        const toScreen = (p) => ({ x: ox + p.x * s, y: oy + p.y * s });

        // Draw lines
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#2563eb';

        this.polyPoints.forEach((pt, i) => {
            const { x, y } = toScreen(pt);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // If polygon closed, draw fill too
        if (this.polygonClosed) {
            ctx.closePath();
            ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
            ctx.fill();
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw vertices
        this.polyPoints.forEach((pt, i) => {
            const { x, y } = toScreen(pt);
            ctx.beginPath();
            ctx.arc(x, y, i === 0 ? 7 : 5, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#10b981' : '#2563eb';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Rubber-band line to first point (closing hint) if >= 3 points
        if (this.polyPoints.length >= 3 && !this.polygonClosed) {
            const first = toScreen(this.polyPoints[0]);
            const last = toScreen(this.polyPoints[this.polyPoints.length - 1]);
            ctx.beginPath();
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(first.x, first.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    _drawTransformHandles(ctx) {
        if (!this.extractedCanvas) return;
        const { extractBBox: bb, imgScale: s, imgOffX: ox, imgOffY: oy } = this;

        const bw = bb.width * s * this.simScaleX;
        const bh = bb.height * s * this.simScaleY;
        const cx = ox + this.simPos.x * s;
        const cy = oy + this.simPos.y * s;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.simRotation);

        // Dashed bounding box
        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
        ctx.setLineDash([]);

        // Corner handles (scale)
        const corners = [
            { x: -bw / 2, y: -bh / 2 },
            { x:  bw / 2, y: -bh / 2 },
            { x:  bw / 2, y:  bh / 2 },
            { x: -bw / 2, y:  bh / 2 },
        ];
        corners.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Rotation handle — circle above center
        const rotHandleY = -bh / 2 - 30;
        // Stem
        ctx.beginPath();
        ctx.moveTo(0, -bh / 2);
        ctx.lineTo(0, rotHandleY);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Knob
        ctx.beginPath();
        ctx.arc(0, rotHandleY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Refresh icon in rotation knob
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↻', 0, rotHandleY);

        // Cache rotation handle position in screen space for hit testing
        const cos = Math.cos(this.simRotation);
        const sin = Math.sin(this.simRotation);
        const rsx = cx + (0 * cos - rotHandleY * sin);
        const rsy = cy + (0 * sin + rotHandleY * cos);
        this.rotateHandle = { x: rsx, y: rsy };

        ctx.restore();
    },

    // --------------------------------------------------------------- HIT TESTING
    /**
     * Returns 'rotate' | 'corner-tl' | 'corner-tr' | 'corner-br' | 'corner-bl' | 'move' | null
     */
    _hitTest(scx, scy) {
        if (!this.extractedCanvas || this.mode !== 'simulate') return null;

        // Rotate handle
        if (this.rotateHandle) {
            const d = Math.hypot(scx - this.rotateHandle.x, scy - this.rotateHandle.y);
            if (d <= 14) return 'rotate';
        }

        const { extractBBox: bb, imgScale: s, imgOffX: ox, imgOffY: oy } = this;
        const bw = bb.width * s * this.simScaleX;
        const bh = bb.height * s * this.simScaleY;
        const cx = ox + this.simPos.x * s;
        const cy = oy + this.simPos.y * s;

        // Transform screen coords to piece-local coords
        const cos = Math.cos(-this.simRotation);
        const sin = Math.sin(-this.simRotation);
        const dx = scx - cx;
        const dy = scy - cy;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        const hw = bw / 2, hh = bh / 2;

        // Corner handles (14px radius)
        const corners = [
            { name: 'corner-tl', x: -hw, y: -hh },
            { name: 'corner-tr', x:  hw, y: -hh },
            { name: 'corner-br', x:  hw, y:  hh },
            { name: 'corner-bl', x: -hw, y:  hh },
        ];
        for (const corn of corners) {
            if (Math.hypot(lx - corn.x, ly - corn.y) <= 14) return corn.name;
        }

        // Inside bounding box → move
        if (lx >= -hw && lx <= hw && ly >= -hh && ly <= hh) return 'move';

        return null;
    },

    // --------------------------------------------------------------- EVENT LISTENERS
    _setupEventListeners() {
        const uiCanvas = this.uiCanvas;
        if (!uiCanvas) return;

        // Mouse
        uiCanvas.addEventListener('mousedown',  (e) => this._onPointerDown(e));
        uiCanvas.addEventListener('mousemove',  (e) => this._onPointerMove(e));
        window.addEventListener('mouseup',      (e) => this._onPointerUp(e));

        // Touch (iPad)
        uiCanvas.addEventListener('touchstart', (e) => this._onPointerDown(e), { passive: false });
        uiCanvas.addEventListener('touchmove',  (e) => this._onPointerMove(e), { passive: false });
        window.addEventListener('touchend',     (e) => this._onPointerUp(e));

        // Toolbar buttons
        const btnExtract = document.getElementById('sim-btn-extract');
        const btnSimulate = document.getElementById('sim-btn-simulate');
        const btnConfirm = document.getElementById('sim-btn-confirm');
        const btnReset = document.getElementById('sim-btn-reset');
        const btnSnapshot = document.getElementById('sim-btn-snapshot');
        const opacitySlider = document.getElementById('sim-opacity-slider');
        const opacityLabel = document.getElementById('sim-opacity-label');

        if (btnExtract)  btnExtract.addEventListener('click',  () => this._switchMode('extract'));
        if (btnSimulate) btnSimulate.addEventListener('click', () => this._switchMode('simulate'));
        if (btnConfirm)  btnConfirm.addEventListener('click',  () => this._confirmPolygon());
        if (btnReset)    btnReset.addEventListener('click',    () => this.reset(true));
        if (btnSnapshot) btnSnapshot.addEventListener('click', () => this.exportSnapshot());

        const btnAI = document.getElementById('sim-btn-ai');
        if (btnAI) btnAI.addEventListener('click', () => this._switchMode('ai_extract'));

        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.simOpacity = parseInt(e.target.value) / 100;
                if (opacityLabel) opacityLabel.textContent = e.target.value + '%';
                this._dirty = true;
            });
        }

        // Resize
        window.addEventListener('resize', this._onResize);
    },

    // ------- Pointer helpers
    _getCanvasCoords(e) {
        const rect = this.uiCanvas.getBoundingClientRect();
        let cx, cy;
        if (e.touches) {
            const t = e.touches[0] || e.changedTouches[0];
            cx = t.clientX - rect.left;
            cy = t.clientY - rect.top;
        } else {
            cx = e.clientX - rect.left;
            cy = e.clientY - rect.top;
        }
        return { scx: cx, scy: cy };
    },

    /** Screen → image coords */
    _screenToImage(scx, scy) {
        return {
            x: (scx - this.imgOffX) / this.imgScale,
            y: (scy - this.imgOffY) / this.imgScale,
        };
    },

    _onPointerDown(e) {
        if (e.cancelable) e.preventDefault();
        const { scx, scy } = this._getCanvasCoords(e);

        if (this.mode === 'extract') {
            const imgPt = this._screenToImage(scx, scy);

            // If polygon is already closed (fine-tuning mode), check for dragging existing points
            if (this.polygonClosed) {
                const ox = this.imgOffX, oy = this.imgOffY, s = this.imgScale;
                for (let i = 0; i < this.polyPoints.length; i++) {
                    const p = this.polyPoints[i];
                    const sx = ox + p.x * s;
                    const sy = oy + p.y * s;
                    if (Math.hypot(scx - sx, scy - sy) < 15) {
                        this.dragPolyIdx = i;
                        this._dirty = true;
                        return;
                    }
                }
            } else {
                // Initial plotting mode: Close polygon if clicking near first point
                if (this.polyPoints.length >= 3) {
                    const first = this.polyPoints[0];
                    const firstScreen = {
                        x: this.imgOffX + first.x * this.imgScale,
                        y: this.imgOffY + first.y * this.imgScale,
                    };
                    if (Math.hypot(scx - firstScreen.x, scy - firstScreen.y) < 18) {
                        this._confirmPolygon();
                        return;
                    }
                }
                // Add new point
                this.polyPoints.push(imgPt);
                this._dirty = true;
                return;
            }
        }

        if (this.mode === 'ai_extract') {
            const imgPt = this._screenToImage(scx, scy);
            this.aiHintPoints.push(imgPt);
            this._updateBanner();
            this._dirty = true;
            return;
        }

        if (this.mode === 'simulate') {
            const hit = this._hitTest(scx, scy);
            if (!hit) return;

            if (hit === 'rotate') {
                this.isRotating = true;
                const cx = this.imgOffX + this.simPos.x * this.imgScale;
                const cy = this.imgOffY + this.simPos.y * this.imgScale;
                this.rotateStart = {
                    angle: Math.atan2(scy - cy, scx - cx),
                    rotation: this.simRotation,
                };
            } else if (hit.startsWith('corner')) {
                this.isScaling = true;
                this.scaleHandlePos = hit;
                this.scaleStart = {
                    scx, scy,
                    sx: this.simScaleX,
                    sy: this.simScaleY,
                };
            } else if (hit === 'move') {
                this.isDragging = true;
                this.dragStart = {
                    scx, scy,
                    px: this.simPos.x,
                    py: this.simPos.y,
                };
            }
        }
    },

    _onPointerMove(e) {
        if (e.cancelable) e.preventDefault();
        const { scx, scy } = this._getCanvasCoords(e);

        if (this.mode === 'extract' && this.dragPolyIdx !== -1) {
            this.polyPoints[this.dragPolyIdx] = this._screenToImage(scx, scy);
            this._dirty = true;
            return;
        }

        if (this.mode === 'simulate') {
            if (this.isDragging) {
                const dx = (scx - this.dragStart.scx) / this.imgScale;
                const dy = (scy - this.dragStart.scy) / this.imgScale;
                this.simPos.x = this.dragStart.px + dx;
                this.simPos.y = this.dragStart.py + dy;
                this._dirty = true;
            } else if (this.isRotating) {
                const cx = this.imgOffX + this.simPos.x * this.imgScale;
                const cy = this.imgOffY + this.simPos.y * this.imgScale;
                const angle = Math.atan2(scy - cy, scx - cx);
                this.simRotation = this.rotateStart.rotation + (angle - this.rotateStart.angle);
                this._dirty = true;
            } else if (this.isScaling) {
                const dsc = Math.hypot(scx - this.scaleStart.scx, scy - this.scaleStart.scy);
                const baseD = Math.hypot(
                    this.imgOffX + this.simPos.x * this.imgScale - this.scaleStart.scx,
                    this.imgOffY + this.simPos.y * this.imgScale - this.scaleStart.scy
                );
                const factor = baseD > 0 ? (baseD + dsc * 0.5) / baseD : 1;
                this.simScaleX = Math.max(0.2, Math.min(5, this.scaleStart.sx * factor));
                this.simScaleY = Math.max(0.2, Math.min(5, this.scaleStart.sy * factor));
                this._dirty = true;
            }

            // Cursor feedback
            const hit = this._hitTest(scx, scy);
            const cursorMap = {
                rotate: 'grab',
                'corner-tl': 'nwse-resize',
                'corner-tr': 'nesw-resize',
                'corner-br': 'nwse-resize',
                'corner-bl': 'nesw-resize',
                move: 'move',
            };
            this.uiCanvas.style.cursor = cursorMap[hit] || 'default';
        }
    },

    _onPointerUp(e) {
        this.isDragging = false;
        this.isRotating = false;
        this.isScaling = false;
        this.dragPolyIdx = -1;
        this.dragStart = null;
        this.rotateStart = null;
        this.scaleStart = null;
    },

    // --------------------------------------------------------------- MODE CONTROL
    _switchMode(mode) {
        if (mode === 'extract' && !this.image) return;
        if (mode === 'simulate' && !this.extractedCanvas) {
            alert('先にポリゴンを確定してください。「抽出確定」ボタンを使用するか、最初の点の近くをクリックして閉じてください。');
            return;
        }
        this.mode = mode;
        this._updateBanner();
        this._updateToolbarState();

        const area = this.container.querySelector('.sim-canvas-area');
        if (area) {
            area.classList.remove('mode-upload', 'mode-extract', 'mode-simulate');
            area.classList.add(`mode-${mode}`);
        }
        this._dirty = true;
    },

    _confirmPolygon() {
        if (this.polyPoints.length < 3) {
            alert('最低3点をプロットしてから確定してください。');
            return;
        }
        this.polygonClosed = true;
        const ok = this._extractPolygon();
        if (ok) {
            this._switchMode('simulate');
        }
    },

    // --------------------------------------------------------------- RESET
    reset(keepImage = false) {
        this.polyPoints = [];
        this.polygonClosed = false;
        this.extractedCanvas = null;
        this.extractBBox = null;
        this.simPos = { x: 0, y: 0 };
        this.simScaleX = 1.0;
        this.simScaleY = 1.0;
        this.simRotation = 0;
        this.simOpacity = 1.0;
        this.isDragging = false;
        this.isRotating = false;
        this.isScaling = false;

        // Reset opacity slider UI
        const slider = document.getElementById('sim-opacity-slider');
        const label = document.getElementById('sim-opacity-label');
        if (slider) slider.value = 100;
        if (label) label.textContent = '100%';

        if (!keepImage) {
            this.image = null;
            const area = this.container.querySelector('.sim-canvas-area');
            if (area) area.classList.remove('has-image');
            [this.bgCtx, this.fgCtx, this.uiCtx].forEach((ctx, i) => {
                const c = [this.bgCanvas, this.fgCanvas, this.uiCanvas][i];
                if (ctx && c) {
                    ctx.clearRect(0, 0, c.width, c.height);
                }
            });
        } else {
            // Do NOT draw background here; let _resizeCanvases handle it
            // because canvas dimensions might not be set yet.
            const fgCtx = this.fgCtx;
            if (fgCtx && this.fgCanvas) {
                fgCtx.clearRect(0, 0, this.fgCanvas.width, this.fgCanvas.height);
            }
        }

        this.mode = this.image ? 'extract' : 'upload';
        this._updateBanner();
        this._updateToolbarState();
        this._dirty = true;
    },

    // --------------------------------------------------------------- UI UPDATE
    _updateBanner() {
        const banner = document.getElementById('sim-phase-banner');
        if (!banner) return;

        let icon = 'info';
        let text = '';
        let cls = 'sim-phase-banner';

        if (this.mode === 'upload') {
            text = '⬆️ まず口腔内写真をアップロードしてください。';
        } else if (this.mode === 'extract') {
            icon = 'pen-tool';
            if (this.polygonClosed) {
                text = '調整モード：点をドラッグして形を整えてください。完了したら「抽出確定」を押してください。';
            } else {
                text = '抽出モード：歯の形に沿ってプロットし、最初をクリックして閉じてください。';
            }
            cls += ' phase-extract';
        } else if (this.mode === 'ai_extract') {
            if (this.isAIRunning) {
                banner.innerHTML = `<div class="banner-content"><i data-lucide="loader-2" class="animate-spin"></i> AI分析中... しばらくお待ちください。</div>`;
            } else {
                const count = this.aiHintPoints.length;
                let html = `<div class="banner-content"><i data-lucide="sparkles"></i> <b>AI抽出モード</b>：歯の周りを囲むようにタップしてください。 (${count}点指定中)</div>`;
                html += `<div class="banner-actions">`;
                if (count >= 3) {
                    html += `<button class="banner-btn primary" onclick="SimulationEngine.startAI()">✨ 解析実行</button>`;
                }
                if (count > 0) {
                    html += `<button class="banner-btn secondary" onclick="SimulationEngine.undoAIPoint()">↩ 戻る</button>`;
                    html += `<button class="banner-btn danger" onclick="SimulationEngine.resetAIPoints()">✕ クリア</button>`;
                }
                html += `</div>`;
                banner.innerHTML = html;
            }
            cls += ' phase-ai';
        } else if (this.mode === 'simulate') {
            icon = 'move';
            text = 'シミュレーションモード：歯を移動・変形できます。';
            cls += ' phase-simulate';
        }

        banner.className = cls;
        if (this.mode !== 'ai_extract' && !this.isAIRunning) {
            banner.innerHTML = `<i data-lucide="${icon}"></i> ${text}`;
        }
        if (window.lucide) window.lucide.createIcons();
    },

    // Global entry points for banner buttons
    startAI() { window.SimulationEngine._runAISegmentation(); },
    undoAIPoint() {
        window.SimulationEngine.aiHintPoints.pop();
        window.SimulationEngine._updateBanner();
        window.SimulationEngine._dirty = true;
    },
    resetAIPoints() {
        window.SimulationEngine.aiHintPoints = [];
        window.SimulationEngine._updateBanner();
        window.SimulationEngine._dirty = true;
    },

    _updateToolbarState() {
        const hasImg = !!this.image;
        if (!hasImg) return;
        const btnAI = document.getElementById('sim-btn-ai');
        const btnExtract = document.getElementById('sim-btn-extract');
        const btnSimulate = document.getElementById('sim-btn-simulate');
        const btnConfirm = document.getElementById('sim-btn-confirm');
        
        if (btnAI) btnAI.classList.toggle('active', this.mode === 'ai_extract');
        if (btnExtract) btnExtract.classList.toggle('active', this.mode === 'extract');
        if (btnSimulate) btnSimulate.classList.toggle('active', this.mode === 'simulate');
        if (btnConfirm) btnConfirm.disabled = (this.mode !== 'extract' || this.polyPoints.length < 3);
    },

    // --------------------------------------------------------------- AI SEGMENTATION
    async _runAISegmentation() {
        if (!window.initInteractiveSegmenter || this.aiHintPoints.length < 3) return;
        
        this.isAIRunning = true;
        this._updateBanner();

        try {
            const segmenter = await window.initInteractiveSegmenter();
            
            // 1. Calculate Crop Area (Image space)
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let sumX = 0, sumY = 0;
            this.aiHintPoints.forEach(pt => {
                minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
                maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
                sumX += pt.x; sumY += pt.y;
            });
            const avgX = sumX / this.aiHintPoints.length;
            const avgY = sumY / this.aiHintPoints.length;

            const w = maxX - minX, h = maxY - minY;
            const margin = Math.max(w, h) * 0.4;
            
            const naturalW = this.image.naturalWidth || this.image.width;
            const naturalH = this.image.naturalHeight || this.image.height;

            const finalCropX = Math.max(0, Math.floor(minX - margin));
            const finalCropY = Math.max(0, Math.floor(minY - margin));
            const finalCropW = Math.min(naturalW, Math.ceil(maxX + margin)) - finalCropX;
            const finalCropH = Math.min(naturalH, Math.ceil(maxY + margin)) - finalCropY;

            // 2. Prepare AI Canvas (Downscaled)
            const maxSide = 1024;
            const scale = Math.min(1.0, maxSide / Math.max(finalCropW, finalCropH));
            const outW = Math.round(finalCropW * scale);
            const outH = Math.round(finalCropH * scale);
            
            const aiCanvas = document.createElement('canvas');
            aiCanvas.width = outW; aiCanvas.height = outH;
            const aiCtx = aiCanvas.getContext('2d');
            aiCtx.drawImage(this.image, finalCropX, finalCropY, finalCropW, finalCropH, 0, 0, outW, outH);

            // 3. Prepare User Constraint Mask (Polygon enclosure)
            const roiCanvas = document.createElement('canvas');
            roiCanvas.width = outW; roiCanvas.height = outH;
            const roiCtx = roiCanvas.getContext('2d');
            roiCtx.fillStyle = '#000';
            roiCtx.fillRect(0, 0, outW, outH);
            roiCtx.fillStyle = '#fff';
            roiCtx.beginPath();
            this.aiHintPoints.forEach((pt, i) => {
                const lx = (pt.x - finalCropX) * scale;
                const ly = (pt.y - finalCropY) * scale;
                if (i === 0) roiCtx.moveTo(lx, ly); else roiCtx.lineTo(lx, ly);
            });
            roiCtx.closePath();
            roiCtx.fill();
            const roiData = roiCtx.getImageData(0, 0, outW, outH).data;

            // 4. Run AI with Inset Scribble
            const scribble = this.aiHintPoints.map(pt => {
                const dx = pt.x - avgX, dy = pt.y - avgY;
                const insetX = avgX + dx * 0.7, insetY = avgY + dy * 0.7;
                return { x: (insetX - finalCropX) / finalCropW, y: (insetY - finalCropY) / finalCropH };
            });
            
            const result = await segmenter.segment(aiCanvas, { scribble }, performance.now());

            const maskObj = result.categoryMask;
            if (maskObj) {
                const rawMask = maskObj.getAsUint8Array ? maskObj.getAsUint8Array() : maskObj.getAsFloat32Array();
                const isRGBA = (rawMask.length === outW * outH * 4);
                
                // --- INVERSION CHECK ---
                // Check if the AI thought our hint points are "Background" (0).
                // If so, it means the mask is inverted for this model/environment.
                let hitSum = 0;
                scribble.forEach(p => {
                    const ix = Math.floor(p.x * outW), iy = Math.floor(p.y * outH);
                    const idx = iy * outW + ix;
                    const val = isRGBA ? rawMask[idx * 4] : rawMask[idx];
                    if (val > 0) hitSum++;
                });
                
                const hitRate = hitSum / scribble.length;
                const shouldInvert = (hitRate < 0.3); // If less than 30% hits, it's likely inverted
                console.log(`[AI Debug] Mask Inversion Check: hitRate=${hitRate.toFixed(2)}, shouldInvert=${shouldInvert}`);

                // Final Mask = Intersect ( (AI Result XOR Invert) , User Boundary)
                const intersectionMask = new Uint8Array(outW * outH);
                let fgCount = 0;
                for (let i = 0; i < outW * outH; i++) {
                    let aiVal = isRGBA ? rawMask[i * 4] : rawMask[i];
                    if (shouldInvert) aiVal = (aiVal > 0) ? 0 : 255; // Reverse logic
                    
                    const userVal = roiData[i * 4];
                    if (aiVal > 0 && userVal > 128) {
                        intersectionMask[i] = 255;
                        fgCount++;
                    }
                }
                console.log(`[AI Debug] Final FG Pixels: ${fgCount}`);

                // 5. Trace Contour
                const points = this._maskToPolygon({ 
                    width: outW, height: outH, mask: intersectionMask 
                }, finalCropX, finalCropY, finalCropW, finalCropH);

                if (points && points.length > 5) {
                    this.polyPoints = points;
                    this.aiHintPoints = [];
                    this.polygonClosed = true;
                    // Switch to manual edit mode instead of direct simulation
                    this._switchMode('extract');
                } else {
                    alert('歯の形状を特定できませんでした。もう少しだけ歯の内側も含めて囲んでみてください。');
                }
            }
        } catch (err) {
            console.error('[AI Error]', err);
            alert('AI解析に失敗しました。');
        } finally {
            this.isAIRunning = false;
            this._updateBanner();
            this._dirty = true;
        }
    },

    /** Robust Mapper & Tracer */
    _maskToPolygon(data, cropX, cropY, cropW, cropH) {
        const { width, height, mask } = data;
        const isFGD = (x, y) => {
            if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) return false;
            return mask[y * width + x] > 0;
        };

        let startX = -1, startY = -1;
        search: for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (isFGD(x, y)) { startX = x; startY = y; break search; }
            }
        }
        if (startX === -1) return null;

        const points = [];
        let currX = startX, currY = startY;
        let prevX = startX - 1, prevY = startY;
        const directions = [[0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1]];
        
        for (let safety = 0; safety < 5000; safety++) {
            points.push({ 
                x: (currX / width) * cropW + cropX, 
                y: (currY / height) * cropH + cropY 
            });

            let startDir = 0;
            for (let i = 0; i < 8; i++) {
                if (currX + directions[i][0] === prevX && currY + directions[i][1] === prevY) {
                    startDir = i; break;
                }
            }
            let found = false;
            for (let i = 1; i <= 8; i++) {
                const d = (startDir + i) % 8;
                const nx = currX + directions[d][0], ny = currY + directions[d][1];
                if (isFGD(nx, ny)) {
                    prevX = currX; prevY = currY;
                    currX = nx; currY = ny;
                    found = true; break;
                }
            }
            if (!found || (currX === startX && currY === startY)) break;
        }

        const samples = [];
        const step = Math.max(1, Math.floor(points.length / 64));
        for (let i = 0; i < points.length; i += step) samples.push(points[i]);
        return samples;
    },

    // --------------------------------------------------------------- EXPORT
    /**
     * Merges bg + fg into a single canvas and returns a data URL.
     * Called by ReportEngine for PDF output.
     */
    getSimulationSnapshot() {
        if (!this.image) return null;
        const out = document.createElement('canvas');
        out.width  = this.bgCanvas.width;
        out.height = this.bgCanvas.height;
        const ctx = out.getContext('2d');
        ctx.drawImage(this.bgCanvas, 0, 0);
        ctx.drawImage(this.fgCanvas, 0, 0);
        return out.toDataURL('image/png');
    },

    /**
     * Download the snapshot as PNG
     */
    exportSnapshot() {
        const dataURL = this.getSimulationSnapshot();
        if (!dataURL) return;
        const a = document.createElement('a');
        a.download = 'simulation_result.png';
        a.href = dataURL;
        a.click();
    },
};

// Auto-init removed. app.js handles init().
if (false) {
    window.addEventListener('load', () => {
        if (document.getElementById('chapter-simulation')) {
            window.SimulationEngine.init();
        }
    });
}
