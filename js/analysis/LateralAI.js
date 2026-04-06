window.LateralAI = {
    /**
     * 右向きの側貌画像（シルエット）から臨床的ランドマークを抽出
     */
    detectLandmarksFromMask(mask, width, height) {
        // 1. プロファイルライン（顔の最前面の境界線）を抽出
        // ユーザー指定により「右向き」固定。右側から走査。
        const profile = this._extractProfileLine(mask, width, height);
        if (profile.length < 50) return null;

        // 2. 特徴点の検出 (垂直順序: G < Prn < Sn < Ls < Li < Pg)
        // 各点は前の点より下にあることを保証する走査を行う
        
        try {
            // --- 眉間 (G): 鼻根の窪み ---
            // 輪郭の上部 1/4 程度から探索
            const gRange = profile.slice(0, Math.floor(profile.length * 0.3));
            const gIdx = this._findExtremeIndex(gRange, false, 'x'); // 最も左(深い)点
            const g = gRange[gIdx];

            // --- 鼻先 (Prn) ---
            // Gより下から探索
            const prnSearchRange = profile.slice(profile.indexOf(g) + 5);
            // 上から 1/3 程度の範囲で最も右に突き出している点が鼻先
            const prnSubRange = prnSearchRange.slice(0, Math.floor(profile.length * 0.3));
            const prnIdx = this._findExtremeIndex(prnSubRange, true, 'x'); // 最も右
            const prn = prnSubRange[prnIdx];

            // --- 鼻下点 (Sn) ---
            // Prnより下、かつ口唇より上の「谷」
            const snSearchRange = profile.slice(profile.indexOf(prn) + 5);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x'); // 最も左(深い)
            const sn = snSubRange[snIdx];

            // --- 上唇 (Ls) ---
            // Snより下の最初の山
            const lsSearchRange = profile.slice(profile.indexOf(sn) + 2);
            const lsSubRange = lsSearchRange.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x'); // 最も右
            const ls = lsSubRange[lsIdx];

            // --- 下唇 (Li) ---
            // Lsより下の次の山
            const liSearchRange = profile.slice(profile.indexOf(ls) + 5);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x'); // 最も右
            const li = liSubRange[liIdx];

            // --- オトガイ点 (Pg) ---
            // Liより下の最後の大きな山
            const pgSearchRange = profile.slice(profile.indexOf(li) + 10);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x'); // 最も右
            const pg = pgSearchRange[pgIdx];

            // 鼻柱下点 (Col) は便宜上 Prn と Sn の中間付近とする
            const betweenPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = betweenPrnSn[Math.floor(betweenPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };

        } catch (e) {
            console.warn("Landmark extraction failed:", e);
            return null;
        }
    },

    /**
     * 右向き固定で輪郭を抽出。画像の右半分のみを対象とする。
     */
    _extractProfileLine(mask, width, height) {
        const points = [];
        // 走査開始位置を画像の右半分に限定 (ノイズ対策)
        const minX = Math.floor(width * 0.4); 

        for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.95); y += 2) {
            let edgeX = -1;
            // 右側(width-1)から左へ走査して、最初の「人」ピクセルを見つける
            for (let x = width - 1; x >= minX; x--) {
                if (mask[y * width + x] > 0) {
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

    _findExtremeIndex(points, findMax, axis) {
        if (!points || points.length === 0) return 0;
        let extIdx = 0;
        let extVal = points[0][axis];
        for (let i = 1; i < points.length; i++) {
            const val = points[i][axis];
            if (findMax ? (val > extVal) : (val < extVal)) {
                extVal = val;
                extIdx = i;
            }
        }
        return extIdx;
    }
};
