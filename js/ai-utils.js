// --- AI (MediaPipe) Integration ---
window.faceLandmarker = null;
window.imageSegmenter = null;

window.initFaceLandmarker = async () => {
    if (window.faceLandmarker) return window.faceLandmarker;
    try {
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
            minFaceDetectionConfidence: 0.1,
            minFacePresenceConfidence: 0.1,
            minTrackingConfidence: 0.1
        };

        try {
            window.faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
        } catch (gpuErr) {
            console.warn("GPU initialization failed, falling back to CPU:", gpuErr);
            options.baseOptions.delegate = "CPU";
            window.faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
        }

        return window.faceLandmarker;
    } catch (err) {
        console.error("AI Initialization failed:", err);
        throw new Error("MediaPipeの初期化に失敗しました。");
    }
};

window.initImageSegmenter = async () => {
    if (window.imageSegmenter) return window.imageSegmenter;
    try {
        const vision_module = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
        const { ImageSegmenter, FilesetResolver } = vision_module;

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const options = {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`,
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            outputCategoryMask: true,
            outputConfidenceMasks: false
        };

        try {
            window.imageSegmenter = await ImageSegmenter.createFromOptions(vision, options);
        } catch (gpuErr) {
            console.warn("GPU Segmenter initialization failed, falling back to CPU:", gpuErr);
            options.baseOptions.delegate = "CPU";
            window.imageSegmenter = await ImageSegmenter.createFromOptions(vision, options);
        }

        return window.imageSegmenter;
    } catch (err) {
        console.error("Segmenter Initialization failed:", err);
        throw new Error("ImageSegmenterの初期化に失敗しました。");
    }
};

window.absDist = (val, target) => Math.abs(val - target);

window.ColorSpace = {
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

window.SHADE_GUIDES = {
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
    // ... (rest of SHADE_GUIDES from app.js)
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
