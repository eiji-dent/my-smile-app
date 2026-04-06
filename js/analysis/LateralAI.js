window.LateralAI = {
    /**
     * AIシルエットマスクをベースにした自動側貌解析 (境界ノイズ対策版)
     * @param {Uint8Array} mask - MediaPipe ImageSegmenterのマスク
     */
    detectFromMask(mask, width, height, imageData) {
        // --- 1. 右端スキャンによる輪郭線の抽出 ---
        const rawProfile = this._scanRightEdgeRobust(mask, width, height);
        if (rawProfile.length < 50) {
            console.error("Robust scan failed: too few points found.");
            return null;
        }

        // --- 2. スムージング (ノイズ除去) ---
        const profile = this._smoothProfile(rawProfile);

        // --- 3. 形状解析による特徴点の特定 ---
        return this._extractLandmarksByCurvature(profile, width, height);
    },

    /**
     * マスクデータを垂直に走査し、各行で「確実に人体である」と判定された最も右の座標を記録
     */
    _scanRightEdgeRobust(mask, width, height) {
        const points = [];
        const marginX = 15; // 画像端15pxは判定から除外 (境界ノイズ回避)
        const solidThreshold = 5; // 5ピクセル連続で「人」判定された地点をエッジとする
        
        let prevX = -1;

        for (let y = Math.floor(height * 0.15); y < Math.floor(height * 0.95); y++) {
            let edgeX = -1;
            // 右端（マージン内側）から左へスキャン
            for (let x = width - marginX; x >= width * 0.15; x--) {
                if (mask[y * width + x] > 128) {
                    // 連続ヒットの確認 (Solid Hit Check)
                    let isSolid = true;
                    for (let checkX = x - 1; checkX >= x - solidThreshold; checkX--) {
                        if (mask[y * width + checkX] <= 128) { isSolid = false; break; }
                    }
                    
                    if (isSolid) {
                        // 前の行からの急激なジャンプ(35px以上)を制限 (ノイズ吸着防止)
                        if (prevX !== -1 && Math.abs(x - prevX) > 35) {
                            // 無視して続行するか、前回の値を維持するか
                        } else {
                            edgeX = x;
                            break;
                        }
                    }
                }
            }
            
            if (edgeX !== -1) {
                points.push({ x: edgeX, y: y });
                prevX = edgeX;
            }
        }
        return points;
    },

    _smoothProfile(points) {
        const result = [];
        const windowSize = 5;
        for (let i = 0; i < points.length; i++) {
            let sumX = 0, count = 0;
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (points[j]) { sumX += points[j].x; count++; }
            }
            result.push({ x: sumX / count, y: points[i].y });
        }
        return result;
    },

    _extractLandmarksByCurvature(profile, width, height) {
        try {
            // Pronasale (Prn): 全体の中で最も右に突き出ている点
            const prnIdx = this._findExtremeIndex(profile, true, 'x');
            const prn = profile[prnIdx];

            // Glabella (G): 鼻先より上で、最も凹んでいる点
            const gRange = profile.slice(0, prnIdx);
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            // Subnasale (Sn): 鼻先より下で、最初の深い凹み
            const snSearchLimit = Math.floor(profile.length * 0.3);
            const snSearchRange = profile.slice(prnIdx + 4, prnIdx + 4 + snSearchLimit);
            const snIdx = this._findExtremeIndex(snSearchRange, false, 'x');
            const sn = snSearchRange[snIdx] || profile[prnIdx + 10];

            // Ls, Li, Pg：Snより下の起伏を解析
            const lowerPart = profile.slice(profile.indexOf(sn) + 1);
            
            // Labiale Superius (Ls): Snより下の最初の山
            const lsSearchLimit = Math.floor(profile.length * 0.15);
            const lsSubRange = lowerPart.slice(0, lsSearchLimit);
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx] || lowerPart[0];

            // Labiale Inferius (Li): 上唇より下の次の山
            const liStartIdx = lowerPart.indexOf(ls) + 6;
            const liSearchRange = lowerPart.slice(liStartIdx, liStartIdx + Math.floor(profile.length * 0.18));
            const liIdx = this._findExtremeIndex(liSearchRange, true, 'x');
            const li = liSearchRange[liIdx] || lowerPart[liStartIdx + 2];

            // Pogonion (Pg): 下唇より下で最も右に突き出した点
            const pgStartIdx = lowerPart.indexOf(li) + 10;
            const pgSearchRange = lowerPart.slice(pgStartIdx);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x');
            const pg = pgSearchRange[pgIdx] || lowerPart[lowerPart.length - 1];

            const btwnPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = btwnPrnSn[Math.floor(btwnPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) {
            console.error("Landmark curvature analysis failed:", e);
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
