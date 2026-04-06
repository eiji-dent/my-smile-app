window.LateralAI = {
    /**
     * ユーザー指定のクリック点（鼻先付近）を起点とした高精度側貌解析
     * @param {number} seedX - ユーザーがクリックしたX座標
     * @param {number} seedY - ユーザーがクリックしたY座標
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @param {Uint8ClampedArray} imageData - 画像ピクセルデータ
     * @param {Uint8Array} aiMask - MediaPipeの補助マスク
     */
    detectFromSeed(seedX, seedY, width, height, imageData, aiMask) {
        const bgSample = this._getBackgroundColor(imageData, width, height);

        // 1. 真の「鼻先エッジ」を特定 (クリック点から右へ走査)
        const noseEdgeX = this._findTrueEdge(seedX, seedY, width, imageData, aiMask, bgSample);
        if (noseEdgeX === -1) return null;

        // 2. 輪郭線を上下にトレース (プロファイル構築)
        const profileLine = this._traceProfileLine(noseEdgeX, seedY, width, height, imageData, aiMask, bgSample);
        if (profileLine.length < 50) return null;

        // 3. 特徴点の検出
        return this._extractLandmarksFromProfile(profileLine);
    },

    /**
     * クリック点から右へ向かって、背景と人体の境界（エッジ）を精密に探す
     */
    _findTrueEdge(startX, y, width, imageData, aiMask, bgSample) {
        // クリックされた点 (startX, y) から右へ走査
        for (let x = startX; x < width - 1; x++) {
            if (!this._isLikelyPerson(x, y, imageData, width, aiMask, bgSample)) {
                // 背景に当たった！一歩手前がエッジ
                return x - 1;
            }
        }
        return -1;
    },

    /**
     * 特定したエッジを起点に、上下へ輪郭線を辿る
     */
    _traceProfileLine(startX, startY, width, height, imageData, aiMask, bgSample) {
        const profile = [{ x: startX, y: startY }];
        
        // 上方向へトレース (眉間方向)
        let currX = startX;
        for (let y = startY - 2; y > height * 0.1; y -= 2) {
            const nextX = this._findLocalEdge(currX, y, width, imageData, aiMask, bgSample);
            if (nextX === -1) break;
            profile.unshift({ x: nextX, y: y });
            currX = nextX;
        }

        // 下方向へトレース (唇・顎方向)
        currX = startX;
        for (let y = startY + 2; y < height * 0.95; y += 2) {
            const nextX = this._findLocalEdge(currX, y, width, imageData, aiMask, bgSample);
            if (nextX === -1) break;
            profile.push({ x: nextX, y: y });
            currX = nextX;
        }
        return profile;
    },

    /**
     * 前の段のX座標の周辺 (+-15px) で、背景との境界を探す
     */
    _findLocalEdge(prevX, y, width, imageData, aiMask, bgSample) {
        const searchWidth = 25; 
        for (let x = prevX + searchWidth; x >= prevX - searchWidth; x--) {
            if (x < 0 || x >= width) continue;
            if (this._isLikelyPerson(x, y, imageData, width, aiMask, bgSample)) {
                return x; // 右から走査して最初に見つかった「人」がエッジ
            }
        }
        return -1;
    },

    _isLikelyPerson(x, y, data, width, aiMask, bgSample) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const Y = 0.299*r + 0.587*g + 0.114*b;
        const Cr = (r - Y) * 0.713 + 128;
        const Cb = (b - Y) * 0.564 + 128;
        const isSkin = (Cr > 132 && Cr < 175) && (Cb > 75 && Cb < 128);
        const distBG = Math.sqrt(Math.pow(r-bgSample.r,2) + Math.pow(g-bgSample.g,2) + Math.pow(b-bgSample.b,2));
        
        // AI判定、または「背景ではなくかつ肌色」なら人
        const aiVal = aiMask ? aiMask[y * width + x] : 0;
        return (aiVal > 0 && distBG > 30) || (distBG > 45 && isSkin);
    },

    _getBackgroundColor(data, width, height) {
        let r=0, g=0, b=0, count=0;
        const samples = [{x:5,y:5}, {x:width-5,y:5}, {x:5,y:height-5}, {x:width-5,y:height-5}];
        samples.forEach(s => {
            const idx = (s.y * width + s.x) * 4;
            if (idx < data.length) { r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++; }
        });
        return count > 0 ? { r: r/count, g: g/count, b: b/count } : { r: 250, g: 250, b: 250 };
    },

    _extractLandmarksFromProfile(profile) {
        try {
            // 垂直順序: Glabella < Prn < Sn < Ls < Li < Pg
            // Prn (鼻先) は全ポイントの中で最も右にある点
            const prnIdx = this._findExtremeIndex(profile, true, 'x');
            const prn = profile[prnIdx];

            // G (眉間) は Prn より上の最深点 (最も左)
            const gRange = profile.slice(0, prnIdx);
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            // Sn (鼻下点) は Prn より下の最初の最深点
            const snSearchRange = profile.slice(prnIdx + 2);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.25));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x');
            const sn = snSubRange[snIdx];

            // Ls (上唇) は Sn より下の最初の膨らみ
            const lsSearchRange = profile.slice(profile.indexOf(sn) + 1);
            const lsSubRange = lsSearchRange.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx];

            // Li (下唇) は Ls より下の膨らみ
            const liSearchRange = profile.slice(profile.indexOf(ls) + 5);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.2));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x');
            const li = liSubRange[liIdx];

            // Pg (オトガイ) は Li より下の最右点
            const pgSearchRange = profile.slice(profile.indexOf(li) + 8);
            const pgIdx = this._findExtremeIndex(pgSearchRange, true, 'x');
            const pg = pgSearchRange[pgIdx];

            const btwnPrnSn = profile.slice(profile.indexOf(prn), profile.indexOf(sn));
            const col = btwnPrnSn[Math.floor(btwnPrnSn.length * 0.5)] || prn;

            return { prn, sn, ls, li, pg, g, col, profileLine: profile };
        } catch(e) { return null; }
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
