window.LateralAI = {
    /**
     * AIシルエット ＋ 輝度補正ハイブリッド方式による解析 (最終ロバスト版)
     */
    detectFromMask(mask, width, height, imageData) {
        // --- 1. 背景色のサンプリング (上部優先) ---
        const bg = this._getBackgroundColorSmart(imageData, width, height);

        // --- 2. グローバルな人物領域(Bounding Box)の特定 ---
        const bbox = this._getMaskBoundingBoxRobust(mask, width, height, imageData, bg);
        if (!bbox || bbox.width < 50 || bbox.height < 100) return null;

        // --- 3. 領域内での「真の鼻先(Global Peak)」の特定 ---
        const globalPeak = this._findGlobalNosePeakRobust(mask, width, height, bbox, imageData, bg);
        if (!globalPeak) return null;

        // --- 4. ピークを基準としたロバストなプロファイル抽出 ---
        const rawProfile = this._scanProfileNearPeak(mask, width, height, bbox, globalPeak, imageData, bg);
        if (rawProfile.length < 50) return null;

        // --- 5. スムージング & 特徴点抽出 ---
        const profile = this._smoothProfile(rawProfile);
        return this._extractLandmarksByCurvature(profile);
    },

    /**
     * 上側の隅を優先的にサンプリングし、肩の服やエプロンの色を混入させない
     */
    _getBackgroundColorSmart(data, width, height) {
        const samples = [];
        // 上部3点 (左、中央、右) を優先。下部は髪や服が多いため除外
        const coords = [[10, 10], [width - 11, 10], [Math.floor(width / 2), 10]];
        
        coords.forEach(s => {
            const idx = (s[1] * width + s[0]) * 4;
            if (idx < data.length) {
                samples.push({ r: data[idx], g: data[idx+1], b: data[idx+2], brightness: data[idx] + data[idx+1] + data[idx+2] });
            }
        });

        // 最も明るい地点を背景色の基準とする (歯科背景は通常白いため)
        samples.sort((a, b) => b.brightness - a.brightness);
        return samples[0] || { r: 255, g: 255, b: 255 };
    },

    _getMaskBoundingBoxRobust(mask, width, height, data, bg) {
        let minX = width, maxX = 0, minY = height, maxY = 0;
        const marginX = 40; // 右端40pxを完全に除外 (ノイズ多発地帯)
        const marginY = 20;
        
        for (let y = marginY; y < height - marginY; y++) {
            for (let x = marginY; x < width - marginX; x++) {
                const idx = (y * width + x) * 4;
                // AI判定 且つ 背景色と明確に異なる (閾値を35にアップ)
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 35)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX <= minX) return null;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, right: maxX };
    },

    /**
     * 単なる1ピクセルではなく、一定の「厚み」がある領域を鼻先とみなす
     */
    _findGlobalNosePeakRobust(mask, width, height, bbox, data, bg) {
        let maxReachX = -1;
        let peakY = -1;
        const solidThreshold = 10; // 10ピクセル連続して「人体」である必要がある
        
        const startY = Math.floor(bbox.y + bbox.height * 0.2);
        const endY = Math.floor(bbox.y + bbox.height * 0.6);
        
        for (let y = startY; y < endY; y++) {
            for (let x = bbox.right; x >= bbox.x + solidThreshold; x--) {
                const idx = (y * width + x) * 4;
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 40)) {
                    // 厚みの確認 (連続性チェック)
                    let isSolid = true;
                    for (let cx = x - 1; cx >= x - solidThreshold; cx--) {
                        const cidx = (y * width + cx) * 4;
                        if (mask[y * width + cx] <= 128 || this._isColorSame(cidx, bg, data, 40)) {
                            isSolid = false; break;
                        }
                    }
                    if (isSolid) {
                        if (x > maxReachX) { maxReachX = x; peakY = y; }
                        break; 
                    }
                }
            }
        }
        return maxReachX !== -1 ? { x: maxReachX, y: peakY } : null;
    },

    _scanProfileNearPeak(mask, width, height, bbox, peak, data, bg) {
        const points = [];
        const scanRangeX = 80;
        
        for (let y = bbox.y; y < bbox.y + bbox.height; y++) {
            let edgeX = -1;
            // 鼻先の少し右から左へスキャン
            for (let x = Math.min(width - 41, peak.x + 5); x >= Math.max(0, peak.x - scanRangeX); x--) {
                const idx = (y * width + x) * 4;
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 40)) {
                    edgeX = x;
                    break;
                }
            }
            if (edgeX !== -1) {
                points.push({ x: edgeX, y: y });
            }
        }
        return points;
    },

    _isColorSame(idx, bg, data, threshold) {
        const dr = data[idx] - bg.r;
        const dg = data[idx+1] - bg.g;
        const db = data[idx+2] - bg.b;
        // 色差（ユークリッド距離）
        return (dr*dr + dg*dg + db*db) < (threshold * threshold);
    },

    _smoothProfile(points) {
        const result = [];
        const windowSize = 4;
        for (let i = 0; i < points.length; i++) {
            let sumX = 0, count = 0;
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (points[j]) { sumX += points[j].x; count++; }
            }
            result.push({ x: sumX / count, y: points[i].y });
        }
        return result;
    },

    _extractLandmarksByCurvature(profile) {
        try {
            const prnIdx = this._findExtremeIndex(profile, true, 'x');
            const prn = profile[prnIdx];

            const gRange = profile.slice(0, Math.max(0, prnIdx - 20));
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            const snSearchRange = profile.slice(prnIdx + 4, prnIdx + Math.floor(profile.length * 0.35));
            const snIdx = this._findExtremeIndex(snSearchRange, false, 'x');
            const sn = snSearchRange[snIdx] || profile[prnIdx + 12];

            const lowerPart = profile.slice(profile.indexOf(sn) + 1);
            const lsSubRange = lowerPart.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx] || lowerPart[0];

            const liStartIdx = lowerPart.indexOf(ls) + 8;
            const liSearchRange = lowerPart.slice(liStartIdx, liStartIdx + Math.floor(profile.length * 0.25));
            const liIdx = this._findExtremeIndex(liSearchRange, true, 'x');
            const li = liSearchRange[liIdx] || lowerPart[liStartIdx + 2];

            const pgStartIdx = lowerPart.indexOf(li) + 10;
            const pgSearchRange = lowerPart.slice(pgStartIdx);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x');
            const pg = pgSearchRange[pgIdx] || lowerPart[lowerPart.length - 1];

            const btwnPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = btwnPrnSn[Math.floor(btwnPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) { return null; }
    },

    _findExtremeIndex(points, findMax, axis) {
        if (!points || points.length === 0) return 0;
        let extIdx = 0, extVal = points[0][axis];
        for (let i = 1; i < points.length; i++) {
            const val = points[i][axis];
            if (findMax ? (val > extVal) : (val < extVal)) { extVal = val; extIdx = i; }
        }
        return extIdx;
    }
};
