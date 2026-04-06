window.LateralAI = {
    /**
     * 右向き側貌（横顔）解析のハイブリッド抽出
     */
    detectLandmarksFromMask(aiMask, width, height, imageData) {
        // --- 1. 輪郭の抽出 (改良版ハイブリッド) ---
        const profile = this._extractProfileLineHybrid(aiMask, width, height, imageData);
        if (profile.length < 30) {
            console.error("Hybrid profile extraction failed (too few points).");
            return null;
        }

        // --- 2. 特徴点の検出 (垂直順序保証) ---
        try {
            // 眉間 (G): 鼻の付け根の凹み
            // 抽出されたプロファイルの最初の方（上部）から探す
            const gRange = profile.slice(0, Math.min(profile.length - 1, 40));
            const gIdx = this._findExtremeIndex(gRange, false, 'x'); // 最深点
            const g = gRange[gIdx];

            // 鼻先 (Prn): 眉間より下で最も右に突き出した点
            const prnSearchRange = profile.slice(profile.indexOf(g) + 5);
            const prnSubRange = prnSearchRange.slice(0, Math.floor(profile.length * 0.4));
            const prnIdx = this._findExtremeIndex(prnSubRange, true, 'x'); // 最右点
            const prn = prnSubRange[prnIdx];

            // 鼻下 (Sn): 鼻先より下の凹み
            const snSearchRange = profile.slice(profile.indexOf(prn) + 3);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.25));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x'); // 最深点
            const sn = snSubRange[snIdx];

            // 上唇 (Ls): Snより下の最初の膨らみ
            const lsSearchRange = profile.slice(profile.indexOf(sn) + 2);
            const lsSubRange = lsSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x'); // 最右点
            const ls = lsSubRange[lsIdx];

            // 下唇 (Li): 上唇より下の次の膨らみ
            const liSearchRange = profile.slice(profile.indexOf(ls) + 6);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.25));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x'); // 最右点
            const li = liSubRange[liIdx];

            // オトガイ点 (Pg): 下唇より下で最も右に突き出した顎
            const pgSearchRange = profile.slice(profile.indexOf(li) + 10);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x'); // 最右点
            const pg = pgSearchRange[pgIdx];

            const betweenPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = betweenPrnSn[Math.floor(betweenPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch (e) {
            console.error("Landmark detection error:", e);
            return null;
        }
    },

    /**
     * 右端の固着を回避する堅牢な輪郭抽出
     */
    _extractProfileLineHybrid(aiMask, width, height, imageData) {
        const points = [];
        const bgSample = this._getBackgroundColor(imageData, width, height);
        const minX = Math.floor(width * 0.3); // 右30%から左へ
        const marginX = 6; // 右端6pxを無視 (境界ノイズ回避)

        // 走査開始を少し下げて髪の毛(頭頂部)を回避
        for (let y = Math.floor(height * 0.15); y < Math.floor(height * 0.9); y += 3) {
            let edgeX = -1;
            // 右端から左に向かって走査
            for (let x = width - marginX; x >= minX; x--) {
                if (this._isPersonAt(x, y, aiMask, imageData, width, bgSample)) {
                    // 連続性確認: 左に向かってさらに3ピクセル「人」であるか確認 (誤検知排除)
                    let isSolid = true;
                    for (let checkX = x - 1; checkX >= x - 3; checkX--) {
                        if (!this._isPersonAt(checkX, y, aiMask, imageData, width, bgSample)) {
                            isSolid = false; break;
                        }
                    }
                    if (isSolid) { edgeX = x; break; }
                }
            }
            if (edgeX !== -1) points.push({ x: edgeX, y: y });
        }
        return points;
    },

    /**
     * 単一ピクセルが「人体/顔」かどうかを複合判定
     */
    _isPersonAt(x, y, aiMask, imageData, width, bgSample) {
        const idx = (y * width + x) * 4;
        const r = imageData[idx], g = imageData[idx+1], b = imageData[idx+2];
        
        // 1. AI判定
        const isPersonAI = aiMask[y * width + x] > 0;

        // 2. 背景判定
        const distRGB = Math.sqrt(Math.pow(r-bgSample.r,2) + Math.pow(g-bgSample.g,2) + Math.pow(b-bgSample.b,2));
        const isNotBG = distRGB > 50;

        // 3. 肌色判定 (YCbCr)
        const Y = 0.299*r + 0.587*g + 0.114*b;
        const Cr = (r - Y) * 0.713 + 128;
        const Cb = (b - Y) * 0.564 + 128;
        const isSkin = (Cr > 135 && Cr < 170) && (Cb > 80 && Cb < 125);

        // 肌色かつ背景でなければ、AI判定がなくても「人」とみなす (AI漏れ補完)
        // AI判定があっても、背景色と酷似している（影など）場合は除外する
        return (isPersonAI && isNotBG) || (isNotBG && isSkin);
    },

    _getBackgroundColor(data, width, height) {
        let r=0, g=0, b=0, count=0;
        // 画像の四隅からサンプリング
        const samples = [
            {x: 10, y: 10}, {x: width-10, y: 10}, 
            {x: 10, y: height-10}, {x: width-10, y: height-10}
        ];
        samples.forEach(s => {
            const idx = (s.y * width + s.x) * 4;
            if (idx < data.length) {
                r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++;
            }
        });
        return count > 0 ? { r: r/count, g: g/count, b: b/count } : { r: 240, g: 240, b: 240 };
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
