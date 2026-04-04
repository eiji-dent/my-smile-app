// Aesthetic Explanations
const TOOL_EXPLANATIONS = {
  'interpupillary': '顔貌の水平基準となる線です。咬合平面や前歯部切縁ラインがこの瞳孔間線と平行になることが、調和のとれたスマイルの基本となります。',
  'interpupillary-e': '顔貌の水平基準となる線です。咬合平面や前歯部切縁ラインがこの瞳孔間線と平行になることが、調和のとれたスマイルの基本となります。',
  'midline': '顔貌の垂直基準となる線です。上顎中切歯の正中（歯列正中）が、この顔貌正中線と一致していることが理想的です。',
  'f-midline': '顔貌の垂直基準となる顔貌正中線です。上顎の中切歯の間（歯列正中）と一致することが理想です。',
  'd-midline': '上顎中切歯の間に引かれる歯列正中線です。顔貌正中線からのズレ（平行移動）や傾き（Canting）を評価します。',
  'commissural': '左右の口角を結ぶ線です。下顎位や口角周囲筋の不調和の確認に用います。瞳孔間線との非平行（ズレ）による咬合平面エラーを警戒します。',
  'vertical-proportions': '顔面を上顔面・中顔面・下顔面に3等分し、そのバランスから顔全体の審美性と調和を評価します。',
  'eline': 'エステティックライン（鼻尖とオトガイを結んだ線）。上下口唇がこの線上か、やや内側にあるのが理想的な横顔のプロファイリングです。',
  'nla': '鼻下点から上口唇への角度（鼻唇角）。日本人の平均は80〜100°です。上顎前突や口唇の突出度の評価に用います。',
  'convexity': '側貌凸型度（Angle of Convexity）。眉間(G)、鼻下点(Sn)、オトガイ(Pg\')を結ぶ角度で、側貌の突出感を凸型・直型・凹型に分類します。',
  'incisal-edge': '前歯の切端ラインです。瞳孔間線などの水平基準との平行性を確認します。',
  'smile-arc': '下口唇のカーブと上顎前歯切端のカーブの一致度。コンソナント（平行）だと若々しく、平坦や逆カーブだと加齢した印象を与えます。',
  'corridor': 'スマイル時の口角と歯列の間の暗黒帯。小さすぎると（義歯様）不自然に見え、1〜14%の適度な空隙が立体的で自然なスマイルを生みます。',
  'gingival': 'スマイル時の歯肉の露出量です。-2（被蓋）〜0mmが理想とされ、露出しすぎるとガミースマイルとして非審美的評価となります。',
  'mmeasure': 'M音発音時の安静位露出量。上唇の下からのぞく前歯の長さ（1〜3mmが基準）を測り、若々しさの指標とします。',
  'smeasure': 'S音発音時の上下歯牙のクリアランス（スピーキングスペース）。1〜1.5mmが基準で、発音障害や垂直的咬合径の評価に用います。',
  'fvmeasure': 'F/V音発音時の、上顎切歯と下唇ドライウェットラインとの接触です。切端位置が長すぎないか、唇側に出すぎていないかの評価に使います。',
  'wl-ratio': '中切歯の幅と長さの比。75〜85%（理想80%）が基準。セントラルドミナンス（前歯部の主役）の審美性を決定づけます。',
  'red-prop': '歯冠幅径バランス。前歯部の見かけの幅が、黄金比（1.618 : 1 : 0.618）や白銀比（1.414 : 1 : 0.707）にどれだけ近いかで調和を評価します。',
  'pink-esth': 'ジンジバル・ゼニス（歯肉縁の最深点）が描く「High-Low-High」のラインと、その左右対称性を評価します。',
  'axial-incl': '歯冠の軸の傾き。正中から遠ざかるほど歯冠軸の傾きが強くなる（中切歯3°、側切歯5°、犬歯8°）のが美しい配列の条件です。',
  'papilla': '歯間乳頭（ブラックトライアングル頂点部）の高さの左右差を評価します。2.0mm以内の左右対称性が理想とされます。'
};

// --- AI (MediaPipe) Integration ---
let faceLandmarker = null;
const initFaceLandmarker = async () => {
    if (faceLandmarker) return faceLandmarker;
    try {
        // MediaPipe Tasks Vision を動的インポート
        const vision_module = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
        const { FaceLandmarker, FilesetResolver } = vision_module;

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const options = {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "IMAGE",
            numFaces: 1,
            minFaceDetectionConfidence: 0.1, // 側貌(真横)の検出を可能にするため大幅に緩和
            minFacePresenceConfidence: 0.1,
            minTrackingConfidence: 0.1
        };

        try {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
        } catch (gpuErr) {
            console.warn("GPU initialization failed, falling back to CPU:", gpuErr);
            options.baseOptions.delegate = "CPU";
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
        }

        return faceLandmarker;
    } catch (err) {
        console.error("AI Initialization failed:", err);
        throw new Error("MediaPipeの初期化に失敗しました。ネットワーク接続またはブラウザの対応状況を確認してください。\nDetails: " + err.message);
    }
};

const absDist = (val, target) => Math.abs(val - target);

