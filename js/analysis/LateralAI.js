window.LateralAI = {
    /**
     * AIシルエットマスクをベースにした自動側貌解析
     * @param {Uint8Array} mask - MediaPipe ImageSegmenterのマスク
     */
    detectFromMask(mask, width, height, imageData) {
        // --- 1. 右端スキャンによる輪郭線の抽出 ---
        const rawProfile = this._scanRightEdge(mask, width, height);
        if (rawProfile.length < 50) return null;

        // --- 2. スムージング (ノイズ除去) ---
        const profile = this._smoothProfile(rawProfile);

        // --- 3. 形状解析による特徴点の特定 ---
        return this._extractLandmarksByCurvature(profile, width, height);
    },

    /**
     * マスクデータを垂直に走査し、各行の人物の最も右の座標(X)を記録
     */
    _scanRightEdge(mask, width, height) {
        const points = [];
        // 頭頂部(15%)から顎下(90%)の範囲をスキャン
        for (let y = Math.floor(height * 0.15); y < Math.floor(height * 0.95); y++) {
            let maxX = -1;
            // 右から左へ向かって、最初に人物(mask > 128)が見つかった点
            for (let x = width - 1; x >= width * 0.2; x--) {
                if (mask[y * width + x] > 128) {
                    maxX = x;
                    break;
                }
            }
            if (maxX !== -1) {
                points.push({ x: maxX, y: y });
            }
        }
        return points;
    },

    _smoothProfile(points) {
        const result = [];
        const windowSize = 5; // 5ピクセルの移動平均
        for (let i = 0; i < points.length; i++) {
            let sumX = 0, count = 0;
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (points[j]) { sumX += points[j].x; count++; }
            }
            result.push({ x: sumX / count, y: points[i].y });
        }
        return result;
    },

    /**
     * 垂直方向のプロファイルラインから、凹凸のピーク（特徴点）を特定
     */
    _extractLandmarksByCurvature(profile, width, height) {
        try {
            // Pronasale (Prn): 全体の中で最も右に突き出ている点（鼻先）
            const prnIdx = this._findExtremeIndex(profile, true, 'x');
            const prn = profile[prnIdx];

            // Glabella (G): 鼻先より上で、最も凹んでいる点（眉間）
            const gRange = profile.slice(0, prnIdx);
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            // Subnasale (Sn): 鼻先より下で、最初の深い凹み
            // 鼻先から下方、全長の1/4程度の範囲で探す
            const snSearchRange = profile.slice(prnIdx + 5);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x');
            const sn = snSubRange[snIdx];

            // Lips & Chin: Snより下の山を探す
            const lowerPart = profile.slice(profile.indexOf(sn) + 5);
            
            // Labiale Superius (Ls): Snより下の最初の山（上唇）
            const lsSubRange = lowerPart.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx];

            // Labiale Inferius (Li): 上唇より下の次の山（下唇）
            const liSearchRange = lowerPart.slice(lsSubRange.indexOf(ls) + 8);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x');
            const li = liSubRange[liIdx];

            // Pogonion (Pg): 下唇より下の最も右に突き出した点（顎）
            const pgSearchRange = lowerPart.slice(lowerPart.indexOf(li) + 10);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x');
            const pg = pgSearchRange[pgIdx];

            // Columella (Col): 鼻先と鼻下の中間点
            const betweenPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = betweenPrnSn[Math.floor(betweenPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) {
            console.error("Lateral profile analysis failed:", e);
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
