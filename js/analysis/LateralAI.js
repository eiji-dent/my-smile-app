window.LateralAI = {
    /**
     * セグメンテーションマスクからプロファイルライン（顔の輪郭）を抽出し、特徴点を特定します
     * @param {Uint8Array} mask - MediaPipe ImageSegmenter のカテゴリマスク
     * @param {number} width - 画像の幅
     * @param {number} height - 画像の高さ
     * @returns {Object} 検出されたランドマーク座標
     */
    detectLandmarksFromMask(mask, width, height) {
        // 1. プロファイルライン（顔の最前面の境界線）を抽出
        const profilePoints = this._extractProfileLine(mask, width, height);
        if (profilePoints.length < 50) return null;

        // 2. 幾何学的な特徴点を検出
        // 探索範囲を限定（上下の端を除外）
        const searchRange = profilePoints.filter(p => p.y > height * 0.1 && p.y < height * 0.9);
        
        // 鼻先 (Prn): 最も前（左右どちらか）に突き出している点
        // 顔が右向きか左向きかを判定
        const isFacingRight = searchRange.reduce((acc, p) => acc + p.x, 0) / searchRange.length < width / 2;
        // ※実際には歯科写真は右向きが標準的なことが多いですが、両方に対応させます
        
        const prnIdx = this._findExtremeIndex(searchRange, isFacingRight, 'x');
        const prn = searchRange[prnIdx];

        // 鼻下〜上唇領域を探索して鼻下点(Sn)と上唇(Ls)を特定
        // 鼻先より下の範囲を抽出
        const belowPrn = searchRange.slice(prnIdx);
        
        // 上唇(Ls): 鼻先から少し下で、再び突き出している点
        const lsIdx = this._findExtremeIndex(belowPrn.slice(0, Math.floor(belowPrn.length * 0.4)), isFacingRight, 'x');
        const ls = belowPrn[lsIdx];

        // 鼻下点(Sn): 鼻先と上唇の間の最も凹んでいる点
        const betweenPrnLs = belowPrn.slice(0, lsIdx);
        const snIdx = this._findExtremeIndex(betweenPrnLs, !isFacingRight, 'x');
        const sn = betweenPrnLs[snIdx] || { x: (prn.x + ls.x) / 2, y: (prn.y + ls.y) / 2 };

        // 下唇(Li): 上唇より下で、次に突き出している点
        const belowLs = belowPrn.slice(lsIdx);
        const liIdx = this._findExtremeIndex(belowLs.slice(0, Math.floor(belowLs.length * 0.5)), isFacingRight, 'x');
        const li = belowLs[liIdx];

        // オトガイ点(Pg): 下唇より下で、最も突き出している点
        const belowLi = belowLs.slice(liIdx);
        const pgIdx = this._findExtremeIndex(belowLi, isFacingRight, 'x');
        const pg = belowLi[pgIdx];

        // 眉間点 (G): 鼻先より上の最も凹んでいる点（または推定）
        const abovePrn = searchRange.slice(0, prnIdx).reverse();
        const gIdx = this._findExtremeIndex(abovePrn.slice(0, Math.floor(abovePrn.length * 0.5)), !isFacingRight, 'x');
        const g = abovePrn[gIdx] || { x: prn.x - (isFacingRight ? 20 : -20), y: prn.y - 100 };

        // 鼻柱下点 (Col): 鼻先からSnへのカーブの途中
        const col = betweenPrnLs[Math.floor(betweenPrnLs.length * 0.5)] || prn;

        return {
            prn, sn, ls, li, pg, g, col,
            profileLine: profilePoints
        };
    },

    /**
     * マスクから左右どちらかの端のピクセルを辿ってプロファイルラインを作成します
     */
    _extractProfileLine(mask, width, height) {
        const points = [];
        // 顔が左右どちらにあるか大まかに判定（左右中央より外側のピクセル数で比較）
        let leftCount = 0;
        let rightCount = 0;
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0) {
                if ((i % width) < width / 2) leftCount++;
                else rightCount++;
            }
        }
        const isPersonOnLeft = leftCount > rightCount;
        const searchFromLeft = !isPersonOnLeft; // 人が左にいるなら、輪郭は右側にあるはず

        for (let y = 0; y < height; y += 2) {
            let edgeX = -1;
            if (searchFromLeft) {
                // 左から右へ走査して最初の「人」ピクセルを見つける
                for (let x = 0; x < width; x++) {
                    if (mask[y * width + x] > 0) {
                        edgeX = x;
                        break;
                    }
                }
            } else {
                // 右から左へ走査して最初の「人」ピクセルを見つける
                for (let x = width - 1; x >= 0; x--) {
                    if (mask[y * width + x] > 0) {
                        edgeX = x;
                        break;
                    }
                }
            }
            if (edgeX !== -1) {
                points.push({ x: edgeX, y: y });
            }
        }
        return points;
    },

    _findExtremeIndex(points, findMax, axis) {
        if (points.length === 0) return 0;
        let extIdx = 0;
        let extVal = points[0][axis];
        for (let i = 1; i < points.length; i++) {
            const val = points[i][axis];
            if (findMax) {
                if (val > extVal) { extVal = val; extIdx = i; }
            } else {
                if (val < extVal) { extVal = val; extIdx = i; }
            }
        }
        return extIdx;
    }
};