// Initialize Icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  window.showAllPlots = true;
  const togglePlots = document.getElementById('toggle-all-plots');
  if (togglePlots) {
      togglePlots.addEventListener('change', (e) => {
          window.showAllPlots = e.target.checked;
          if (window.appCards) window.appCards.forEach(c => c.drawCanvas());
      });
  }

  // Global Loupe Elements
  const loupeContainer = document.getElementById('loupe-container');
  const loupeCanvas = document.getElementById('loupe-canvas');
  const loupeCtx = loupeCanvas.getContext('2d');
  
  // Loupe & Global settings
  const MAGNIFICATION = 2.0;
  const LOUPE_SIZE_W = 160;
  const LOUPE_SIZE_H = 160;

  // Instruction Texts
  const CALIB_STEPS = ["1点目: 基準オブジェクト(定規等)の始点","2点目: 基準オブジェクトの終点","完了：実測値を入力してください。"];
  const PROPORTION_STEPS = ["1点目：ヘアライン","2点目：眉間","3点目：瞳孔ライン","4点目：鼻下","5点目：口唇","6点目：オトガイ","完了しました"];
  const ELINE_STEPS = ["1点目：鼻先","2点目：オトガイ","3点目：上唇","4点目：下唇","完了しました"];
  const NLA_STEPS = ["1点目：鼻柱","2点目：鼻下(頂点)","3点目：上唇","完了しました"];
  const CONVEXITY_STEPS = ["1点目：眉間(G)","2点目：鼻下点(Sn)","3点目：オトガイ(Pg')","完了しました"];
  const HBAR_REF_STEPS = ["1点目：水平基準の始点","2点目：水平基準の終点","水平基準が設定されました"];
  const HBAR_BAR_STEPS = ["1点目：バーの始点","2点目：バーの終点","バーのプロットが完了しました"];
  
  // Intraoral Micro-esthetics
  const WL_STEPS = ["右中切歯: 上端","右中切歯: 下端","右中切歯: 近心(左端)","右中切歯: 遠心(右端)","左中切歯: 上端","左中切歯: 下端","左中切歯: 近心(右端)","左中切歯: 遠心(左端)","完了しました。"];
  const RED_STEPS = ["1点目：右犬歯の遠心端","2点目：右側切歯の遠心端","3点目：右中切歯の遠心端","4点目：正中","5点目：左中切歯の遠心端","6点目：左側切歯の遠心端","7点目：左犬歯の遠心端","完了しました。"];
  const PINK_STEPS = ["1点目：右犬歯のゼニス","2点目：右側切歯のゼニス","3点目：右中切歯のゼニス","4点目：左中切歯のゼニス","5点目：左側切歯のゼニス","6点目：左犬歯のゼニス","完了しました。左右のGZPを判定しました。"];
  const AXIAL_STEPS = ["1/14:正中の上部","2/14:正中の下部","3/14:右中切歯 歯頸部","4/14:右中切歯 切縁","5/14:右側切歯 歯頸部","6/14:右側切歯 切縁","7/14:右犬歯 歯頸部","8/14:右犬歯 切縁","9/14:左中切歯 歯頸部","10/14:左中切歯 切縁","11/14:左側切歯 歯頸部","12/14:左側切歯 切縁","13/14:左犬歯 歯頸部","14/14:左犬歯 切縁","完了しました。"];
  const PAPILLA_STEPS = ["1点目:右乳頭(犬-側)","2点目:右乳頭(側-中)","3点目:正中乳頭","4点目:左乳頭(中-側)","5点目:左乳頭(側-犬)","完了しました。"];

  // E-Sound Mini-esthetics
  const ARC_STEPS = ["1点目: 上顎右側の切縁","2点目: 上顎中切歯の切縁","3点目: 上顎左側の切縁","4点目: 右側の下唇上縁","5点目: 中央の下唇上縁","6点目: 左側の下唇上縁","完了しました。スマイルアークを確認してください。"];
  const CORRIDOR_STEPS = ["1点目: 右側の口角端","2点目: 右側の歯列最外周（小臼歯）","3点目: 左側の歯列最外周","4点目: 左側の口角端","完了しました。バッカルコリドー率をご確認ください。"];
  const GINGIVAL_STEPS = ["1点目: 中切歯の最深部（ゼニス）","2点目: 上唇の下縁","3点目: 中切歯の切縁","4点目: 下唇の上縁","完了しました。歯肉露出とE位をご確認ください。"];

  class AnalysisCard {
    constructor(cardElement) {
      this.card = cardElement;
      this.phase = cardElement.dataset.phase;

      // 1. Authentication & Expiry Logic (Gatekeeper)
      if (this.phase === 'intraoral') { 
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
      
      this.guidedMode = false; // 鼻先クリック誘導モード
      this.pxToMm = 0.075; // Default reference scale
      
      // Inject Calibration Tool into Toolbar (Only for phases that use mm measurements)
      const mmPhases = ['lateral', 'e-midline', 'e-sound', 'm-sound', 's-sound', 'fv-sound', 'intraoral'];
      const tSelector = this.card.querySelector('.tool-selector');
      if (tSelector && mmPhases.includes(this.phase)) {
        const calId = 'tool-calib-' + this.phase;
        const rd = document.createElement('input'); rd.type = 'radio'; rd.name = 'tool-'+this.phase; rd.id = calId; rd.value = 'calib'; rd.className = 'tool-radio';
        const lb = document.createElement('label'); lb.htmlFor = calId; lb.className = 'tool-label'; lb.style.marginRight = 'auto'; // push it left
        lb.innerHTML = '<i data-lucide="ruler"></i> 実寸キャリブ';
        tSelector.prepend(lb); tSelector.prepend(rd);
        if(window.lucide) window.lucide.createIcons({root: lb});
      }
      this.toolRadios = this.card.querySelectorAll('.tool-radio');
      
      // Initialize activeTool from checked radio
      const checkedRadio = this.card.querySelector('.tool-radio:checked');
      if (checkedRadio) this.activeTool = checkedRadio.value;
      
      // Drag/Hover State
      this.hoveredPoint = null;
      this.draggingPoint = null;
      
      this.zoomLevel = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.isPanning = false;
      this.lastPanPt = null;
      this.imgRotation = 0; // Rotation in radians
      


      // Per-card Plot Toggle Initialization
      this.showPlots = true;
      const toggle = this.card.querySelector('.card-plot-toggle');
      if (toggle) {
        toggle.checked = true;
        toggle.addEventListener('change', (e) => {
          this.showPlots = e.target.checked;
          this.drawCanvas();
        });
      }

      // AI Analysis Button is initialized in initEvents()
      
      // Shade Take specific UI elements
      if (this.phase === 'shade-take') {
        this.shadeSwatch = this.card.querySelector('#shade-color-swatch');
        this.shadeIdValue = this.card.querySelector('#shade-result-id');
        this.shadeL = this.card.querySelector('#shade-lab-l');
        this.shadeA = this.card.querySelector('#shade-lab-a');
        this.shadeB = this.card.querySelector('#shade-lab-b');
        this.shadeDelta = this.card.querySelector('#shade-delta-e');
        
        // Calibration UI
        this.shadeCalibRef = this.card.querySelector('#shade-calib-ref');
        this.shadeCalibResetBtn = this.card.querySelector('#shade-calib-reset-btn');
        this.shadeCalibStatus = this.card.querySelector('#shade-calib-status');
        this.shadeOffsetValues = this.card.querySelector('#shade-offset-values');
        this.shadePlotList = this.card.querySelector('#shade-plot-list');
        this.shadePalette = this.card.querySelector('#shade-palette');
        this.shadeDiffPanel = this.card.querySelector('#shade-diff-panel');
        this.aiEnhanceBtn = this.card.querySelector('#btn-ai-enhance');
        this.shadeMagnifierContainer = this.card.querySelector('#shade-magnifier-container');
        this.shadeZoomCanvas = this.card.querySelector('#shade-zoom-canvas');
        this.shadeDiffA = null;
        this.shadeDiffB = null;
        this.shadeMapRect = null; // {x1, y1, x2, y2, active: bool, finalized: bool}
        
        // New Guide Selector Elements
        this.shadeGuideSelect = this.card.querySelector('#shade-guide-select');
        this.shadeGuideDescription = this.card.querySelector('#shade-guide-description');
        
        this.currentShadeGuideId = 'vita-classical'; 
        this.currentCalibId = 'A2'; // Default
        
        this.shadeOffset = { l: 0, a: 0, b: 0 };
        this.calibPoints = []; // [{id, sampledLab, offset, x, y}]
        this.shadeMatrixValues = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0";
        
        // Initialize dynamic palette
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
            this.aiEnhanceBtn.classList.remove('active'); // Ensure start as OFF
            this.aiEnhanceBtn.addEventListener('click', () => {
                this.aiEnhanceBtn.classList.toggle('active');
                this.updateAutoCorrectionMatrix();
                this.drawCanvas();
            });
        }
      }
      
      this.initEventListeners();
    }

    checkPrivacyModal(privacyModal) {
        const agreeBtn = document.getElementById('agree-button');
        if (privacyModal && agreeBtn) {
            // Always show modal on startup (removing localStorage check)
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
        this.initEvents();
    }

    /**
     * Calculate the optimal R,G,B gains (Exposure/White Balance) to match all calibPoints.
     */
    solveAutoCorrection() {
        if (this.calibPoints.length === 0) {
            this.shadeMatrixValues = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0";
            return;
        }

        let sumRIn = 0, sumROut = 0, sumGIn = 0, sumGOut = 0, sumBIn = 0, sumBOut = 0;
        this.calibPoints.forEach(p => {
            const ideal = ColorSpace.labToRgb(p.idealLab.l, p.idealLab.a, p.idealLab.b);
            sumRIn += p.sampledRGB.r; sumROut += ideal.r;
            sumGIn += p.sampledRGB.g; sumGOut += ideal.g;
            sumBIn += p.sampledRGB.b; sumBOut += ideal.b;
        });

        // Simple Average Gain Model
        const gainR = Math.min(3, sumROut / (sumRIn || 1));
        const gainG = Math.min(3, sumGOut / (sumGIn || 1));
        const gainB = Math.min(3, sumBOut / (sumBIn || 1));

        this.shadeMatrixValues = `${gainR.toFixed(3)} 0 0 0 0  0 ${gainG.toFixed(3)} 0 0 0  0 0 ${gainB.toFixed(3)} 0 0  0 0 0 1 0`;
    }

    updateAutoCorrectionMatrix() {
        const matrix = document.getElementById('shade-auto-matrix');
        if (!matrix) return;

        const isActive = this.aiEnhanceBtn && this.aiEnhanceBtn.classList.contains('active');
        if (isActive) {
            this.solveAutoCorrection();
            matrix.setAttribute('values', this.shadeMatrixValues);
            this.canvas.style.filter = 'url(#shade-auto-filter)';
        } else {
            this.canvas.style.filter = 'none';
        }
    }

    findHoverPoint(coords) {
       if (this.drawState !== 'idle' && this.drawState !== 'multi-point') return null;
       const threshold = 20 / coords.scale; 

       const multiMap = {
           'vertical-proportions': 'verticalProportions',
           'eline': 'eLine', 'nla': 'nla', 'wl-ratio': 'wlRatio',
           'red-prop': 'redProp', 'pink-esth': 'pinkEsth', 'smile-arc': 'smileArc',
           'corridor': 'corridor', 'gingival': 'gingival', 'axial-incl': 'axialIncl',
           'papilla': 'papilla', 'convexity': 'convexity'
       };
       let activeKey = this.activeTool && this.activeTool !== 'calib' ? (multiMap[this.activeTool] || this.activeTool) : null;

       for(let i=0; i<this.tempPoints.length; i++) {
          const p = this.tempPoints[i];
          if(Math.hypot(p.x - coords.realX, p.y - coords.realY) < threshold) return { key:'tempPoints', index:i, pt:p, mode:'multi' };
       }
       for (const key in this.lines) {
          if (activeKey && key !== activeKey) continue;
          const v = this.lines[key];
          if (key === 'shadeSample' && v) {
             if (this.activeTool === 'shade-picker' && Math.hypot(v.x - coords.realX, v.y - coords.realY) < threshold) {
                 return { key:'shadeSample', pt:v, mode:'shade' };
             }
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

       // Check standalone shade diff points
       if (this.phase === 'shade-take' && this.activeTool === 'shade-diff') {
           if (this.shadeDiffA && Math.hypot(this.shadeDiffA.x - coords.realX, this.shadeDiffA.y - coords.realY) < threshold) {
               return { key: 'shadeDiffA', pt: this.shadeDiffA, mode: 'shade-diff' };
           }
           if (this.shadeDiffB && Math.hypot(this.shadeDiffB.x - coords.realX, this.shadeDiffB.y - coords.realY) < threshold) {
               return { key: 'shadeDiffB', pt: this.shadeDiffB, mode: 'shade-diff' };
           }
       }

       return null;
    }

    initEvents() {
      // 1. Tool Selection
      const handleToolChange = (toolValue) => {
          this.activeTool = toolValue;
          this.tempStart = null;
          this.tempPoints = [];
          
          // State machine updates based on tool type
          const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
          if (multiHndls.includes(this.activeTool)) {
            this.drawState = 'multi-point';
            if(this.activeTool === 'vertical-proportions') this.showTooltip(PROPORTION_STEPS[0]);
            else if(this.activeTool === 'eline') this.showTooltip(ELINE_STEPS[0]);
            else if(this.activeTool === 'nla') this.showTooltip(NLA_STEPS[0]);
            else if(this.activeTool === 'convexity') this.showTooltip(CONVEXITY_STEPS[0]);
            else if(this.activeTool === 'wl-ratio') this.showTooltip(WL_STEPS[0]);
            else if(this.activeTool === 'red-prop') this.showTooltip(RED_STEPS[0]);
            else if(this.activeTool === 'pink-esth') this.showTooltip(PINK_STEPS[0]);
            else if(this.activeTool === 'smile-arc') this.showTooltip(ARC_STEPS[0]);
            else if(this.activeTool === 'corridor') this.showTooltip(CORRIDOR_STEPS[0]);
            else if(this.activeTool === 'gingival') this.showTooltip(GINGIVAL_STEPS[0]);
            else if(this.activeTool === 'axial-incl') this.showTooltip(AXIAL_STEPS[0]);
            else if(this.activeTool === 'papilla') this.showTooltip(PAPILLA_STEPS[0]);
          } else if (this.activeTool === 'hbar-ref') {
            this.drawState = 'idle'; this.showTooltip(HBAR_REF_STEPS[0]);
          } else if (this.activeTool === 'hbar-bar') {
            this.drawState = 'idle'; this.showTooltip(HBAR_BAR_STEPS[0]);
          } else if (this.activeTool === 'calib') {
            this.drawState = 'idle'; 
            this.showTooltip(CALIB_STEPS[0]);
          } else {
            this.drawState = 'idle';
            this.hideTooltip();
          }

          // Toggle Shade Palette Drawer
          if (this.phase === 'shade-take' && this.shadePalette) {
            const container = this.shadePalette.closest('.palette-container');
            if (container) {
              if (this.activeTool === 'shade-calibrator') {
                container.classList.add('open');
              } else {
                container.classList.remove('open');
              }
            }
          }

          this.drawCanvas();
      };

      this.toolRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.checked) {
              handleToolChange(e.target.value);
          }
        });
      });

      // Trigger initial state for the checked radio
      const initialChecked = this.card.querySelector('.tool-radio:checked');
      if (initialChecked) {
          handleToolChange(initialChecked.value);
      }

      // 2. Clear Lines
      if (this.btnReset) {
        this.btnReset.addEventListener('click', () => {
          this.lines = {}; this.tempStart = null; this.tempPoints = [];
          
          const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
          if (multiHndls.includes(this.activeTool)) {
             this.drawState = 'multi-point';
             if(this.activeTool === 'vertical-proportions') this.showTooltip(PROPORTION_STEPS[0]);
             else if(this.activeTool === 'eline') this.showTooltip(ELINE_STEPS[0]);
             else if(this.activeTool === 'nla') this.showTooltip(NLA_STEPS[0]);
             else if(this.activeTool === 'convexity') this.showTooltip(CONVEXITY_STEPS[0]);
             else if(this.activeTool === 'wl-ratio') this.showTooltip(WL_STEPS[0]);
             else if(this.activeTool === 'red-prop') this.showTooltip(RED_STEPS[0]);
             else if(this.activeTool === 'pink-esth') this.showTooltip(PINK_STEPS[0]);
             else if(this.activeTool === 'smile-arc') this.showTooltip(ARC_STEPS[0]);
             else if(this.activeTool === 'corridor') this.showTooltip(CORRIDOR_STEPS[0]);
             else if(this.activeTool === 'gingival') this.showTooltip(GINGIVAL_STEPS[0]);
             else if(this.activeTool === 'axial-incl') this.showTooltip(AXIAL_STEPS[0]);
             else if(this.activeTool === 'papilla') this.showTooltip(PAPILLA_STEPS[0]);
          } else if(this.activeTool === 'hbar-ref') {
             this.drawState = 'idle'; this.showTooltip(HBAR_REF_STEPS[0]);
          } else if(this.activeTool === 'hbar-bar') {
             this.drawState = 'idle'; this.showTooltip(HBAR_BAR_STEPS[0]);
          } else if(this.activeTool === 'calib') { 
             this.drawState = 'idle'; this.showTooltip(CALIB_STEPS[0]); 
          } else { 
             this.drawState = 'idle'; this.hideTooltip(); 
          }
          
          this.drawCanvas(); this.updateStats();
        });
      }

      // AI Analysis Button
      const aiBtn = this.card.querySelector('.ai-analyze-btn');
      if (aiBtn) {
          aiBtn.addEventListener('click', () => this.runAIAnalysis());
      }

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

      // 4. Canvas Mouse Click
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
        
        // Handle Dragging Existing Point
        if (this.hoveredPoint) {
           this.draggingPoint = this.hoveredPoint;
           this.canvas.style.cursor = 'grabbing';
           return;
        }
        
        // Calibration Tool
        if (this.activeTool === 'calib') {
           if (this.drawState === 'idle') {
             this.drawState = 'pt1-placed'; this.tempStart = coords; this.tempEnd = coords;
             this.showTooltip(CALIB_STEPS[1]);
             this.drawCanvas();
           } else if (this.drawState === 'pt1-placed') {
             this.tempEnd = coords;
             const distPx = Math.hypot(this.tempEnd.realX - this.tempStart.realX, this.tempEnd.realY - this.tempStart.realY);
             this.drawCanvas(); // draw line briefly
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
                this.updateStats(); // Recalculate
                this.drawCanvas();
             });
           }
           return;
        }

        // Shade Picker Handler
        if (this.activeTool === 'shade-picker') {
          this.updateShade(coords.realX, coords.realY);
          return;
        }

        // Shade Comparison Handler
        if (this.activeTool === 'shade-diff') {
          this.updateShade(coords.realX, coords.realY);
          return;
        }

        // Shade Calibration Handler
        if (this.activeTool === 'shade-calibrator') {
          this.calibrateShade(coords.realX, coords.realY);
          return;
        }

        // Multi-Point Handler
        if (this.drawState === 'multi-point') {
           let limits = 0; let texts = []; let storeKey = '';
           
           if (this.activeTool === 'vertical-proportions') { limits = 6; texts = PROPORTION_STEPS; storeKey = 'verticalProportions'; }
           if (this.activeTool === 'eline') { limits = 4; texts = ELINE_STEPS; storeKey = 'eLine'; }
           if (this.activeTool === 'nla') { limits = 3; texts = NLA_STEPS; storeKey = 'nla'; }
           if (this.activeTool === 'convexity') { limits = 3; texts = CONVEXITY_STEPS; storeKey = 'convexity'; }
           if (this.activeTool === 'wl-ratio') { limits = 8; texts = WL_STEPS; storeKey = 'wlRatio'; }
           if (this.activeTool === 'red-prop') { limits = 7; texts = RED_STEPS; storeKey = 'redProp'; }
           if (this.activeTool === 'pink-esth') { limits = 6; texts = PINK_STEPS; storeKey = 'pinkEsth'; }
           if (this.activeTool === 'smile-arc') { limits = 6; texts = ARC_STEPS; storeKey = 'smileArc'; }
           if (this.activeTool === 'corridor') { limits = 4; texts = CORRIDOR_STEPS; storeKey = 'corridor'; }
           if (this.activeTool === 'gingival') { limits = 4; texts = GINGIVAL_STEPS; storeKey = 'gingival'; }
           if (this.activeTool === 'axial-incl') { limits = 14; texts = AXIAL_STEPS; storeKey = 'axialIncl'; }
           if (this.activeTool === 'papilla') { limits = 5; texts = PAPILLA_STEPS; storeKey = 'papilla'; }

           if(limits === 0) return;

           if (this.tempPoints.length < limits) {
              this.tempPoints.push({ x: coords.realX, y: coords.realY });
              if (this.tempPoints.length < limits) {
                 this.showTooltip(texts[this.tempPoints.length]);
              } else {
                 this.lines[storeKey] = [...this.tempPoints];
                 this.drawState = 'idle';
                 this.hideTooltip();
                 this.showTooltip(texts[limits]);
                 setTimeout(() => this.hideTooltip(), 3000);
                 this.updateStats();
              }
              this.drawCanvas();
           }
           return;
        }

        // Shade Map (Rectangle Drag)
        if (this.activeTool === 'shade-map') {
            this.shadeMapRect = { x1: coords.realX, y1: coords.realY, x2: coords.realX, y2: coords.realY, active: true, finalized: false };
            this.drawCanvas();
            return;
        }

        // Standard 2-Point
        if (this.drawState === 'idle') {
          this.drawState = 'pt1-placed'; this.tempStart = coords; this.tempEnd = coords; this.drawCanvas();
        } else if (this.drawState === 'pt1-placed') {
          this.drawState = 'idle'; this.tempEnd = coords;
          this.lines[this.activeTool] = { startX: this.tempStart.realX, startY: this.tempStart.realY, endX: this.tempEnd.realX, endY: this.tempEnd.realY };
          
          if (this.activeTool === 'hbar-ref') this.showTooltip(HBAR_REF_STEPS[2]);
          else if (this.activeTool === 'hbar-bar') this.showTooltip(HBAR_BAR_STEPS[2]);
          
          this.tempStart = null; this.tempEnd = null; this.drawCanvas(); this.updateStats();
        }
      });

      // 5. Mouse Move
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
        
        // Handle Dragging
        if (this.draggingPoint) {
            const dp = this.draggingPoint;
            if (dp.mode === 'multi' || dp.mode === 'array') { dp.pt.x = coords.realX; dp.pt.y = coords.realY; }
            else if (dp.mode === 'start') { dp.pt.startX = coords.realX; dp.pt.startY = coords.realY; }
            else if (dp.mode === 'end') { dp.pt.endX = coords.realX; dp.pt.endY = coords.realY; }
            else if (dp.mode === 'shade' || dp.mode === 'shade-diff') {
                dp.pt.x = coords.realX;
                dp.pt.y = coords.realY;
                // Resample color during drag
                const newColor = this.sampleColorAt(coords.realX, coords.realY);
                dp.pt.r = newColor.r; dp.pt.g = newColor.g; dp.pt.b = newColor.b;
            }
            this.drawCanvas(); this.updateStats();
            return; // stop other hover actions during drag
        }

        // Hover Detection
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
      
      // Mouse Up (Global)
      window.addEventListener('mouseup', () => {
         if (this.shadeMapRect && this.shadeMapRect.active) {
             this.shadeMapRect.active = false;
             this.shadeMapRect.finalized = true;
             this.drawCanvas();
             this.updateStats();
         }
         if (this.isPanning) {
             this.isPanning = false;
             if(this.canvas) this.canvas.style.cursor = 'crosshair';
         }
         if (this.draggingPoint) {
            // 学習トリガー: 横顔の点をドラッグし終えたらパターンを保存
            if (this.phase === 'lateral' && ['eLine', 'nla', 'convexity'].includes(this.draggingPoint.key)) {
                this.saveProfilePattern();
            }
            this.draggingPoint = null;
            if (this.canvas && this.hoveredPoint) {
               this.canvas.style.cursor = 'grab';
            } else if (this.canvas) {
               this.canvas.style.cursor = 'crosshair';
            }
         }
      });
      
      // Context Menu block (for right click panning)
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());

      // Wheel Pan
      this.canvas.addEventListener('wheel', (e) => {
          if (!this.currentImage) return;
          e.preventDefault();
          this.panX -= e.deltaX;
          this.panY -= e.deltaY;
          this.drawCanvas();
      });
      
      // Vertical Zoom Slider binding
      const vSlider = this.card.querySelector('.vertical-zoom-slider');
      if (vSlider) {
          vSlider.addEventListener('input', (e) => {
             this.zoomLevel = parseInt(e.target.value) / 100;
             if (this.zoomLevel <= 1.0) { this.panX = 0; this.panY = 0; }
             this.drawCanvas();
          });
      }

      this.canvas.addEventListener('mouseleave', () => { 
        loupeContainer.classList.add('hidden'); 
      });
      this.canvas.addEventListener('mouseenter', (e) => {
         if (this.currentImage && this.activeTool) { loupeContainer.classList.remove('hidden'); this.updateMagnifier(e); }
      });

       // Rotation logic bindings
       const btnRotInter = this.card.querySelector('.rotate-inter-btn');
       if (btnRotInter) {
          btnRotInter.addEventListener('click', () => {
             const line = this.lines['interpupillary'] || this.lines['interpupillary-e'];
             if (line) {
                 let cx = line.endX - line.startX;
                 let cy = line.endY - line.startY;
                 if (cx < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = -Math.atan2(cy, cx);
                 this.drawCanvas();
             } else { alert('基準となる瞳孔間線がプロットされていません。'); }
          });
       }

       const btnRotMid = this.card.querySelector('.rotate-mid-btn');
       if (btnRotMid) {
          btnRotMid.addEventListener('click', () => {
             const line = this.lines['midline'] || this.lines['f-midline'];
             if (line) {
                 let cx = line.endX - line.startX;
                 let cy = line.endY - line.startY;
                 if (cy < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = (Math.PI / 2) - Math.atan2(cy, cx);
                 this.drawCanvas();
             } else { alert('基準となる顔貌正中線がプロットされていません。'); }
          });
       }

       const btnApplyP3Mid = this.card.querySelector('.apply-p3-mid-btn');
       if (btnApplyP3Mid) {
          btnApplyP3Mid.addEventListener('click', () => {
             const phase3Card = window.appCards.find(c => c.phase === 'e-midline');
             if (phase3Card && phase3Card.lines['f-midline']) {
                 const line = phase3Card.lines['f-midline'];
                 let cx = line.endX - line.startX;
                 let cy = line.endY - line.startY;
                 if (cy < 0) { cx = -cx; cy = -cy; }
                 this.imgRotation = (Math.PI / 2) - Math.atan2(cy, cx);
                 this.drawCanvas();
                 alert('Phase 3の顔貌正中線の傾き（補正量）を適用しました。');
             } else { alert('Phase 3 (E音発音時) で顔貌正中線がプロットされていません。'); }
           });
        }

        const btnRotHBarRef = this.card.querySelector(".rotate-hbar-ref-btn");
        if (btnRotHBarRef) {
           btnRotHBarRef.addEventListener("click", () => {
              const line = this.lines["hbar-ref"];
              if (line) {
                  let cx = line.endX - line.startX;
                  let cy = line.endY - line.startY;
                  if (cx < 0) { cx = -cx; cy = -cy; }
                  this.imgRotation = -Math.atan2(cy, cx);
                  this.drawCanvas();
                  this.updateStats();
              } else { alert("基準となる水平基準プロットが引かれていません。"); }
           });
        }
     }
    showTooltip(text) { 
        const gInfo = document.getElementById('global-tooltip');
        if(gInfo) { gInfo.textContent = text; gInfo.classList.remove('hidden'); }
        const aest = document.getElementById('aesthetic-explanation');
        if(aest) {
            aest.textContent = TOOL_EXPLANATIONS[this.activeTool] || 'ツールの評価目的がここに表示されます。';
        }
    }
    hideTooltip() { 
        const gInfo = document.getElementById('global-tooltip');
        if(gInfo) { gInfo.classList.add('hidden'); }
    }

    async runAIAnalysis() {
        if (!this.currentImage) {
            alert("先に画像を読み込んでください。");
            return;
        }

        const aiBtn = this.card.querySelector('.ai-analyze-btn');
        const originalBtnHTML = aiBtn.innerHTML;

        // 横顔フェーズでは「鼻先クリック」方式を採用
        if (this.phase === 'lateral') {
            if (this.guidedMode) {
                this.guidedMode = false;
                aiBtn.innerHTML = originalBtnHTML;
                this.hideTooltip();
                return;
            }
            this.guidedMode = true;
            aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">鼻先をクリック...</span>';
            this.showTooltip("画像上の「鼻の先端」を1回クリックしてください。AIが輪郭を自動抽出します。");
            return;
        }

        aiBtn.disabled = true;
        aiBtn.innerHTML = '<i class="spinner"></i> <span style="font-size:0.85em">AI解析中...</span>';
        this.card.classList.add('ai-scanning');

        try {
            const landmarker = await initFaceLandmarker();
            if (!landmarker) throw new Error("AIモデルの初期化に失敗しました。");

            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = this.currentImage.width;
            offscreenCanvas.height = this.currentImage.height;
            const oCtx = offscreenCanvas.getContext('2d');
            oCtx.drawImage(this.currentImage, 0, 0);

            const result = landmarker.detect(offscreenCanvas);
            
            // 診断結果の参照: 正面(frontal)のキャリブレーション値を自動引き継ぎ
            if (this.phase !== 'frontal' && this.pxToMm === 0.075) {
                const frontalCard = window.appCards.find(c => c.phase === 'frontal');
                if (frontalCard && frontalCard.pxToMm !== 0.075) {
                    this.pxToMm = frontalCard.pxToMm;
                    const statusEl = this.card.querySelector('.calib-status');
                    if(statusEl) statusEl.textContent = `[1px = ${this.pxToMm.toFixed(4)}mm (正面から引用)]`;
                    console.log("Calibration data shared from frontal phase:", this.pxToMm);
                }
            }

            if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
                if (this.phase === 'lateral') {
                    console.log("MediaPipe failed for lateral view. Attempting Silhouette Profile Analysis...");
                    const success = this.analyzeProfileSilhouette(offscreenCanvas);
                    if(!success) {
                        alert("横顔の自動検出に失敗しました。\n背景が無地の場所で撮影するか、手動でプロットしてください。\n\n【ヒント】\n真横の画像はシルエット解析により、ある程度補正可能です。");
                    }
                } else {
                    alert("顔が検出されませんでした。正面を向いた鮮明な画像でお試しください。");
                }
            } else {
                const landmarks = result.faceLandmarks[0];
                this.applyLandmarksToPlots(landmarks, offscreenCanvas.width, offscreenCanvas.height);
            }

        } catch (err) {
            console.error("AI Analysis Error:", err);
            alert("解析中にエラーが発生しました：\n" + err.message);
        } finally {
            aiBtn.disabled = false;
            aiBtn.innerHTML = originalBtnHTML;
            this.card.classList.remove('ai-scanning');
            if (window.lucide) window.lucide.createIcons({ root: aiBtn });
        }
    }

    // 配置した点を周辺の輪郭にのみ吸着させる
    snapPointToEdge(pt, data, imgW, bgLum, radius = 40) {
        let bestX = pt.x;
        const scanYStart = Math.max(0, pt.y - 10);
        const scanYEnd = Math.min(data.height - 1, pt.y + 10);
        let maxRightX = -1;

        const getLum = (x, y) => {
            const idx = (Math.floor(y) * imgW + Math.floor(x)) * 4;
            return (data.data[idx] + data.data[idx+1] + data.data[idx+2]) / 3;
        };

        for(let y = scanYStart; y < scanYEnd; y += 2) {
            for(let x = Math.min(imgW - 1, pt.x + radius); x > pt.x - radius; x -= 2) {
                if(Math.abs(getLum(x, y) - bgLum) > 30) {
                    if(x > maxRightX) maxRightX = x;
                    break;
                }
            }
        }
        return maxRightX > 0 ? { x: maxRightX, y: pt.y } : pt;
    }

    // 学習機能: 鼻先からの相対距離を保存
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
       console.log("Profile pattern learned & saved.");
    }

    loadProfilePattern() {
       const saved = localStorage.getItem('aesthetic_profile_pattern');
       if(!saved) return null;
       return JSON.parse(saved);
    }

    // ユーザーがクリックした鼻先の座標を起点としてシルエット解析を行う (記憶優先スナップ型)
    analyzeFromNoseClick(startX, startY) {
        this.guidedMode = false;
        const aiBtn = this.card.querySelector('.ai-analyze-btn');
        if (aiBtn) {
            aiBtn.innerHTML = '<i data-lucide="sparkles"></i> AI自動解析';
            if (window.lucide) window.lucide.createIcons({ root: aiBtn });
        }
        this.hideTooltip();

        const canvas = document.createElement('canvas');
        canvas.width = this.currentImage.width;
        canvas.height = this.currentImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.currentImage, 0, 0);

        const imgW = canvas.width;
        const imgH = canvas.height;
        const imageData = ctx.getImageData(0, 0, imgW, imgH);
        const data = imageData.data;

        // 輝度取得
        const getLum = (x, y) => {
            const idx = (Math.floor(y) * imgW + Math.floor(x)) * 4;
            return (data[idx] + data[idx+1] + data[idx+2]) / 3;
        };

        // 背景色のサンプリング (画面右上を背景と仮定)
        let bgLum = 0;
        for(let i=0; i<10; i++) bgLum += getLum(imgW - 10 - i, 10 + i);
        bgLum /= 10;

        // 1. 真の鼻先（Pronasale）の特定
        let pn = { x: startX, y: startY };
        let maxRightX = startX;
        for(let y = startY - 20; y < startY + 20; y += 2) {
            if(y < 0 || y >= imgH) continue;
            for(let x = Math.min(imgW - 1, startX + 100); x > startX - 20; x -= 2) {
                if(Math.abs(getLum(x, y) - bgLum) > 30) {
                    if(x > maxRightX) { maxRightX = x; pn = { x: x, y: y }; }
                    break; 
                }
            }
        }

        // 2. 記憶データの読み込み
        const pattern = this.loadProfilePattern();
        let pg, ls, li, sn;

        if (pattern) {
            // A. 学習済みの相対座標を適用 (画像サイズでスケール調整)
            const scale = imgH / pattern.imgH;
            pg = { x: pn.x + pattern.offsets.pg.dx * scale, y: pn.y + pattern.offsets.pg.dy * scale };
            ls = { x: pn.x + pattern.offsets.ls.dx * scale, y: pn.y + pattern.offsets.ls.dy * scale };
            li = { x: pn.x + pattern.offsets.li.dx * scale, y: pn.y + pattern.offsets.li.dy * scale };
            sn = pattern.offsets.sn ? { x: pn.x + pattern.offsets.sn.dx * scale, y: pn.y + pattern.offsets.sn.dy * scale } : { x: (pn.x+ls.x)/2, y: (pn.y+ls.y)/2 };
            
            // B. 仮置き位置の近傍のみで輪郭に吸着 (周辺ノイズ無視)
            pg = this.snapPointToEdge(pg, imageData, imgW, bgLum, 60);
            ls = this.snapPointToEdge(ls, imageData, imgW, bgLum, 30);
            li = this.snapPointToEdge(li, imageData, imgW, bgLum, 30);
            sn = this.snapPointToEdge(sn, imageData, imgW, bgLum, 30);
            
            console.log("Memory applied and snapped.");
        } else {
            // 初回のデフォルト配置 (日本人平均プロンプト案)
            pg = { x: pn.x - 20, y: pn.y + imgH * 0.25 };
            ls = { x: pn.x - 30, y: pn.y + imgH * 0.08 };
            li = { x: pn.x - 25, y: pn.y + imgH * 0.16 };
            sn = { x: (pn.x + ls.x)/2, y: (pn.y + ls.y)/2 };
            
            // 輪郭へ吸着
            pg = this.snapPointToEdge(pg, imageData, imgW, bgLum, 100);
            ls = this.snapPointToEdge(ls, imageData, imgW, bgLum, 60);
            li = this.snapPointToEdge(li, imageData, imgW, bgLum, 60);
            sn = this.snapPointToEdge(sn, imageData, imgW, bgLum, 40);
        }

        // キャリブレーション参照
        if (this.pxToMm === 0.075) {
            const frontalCard = window.appCards.find(c => c.phase === 'frontal');
            if (frontalCard && frontalCard.pxToMm !== 0.075) {
                this.pxToMm = frontalCard.pxToMm;
                const st = this.card.querySelector('.calib-status');
                if(st) st.textContent = `[1px = ${this.pxToMm.toFixed(4)}mm (正面から引用)]`;
            }
        }

        // プロット配置
        this.lines.eLine = [pn, pg, ls, li];
        this.lines.nla = [{x: pn.x, y: pn.y + 15}, sn, ls];
        this.lines.convexity = [{x: pn.x, y: pn.y - 60}, sn, pg];

        this.updateStats();
        this.drawCanvas();
        this.showTooltip("記憶データを適用しました。必要に応じて微調整してください。修正すると学習内容が更新されます。");
    }

    // 真横の画像をピクセル操作で解析して輪郭をとる特殊エンジン
    analyzeProfileSilhouette(canvas) {
        const ctx = canvas.getContext('2d');
        const imgW = canvas.width;
        const imgH = canvas.height;
        const imageData = ctx.getImageData(0, 0, imgW, imgH);
        const data = imageData.data;

        // 輪郭検出 (簡単なエッジ検出と輝度走査)
        const getLum = (x, y) => {
            const idx = (y * imgW + x) * 4;
            return (data[idx] + data[idx+1] + data[idx+2]) / 3;
        };

        const stepH = Math.floor(imgH / 200) || 1; 
        
        // サンプリングして顔の向きを判定 (左端か右端か)
        let leftLum = 0, rightLum = 0;
        for(let y=stepH; y < imgH; y+=stepH*10) {
           leftLum += getLum(Math.floor(imgW*0.1), y);
           rightLum += getLum(Math.floor(imgW*0.9), y);
        }
        const facingLeft = leftLum < rightLum; // 暗い方が顔、明るい方が背景と仮定

        const profilePoints = [];
        
        for(let y=0; y < imgH; y += stepH) {
            let foundX = facingLeft ? 0 : imgW - 1;
            let threshold = 30; // 適宜調整
            
            if(facingLeft) {
                for(let x=0; x < imgW * 0.6; x += 2) {
                    const l1 = getLum(x, y); const l2 = getLum(x+4, y);
                    if(Math.abs(l1 - l2) > threshold) { foundX = x; break; }
                }
            } else {
                for(let x=imgW-1; x > imgW * 0.4; x -= 2) {
                    const l1 = getLum(x, y); const l2 = getLum(x-4, y);
                    if(Math.abs(l1 - l2) > threshold) { foundX = x; break; }
                }
            }
            profilePoints.push({x: foundX, y});
        }

        // 輪郭波形から特徴点を幾何学的に特定
        // 1. 最も突出している点 (鼻先)
        let pronasaleIndex = 0;
        let extX = facingLeft ? -1 : imgW + 1;
        profilePoints.forEach((p, i) => {
            if(facingLeft ? (p.x > extX) : (p.x < extX)) {
                if(p.y > imgH*0.2 && p.y < imgH*0.8) { // 画面中央付近限定
                    extX = p.x; pronasaleIndex = i;
                }
            }
        });

        const pn = profilePoints[pronasaleIndex];
        if(!pn || pn.x === (facingLeft ? 0 : imgW-1)) return false;

        // 2. 他の点の推定 (鼻先からの相対距離でスキャン範囲を限定)
        // オトガイ
        let pogonionIndex = -1;
        let pogX = facingLeft ? -1 : imgW+1;
        for(let i = pronasaleIndex + 20; i < profilePoints.length; i++) {
            const p = profilePoints[i];
            if(p.y > imgH * 0.85) break; 
            if(facingLeft ? (p.x > pogX) : (p.x < pogX)) {
                pogX = p.x; pogonionIndex = i;
            }
        }
        const pg = profilePoints[pogonionIndex] || {x: pn.x, y: pn.y + imgH*0.3};

        // 唇 (鼻先とオトガイの間)
        let lsIndex = -1, liIndex = -1;
        let lsX = facingLeft ? -1 : imgW, liX = facingLeft ? -1 : imgW;
        for(let i = pronasaleIndex+5; i < (pogonionIndex > 0 ? pogonionIndex : profilePoints.length); i++) {
            const p = profilePoints[i];
            if(p.y > pg.y - imgH*0.05) break;
            // 上唇・下唇の簡易推定（山を探す）
            if(i < pronasaleIndex + (pogonionIndex-pronasaleIndex)/2) {
                if(facingLeft ? (p.x > lsX) : (p.x < lsX)) { lsX = p.x; lsIndex = i; }
            } else {
                if(facingLeft ? (p.x > liX) : (p.x < liX)) { liX = p.x; liIndex = i; }
            }
        }
        const ls = profilePoints[lsIndex] || {x: pn.x * 0.9, y: pn.y + imgH*0.1};
        const li = profilePoints[liIndex] || {x: pn.x * 0.9, y: pn.y + imgH*0.2};
        const sn = { x: (pn.x + ls.x)/2, y: (pn.y + ls.y)/2 }; // 鼻下点

        // プロットをセット
        this.lines.eLine = [pn, pg, ls, li];
        this.lines.nla = [{x: pn.x, y: pn.y + 10}, sn, ls];
        this.lines.convexity = [{x: pn.x, y: pn.y - 40}, sn, pg];

        this.updateStats();
        this.drawCanvas();
        return true;
    }

    applyLandmarksToPlots(landmarks, imgW, imgH) {
        const getPt = (idx) => ({
            x: landmarks[idx].x * imgW,
            y: landmarks[idx].y * imgH
        });

        if (this.phase === 'frontal' || this.phase === 'e-midline') {
            const rEye = getPt(468);
            const lEye = getPt(473);
            const midTop = getPt(168);
            const midBtm = getPt(152);
            const lMouth = getPt(61);
            const rMouth = getPt(291);

            if (this.phase === 'frontal') {
                this.lines.interpupillary = {
                    startX: lEye.x, startY: lEye.y,
                    endX: rEye.x, endY: rEye.y
                };
                this.lines.midline = {
                    startX: midTop.x, startY: midTop.y,
                    endX: midBtm.x, endY: midBtm.y
                };
                this.lines.commissural = {
                    startX: lMouth.x, startY: lMouth.y,
                    endX: rMouth.x, endY: rMouth.y
                };
            }
        } else if (this.phase === 'lateral') {
            const pn = getPt(1);   // Pronasale
            const sn = getPt(2);   // Subnasale
            const g = getPt(168);  // Glabella
            const pg = getPt(152); // Pogonion/Menton
            const ls = getPt(0);   // Labrale Superius
            const li = getPt(17);  // Labrale Inferius
            const col = getPt(4);  // Columella

            this.lines.eLine = [pn, pg, ls, li];
            this.lines.nla = [col, sn, ls];
            this.lines.convexity = [g, sn, pg];

        } else if (this.phase === 'e-sound') {
            const lc = getPt(61);  // Left corner
            const rc = getPt(291); // Right corner
            const ut = getPt(13);  // Upper lip bottom center
            const lt = getPt(14);  // Lower lip top center
            
            // Smile Arc Approximation
            this.lines.smileArc = [
                {x: (rc.x + ut.x)/2, y: (rc.y + ut.y)/2}, 
                ut, 
                {x: (lc.x + ut.x)/2, y: (lc.y + ut.y)/2},
                {x: (rc.x + lt.x)/2, y: (rc.y + lt.y)/2 + 10}, 
                lt, 
                {x: (lc.x + lt.x)/2, y: (lc.y + lt.y)/2 + 10}
            ];
            this.lines.corridor = [rc, {x: rc.x - 20, y: rc.y}, {x: lc.x + 20, y: lc.y}, lc];
            this.lines.gingival = [getPt(164), {x: ut.x, y: ut.y - 5}, ut, lt];
        } 
        
        if (this.updateStats) this.updateStats();
        this.drawCanvas();
    }

    handleImage(file) {
      if (!file.type.match('image.*')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          this.currentImage = img; this.placeholder.style.display = 'none'; this.lines = {}; this.tempPoints = [];
          
          const multiHndls = ['vertical-proportions', 'eline', 'nla', 'wl-ratio', 'red-prop', 'pink-esth', 'smile-arc', 'corridor', 'gingival', 'axial-incl', 'papilla', 'convexity'];
          if (multiHndls.includes(this.activeTool)) {
              this.drawState = 'multi-point';
              if(this.activeTool === 'vertical-proportions') this.showTooltip(PROPORTION_STEPS[0]);
              if(this.activeTool === 'eline') this.showTooltip(ELINE_STEPS[0]);
              if(this.activeTool === 'nla') this.showTooltip(NLA_STEPS[0]);
              if(this.activeTool === 'convexity') this.showTooltip(CONVEXITY_STEPS[0]);
              if(this.activeTool === 'wl-ratio') this.showTooltip(WL_STEPS[0]);
              if(this.activeTool === 'red-prop') this.showTooltip(RED_STEPS[0]);
              if(this.activeTool === 'pink-esth') this.showTooltip(PINK_STEPS[0]);
              if(this.activeTool === 'smile-arc') this.showTooltip(ARC_STEPS[0]);
              if(this.activeTool === 'corridor') this.showTooltip(CORRIDOR_STEPS[0]);
              if(this.activeTool === 'gingival') this.showTooltip(GINGIVAL_STEPS[0]);
              if(this.activeTool === 'axial-incl') this.showTooltip(AXIAL_STEPS[0]);
              if(this.activeTool === 'papilla') this.showTooltip(PAPILLA_STEPS[0]);
          } else { this.drawState = 'idle'; }
          this.resizeCanvas(); this.updateStats();
        };
        img.src = event.target.result;
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
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      
      const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
      const xOffset = (this.canvas.width / 2) + this.panX;
      const yOffset = (this.canvas.height / 2) + this.panY;
      
      // Inverse rotation then inverse scale/translate
      const dx = mouseX - xOffset;
      const dy = mouseY - yOffset;
      const cos = Math.cos(-this.imgRotation);
      const sin = Math.sin(-this.imgRotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      
      const realX = rx / scale + (this.currentImage.width / 2);
      const realY = ry / scale + (this.currentImage.height / 2);

      return { realX, realY, mouseX, mouseY, scale, xOffset, yOffset };
    }

    updateMagnifier(e) {
      if(!loupeCtx) return;
      const coords = this.getMouseCoords(e);
      // No more absolute positioning since loupe is fixed in side-panel
      loupeCtx.clearRect(0, 0, LOUPE_SIZE_W, LOUPE_SIZE_H);
      loupeCtx.fillStyle = '#eef2f6';
      loupeCtx.fillRect(0, 0, LOUPE_SIZE_W, LOUPE_SIZE_H);
      
      const viewRadW = (LOUPE_SIZE_W / 2) / MAGNIFICATION; 
      const viewRadH = (LOUPE_SIZE_H / 2) / MAGNIFICATION; 
      const sx = coords.realX - viewRadW; const sy = coords.realY - viewRadH;
      const sWidth = viewRadW * 2; const sHeight = viewRadH * 2;
      try { loupeCtx.drawImage(this.currentImage, sx, sy, sWidth, sHeight, 0, 0, LOUPE_SIZE_W, LOUPE_SIZE_H); } catch(err) {} 
      loupeContainer.classList.remove('hidden');
    }

    drawCanvas() {
      if (!this.currentImage) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height) * this.zoomLevel;
      
      const centerX = (this.canvas.width / 2) + this.panX;
      const centerY = (this.canvas.height / 2) + this.panY;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(this.imgRotation);
      
      // Apply Visual Correction Filter if enabled
      if (this.phase === 'shade-take' && this.shadePreviewToggle && this.shadePreviewToggle.checked && (this.shadeOffset.l !== 0 || this.shadeOffset.a !== 0 || this.shadeOffset.b !== 0)) {
          this.ctx.filter = 'url(#shade-correction-filter)';
      } else {
          this.ctx.filter = 'none';
      }

      this.ctx.drawImage(this.currentImage, - (this.currentImage.width / 2) * scale, - (this.currentImage.height / 2) * scale, this.currentImage.width * scale, this.currentImage.height * scale);
      this.ctx.filter = 'none'; // reset for other drawings
      this.ctx.restore();
      
      const mapC = (nx, ny) => {
         // Forward transform: Scale -> Translate to center -> Rotate -> Translate to canvas center + pan
         const sx = (nx - this.currentImage.width / 2) * scale;
         const sy = (ny - this.currentImage.height / 2) * scale;
         const cos = Math.cos(this.imgRotation);
         const sin = Math.sin(this.imgRotation);
         return {
            x: sx * cos - sy * sin + centerX,
            y: sx * sin + sy * cos + centerY
         };
      };

      if (!this.showPlots) return;

      // Draw all general lines
      const excludeTools = ['verticalProportions', 'eLine', 'nla', 'wlRatio', 'redProp', 'pinkEsth', 'smileArc', 'corridor', 'gingival', 'axialIncl', 'papilla'];
      for (const toolName in this.lines) {
        if (excludeTools.includes(toolName)) continue; 
        const lineData = this.lines[toolName];
        if (lineData) this.drawLineSpec(lineData, toolName, mapC);
      }
      
      if (this.lines.verticalProportions) this.drawProportionLines(this.lines.verticalProportions, mapC, false);
      if (this.activeTool === 'vertical-proportions' && this.tempPoints.length < 6 && this.tempPoints.length > 0) this.drawProportionLines(this.tempPoints, mapC, true);
      
      if (this.lines.eLine) this.drawELine(this.lines.eLine, mapC, false);
      if (this.activeTool === 'eline' && this.tempPoints.length < 4 && this.tempPoints.length > 0) this.drawELine(this.tempPoints, mapC, true);
      
      if (this.lines.nla) this.drawNla(this.lines.nla, mapC, false);
      if (this.activeTool === 'nla' && this.tempPoints.length < 3 && this.tempPoints.length > 0) this.drawNla(this.tempPoints, mapC, true);

      if (this.lines.convexity) this.drawConvexity(this.lines.convexity, mapC, false);
      if (this.activeTool === 'convexity' && this.tempPoints.length < 3 && this.tempPoints.length > 0) this.drawConvexity(this.tempPoints, mapC, true);

      if (this.lines.wlRatio) this.drawWlRatio(this.lines.wlRatio, mapC, false);
      if (this.activeTool === 'wl-ratio' && this.tempPoints.length < 8 && this.tempPoints.length > 0) this.drawWlRatio(this.tempPoints, mapC, true);

      if (this.lines.redProp) this.drawRedProp(this.lines.redProp, mapC, false);
      if (this.activeTool === 'red-prop' && this.tempPoints.length < 7 && this.tempPoints.length > 0) this.drawRedProp(this.tempPoints, mapC, true);

      if (this.lines.pinkEsth) this.drawPinkEsth(this.lines.pinkEsth, mapC, false);
      if (this.activeTool === 'pink-esth' && this.tempPoints.length < 6 && this.tempPoints.length > 0) this.drawPinkEsth(this.tempPoints, mapC, true);

      if (this.lines.axialIncl) this.drawAxial(this.lines.axialIncl, mapC, false);
      if (this.activeTool === 'axial-incl' && this.tempPoints.length < 14 && this.tempPoints.length > 0) {
          const tmps = [...this.tempPoints]; if(this.tempEnd) tmps.push({x:this.tempEnd.realX, y:this.tempEnd.realY});
          this.drawAxial(tmps, mapC, true);
      }
      
      if (this.lines.papilla) this.drawPapilla(this.lines.papilla, mapC, false);
      if (this.activeTool === 'papilla' && this.tempPoints.length < 5 && this.tempPoints.length > 0) {
          const tmps = [...this.tempPoints]; if(this.tempEnd) tmps.push({x:this.tempEnd.realX, y:this.tempEnd.realY});
          this.drawPapilla(tmps, mapC, true);
      }

      // E-Sound specific
      if (this.lines.smileArc) this.drawSmileArc(this.lines.smileArc, mapC, false);
      if (this.activeTool === 'smile-arc' && this.tempPoints.length < 6 && this.tempPoints.length > 0) {
          const tmps = [...this.tempPoints]; if(this.tempEnd) tmps.push({x:this.tempEnd.realX, y:this.tempEnd.realY});
          this.drawSmileArc(tmps, mapC, true);
      }
      
      if (this.lines.corridor) this.drawCorridor(this.lines.corridor, mapC, false);
      if (this.activeTool === 'corridor' && this.tempPoints.length < 4 && this.tempPoints.length > 0) {
          const tmps = [...this.tempPoints]; if(this.tempEnd) tmps.push({x:this.tempEnd.realX, y:this.tempEnd.realY});
          this.drawCorridor(tmps, mapC, true);
      }
      
      if (this.lines.gingival) this.drawGingival(this.lines.gingival, mapC, false);
      if (this.activeTool === 'gingival' && this.tempPoints.length < 4 && this.tempPoints.length > 0) {
          const tmps = [...this.tempPoints]; if(this.tempEnd) tmps.push({x:this.tempEnd.realX, y:this.tempEnd.realY});
          this.drawGingival(tmps, mapC, true);
      }
      
      // Standard 2-point
      if (this.drawState === 'pt1-placed' && this.tempStart && this.tempEnd) {
        const tempLine = { startX: this.tempStart.realX, startY: this.tempStart.realY, endX: this.tempEnd.realX, endY: this.tempEnd.realY };
        this.drawLineSpec(tempLine, this.activeTool, mapC, true);
        const pt1 = mapC(tempLine.startX, tempLine.startY);
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.beginPath(); this.ctx.arc(pt1.x, pt1.y, 6, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff'; this.ctx.lineWidth = 1; this.ctx.stroke();
      }
      
      // Phase 9: Horizontal Bar
      if (this.lines['hbar-ref']) this.drawLineSpec(this.lines['hbar-ref'], 'hbar-ref', mapC);
      if (this.lines['hbar-bar']) this.drawLineSpec(this.lines['hbar-bar'], 'hbar-bar', mapC);

      // Phase 10: Shade Take
      if (this.lines.shadeSample) this.drawShadeSample(this.lines.shadeSample, mapC);
      
      // Draw Shade Comparison Points (Hollow Ring Design)
      if (this.activeTool === 'shade-diff' && this.shadeDiffA) {
          const m1 = mapC(this.shadeDiffA.x, this.shadeDiffA.y);
          // Hollow ring A
          this.ctx.beginPath();
          this.ctx.arc(m1.x, m1.y, 10, 0, Math.PI*2);
          this.ctx.strokeStyle = '#6366f1';
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
          // Inner white ring for visibility
          this.ctx.beginPath();
          this.ctx.arc(m1.x, m1.y, 8, 0, Math.PI*2);
          this.ctx.strokeStyle = 'white';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
          
          this.ctx.font = 'bold 14px Inter';
          this.ctx.fillStyle = '#6366f1';
          this.ctx.fillText("A (Ref)", m1.x + 15, m1.y - 15);

          if (this.shadeDiffB) {
              const m2 = mapC(this.shadeDiffB.x, this.shadeDiffB.y);
              // Hollow ring B
              this.ctx.beginPath();
              this.ctx.arc(m2.x, m2.y, 10, 0, Math.PI*2);
              this.ctx.strokeStyle = '#ec4899';
              this.ctx.lineWidth = 4;
              this.ctx.stroke();
              // Inner white ring
              this.ctx.beginPath();
              this.ctx.arc(m2.x, m2.y, 8, 0, Math.PI*2);
              this.ctx.strokeStyle = 'white';
              this.ctx.lineWidth = 1.5;
              this.ctx.stroke();

              this.ctx.font = 'bold 14px Inter';
              this.ctx.fillStyle = '#ec4899';
              this.ctx.fillText("B (Target)", m2.x + 15, m2.y - 15);
          }
      }

      // Pro-Shade Map (Gradient / Contour)
      if (this.activeTool === 'shade-map' && this.shadeMapRect) {
          this.drawShadeMapOverlay(mapC);
      }
      
      // Draw Calibration Points
      if (this.phase === 'shade-take' && this.calibPoints) {
          this.calibPoints.forEach(p => {
              const m = mapC(p.x, p.y);
              this.ctx.strokeStyle = '#10b981';
              this.ctx.lineWidth = 1;
              this.ctx.beginPath();
              this.ctx.moveTo(m.x - 10, m.y); this.ctx.lineTo(m.x + 10, m.y);
              this.ctx.moveTo(m.x, m.y - 10); this.ctx.lineTo(m.x, m.y + 10);
              this.ctx.stroke();
              this.ctx.font = '10px sans-serif';
              this.ctx.fillStyle = '#10b981';
              this.ctx.fillText(p.id, m.x + 12, m.y - 12);
          });
      }
    }

    drawShadeSample(s, mapC) {
        const m = mapC(s.x, s.y);
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        // Crosshair
        this.ctx.moveTo(m.x - 15, m.y); this.ctx.lineTo(m.x + 15, m.y);
        this.ctx.moveTo(m.x, m.y - 15); this.ctx.lineTo(m.x, m.y + 15);
        this.ctx.stroke();
        // Target circle
        this.ctx.beginPath();
        this.ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
        this.ctx.stroke();
        // Outer glow/contrast
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawShadeMapOverlay(mapC) {
        const r = this.shadeMapRect;
        const xMin = Math.min(r.x1, r.x2);
        const yMin = Math.min(r.y1, r.y2);
        const xMax = Math.max(r.x1, r.x2);
        const yMax = Math.max(r.y1, r.y2);

        const mMin = mapC(xMin, yMin);
        const mMax = mapC(xMax, yMax);

        // 1. Dimming Effect (Overlay except the inner rect)
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        // Top
        this.ctx.fillRect(0, 0, this.canvas.width, mMin.y);
        // Bottom
        this.ctx.fillRect(0, mMax.y, this.canvas.width, this.canvas.height - mMax.y);
        // Left (center row)
        this.ctx.fillRect(0, mMin.y, mMin.x, mMax.y - mMin.y);
        // Right (center row)
        this.ctx.fillRect(mMax.x, mMin.y, this.canvas.width - mMax.x, mMax.y - mMin.y);
        this.ctx.restore();

        // 2. Selection border
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(mMin.x, mMin.y, mMax.x - mMin.x, mMax.y - mMin.y);
        this.ctx.setLineDash([]);

        if (!r.finalized) return;

        // 3. Generate 10x10 Grid (Fixed 100 Squares)
        const gridCells = 10;
        const results = [];
        const guide = SHADE_GUIDES[this.currentShadeGuideId];
        if (!guide) return;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.currentImage.width;
        offCanvas.height = this.currentImage.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(this.currentImage, 0, 0);
        
        const realXMin = Math.floor(Math.min(xMin, xMax));
        const realYMin = Math.floor(Math.min(yMin, yMax));
        const rw = Math.floor(Math.abs(xMax - xMin));
        const rh = Math.floor(Math.abs(yMax - yMin));

        if (rw < 10 || rh < 10) return; // Ignore too small areas

        const imgData = offCtx.getImageData(realXMin, realYMin, rw, rh);
        const roiData = imgData.data;
        const actualW = imgData.width;

        const cellW = rw / gridCells;
        const cellH = rh / gridCells;

        for (let gx = 0; gx < gridCells; gx++) {
            const row = [];
            for (let gy = 0; gy < gridCells; gy++) {
                // Average color in this cell
                let sR = 0, sG = 0, sB = 0, count = 0;
                const startX = Math.floor(gx * cellW);
                const startY = Math.floor(gy * cellH);
                const endX = Math.floor((gx + 1) * cellW);
                const endY = Math.floor((gy + 1) * cellH);

                for (let px = startX; px < endX; px++) {
                    for (let py = startY; py < endY; py++) {
                        const idx = (py * actualW + px) * 4;
                        sR += roiData[idx]; sG += roiData[idx+1]; sB += roiData[idx+2];
                        count++;
                    }
                }
                
                const avgR = sR / (count || 1);
                const avgG = sG / (count || 1);
                const avgB = sB / (count || 1);

                const lab = ColorSpace.rgbToLab(avgR, avgG, avgB);
                lab.l += this.shadeOffset.l; lab.a += this.shadeOffset.a; lab.b += this.shadeOffset.b;
                
                // Smart Filter: Skip dark areas (L < 30) or clear gingiva-like areas (a > 20)
                let matchId = '---';
                if (lab.l > 30 && lab.a < 20) {
                    let bestMatch = guide.shades[0];
                    let minDE = Infinity;
                    guide.shades.forEach(ref => {
                        const de = ColorSpace.deltaE(lab, ref);
                        if (de < minDE) { minDE = de; bestMatch = ref; }
                    });
                    matchId = bestMatch ? bestMatch.id : 'N/A';
                }
                row.push({ match: matchId, x: realXMin + gx * cellW, y: realYMin + gy * cellH });
            }
            results.push(row);
        }

        // 4. Draw Grids and Labels (Main Canvas)
        const mappedCellW = (mMax.x - mMin.x) / gridCells;
        const mappedCellH = (mMax.y - mMin.y) / gridCells;
        this.ctx.lineWidth = 1;

        // 5. Update Magnifier View and Draw Sync Grid
        if (this.shadeZoomCanvas) {
            const zCtx = this.shadeZoomCanvas.getContext('2d');
            this.shadeZoomCanvas.width = 400; // Resolution of magnifier
            this.shadeZoomCanvas.height = 400;
            zCtx.imageSmoothingEnabled = false; // Keep it crisp
            zCtx.drawImage(this.currentImage, realXMin, realYMin, rw, rh, 0, 0, 400, 400);

            // Draw sync grid on Loupe (Enhanced contrast)
            const zw = 400 / gridCells;
            const zh = 400 / gridCells;
            zCtx.lineWidth = 1;
            zCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // Brighter grid
            zCtx.font = 'bold 16px sans-serif'; // Larger font
            zCtx.fillStyle = 'white';
            zCtx.textAlign = 'center';
            zCtx.textBaseline = 'middle';

            for (let gx = 0; gx < gridCells; gx++) {
                for (let gy = 0; gy < gridCells; gy++) {
                    const zx = gx * zw;
                    const zy = gy * zh;
                    zCtx.strokeRect(zx, zy, zw, zh);
                    
                    const cur = results[gx][gy];
                    if (cur.match !== '---') {
                        zCtx.shadowColor = 'rgba(0, 0, 0, 0.9)'; 
                        zCtx.shadowBlur = 6;
                        zCtx.fillText(cur.match, zx + zw/2, zy + zh/2);
                        zCtx.shadowBlur = 0;
                    }
                }
            }
        }

        // 6. Draw Final Grid on Main Canvas
        this.ctx.strokeStyle = 'white';
        this.ctx.font = 'bold 9px Inter';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        for (let gx = 0; gx < gridCells; gx++) {
            for (let gy = 0; gy < gridCells; gy++) {
                const cx = mMin.x + gx * mappedCellW;
                const cy = mMin.y + gy * mappedCellH;
                this.ctx.strokeRect(cx, cy, mappedCellW, mappedCellH);
                const cur = results[gx][gy];
                if (cur.match !== '---') {
                    this.ctx.shadowColor = 'black'; this.ctx.shadowBlur = 3;
                    this.ctx.fillText(cur.match, cx + mappedCellW/2, cy + mappedCellH/2);
                    this.ctx.shadowBlur = 0;
                }
            }
        }
    }

    // --- Extracted specialized drawing functions ---
    drawProportionLines(pts, mapC, isPre) { 
        this.ctx.setLineDash([]); this.ctx.lineWidth = 1;
        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1'];
        pts.forEach((pt, i) => {
          const mapped = mapC(pt.x, pt.y);
          this.ctx.strokeStyle = colors[i]; this.ctx.fillStyle = colors[i];
          this.ctx.beginPath(); this.ctx.moveTo(mapped.x - 80, mapped.y); this.ctx.lineTo(mapped.x + 80, mapped.y); this.ctx.stroke();
          this.ctx.beginPath(); this.ctx.arc(mapped.x, mapped.y, 4, 0, Math.PI * 2); this.ctx.fill();
        });
    }

    drawELine(pts, mapC, isPre) {
       if(pts.length >= 2) {
          const p1 = mapC(pts[0].x, pts[0].y); const p2 = mapC(pts[1].x, pts[1].y);
          const dx=p2.x-p1.x; const dy=p2.y-p1.y; const len=Math.sqrt(dx*dx+dy*dy); const ux=dx/len; const uy=dy/len;
          this.ctx.beginPath(); this.ctx.moveTo(p1.x-ux*50,p1.y-uy*50); this.ctx.lineTo(p2.x+ux*50,p2.y+uy*50);
          this.ctx.strokeStyle = '#f59e0b'; this.ctx.lineWidth = 1; this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.stroke();
       }
       pts.forEach((pt,i)=>{
          const mp=mapC(pt.x,pt.y); this.ctx.fillStyle = i<2?'#f59e0b':'#ec4899';
          this.ctx.beginPath(); this.ctx.arc(mp.x, mp.y, 5, 0, Math.PI*2); this.ctx.fill();
       });
    }
    
    drawNla(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre ? [5,5] : []); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#10b981';
       if(pts.length>=2){ const p0=mapC(pts[0].x,pts[0].y); const p1=mapC(pts[1].x,pts[1].y);
          this.ctx.beginPath(); this.ctx.moveTo(p0.x,p0.y); this.ctx.lineTo(p1.x,p1.y); this.ctx.stroke(); }
       if(pts.length===3 || (pts.length===2 && this.tempEnd)){
          const p1=mapC(pts[1].x,pts[1].y); const p2=pts.length===3?mapC(pts[2].x,pts[2].y):mapC(this.tempEnd.realX,this.tempEnd.realY);
          this.ctx.beginPath(); this.ctx.moveTo(p1.x,p1.y); this.ctx.lineTo(p2.x,p2.y); this.ctx.stroke();
          
          // Draw arc
          const p0=mapC(pts[0].x,pts[0].y);
          const a1 = Math.atan2(p0.y - p1.y, p0.x - p1.x);
          const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          // Angle logic ensures we draw the smaller inner angle correctly. We normally want the angle facing the lips.
          let startAngle = a1; let endAngle = a2;
          // In standard cases (right-facing profile), angle is concave forwards.
          this.ctx.beginPath();
          this.ctx.arc(p1.x, p1.y, 30, startAngle, endAngle, false);
          this.ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          this.ctx.fill();
          this.ctx.beginPath();
          this.ctx.arc(p1.x, p1.y, 30, startAngle, endAngle, false);
          this.ctx.stroke();
       }
       pts.forEach((pt,i)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle=i===1?'#059669':'#34d399'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,Math.PI*2); this.ctx.fill(); });
    }

    drawConvexity(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre ? [5,5] : []); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#3b82f6';
       if(pts.length>=2){ const p0=mapC(pts[0].x,pts[0].y); const p1=mapC(pts[1].x,pts[1].y);
          this.ctx.beginPath(); this.ctx.moveTo(p0.x,p0.y); this.ctx.lineTo(p1.x,p1.y); this.ctx.stroke(); }
       if(pts.length===3 || (pts.length===2 && this.tempEnd)){
          const p1=mapC(pts[1].x,pts[1].y); const p2=pts.length===3?mapC(pts[2].x,pts[2].y):mapC(this.tempEnd.realX,this.tempEnd.realY);
          this.ctx.beginPath(); this.ctx.moveTo(p1.x,p1.y); this.ctx.lineTo(p2.x,p2.y); this.ctx.stroke();
       }
       pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#2563eb'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,Math.PI*2); this.ctx.fill(); });
    }

    drawWlRatio(pts, mapC, isPre) {
       const p1 = pts.slice(0, 4);
       this.ctx.setLineDash(isPre && p1.length < 4 ? [5,5] : []); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#8b5cf6';
       if(p1.length >= 2) {
           const top = mapC(p1[0].x, p1[0].y); const bot = mapC(p1[1].x, p1[1].y);
           this.ctx.beginPath(); this.ctx.moveTo(top.x, top.y); this.ctx.lineTo(bot.x, bot.y); this.ctx.stroke();
       }
       if(p1.length >= 3) {
           const lft = mapC(p1[2].x, p1[2].y); const rht = p1.length===4 ? mapC(p1[3].x, p1[3].y) : mapC(this.tempEnd.realX, this.tempEnd.realY);
           this.ctx.beginPath(); this.ctx.moveTo(lft.x, lft.y); this.ctx.lineTo(rht.x, rht.y); this.ctx.stroke();
           if(p1.length === 4) {
               const top = mapC(p1[0].x, p1[0].y); const bot = mapC(p1[1].x, p1[1].y);
               this.ctx.setLineDash([2,4]); this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
               this.ctx.strokeRect(lft.x, top.y, rht.x - lft.x, bot.y - top.y);
           }
       }
       p1.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#8b5cf6'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,4,0,7); this.ctx.fill(); });

       if (pts.length >= 4) {
           const p2 = pts.slice(4, 8);
           this.ctx.setLineDash(isPre && p2.length < 4 ? [5,5] : []); this.ctx.strokeStyle = '#10b981';
           if(p2.length >= 2) {
               const top = mapC(p2[0].x, p2[0].y); const bot = mapC(p2[1].x, p2[1].y);
               this.ctx.beginPath(); this.ctx.moveTo(top.x, top.y); this.ctx.lineTo(bot.x, bot.y); this.ctx.stroke();
           }
           if(p2.length >= 3) {
               const lft = mapC(p2[2].x, p2[2].y); const rht = p2.length===4 ? mapC(p2[3].x, p2[3].y) : mapC(this.tempEnd.realX, this.tempEnd.realY);
               this.ctx.beginPath(); this.ctx.moveTo(lft.x, lft.y); this.ctx.lineTo(rht.x, rht.y); this.ctx.stroke();
               if(p2.length === 4) {
                   const top = mapC(p2[0].x, p2[0].y); const bot = mapC(p2[1].x, p2[1].y);
                   this.ctx.setLineDash([2,4]); this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
                   this.ctx.strokeRect(lft.x, top.y, rht.x - lft.x, bot.y - top.y);
               }
           }
           p2.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#10b981'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,4,0,7); this.ctx.fill(); });
       }
    }

    drawRedProp(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#3b82f6';
       if(pts.length > 0) {
           let sumY = 0; pts.forEach(pt => sumY += pt.y); const avgY = sumY / pts.length;
           pts.forEach((pt, i)=>{ 
              const m=mapC(pt.x,pt.y);
              this.ctx.beginPath(); this.ctx.moveTo(m.x, mapC(pt.x, avgY).y - 40); this.ctx.lineTo(m.x, mapC(pt.x, avgY).y + 40); this.ctx.stroke();
              this.ctx.fillStyle='#3b82f6'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,4,0,7); this.ctx.fill();
           });
           const f = mapC(pts[0].x, avgY);
           const l = mapC(pts[pts.length-1].x, avgY);
           this.ctx.beginPath(); this.ctx.moveTo(f.x, f.y); this.ctx.lineTo(l.x, f.y); this.ctx.stroke();
       }
    }

    drawPinkEsth(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#ec4899';
       pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#ec4899'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,4,0,7); this.ctx.fill(); });
       if(pts.length >= 2) {
           this.ctx.beginPath();
           pts.forEach((pt, i) => {
               const m = mapC(pt.x, pt.y);
               if(i===0) this.ctx.moveTo(m.x, m.y); else this.ctx.lineTo(m.x, m.y);
           });
           this.ctx.stroke();
       }
    }

    drawAxial(pts, mapC, isPre) {
       this.ctx.lineWidth = 1;
       pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#f59e0b'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,4,0,7); this.ctx.fill(); });
       
       if(pts.length >= 2) {
          const p1 = mapC(pts[0].x, pts[0].y); const p2 = mapC(pts[1].x, pts[1].y);
          this.ctx.setLineDash([5,5]); this.ctx.strokeStyle = '#06b6d4';
          const dx = p2.x - p1.x; const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
              const nx = dx/len; const ny = dy/len;
              const maxL = 5000;
              this.ctx.beginPath(); this.ctx.moveTo(p1.x - nx*maxL, p1.y - ny*maxL); this.ctx.lineTo(p1.x + nx*maxL, p1.y + ny*maxL); this.ctx.stroke();
          } else {
              this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.stroke();
          }
       }
       this.ctx.setLineDash(isPre?[5,5]:[]);
       for(let i=2; i<pts.length; i+=2) {
           if(pts[i+1]) {
               const t = mapC(pts[i].x, pts[i].y); const b = mapC(pts[i+1].x, pts[i+1].y);
               this.ctx.strokeStyle = (i < 8) ? '#10b981' : '#f43f5e'; 
               const dx = b.x - t.x; const dy = b.y - t.y;
               const len = Math.hypot(dx, dy);
               if (len > 0) {
                   const nx = dx/len; const ny = dy/len;
                   const maxL = 5000;
                   this.ctx.beginPath(); this.ctx.moveTo(t.x - nx*maxL, t.y - ny*maxL); this.ctx.lineTo(t.x + nx*maxL, t.y + ny*maxL); this.ctx.stroke();
               } else {
                   this.ctx.beginPath(); this.ctx.moveTo(t.x, t.y); this.ctx.lineTo(b.x, b.y); this.ctx.stroke();
               }
           }
       }
    }
    
    drawPapilla(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#8b5cf6';
       pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#8b5cf6'; this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,7); this.ctx.fill(); });
       if(pts.length > 0) {
           pts.forEach((pt) => {
              const m = mapC(pt.x, pt.y);
              this.ctx.beginPath(); this.ctx.moveTo(m.x - 30, m.y); this.ctx.lineTo(m.x + 30, m.y); this.ctx.stroke();
           });
       }
       if(pts.length === 5) {
           const p1 = mapC(pts[0].x, pts[0].y); const p5 = mapC(pts[4].x, pts[4].y);
           const p2 = mapC(pts[1].x, pts[1].y); const p4 = mapC(pts[3].x, pts[3].y);
           this.ctx.setLineDash([2,4]); this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
           this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p5.x, p5.y); this.ctx.stroke();
           this.ctx.beginPath(); this.ctx.moveTo(p2.x, p2.y); this.ctx.lineTo(p4.x, p4.y); this.ctx.stroke();
       }
    }

    // Parabola helper: y = ax^2 + bx + c
    calcParabola(p1, p2, p3) {
       const det = (p1.x - p2.x) * (p1.x - p3.x) * (p2.x - p3.x);
       if(Math.abs(det) < 0.1) return { a:0, b:0, c:0 };
       const a = (p3.x * (p2.y - p1.y) + p2.x * (p1.y - p3.y) + p1.x * (p3.y - p2.y)) / det;
       const b = (p3.x*p3.x * (p1.y - p2.y) + p2.x*p2.x * (p3.y - p1.y) + p1.x*p1.x * (p2.y - p3.y)) / det;
       const c = (p2.x * p3.x * (p2.x - p3.x) * p1.y + p3.x * p1.x * (p3.x - p1.x) * p2.y + p1.x * p2.x * (p1.x - p2.x) * p3.y) / det;
       return { a, b, c };
    }

    drawSmileArc(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1;
       
       // Draw Upper Incisal Curve (pts 0,1,2)
       const upperPts = pts.slice(0,3);
       if (upperPts.length === 3) {
          const pb = this.calcParabola(upperPts[0], upperPts[1], upperPts[2]);
          this.ctx.strokeStyle = '#3b82f6'; this.ctx.beginPath();
          for(let x = upperPts[0].x; x <= upperPts[2].x; x+=2) {
             const m = mapC(x, (pb.a*x*x + pb.b*x + pb.c));
             if (x === upperPts[0].x) this.ctx.moveTo(m.x, m.y); else this.ctx.lineTo(m.x, m.y);
          }
          this.ctx.stroke();
       }
       
       // Draw Lower Lip Curve (pts 3,4,5)
       const lowerPts = pts.slice(3,6);
       if (lowerPts.length === 3) {
          const pb = this.calcParabola(lowerPts[0], lowerPts[1], lowerPts[2]);
          this.ctx.strokeStyle = '#10b981'; this.ctx.beginPath();
          for(let x = lowerPts[0].x; x <= lowerPts[2].x; x+=2) {
             const m = mapC(x, (pb.a*x*x + pb.b*x + pb.c));
             if (x === lowerPts[0].x) this.ctx.moveTo(m.x, m.y); else this.ctx.lineTo(m.x, m.y);
          }
          this.ctx.stroke();
       }

       pts.forEach((pt, i)=>{ 
          const m=mapC(pt.x,pt.y); this.ctx.fillStyle= i<3 ? '#2563eb':'#059669'; 
          this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,7); this.ctx.fill(); 
          this.ctx.strokeStyle='#fff'; this.ctx.lineWidth=1; this.ctx.stroke();
       });
    }

    drawCorridor(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1;
       if (pts.length >= 2) {
          const leftP = mapC(pts[0].x, pts[0].y); const rightP = mapC(pts[pts.length-1].x, pts[pts.length-1].y);
          this.ctx.strokeStyle = '#f59e0b';
          this.ctx.beginPath(); this.ctx.moveTo(leftP.x, leftP.y); this.ctx.lineTo(rightP.x, rightP.y); this.ctx.stroke();
       }
       if (pts.length === 4) {
          const c1 = mapC(pts[0].x, pts[0].y); const t1 = mapC(pts[1].x, pts[1].y);
          const t2 = mapC(pts[2].x, pts[2].y); const c2 = mapC(pts[3].x, pts[3].y);
          this.ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
          this.ctx.fillRect(c1.x, c1.y-15, t1.x - c1.x, 30);
          this.ctx.fillRect(t2.x, t2.y-15, c2.x - t2.x, 30);
       }
       pts.forEach((pt, i)=>{ 
          const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#f59e0b';
          this.ctx.beginPath(); this.ctx.moveTo(m.x, m.y-25); this.ctx.lineTo(m.x, m.y+25); this.ctx.stroke();
          this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,7); this.ctx.fill(); 
       });
    }

    drawGingival(pts, mapC, isPre) {
       this.ctx.setLineDash(isPre?[5,5]:[]); this.ctx.lineWidth = 1; this.ctx.strokeStyle = '#ec4899';
       pts.forEach((pt, i)=>{ 
          const m=mapC(pt.x,pt.y); this.ctx.fillStyle='#ec4899'; 
          this.ctx.beginPath(); this.ctx.moveTo(m.x-60, m.y); this.ctx.lineTo(m.x+60, m.y); this.ctx.stroke();
          this.ctx.beginPath(); this.ctx.arc(m.x,m.y,5,0,7); this.ctx.fill(); 
       });
       if(pts.length >= 2) {
          const t = mapC(pts[0].x, pts[0].y); const b = mapC(pts[pts.length-1].x, pts[pts.length-1].y);
          this.ctx.beginPath(); this.ctx.moveTo(t.x, t.y); this.ctx.lineTo(t.x, b.y); 
          this.ctx.setLineDash([5,5]); this.ctx.stroke();
       }
    }

    drawLineSpec(lineCoord, toolType, mapC, isPreview = false) {
      const start = mapC(lineCoord.startX, lineCoord.startY); const end = mapC(lineCoord.endX, lineCoord.endY);
      this.ctx.beginPath(); this.ctx.lineWidth = 1;
      
      const extendList = ['midline', 'interpupillary', 'f-midline', 'commissural', 'd-midline', 'interpupillary-e', 'incisal-edge'];
      if (extendList.includes(toolType)) {
          const dx = end.x - start.x; const dy = end.y - start.y;
          const len = Math.hypot(dx, dy);
          if(len > 0) {
              const nx = dx/len; const ny = dy/len;
              const maxL = 5000;
              this.ctx.moveTo(start.x - nx*maxL, start.y - ny*maxL);
              this.ctx.lineTo(start.x + nx*maxL, start.y + ny*maxL);
          } else {
              this.ctx.moveTo(start.x, start.y); this.ctx.lineTo(end.x, end.y);
          }
      } else {
          this.ctx.moveTo(start.x, start.y); this.ctx.lineTo(end.x, end.y);
      }

      if (isPreview) { this.ctx.strokeStyle = '#94a3b8'; this.ctx.setLineDash([5, 5]); }
      else { 
        this.ctx.setLineDash([]); 
        if(toolType === 'sline') this.ctx.strokeStyle = '#8b5cf6';
        else if(['emeasure', 'mmeasure', 'smeasure'].includes(toolType)) this.ctx.strokeStyle = '#3b82f6';
        else if(['fvmeasure'].includes(toolType)) this.ctx.strokeStyle = '#f43f5e';
        else if(toolType === 'f-midline') { this.ctx.strokeStyle = '#06b6d4'; this.ctx.setLineDash([5,5]); } // Cyan
        else if(toolType === 'd-midline') { this.ctx.strokeStyle = '#db2777'; this.ctx.setLineDash([5,5]); } // Pink
        else if(toolType === 'hbar-ref') { this.ctx.strokeStyle = '#10b981'; this.ctx.setLineDash([5,5]); } // Green
        else if(toolType === 'hbar-bar') { this.ctx.strokeStyle = '#f59e0b'; } // Amber
        else this.ctx.strokeStyle = '#ef4444'; 
      }
      this.ctx.stroke();
      this.ctx.fillStyle = this.ctx.strokeStyle;
      this.ctx.beginPath(); this.ctx.arc(start.x, start.y, 4, 0, 7); this.ctx.fill();
      this.ctx.beginPath(); this.ctx.arc(end.x, end.y, 4, 0, 7); this.ctx.fill();
    }

    getLineLengthMm(lineName) {
        if (!this.lines[lineName]) return null;
        const line = this.lines[lineName];
        const dx = line.endX - line.startX; const dy = line.endY - line.startY;
        return (Math.sqrt(dx*dx + dy*dy) * this.pxToMm).toFixed(1);
    }

    updateStats() {
      // 1. Frontal Phase
      if (this.phase === 'frontal') {
        const elCant = this.card.querySelector('.cant-value'); const elDev = this.card.querySelector('.dev-value');
        let angInt = null;
        if (this.lines.interpupillary) {
          const dx = this.lines.interpupillary.endX - this.lines.interpupillary.startX; const dy = this.lines.interpupillary.endY - this.lines.interpupillary.startY;
          angInt = Math.atan2(dy, dx) * (180 / Math.PI); if(angInt > 90) angInt -= 180; if(angInt < -90) angInt += 180;
        }

        if (this.lines.midline && angInt !== null && elCant) {
          const dxM = this.lines.midline.endX - this.lines.midline.startX; const dyM = this.lines.midline.endY - this.lines.midline.startY;
          let angMid = Math.atan2(dyM, dxM) * (180 / Math.PI);
          let diff = Math.abs(angMid - angInt);
          if (diff > 90) diff = 180 - diff;
          let dev = Math.abs(90 - diff);
          elCant.textContent = dev.toFixed(1) + '° ズレ';
          elCant.style.color = dev <= 2.0 ? 'var(--success)' : 'var(--danger)'; 
        } else if (elCant) elCant.textContent = '--°';

        if (this.lines.commissural && angInt !== null && elDev) {
          const dxC = this.lines.commissural.endX - this.lines.commissural.startX; const dyC = this.lines.commissural.endY - this.lines.commissural.startY;
          let angCom = Math.atan2(dyC, dxC) * (180 / Math.PI); if(angCom > 90) angCom -= 180; if(angCom < -90) angCom += 180;
          let diff = Math.abs(angCom - angInt);
          if (diff > 90) diff = 180 - diff;
          elDev.textContent = diff.toFixed(1) + '° ズレ';
          elDev.style.color = diff <= 2.0 ? 'var(--success)' : 'var(--danger)';
        } else if (elDev) elDev.textContent = '--°';

        const elThirds = this.card.querySelector('.prop-thirds-value');
        const elWillis = this.card.querySelector('.prop-willis-value');
        const elLower = this.card.querySelector('.prop-lower-value');
        if (this.lines.verticalProportions && this.lines.verticalProportions.length === 6) {
           const pts = this.lines.verticalProportions;
           const upper = Math.abs(pts[1].y - pts[0].y); const middle = Math.abs(pts[3].y - pts[1].y); const lower = Math.abs(pts[5].y - pts[3].y);
           if (middle > 0) elThirds.textContent = `${(upper / middle).toFixed(1)} : 1.0 : ${(lower / middle).toFixed(1)}`;
           const ptS = Math.abs(pts[4].y - pts[2].y);
           if (middle > 0) elWillis.textContent = `1 : ${(ptS / middle).toFixed(1)}`;
           const lU = Math.abs(pts[4].y - pts[3].y); const lL = Math.abs(pts[5].y - pts[4].y);
           if (lU > 0) elLower.textContent = `1 : ${(lL / lU).toFixed(1)}`;
        } else {
           if(elThirds) elThirds.textContent = '-- : -- : --'; if(elWillis) elWillis.textContent = '--'; if(elLower) elLower.textContent = '1 : --';
        }
      }
      
      // 2. Lateral Phase
      if (this.phase === 'lateral') {
         const elUlip = this.card.querySelector('.ulip-val'); const elLlip = this.card.querySelector('.llip-val'); const elNla = this.card.querySelector('.nla-val');
         if (this.lines.eLine && this.lines.eLine.length === 4) {
           const [nose, pog, ulip, llip] = this.lines.eLine; const isLF = nose.x < (this.currentImage.width/2);
           const cDist = (pt) => {
              const A = nose.y - pog.y; const B = pog.x - nose.x; const C = (nose.x * pog.y) - (pog.x * nose.y);
              const distAbs = Math.abs(A * pt.x + B * pt.y + C) / Math.sqrt(A*A + B*B);
              const crs = (pog.x - nose.x) * (pt.y - nose.y) - (pog.y - nose.y) * (pt.x - nose.x);
              return (isLF ? crs > 0 : crs < 0) ? distAbs : -distAbs;
           };
           const uMm = (cDist(ulip)*this.pxToMm); const lMm = (cDist(llip)*this.pxToMm);
           if(elUlip) { elUlip.textContent = (uMm>0?'+':'')+uMm.toFixed(2)+' mm'; elUlip.style.color = (uMm>=-5.5&&uMm<=-3.5)?'var(--success)':'var(--primary)'; }
           if(elLlip) { elLlip.textContent = (lMm>0?'+':'')+lMm.toFixed(2)+' mm'; elLlip.style.color = (lMm>=-2.0&&lMm<=0)?'var(--success)':'var(--primary)'; }
         } else {
           if(elUlip) { elUlip.textContent = '-- mm'; elUlip.style.color = 'var(--primary)'; }
           if(elLlip) { elLlip.textContent = '-- mm'; elLlip.style.color = 'var(--primary)'; }
         }
         
         if (this.lines.nla && this.lines.nla.length === 3) {
           const [col, sub, u_lip] = this.lines.nla;
           const vA = { x: col.x - sub.x, y: col.y - sub.y }; const vB = { x: u_lip.x - sub.x, y: u_lip.y - sub.y };
           const d = (vA.x*vB.x)+(vA.y*vB.y); const mA = Math.sqrt(vA.x*vA.x+vA.y*vA.y); const mB = Math.sqrt(vB.x*vB.x+vB.y*vB.y);
           const aDeg = Math.acos(d / (mA * mB)) * (180/Math.PI);
           if(elNla) { elNla.textContent = aDeg.toFixed(1) + ' °'; elNla.style.color = (aDeg>=80&&aDeg<=100) ? 'var(--success)' : 'var(--primary)'; }
         } else { if(elNla) { elNla.textContent = '-- °'; elNla.style.color = 'var(--primary)'; } }

         const elConvexity = this.card.querySelector('.convexity-val');
         if (this.lines.convexity && this.lines.convexity.length === 3) {
           const [g, sn, pg] = this.lines.convexity;
           const vA = { x: g.x - sn.x, y: g.y - sn.y };
           const vB = { x: pg.x - sn.x, y: pg.y - sn.y };
           const d = (vA.x*vB.x)+(vA.y*vB.y); const mA = Math.sqrt(vA.x*vA.x+vA.y*vA.y); const mB = Math.sqrt(vB.x*vB.x+vB.y*vB.y);
           let aDeg = Math.acos(d / (mA * mB)) * (180/Math.PI);
           
           const vecG_Pg = { x: pg.x - g.x, y: pg.y - g.y };
           const vecG_Sn = { x: sn.x - g.x, y: sn.y - g.y };
           const crossG = vecG_Pg.x * vecG_Sn.y - vecG_Pg.y * vecG_Sn.x;
           const isFacLeft = g.x < (this.currentImage.width/2);
           
           let isConcave = false;
           if (isFacLeft) {
              if (crossG < 0) isConcave = true; 
           } else {
              if (crossG > 0) isConcave = true;
           }
           let displayAngle = isConcave ? (360 - aDeg) : aDeg;

           let cat = ''; let col = 'var(--primary)';
           if (displayAngle < 165) { cat = 'Convex (凸)'; col = '#f59e0b'; }
           else if (displayAngle >= 165 && displayAngle <= 175) { cat = 'Straight (直)'; col = 'var(--success)'; }
           else { cat = 'Concave (凹)'; col = 'var(--danger)'; }

           if(elConvexity) { elConvexity.innerHTML = `${displayAngle.toFixed(1)}° <br><span style="font-size:0.85em">${cat}</span>`; elConvexity.style.color = col; }
         } else { if (elConvexity) { elConvexity.textContent = '--'; elConvexity.style.color = 'var(--primary)'; } }
      }

      // 3. E-Sound Midline / Canting
      if (this.phase === 'e-midline') {
         const elDev = this.card.querySelector('.emid-dev-value');
         const elCant = this.card.querySelector('.emid-cant-value');
         const elCantNew = this.card.querySelector('.emid-cant-new-value');
         const fLine = this.lines['f-midline'];
         const dLine = this.lines['d-midline'];
         
         if (fLine && dLine && elDev && elCant) {
            // angle logic
            let degF = Math.atan2(fLine.endY - fLine.startY, fLine.endX - fLine.startX) * (180/Math.PI);
            let degD = Math.atan2(dLine.endY - dLine.startY, dLine.endX - dLine.startX) * (180/Math.PI);
            // normalize to vertical
            let cantF = degF - 90; if (cantF < -180) cantF += 360;
            let cantD = degD - 90; if (cantD < -180) cantD += 360;
            const cantDiff = Math.abs(cantD - cantF);
            elCant.textContent = cantDiff.toFixed(1) + ' °';
            elCant.style.color = (cantDiff >= 4.0) ? 'var(--danger)' : 'var(--success)';
            
            // deviation logic: distance from dLine midpoint to fLine
            const mdX = (dLine.startX + dLine.endX) / 2; const mdY = (dLine.startY + dLine.endY) / 2;
            const A = fLine.endY - fLine.startY; const B = fLine.startX - fLine.endX; const C = (fLine.endX * fLine.startY) - (fLine.startX * fLine.endY);
            const distPx = Math.abs(A * mdX + B * mdY + C) / Math.sqrt(A*A + B*B);
            const devMm = distPx * this.pxToMm;
            elDev.textContent = devMm.toFixed(2) + ' mm';
            elDev.style.color = (devMm <= 2.0) ? 'var(--success)' : 'var(--danger)';
         } else {
            if (elDev) elDev.textContent = '-- mm';
            if (elCant) elCant.textContent = '-- °';
         }

         if (this.lines['interpupillary-e'] && this.lines['incisal-edge']) {
            const eye = this.lines['interpupillary-e'];
            const inc = this.lines['incisal-edge'];
            const ang1 = Math.atan2(eye.endY - eye.startY, eye.endX - eye.startX) * (180/Math.PI);
            const ang2 = Math.atan2(inc.endY - inc.startY, inc.endX - inc.startX) * (180/Math.PI);
            let diff = Math.abs(ang1 - ang2);
            if (diff > 90) diff = 180 - diff;
            if (elCantNew) {
               elCantNew.textContent = diff.toFixed(1) + ' °';
               elCantNew.style.color = diff <= 1.0 ? 'var(--success)' : 'var(--danger)'; 
            }
         } else if (elCantNew) {
            elCantNew.textContent = '-- °';
         }
      }

      // E-Sound Mini-esthetics specifics
      if (this.phase === 'e-sound') {
         // Smile Arc
         const elArc = this.card.querySelector('.arc-val');
         if (this.lines.smileArc && this.lines.smileArc.length === 6 && elArc) {
            const pbUpper = this.calcParabola(this.lines.smileArc[0], this.lines.smileArc[1], this.lines.smileArc[2]);
            const pbLower = this.calcParabola(this.lines.smileArc[3], this.lines.smileArc[4], this.lines.smileArc[5]);
            
            if (pbUpper && pbLower) {
               const aTooth = pbUpper.a;
               const aLip = pbLower.a;
               
               // Canvas Y is inverted. A smile (U-shape) has a < 0. A frown (inverted U) has a > 0.
               if (aTooth > 0.0001) {
                  elArc.textContent = 'Reverse'; elArc.style.color = 'var(--danger)';
               } else if (aTooth > aLip * 0.7) {
                  elArc.textContent = 'Flat'; elArc.style.color = '#f59e0b';
               } else {
                  elArc.textContent = 'Consonant'; elArc.style.color = 'var(--success)';
               }
            } else {
               elArc.textContent = '-- (判定不可)'; elArc.style.color = 'var(--primary)';
            }
         } else if (elArc) { elArc.textContent = '-- (未判定)'; elArc.style.color = 'var(--primary)'; }
         
         // Buccal Corridor
         const elCorridor = this.card.querySelector('.corridor-val');
         if (this.lines.corridor && this.lines.corridor.length === 4 && elCorridor) {
            const w1 = Math.abs(this.lines.corridor[1].x - this.lines.corridor[0].x);
            const w2 = Math.abs(this.lines.corridor[3].x - this.lines.corridor[2].x);
            const totalW = Math.abs(this.lines.corridor[3].x - this.lines.corridor[0].x);
            if (totalW > 0) {
              const ratio = ((w1 + w2) / totalW) * 100;
              elCorridor.textContent = ratio.toFixed(1) + ' %';
              if (ratio >= 1 && ratio <= 14) { elCorridor.style.color = 'var(--success)'; }
              else { elCorridor.style.color = (ratio < 1) ? '#f59e0b' : 'var(--danger)'; } 
            }
         } else if (elCorridor) { elCorridor.textContent = '-- %'; elCorridor.style.color = 'var(--primary)'; }
         
         // Gingival & Incisal Vertical
         const elGingival = this.card.querySelector('.gingival-val');
         const elIncisal = this.card.querySelector('.incisal-eb-val');
         if (this.lines.gingival && this.lines.gingival.length === 4) {
            const zen = this.lines.gingival[0]; const uLip = this.lines.gingival[1]; 
            const inc = this.lines.gingival[2]; const lLip = this.lines.gingival[3];
            
            // ゼニスの位置が上唇の位置より下なら＋、上なら-になるようにして。
            // canvas y increases downwards, so below means zen.y > uLip.y
            const displayMm = (zen.y - uLip.y) * this.pxToMm;
            
            if (elGingival) {
               elGingival.textContent = (displayMm > 0 ? '+' : '') + displayMm.toFixed(2) + ' mm';
               elGingival.style.color = (displayMm >= -2.0 && displayMm <= 0.0) ? 'var(--success)' : 'var(--primary)';
            }
            
            const lipDist = Math.abs(lLip.y - uLip.y);
            const incDistFromUpper = Math.abs(inc.y - uLip.y);
            if (elIncisal && lipDist > 0) {
               const incPercent = (incDistFromUpper / lipDist) * 100;
               elIncisal.textContent = incPercent.toFixed(1) + ' %';
               elIncisal.style.color = (incPercent >= 45 && incPercent <= 55) ? 'var(--success)' : 'var(--primary)';
            }
         } else {
            if (elGingival) { elGingival.textContent = '-- mm'; elGingival.style.color = 'var(--primary)'; }
            if (elIncisal) { elIncisal.textContent = '-- %'; elIncisal.style.color = 'var(--primary)'; }
         }
      }

      // Sounds phases (M, S, FV)
      if (this.phase === 'm-sound') { const el = this.card.querySelector('.mmeasure-val'); if(el){ const l=this.getLineLengthMm('mmeasure'); el.textContent = l!==null?l+' mm':'-- mm'; el.style.color = (l>=1.0&&l<=3.0)?'var(--success)':'var(--primary)'; } }
      if (this.phase === 's-sound') { const el = this.card.querySelector('.smeasure-val'); if(el){ const l=this.getLineLengthMm('smeasure'); el.textContent = l!==null?l+' mm':'-- mm'; el.style.color = (l>=1.0&&l<=1.5)?'var(--success)':'var(--primary)'; } }
      if (this.phase === 'fv-sound') { const el = this.card.querySelector('.fvmeasure-val'); if(el){ const l=this.getLineLengthMm('fvmeasure'); el.textContent = l!==null?l+' mm':'-- mm'; el.style.color = (l<=0.2)?'var(--success)':'var(--primary)'; } }

      // 7. Intraoral Phase (REDUCE length for brevity)
      // 7. Intraoral Phase
      if (this.phase === 'intraoral') {
         if (this.lines.wlRatio && this.lines.wlRatio.length === 8) {
            const pt = this.lines.wlRatio;
            const hr = Math.abs(pt[0].y - pt[1].y); const wr = Math.abs(pt[2].x - pt[3].x);
            const ratR = hr > 0 ? (wr/hr)*100 : 0;
            const elWlR = this.card.querySelector('.wl-r-val'); const elProfR = this.card.querySelector('.wl-r-profile');
            if(elWlR) { elWlR.textContent = ratR.toFixed(1) + ' %'; elWlR.style.color = (ratR >= 75 && ratR <= 85) ? 'var(--success)' : 'var(--primary)'; }
            if(elProfR) { if(ratR < 75) elProfR.textContent = '細長い'; else if(ratR > 85) elProfR.textContent = '幅広'; else elProfR.textContent = '標準 (Ovoid)'; }

            const hl = Math.abs(pt[4].y - pt[5].y); const wl = Math.abs(pt[6].x - pt[7].x);
            const ratL = hl > 0 ? (wl/hl)*100 : 0;
            const elWlL = this.card.querySelector('.wl-l-val'); const elProfL = this.card.querySelector('.wl-l-profile');
            if(elWlL) { elWlL.textContent = ratL.toFixed(1) + ' %'; elWlL.style.color = (ratL >= 75 && ratL <= 85) ? 'var(--success)' : 'var(--primary)'; }
            if(elProfL) { if(ratL < 75) elProfL.textContent = '細長い'; else if(ratL > 85) elProfL.textContent = '幅広'; else elProfL.textContent = '標準 (Ovoid)'; }
         } else {
            const elWlR = this.card.querySelector('.wl-r-val'); const elWlL = this.card.querySelector('.wl-l-val');
            const elProfR = this.card.querySelector('.wl-r-profile'); const elProfL = this.card.querySelector('.wl-l-profile');
            if(elWlR) elWlR.textContent = '-- %'; if(elWlL) elWlL.textContent = '-- %';
            if(elProfR) elProfR.textContent = '--'; if(elProfL) elProfL.textContent = '--';
         }
         
         // RED 7 points: 0:RC, 1:R2, 2:R1, 3:Mid, 4:L1, 5:L2, 6:LC
         if (this.lines.redProp && this.lines.redProp.length === 7) {
            const pt = this.lines.redProp;
            const w1R = Math.abs(pt[3].x - pt[2].x); const w2R = Math.abs(pt[2].x - pt[1].x); const w3R = Math.abs(pt[1].x - pt[0].x);
            const w1L = Math.abs(pt[4].x - pt[3].x); const w2L = Math.abs(pt[5].x - pt[4].x); const w3L = Math.abs(pt[6].x - pt[5].x);
            
            const totalR = w1R+w2R+w3R; const totalL = w1L+w2L+w3L;
            const elRedR=this.card.querySelector('.red-r-val'); const elRedL=this.card.querySelector('.red-l-val');
            const elGpR=this.card.querySelector('.gp-r-val'); const elGpL=this.card.querySelector('.gp-l-val');
            const elSilR=this.card.querySelector('.silver-r-val'); const elSilL=this.card.querySelector('.silver-l-val');
            
            if(elRedR) { const rv = (w2R/w1R)*100; elRedR.textContent = rv.toFixed(1) + ' %'; elRedR.style.color = (rv >= 68 && rv <= 72) ? 'var(--success)':'var(--primary)'; }
            if(elRedL) { const rv = (w2L/w1L)*100; elRedL.textContent = rv.toFixed(1) + ' %'; elRedL.style.color = (rv >= 68 && rv <= 72) ? 'var(--success)':'var(--primary)'; }
            if(elGpR) { 
               const gp1=w1R/totalR*50; const gp2=w2R/totalR*50; const gp3=w3R/totalR*50; 
               elGpR.textContent=`${gp1.toFixed(1)} : ${gp2.toFixed(1)} : ${gp3.toFixed(1)}`;
               elGpR.style.color=(absDist(gp1,25)<=3&&absDist(gp2,15)<=3&&absDist(gp3,10)<=3)?'var(--success)':'var(--primary)'; 
            }
            if(elGpL) { 
               const pl1=w1L/totalL*50; const pl2=w2L/totalL*50; const pl3=w3L/totalL*50; 
               elGpL.textContent=`${pl1.toFixed(1)} : ${pl2.toFixed(1)} : ${pl3.toFixed(1)}`; 
               elGpL.style.color=(absDist(pl1,25)<=3&&absDist(pl2,15)<=3&&absDist(pl3,10)<=3)?'var(--success)':'var(--primary)'; 
            }
            if(elSilR && w2R>0) { 
               const sil1 = parseFloat((w1R/w2R).toFixed(3)); const sil3 = parseFloat((w3R/w2R).toFixed(3)); 
               const distG = absDist(sil1, 1.618) + absDist(sil3, 0.618);
               const distS = absDist(sil1, 1.414) + absDist(sil3, 0.707);
               let note = distG <= distS ? '(黄金比)' : '(白銀比)';
               if (absDist(sil1, 1.618) > 0.3 && absDist(sil1, 1.414) > 0.3) note = '';
               elSilR.textContent=`${sil1.toFixed(2)} : 1.00 : ${sil3.toFixed(2)} ${note}`; 
               elSilR.style.color='var(--primary)'; 
            }
            if (this.phase === 'shade-take') {
                const hasSample = !!this.lines.shadeSample;
                const hasMap = this.shadeMapRect && this.shadeMapRect.finalized;

                if (this.shadeMagnifierContainer) this.shadeMagnifierContainer.classList.toggle('hidden', !hasMap || this.activeTool !== 'shade-map');
            }
            if(elSilL && w2L>0) { 
               const sil1 = parseFloat((w1L/w2L).toFixed(3)); const sil3 = parseFloat((w3L/w2L).toFixed(3)); 
               const distG = absDist(sil1, 1.618) + absDist(sil3, 0.618);
               const distS = absDist(sil1, 1.414) + absDist(sil3, 0.707);
               let note = distG <= distS ? '(黄金比)' : '(白銀比)';
               if (absDist(sil1, 1.618) > 0.3 && absDist(sil1, 1.414) > 0.3) note = '';
               elSilL.textContent=`${sil1.toFixed(2)} : 1.00 : ${sil3.toFixed(2)} ${note}`; 
               elSilL.style.color='var(--primary)'; 
            }

            // 中切歯・側切歯の幅の左右差 (mm)
            const elDiff1 = this.card.querySelector('.red-diff1-val');
            const elDiff2 = this.card.querySelector('.red-diff2-val');
            if (elDiff1) {
               const diffCentral = Math.abs(w1R - w1L) * this.pxToMm;
               elDiff1.textContent = diffCentral.toFixed(2) + ' mm';
               elDiff1.style.color = (diffCentral <= 0.5) ? 'var(--success)' : 'var(--primary)';
            }
            if (elDiff2) {
               const diffLateral = Math.abs(w2R - w2L) * this.pxToMm;
               elDiff2.textContent = diffLateral.toFixed(2) + ' mm';
               elDiff2.style.color = (diffLateral <= 2.0) ? 'var(--success)' : 'var(--primary)';
            }
         }
         
         // Pink 6 points: 0:R3, 1:R2, 2:R1, 3:L1, 4:L2, 5:L3
         if (this.lines.pinkEsth && this.lines.pinkEsth.length === 6) {
            const pt = this.lines.pinkEsth;
            const asym1 = Math.abs(pt[2].y - pt[3].y) * this.pxToMm;
            const asym3 = Math.abs(pt[0].y - pt[5].y) * this.pxToMm;
            const elAsy = this.card.querySelector('.pz-asym-val');
            const elCanine = this.card.querySelector('.pz-canine-val');
            if(elAsy) { elAsy.textContent = asym1.toFixed(2) + ' mm'; elAsy.style.color = (asym1 <= 1.0) ? 'var(--success)' : 'var(--danger)'; }
            if(elCanine) { elCanine.textContent = asym3.toFixed(2) + ' mm'; elCanine.style.color = (asym3 <= 2.0) ? 'var(--success)' : 'var(--danger)'; }
            
            const elLvl = this.card.querySelector('.pz-level-val');
            if(elLvl) {
               const calcLvl = (cen, lat, can) => {
                  const t = (lat.x - cen.x)/(cen.x===can.x?0.01:(can.x - cen.x)); 
                  const lineY = cen.y + t*(can.y - cen.y);
                  return (lat.y - lineY)*this.pxToMm; 
               };
               const lvlR = calcLvl(pt[2], pt[1], pt[0]);
               const lvlL = calcLvl(pt[3], pt[4], pt[5]);
               const avgLvl = (lvlR + lvlL) / 2;
               elLvl.textContent = (avgLvl > 0 ? '歯冠側 ':'歯根側 ') + Math.abs(avgLvl).toFixed(2) + ' mm';
               elLvl.style.color = (avgLvl >= 0.8 && avgLvl <= 1.2) ? 'var(--success)' : 'var(--primary)';
            }
         }
         
         // Axial Inclination 14pts
         if (this.lines.axialIncl && this.lines.axialIncl.length === 14) {
            const pt = this.lines.axialIncl;
            const getAngle = (pT, pB) => {
               let dx = pB.x - pT.x; let dy = pB.y - pT.y;
               if (dy < 0) { dx = -dx; dy = -dy; } // ensure vector points down
               return Math.atan2(dx, dy) * (180/Math.PI);
            };
            const midAng = getAngle(pt[0], pt[1]);
            
            const r1 = Math.abs(getAngle(pt[2], pt[3]) - midAng);
            const r2 = Math.abs(getAngle(pt[4], pt[5]) - midAng);
            const r3 = Math.abs(getAngle(pt[6], pt[7]) - midAng);
            
            const l1 = Math.abs(getAngle(pt[8], pt[9]) - midAng);
            const l2 = Math.abs(getAngle(pt[10], pt[11]) - midAng);
            const l3 = Math.abs(getAngle(pt[12], pt[13]) - midAng);
            
            const check = (elCls, val, target) => {
               const el = this.card.querySelector(elCls); if(!el) return;
               el.textContent = val.toFixed(1) + ' °'; 
               el.style.color = (Math.abs(val-target) <= 2.0) ? 'var(--success)' : 'var(--primary)';
            };
            check('.ax1-r-val', r1, 3.0); check('.ax1-l-val', l1, 3.0);
            check('.ax2-r-val', r2, 5.0); check('.ax2-l-val', l2, 5.0);
            check('.ax3-r-val', r3, 8.0); check('.ax3-l-val', l3, 8.0);
         }
         
         // Papilla 5pts
         if (this.lines.papilla && this.lines.papilla.length === 5) {
            const pt = this.lines.papilla;
            const dist1 = Math.abs(pt[0].y - pt[4].y) * this.pxToMm;
            const dist2 = Math.abs(pt[1].y - pt[3].y) * this.pxToMm;
            const elD1 = this.card.querySelector('.pap-dist-val');
            const elD2 = this.card.querySelector('.pap-prox-val');
            if(elD1) { elD1.textContent = dist1.toFixed(2) + ' mm'; elD1.style.color = (dist1 <= 2.0) ? 'var(--success)' : 'var(--primary)'; }
            if(elD2) { elD2.textContent = dist2.toFixed(2) + ' mm'; elD2.style.color = (dist2 <= 2.0) ? 'var(--success)' : 'var(--primary)'; }
         }
      }

      // 9. Horizontal Bar Phase (front and top)
      if (this.phase === 'horizontal-bar' || this.phase === 'horizontal-bar-front' || this.phase === 'horizontal-bar-top') {
          const elCant = this.card.querySelector('.hbar-cant-val');
          const ref = this.lines['hbar-ref'];
          const bar = this.lines['hbar-bar'];
          
          if (ref && bar) {
               const angRef = Math.atan2(ref.endY - ref.startY, ref.endX - ref.startX);
               const angBar = Math.atan2(bar.endY - bar.startY, bar.endX - bar.startX);
               let diff = (angBar - angRef) * (180/Math.PI);
               if (diff > 90) diff -= 180; if (diff < -90) diff += 180;
               
               if (elCant) {
                   elCant.textContent = Math.abs(diff).toFixed(1) + ' °';
                   elCant.style.color = Math.abs(diff) <= 1.0 ? 'var(--success)' : 'var(--danger)'; 
               }
          } else if (elCant) { elCant.textContent = '-- °'; elCant.style.color = 'var(--text-main)'; }
      }

      // 10. Shade Take Phase
      if (this.phase === 'shade-take') {
          // Update Plot List tags
          this.renderCalibPlotList();

          // Update Calibration UI Status
          if (this.shadeCalibStatus && this.shadeOffsetValues) {
            const isCalibrated = this.calibPoints.length > 0;
            if (isCalibrated) {
                this.shadeCalibStatus.classList.remove('hidden');
                this.shadeOffsetValues.textContent = `(L:${this.shadeOffset.l > 0 ? '+' : ''}${this.shadeOffset.l.toFixed(1)}, a:${this.shadeOffset.a > 0 ? '+' : ''}${this.shadeOffset.a.toFixed(1)}, b:${this.shadeOffset.b > 0 ? '+' : ''}${this.shadeOffset.b.toFixed(1)})`;
                
                // Trigger Matrix Update
                this.updateAutoCorrectionMatrix();
            } else {
                this.shadeCalibStatus.classList.add('hidden');
                if (this.canvas) this.canvas.style.filter = 'none';
            }
          }

          if (this.lines.shadeSample) {
            const s = this.lines.shadeSample;
            const rawLab = ColorSpace.rgbToLab(s.r, s.g, s.b);
            
            // Apply Calibration Offset
            const lab = {
                l: rawLab.l + this.shadeOffset.l,
                a: rawLab.a + this.shadeOffset.a,
                b: rawLab.b + this.shadeOffset.b
            };
            
            // Find closest Shade in current guide
            const currentGuide = SHADE_GUIDES[this.currentShadeGuideId];
            let minDE = Infinity;
            let bestMatch = null;
            if (currentGuide) {
                currentGuide.shades.forEach(ref => {
                    const de = ColorSpace.deltaE(lab, ref);
                    if (de < minDE) { minDE = de; bestMatch = ref; }
                });
            }

            if (this.shadeSwatch) this.shadeSwatch.style.backgroundColor = `rgb(${s.r}, ${s.g}, ${s.b})`;
            if (this.shadeIdValue) this.shadeIdValue.textContent = bestMatch ? bestMatch.id : '--';
            if (this.shadeL) this.shadeL.textContent = lab.l.toFixed(1);
            if (this.shadeA) this.shadeA.textContent = lab.a.toFixed(1);
            if (this.shadeB) this.shadeB.textContent = lab.b.toFixed(1);
            if (this.shadeDelta) this.shadeDelta.textContent = minDE.toFixed(2);
          }

          // Update Shade Comparison (Diff) mode UI (Always Visible)
          if (this.shadeDiffPanel) {
              const panel = this.shadeDiffPanel;
              panel.classList.remove('hidden'); // Ensure it's not hidden
              
              const swatchA = panel.querySelector('#diff-swatch-a');
              const swatchB = panel.querySelector('#diff-swatch-b');
              const deltaEVal = panel.querySelector('#diff-delta-e-val');
              const judgment = panel.querySelector('#diff-judgment');
              const statusBadge = panel.querySelector('#diff-status-badge');

              if (this.shadeDiffA) {
                 swatchA.style.backgroundColor = `rgb(${this.shadeDiffA.r}, ${this.shadeDiffA.g}, ${this.shadeDiffA.b})`;
              } else {
                 swatchA.style.backgroundColor = 'transparent';
              }

              if (this.shadeDiffB) {
                 swatchB.style.backgroundColor = `rgb(${this.shadeDiffB.r}, ${this.shadeDiffB.g}, ${this.shadeDiffB.b})`;
                 
                 // Calculate Delta E (CIE76 simple version)
                 const labA = ColorSpace.rgbToLab(this.shadeDiffA.r, this.shadeDiffA.g, this.shadeDiffA.b);
                 const labB = ColorSpace.rgbToLab(this.shadeDiffB.r, this.shadeDiffB.g, this.shadeDiffB.b);
                 const de = ColorSpace.deltaE(labA, labB);

                 deltaEVal.textContent = de.toFixed(2);
                 
                 // Judge with 3-tier traffic light system
                 statusBadge.classList.remove('status-blue', 'status-yellow', 'status-red');
                 if (de < 1.8) {
                     judgment.textContent = ' 適合良好 (Excellent)';
                     statusBadge.classList.add('status-blue');
                 } else if (de < 3.6) {
                     judgment.textContent = ' 許容範囲 (Acceptable)';
                     statusBadge.classList.add('status-yellow');
                 } else {
                     judgment.textContent = ' 不適合 (Mismatch)';
                     statusBadge.classList.add('status-red');
                 }
              } else {
                 swatchB.style.backgroundColor = 'transparent';
                 deltaEVal.textContent = '--';
                 judgment.textContent = '--';
                 statusBadge.classList.remove('status-blue', 'status-yellow', 'status-red');
              }
          }
      }
    } // end updateStats

    /**
     * Calibrate shade analysis using multiple reference objects (Interactive)
     */
    calibrateShade(realX, realY) {
        if (!this.currentImage) return;
        
        // Sampling (5x5)
        const sampleSize = 5;
        const half = Math.floor(sampleSize / 2);
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.currentImage.width;
        offCanvas.height = this.currentImage.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(this.currentImage, 0, 0);

        const imgData = offCtx.getImageData(realX - half, realY - half, sampleSize, sampleSize).data;
        let sR = 0, sG = 0, sB = 0;
        for (let i = 0; i < imgData.length; i += 4) {
            sR += imgData[i]; sG += imgData[i+1]; sB += imgData[i+2];
        }
        const avgR = sR / (sampleSize * sampleSize);
        const avgG = sG / (sampleSize * sampleSize);
        const avgB = sB / (sampleSize * sampleSize);

        const sampledLab = ColorSpace.rgbToLab(avgR, avgG, avgB);
        
        // Target Reference ID (from Palette selection)
        const targetId = this.currentCalibId || 'A2';
        const currentGuide = SHADE_GUIDES[this.currentShadeGuideId];
        const targetShade = currentGuide ? currentGuide.shades.find(sh => sh.id === targetId) : null;
        
        if (targetShade) {
            // Lab Offset (for statistics)
            const offset = {
                l: targetShade.l - sampledLab.l,
                a: targetShade.a - sampledLab.a,
                b: targetShade.b - sampledLab.b
            };
            
            // Add to multi-point list
            this.calibPoints.push({
                id: targetId,
                sampledRGB: { r: avgR, g: avgG, b: avgB },
                idealLab: { l: targetShade.l, a: targetShade.a, b: targetShade.b },
                offset: offset,
                x: realX,
                y: realY
            });

            // Recalculate average offset
            let sumL = 0, sumA = 0, sumB = 0;
            this.calibPoints.forEach(p => {
                sumL += p.offset.l; sumA += p.offset.a; sumB += p.offset.b;
            });
            const count = this.calibPoints.length;
            this.shadeOffset = { l: sumL/count, a: sumA/count, b: sumB/count };
            
            this.updateStats();
            this.drawCanvas();
            
            this.showShadeToast(`${targetId} としてプロットしました。画像全体を自動補正します。`);
        }
    }

    initShadeGuide() {
        if (this.shadeGuideSelect) {
            this.shadeGuideSelect.addEventListener('change', (e) => {
                this.currentShadeGuideId = e.target.value;
                const guide = SHADE_GUIDES[this.currentShadeGuideId];
                if (guide && this.shadeGuideDescription) {
                    this.shadeGuideDescription.textContent = guide.description;
                }
                this.renderShadePalette();
                this.updateStats();
            });
        }
        
        if (this.shadePalette) {
            this.shadePalette.addEventListener('click', (e) => {
                const btn = e.target.closest('.shade-btn');
                if (!btn) return;
                
                // Update active state
                this.shadePalette.querySelectorAll('.shade-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCalibId = btn.dataset.shade;

                // Auto-switch to Calibrator tool
                const calibRadio = this.card.querySelector('#tool-shade-calibrator');
                if (calibRadio) {
                    calibRadio.checked = true;
                    // Manually trigger tool update logic
                    this.activeTool = 'shade-calibrator';
                    
                    // Open drawer
                    const container = this.shadePalette.closest('.palette-container');
                    if (container) container.classList.add('open');
                }
                
                this.showShadeToast(`${this.currentCalibId} が選択されました。画像をプロットしてください。`);
            });
        }
    }

    renderShadePalette() {
        if (!this.shadePalette) return;
        
        const guide = SHADE_GUIDES[this.currentShadeGuideId];
        if (!guide) return;
        
        this.shadePalette.innerHTML = '';
        
        guide.shades.forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shade-btn';
            if (s.id === this.currentCalibId) btn.classList.add('active');
            btn.dataset.shade = s.id;
            btn.textContent = s.id;
            
            // Set background color preview if we have LAB values
            const rgb = ColorSpace.labToRgb(s.l, s.a, s.b);
            btn.style.setProperty('--shade-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
            
            this.shadePalette.appendChild(btn);
        });
    }

    showShadeToast(msg) {
        let t = document.getElementById('shade-toast');
        if (!t) {
            t = document.createElement('div'); t.id = 'shade-toast';
            t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(37,99,235,0.9); color:white; padding:10px 20px; border-radius:30px; font-weight:600; z-index:9999; pointer-events:none; transition: opacity 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
            document.body.appendChild(t);
        }
        t.textContent = msg; t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 2000);
    }

    renderCalibPlotList() {
        if (!this.shadePlotList) return;
        this.shadePlotList.innerHTML = '';
        this.calibPoints.forEach((p, idx) => {
            const tag = document.createElement('div');
            tag.className = 'plot-tag';
            tag.innerHTML = `<span>${p.id}</span><span class="remove-btn" title="削除">&times;</span>`;
            tag.querySelector('.remove-btn').onclick = (e) => {
                e.stopPropagation();
                this.calibPoints.splice(idx, 1);
                // Recalculate offset or reset if empty
                if (this.calibPoints.length === 0) {
                    this.shadeOffset = { l: 0, a: 0, b: 0 };
                } else {
                    let sL = 0, sA = 0, sB = 0;
                    this.calibPoints.forEach(cp => { sL += cp.offset.l; sA += cp.offset.a; sB += cp.offset.b; });
                    this.shadeOffset = { l: sL / this.calibPoints.length, a: sA / this.calibPoints.length, b: sB / this.calibPoints.length };
                }
                this.updateStats();
                this.drawCanvas();
            };
            this.shadePlotList.appendChild(tag);
        });
    }

    /**
     * Helper to sample R,G,B at a specific coordinate
     */
    sampleColorAt(realX, realY) {
        if (!this.currentImage) return { r: 128, g: 128, b: 128 };
        const sampleSize = 5;
        const half = Math.floor(sampleSize / 2);
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.currentImage.width;
        offCanvas.height = this.currentImage.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(this.currentImage, 0, 0);

        const imgData = offCtx.getImageData(realX - half, realY - half, sampleSize, sampleSize).data;
        let sumR = 0, sumG = 0, sumB = 0;
        const count = sampleSize * sampleSize;
        for (let i = 0; i < imgData.length; i += 4) {
            sumR += imgData[i]; sumG += imgData[i+1]; sumB += imgData[i+2];
        }
        return {
            r: Math.round(sumR / count),
            g: Math.round(sumG / count),
            b: Math.round(sumB / count)
        };
    }

    /**
     * Shade Take Analysis Logic
     */
    updateShade(realX, realY) {
        if (!this.currentImage || !this.canvas) return;

        // 1. Pixel Sampling (5x5 neighborhood to reduce noise)
        const sampleSize = 5;
        const half = Math.floor(sampleSize / 2);
        
        // Sampling from the original image at the real coordinates
        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.currentImage.width;
        offCanvas.height = this.currentImage.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(this.currentImage, 0, 0);

        const imgData = offCtx.getImageData(realX - half, realY - half, sampleSize, sampleSize).data;
        
        let sumR = 0, sumG = 0, sumB = 0;
        const count = sampleSize * sampleSize;

        for (let i = 0; i < imgData.length; i += 4) {
            sumR += imgData[i];
            sumG += imgData[i+1];
            sumB += imgData[i+2];
        }

        const avgR = Math.round(sumR / count);
        const avgG = Math.round(sumG / count);
        const avgB = Math.round(sumB / count);

        // 2. Data Storage
        if (this.activeTool === 'shade-diff') {
            // Toggle between A and B
            if (!this.shadeDiffA || (this.shadeDiffA && this.shadeDiffB)) {
                this.shadeDiffA = { x: realX, y: realY, r: avgR, g: avgG, b: avgB };
                this.shadeDiffB = null; // Clear B when new A is picked
            } else {
                this.shadeDiffB = { x: realX, y: realY, r: avgR, g: avgG, b: avgB };
            }
        } else {
            this.lines['shadeSample'] = { x: realX, y: realY, r: avgR, g: avgG, b: avgB };
        }
        
        // 3. UI Update
        this.updateStats();
        this.drawCanvas();
    }
  }

  const cardElements = document.querySelectorAll('.analysis-card:not(.lab-card), .analysis-unit'); 
  window.appCards = [];
  cardElements.forEach(el => window.appCards.push(new AnalysisCard(el)));

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

  // --- Trial License Manager (Study Group Edition) ---
  class TrialManager {
    constructor() {
      this.passcode = 'SHIBATA';
      this.expirationDate = new Date('2026-05-31');
      this.storageKey = 'aesthetic_trial_auth';
      this.modal = document.getElementById('trial-modal');
      this.input = document.getElementById('trial-passcode');
      this.button = document.getElementById('trial-submit-btn');
      this.errorMsg = document.getElementById('trial-error-msg');
      this.content = document.getElementById('trial-content');
      this.expiredMsg = document.getElementById('trial-expired-msg');
      this.init();
    }
    init() {
      if (!this.modal) return;
      if (new Date() > this.expirationDate) {
        this.showExpired(); return;
      }
      if (localStorage.getItem(this.storageKey) === 'true') {
        this.hideModal();
      } else {
        this.showModal();
      }
      this.button.addEventListener('click', () => this.checkPasscode());
      this.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.checkPasscode();
      });
    }
    showModal() {
      this.modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }
    hideModal() { this.modal.style.display = 'none'; }
    showExpired() {
      this.modal.style.display = 'flex';
      this.content.style.display = 'none';
      this.expiredMsg.style.display = 'block';
      if (window.lucide) window.lucide.createIcons();
    }
    checkPasscode() {
      if (this.input.value.trim() === this.passcode) {
        localStorage.setItem(this.storageKey, 'true');
        this.hideModal();
      } else {
        this.errorMsg.style.display = 'block';
        this.input.value = ''; this.input.focus();
      }
    }
  }

  // --- Trial License Manager ---
  // ... (既存のコードの後に追記)

});

