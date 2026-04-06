window.LateralAI = {
    /**
     * 画像全体を俯瞰し、最も妥当な人物領域を特定してから解析するグローバル方式
     */
    detectFromMask(mask, width, height) {
        // --- 1. グローバルな人物領域(Bounding Box)の特定 ---
        const bbox = this._getMaskBoundingBox(mask, width, height);
        if (!bbox || bbox.width < 50 || bbox.height < 100) return null;

        // --- 2. 領域内での「真の鼻先(Global Peak)」の特定 ---
        const globalPeak = this._findGlobalNosePeak(mask, width, height, bbox);
        if (!globalPeak) return null;

        // --- 3. ピークを基準としたロバストなプロファイル抽出 ---
        const rawProfile = this._scanProfileNearPeak(mask, width, height, bbox, globalPeak);
        if (rawProfile.length < 50) return null;

        // --- 4. スムージング & 特徴点抽出 ---
        const profile = this._smoothProfile(rawProfile);
        return this._extractLandmarksByCurvature(profile);
    },

    /**
     * マスク全体を走査し、人体が存在する矩形領域を特定 (右端ノイズを除外)
     */
    _getMaskBoundingBox(mask, width, height) {
        let minX = width, maxX = 0, minY = height, maxY = 0;
        const marginX = 20; // 右端20pxはノイズとして無視
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width - marginX; x++) {
                if (mask[y * width + x] > 128) {
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
     * 特定された顔領域の中で、最も右側に突出している地点(鼻先)を検索
     */
    _findGlobalNosePeak(mask, width, height, bbox) {
        let maxReachX = -1;
        let peakY = -1;
        
        // 顔の上〜中央付近(bboxの10%〜60%の高さ)をターゲットに鼻先を探す
        const startY = Math.floor(bbox.y + bbox.height * 0.1);
        const endY = Math.floor(bbox.y + bbox.height * 0.65);
        
        for (let y = startY; y < endY; y++) {
            for (let x = bbox.right; x >= bbox.x; x--) {
                if (mask[y * width + x] > 128) {
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

    /**
     * 特定された鼻先ピークを基準に、上下の輪郭を「吸着」させながら抽出
     */
    _scanProfileNearPeak(mask, width, height, bbox, peak) {
        const points = [];
        const scanRangeX = 60; // 鼻先から左側60pxの範囲内でエッジを探す
        
        // 顔の上下端をスキャン
        for (let y = bbox.y; y < bbox.y + bbox.height; y++) {
            let edgeX = -1;
            // 鼻先のX座標付近から左方向にスキャン
            // これにより「右端の壁」ではなく「顔の凸凹」にだけ吸着する
            for (let x = peak.x; x >= Math.max(0, peak.x - scanRangeX); x--) {
                if (mask[y * width + x] > 128) {
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

            const gRange = profile.slice(0, prnIdx);
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            const snSearchRange = profile.slice(prnIdx + 4, prnIdx + Math.floor(profile.length * 0.3));
            const snIdx = this._findExtremeIndex(snSearchRange, false, 'x');
            const sn = snSearchRange[snIdx] || profile[prnIdx + 10];

            const lowerPart = profile.slice(profile.indexOf(sn) + 1);
            const lsSubRange = lowerPart.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx] || lowerPart[0];

            const liStartIdx = lowerPart.indexOf(ls) + 6;
            const liSearchRange = lowerPart.slice(liStartIdx, liStartIdx + Math.floor(profile.length * 0.18));
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
