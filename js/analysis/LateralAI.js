window.LateralAI = {
    /**
     * AIシルエット ＋ 色彩ハイブリッド方式による解析
     */
    detectFromMask(mask, width, height, imageData) {
        // --- 1. 背景色のサンプリング ---
        const bg = this._getBackgroundColor(imageData, width, height);

        // --- 2. グローバルな人物領域(Bounding Box)の特定 ---
        // 色彩ガードを併用してノイズを除去
        const bbox = this._getMaskBoundingBox(mask, width, height, imageData, bg);
        if (!bbox || bbox.width < 50 || bbox.height < 100) return null;

        // --- 3. 領域内での「真の鼻先(Global Peak)」の特定 ---
        const globalPeak = this._findGlobalNosePeak(mask, width, height, bbox, imageData, bg);
        if (!globalPeak) return null;

        // --- 4. ピークを基準としたロバストなプロファイル抽出 ---
        const rawProfile = this._scanProfileNearPeak(mask, width, height, bbox, globalPeak, imageData, bg);
        if (rawProfile.length < 50) return null;

        // --- 5. スムージング & 特徴点抽出 ---
        const profile = this._smoothProfile(rawProfile);
        return this._extractLandmarksByCurvature(profile);
    },

    /**
     * AIマスクと「背景色との差」をダブルチェックして、真の人物領域を特定
     */
    _getMaskBoundingBox(mask, width, height, data, bg) {
        let minX = width, maxX = 0, minY = height, maxY = 0;
        const margin = 30; // 四方のマージンを広めに（ノイズ回避）
        
        for (let y = margin; y < height - margin; y++) {
            for (let x = margin; x < width - margin; x++) {
                const idx = (y * width + x) * 4;
                // AIが「人」と言い、かつ「色が背景と違う」場合のみ採用
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 25)) {
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

    _findGlobalNosePeak(mask, width, height, bbox, data, bg) {
        let maxReachX = -1;
        let peakY = -1;
        
        // BBoxの中央付近〜上部をターゲット
        const startY = Math.floor(bbox.y + bbox.height * 0.1);
        const endY = Math.floor(bbox.y + bbox.height * 0.7);
        
        for (let y = startY; y < endY; y++) {
            // 右端から左へ。ただしBBoxの右端よりもさらに内側から探すこともある
            for (let x = bbox.right; x >= bbox.x; x--) {
                const idx = (y * width + x) * 4;
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 30)) {
                    if (x > maxReachX) {
                        maxReachX = x;
                        peakY = y;
                    }
                    break; 
                }
            }
        }
        return maxReachX !== -1 ? { x: maxReachX, y: peakY } : null;
    },

    _scanProfileNearPeak(mask, width, height, bbox, peak, data, bg) {
        const points = [];
        const scanRangeX = 70; // 鼻先から左側70pxの範囲
        
        for (let y = bbox.y; y < bbox.y + bbox.height; y++) {
            let edgeX = -1;
            for (let x = peak.x; x >= Math.max(0, peak.x - scanRangeX); x--) {
                const idx = (y * width + x) * 4;
                if (mask[y * width + x] > 128 && !this._isColorSame(idx, bg, data, 30)) {
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
        // ユークリッド距離の自乗で比較（高速化のため）
        return (dr*dr + dg*dg + db*db) < (threshold * threshold);
    },

    _getBackgroundColor(data, width, height) {
        // 四隅からサンプリング
        let r=0, g=0, b=0, c=0;
        const samples = [[5,5], [width-5,5], [5,height-5], [width-5,height-5]];
        samples.forEach(s => {
            const idx = (s[1] * width + s[0]) * 4;
            if (idx < data.length) { r += data[idx]; g += data[idx+1]; b += data[idx+2]; c++; }
        });
        return c > 0 ? { r: r/c, g: g/c, b: b/c } : { r: 255, g: 255, b: 255 };
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

            const liStartIdx = lowerPart.indexOf(ls) + 6;
            const liSearchRange = lowerPart.slice(liStartIdx, liStartIdx + Math.floor(profile.length * 0.22));
            const liIdx = this._findExtremeIndex(liSearchRange, true, 'x');
            const li = liSearchRange[liIdx] || lowerPart[liStartIdx + 2];

            const pgStartIdx = lowerPart.indexOf(li) + 10;
            const pgSearchRange = lowerPart.slice(pgStartIdx);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x');
            const pg = pgSearchRange[pgIdx] || lowerPart[lowerPart.length - 1];

            const btwnPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = btwnPrnSn[Math.floor(btwnPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) {
            return null;
        }
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