/**
 * Color Space Conversion Utils
 */
const ColorSpace = {
    // RGB [0-255] -> CIE L*a*b*
    rgbToLab: function(r, g, b) {
        // Normalize
        let _r = r / 255, _g = g / 255, _b = b / 255;

        // sRGB to linear XYZ
        _r = (_r > 0.04045) ? Math.pow((_r + 0.055) / 1.055, 2.4) : _r / 12.92;
        _g = (_g > 0.04045) ? Math.pow((_g + 0.055) / 1.055, 2.4) : _g / 12.92;
        _b = (_b > 0.04045) ? Math.pow((_b + 0.055) / 1.055, 2.4) : _b / 12.92;

        let x = (_r * 0.4124 + _g * 0.3576 + _b * 0.1805) * 100;
        let y = (_r * 0.2126 + _g * 0.7152 + _b * 0.0722) * 100;
        let z = (_r * 0.0193 + _g * 0.1192 + _b * 0.9505) * 100;

        // XYZ to Lab (Reference: D65)
        const refX = 95.047, refY = 100.0, refZ = 108.883;
        x /= refX; y /= refY; z /= refZ;

        const f = (t) => (t > 0.008856) ? Math.pow(t, 1/3) : (7.787 * t) + (16/116);

        x = f(x); y = f(y); z = f(z);

        return {
            l: (116 * y) - 16,
            a: 500 * (x - y),
            b: 200 * (y - z)
        };
    },

    // CIE L*a*b* -> RGB [0-255]
    labToRgb: function(l, a, b) {
        // Lab to XYZ (Reference: D65)
        let y = (l + 16) / 116;
        let x = a / 500 + y;
        let z = y - b / 200;

        const f = (t) => (t > 0.206897) ? Math.pow(t, 3) : (t - 16/116) / 7.787;
        x = f(x) * 95.047;
        y = f(y) * 100.000;
        z = f(z) * 108.883;

        // XYZ to linear RGB
        let _r = (x * 0.032406 - y * 0.015372 - z * 0.004986);
        let _g = (x * -0.009689 + y * 0.018758 + z * 0.000415);
        let _b = (x * 0.000557 - y * 0.002040 + z * 0.010570);

        // Linear RGB to sRGB
        const comp = (c) => {
            const clamped = Math.max(0, c); // Avoid NaN with negative values for out-of-gamut Lab
            const srgb = (clamped > 0.0031308) ? (1.055 * Math.pow(clamped, 1 / 2.4) - 0.055) : (12.92 * clamped);
            return Math.max(0, Math.min(255, Math.round(srgb * 255)));
        };

        return { r: comp(_r), g: comp(_g), b: comp(_b) };
    },

    // Calculate Delta E (Color Difference)
    deltaE: function(lab1, lab2) {
        return Math.sqrt(
            Math.pow(lab1.l - lab2.l, 2) +
            Math.pow(lab1.a - lab2.a, 2) +
            Math.pow(lab1.b - lab2.b, 2)
        );
    }
};

