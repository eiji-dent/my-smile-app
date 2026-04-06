window.LateralAI = {
    /**
     * 右向き側貌（横顔）解析のハイブリッド抽出
     * @param {Uint8Array} aiMask - MediaPipeからのマスク
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Uint8ClampedArray} imageData - 生の画像ピクセルデータ
     */
    detectLandmarksFromMask(aiMask, width, height, imageData) {
        // --- 1. 輪郭の抽出 (AI + 背景差分 + 肌色抽出 のハイブリッド) ---
        const profile = this._extractProfileLineHybrid(aiMask, width, height, imageData);
        if (profile.length < 50) {
            console.error("Hybrid profile extraction failed (too few points).");
            return null;
        }

        // --- 2. 特徴点の検出 (垂直順序保証: G < Prn < Sn < Ls < Li < Pg) ---
        try {
            // 眉間 (G): 鼻の付け根の凹み
            const gRange = profile.slice(0, Math.floor(profile.length * 0.35));
            const gIdx = this._findExtremeIndex(gRange, false, 'x'); // 最深点を眉間とする
            const g = gRange[gIdx];

            // 鼻先 (Prn): 眉間より下で最も右に突き出した点
            const prnSearchRange = profile.slice(profile.indexOf(g) + 8);
            const prnSubRange = prnSearchRange.slice(0, Math.floor(profile.length * 0.3));
            const prnIdx = this._findExtremeIndex(prnSubRange, true, 'x'); // 最右点
            const prn = prnSubRange[prnIdx];

            // 鼻下 (Sn): 鼻先より下の凹み
            const snSearchRange = profile.slice(profile.indexOf(prn) + 5);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x'); // 最深点
            const sn = snSubRange[snIdx];

            // 上唇 (Ls): Snより下の最初の膨らみ
            const lsSearchRange = profile.slice(profile.indexOf(sn) + 3);
            const lsSubRange = lsSearchRange.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x'); // 最右点
            const ls = lsSubRange[lsIdx];

            // 下唇 (Li): 上唇より下の次の膨らみ
            const liSearchRange = profile.slice(profile.indexOf(ls) + 8);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.18));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x'); // 最右点
            const li = liSubRange[liIdx];

            // オトガイ点 (Pg): 下唇より下で最も右に突き出した顎
            const pgSearchRange = profile.slice(profile.indexOf(li) + 12);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x'); // 最右点
            const pg = pgSearchRange[pgIdx];

            // 鼻柱下点 (Col)
            const betweenPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = betweenPrnSn[Math.floor(betweenPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) {
            console.error("Landmark detection error:", e);
            return null;
        }
    },

    /**
     * 自走式の輪郭抽出 (AIマスクと画像解析の組み合わせ)
     */
    _extractProfileLineHybrid(aiMask, width, height, imageData) {
        const points = [];
        const bgSample = this._getBackgroundColor(imageData, width, height);
        const minX = Math.floor(width * 0.4); // 右側のみを対象

        for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.95); y += 2) {
            let edgeX = -1;
            // 右端から左に向かって走査
            for (let x = width - 1; x >= minX; x--) {
                const idx = (y * width + x) * 4;
                const r = imageData[idx], g = imageData[idx+1], b = imageData[idx+2];
                const aiVal = aiMask[y * width + x];

                // 判定1: MediaPipe AIマスクが「人」と判定しているか
                const isPersonAI = aiVal > 0;

                // 判定2: 背景色との距離 (背景差分)
                const distRGB = Math.sqrt(Math.pow(r-bgSample.r,2) + Math.pow(g-bgSample.g,2) + Math.pow(b-bgSample.b,2));
                const isNotBG = distRGB > 45; // 閾値: クリニックの明るさに応じて

                // 判定3: 日本人の肌色範囲か (YCbCr)
                const Y = 0.299*r + 0.587*g + 0.114*b;
                const Cr = (r - Y) * 0.713 + 128;
                const Cb = (b - Y) * 0.564 + 128;
                const isSkin = (Cr > 133 && Cr < 173) && (Cb > 77 && Cb < 127);

                // ハイブリッド判定: AIが未検知でも、背景ではなく肌色なら「人(顔)」として扱う
                if (isPersonAI || (isNotBG && isSkin)) {
                    edgeX = x;
                    break;
                }
            }
            if (edgeX !== -1) points.push({ x: edgeX, y: y });
        }
        return points;
    },

    _getBackgroundColor(data, width, height) {
        // 画像の左上角と右下角付近からサンプリングして背景色を推定
        let r=0, g=0, b=0, count=0;
        const samples = [
            {x: 5, y: 5}, {x: 10, y: 10}, 
            {x: width-5, y: height-5}, {x: width-10, y: height-10}
        ];
        samples.forEach(s => {
            const idx = (s.y * width + s.x) * 4;
            if (idx < data.length) {
                r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++;
            }
        });
        return count > 0 ? { r: r/count, g: g/count, b: b/count } : { r: 255, g: 255, b: 255 };
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