/**
 * Comprehensive Shade Guide Data (Vita Classical, 3D Master, Chromascop, Vintage)
 */
const SHADE_GUIDES = {
    "vita-classical": {
        "name": "Vita Classical",
        "description": "スタンダード16色。ホワイトニングには通常OM1〜OM3（または3Dマスターの0M1〜0M3）が併用されます。",
        "shades": [
            { "id": "OM1", "l": 82.5, "a": -1.2, "b": 6.5 },
            { "id": "OM2", "l": 81.3, "a": -1.0, "b": 8.0 },
            { "id": "OM3", "l": 80.1, "a": -0.8, "b": 10.1 },
            { "id": "A1", "l": 73.1, "a": -0.3, "b": 12.0 },
            { "id": "A2", "l": 71.0, "a": 0.8, "b": 14.8 },
            { "id": "A3", "l": 69.8, "a": 1.5, "b": 16.5 },
            { "id": "A3.5", "l": 66.8, "a": 2.1, "b": 18.2 },
            { "id": "A4", "l": 64.9, "a": 2.7, "b": 19.3 },
            { "id": "B1", "l": 74.6, "a": -0.8, "b": 11.2 },
            { "id": "B2", "l": 72.8, "a": -0.1, "b": 14.2 },
            { "id": "B3", "l": 70.8, "a": 0.9, "b": 17.5 },
            { "id": "B4", "l": 68.6, "a": 1.6, "b": 19.6 },
            { "id": "C1", "l": 70.9, "a": -0.5, "b": 11.9 },
            { "id": "C2", "l": 68.5, "a": 0.1, "b": 14.4 },
            { "id": "C3", "l": 66.2, "a": 0.8, "b": 16.5 },
            { "id": "C4", "l": 63.6, "a": 1.4, "b": 18.2 },
            { "id": "D2", "l": 70.4, "a": -0.1, "b": 12.8 },
            { "id": "D3", "l": 68.5, "a": 0.4, "b": 14.5 },
            { "id": "D4", "l": 66.9, "a": 0.9, "b": 16.7 }
        ]
    },
    "vita-3d-master": {
        "name": "Vita 3D Master",
        "description": "明度ベースの体系的システム。0グループがブリーチングシェードに該当します。",
        "shades": [
            { "id": "0M1", "l": 84.3, "a": -1.4, "b": 6.7 },
            { "id": "0M2", "l": 83.0, "a": -1.2, "b": 8.8 },
            { "id": "0M3", "l": 81.6, "a": -1.0, "b": 11.2 },
            { "id": "1M1", "l": 78.5, "a": -0.5, "b": 12.0 },
            { "id": "1M2", "l": 77.0, "a": -0.2, "b": 14.5 },
            { "id": "2M1", "l": 74.0, "a": -0.1, "b": 14.0 },
            { "id": "2M2", "l": 72.5, "a": 0.5, "b": 16.5 },
            { "id": "2M3", "l": 71.0, "a": 1.2, "b": 19.5 },
            { "id": "3M1", "l": 69.5, "a": 0.3, "b": 15.5 },
            { "id": "3M2", "l": 68.0, "a": 0.8, "b": 18.0 },
            { "id": "3M3", "l": 66.5, "a": 1.5, "b": 20.5 },
            { "id": "4M1", "l": 65.0, "a": 0.6, "b": 17.0 },
            { "id": "4M2", "l": 63.5, "a": 1.2, "b": 19.5 },
            { "id": "4M3", "l": 62.0, "a": 1.8, "b": 22.0 },
            { "id": "5M1", "l": 60.5, "a": 1.0, "b": 18.5 },
            { "id": "5M2", "l": 59.0, "a": 1.5, "b": 21.0 },
            { "id": "5M3", "l": 57.5, "a": 2.2, "b": 23.5 }
        ]
    },
    "chromascop": {
        "name": "Chromascop",
        "description": "Ivoclarのシェードガイド。010〜040がブリーチングシェードとして設定されています。",
        "shades": [
            { "id": "010", "l": 83.0, "a": -1.0, "b": 6.5 },
            { "id": "020", "l": 81.5, "a": -0.8, "b": 8.0 },
            { "id": "030", "l": 80.0, "a": -0.6, "b": 9.5 },
            { "id": "040", "l": 78.5, "a": -0.4, "b": 11.0 },
            { "id": "110", "l": 79.7, "a": -0.6, "b": 14.6 },
            { "id": "120", "l": 78.5, "a": -0.3, "b": 16.1 },
            { "id": "130", "l": 76.6, "a": -0.7, "b": 17.0 },
            { "id": "140", "l": 77.0, "a": 0.2, "b": 19.4 },
            { "id": "210", "l": 75.4, "a": 0.1, "b": 20.9 },
            { "id": "220", "l": 74.9, "a": 1.5, "b": 19.1 },
            { "id": "230", "l": 73.0, "a": 1.7, "b": 21.2 },
            { "id": "240", "l": 72.5, "a": 2.9, "b": 22.9 },
            { "id": "310", "l": 73.1, "a": -0.1, "b": 23.1 },
            { "id": "320", "l": 70.8, "a": 0.7, "b": 23.8 },
            { "id": "330", "l": 71.9, "a": 1.3, "b": 27.7 },
            { "id": "340", "l": 68.6, "a": 2.4, "b": 26.2 },
            { "id": "410", "l": 72.2, "a": 0.7, "b": 16.8 },
            { "id": "420", "l": 73.1, "a": 0.7, "b": 18.9 },
            { "id": "430", "l": 72.8, "a": -0.0, "b": 19.5 },
            { "id": "440", "l": 71.0, "a": -0.1, "b": 18.6 },
            { "id": "510", "l": 70.1, "a": 0.5, "b": 20.2 },
            { "id": "520", "l": 68.7, "a": 1.3, "b": 22.5 },
            { "id": "530", "l": 68.8, "a": 1.6, "b": 24.8 },
            { "id": "540", "l": 65.6, "a": 3.9, "b": 23.0 }
        ]
    },
    "vintage": {
        "name": "Vintage Color Indicator",
        "description": "松風ヴィンテージシステム。ホワイトニングシェードはW1、W2、W3等で定義されます。C・Dグループも含めたフルセットです。",
        "shades": [
            { "id": "W1", "l": 82.0, "a": -1.0, "b": 7.0 },
            { "id": "W2", "l": 80.5, "a": -0.8, "b": 8.5 },
            { "id": "W3", "l": 79.0, "a": -0.5, "b": 10.0 },
            { "id": "A1", "l": 73.5, "a": -0.2, "b": 12.5 },
            { "id": "A2", "l": 71.5, "a": 0.7, "b": 15.0 },
            { "id": "A3", "l": 70.0, "a": 1.4, "b": 17.0 },
            { "id": "A3.5", "l": 67.5, "a": 2.0, "b": 18.5 },
            { "id": "A4", "l": 65.5, "a": 2.5, "b": 19.5 },
            { "id": "B1", "l": 75.0, "a": -0.7, "b": 11.5 },
            { "id": "B2", "l": 73.0, "a": 0.0, "b": 14.5 },
            { "id": "B3", "l": 71.0, "a": 0.8, "b": 18.0 },
            { "id": "B4", "l": 69.0, "a": 1.5, "b": 20.0 },
            { "id": "C1", "l": 71.2, "a": -0.4, "b": 12.0 },
            { "id": "C2", "l": 69.0, "a": 0.2, "b": 14.5 },
            { "id": "C3", "l": 66.5, "a": 0.9, "b": 16.8 },
            { "id": "C4", "l": 64.0, "a": 1.5, "b": 18.5 },
            { "id": "D2", "l": 70.8, "a": 0.0, "b": 13.0 },
            { "id": "D3", "l": 68.8, "a": 0.5, "b": 14.8 },
            { "id": "D4", "l": 67.2, "a": 1.0, "b": 17.0 }
        ]
    }
};

/**
 * Handle image upload for the free supplemental image slots in Lab Tools.
 * @param {HTMLInputElement} input 
 */
window.handleFreeImageUpload = function(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const slot = input.parentElement;
    
    // Remove existing image if any
    const existingImg = slot.querySelector('img');
    if (existingImg) existingImg.remove();
    
    // Create new image element
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'preview-img';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    slot.appendChild(img);
    
    // Hide icon and label
    const icon = slot.querySelector('.slot-icon');
    const label = slot.querySelector('.slot-label');
    if (icon) icon.style.opacity = '0';
    if (label) label.style.opacity = '0';
  };
  reader.readAsDataURL(file);
};


