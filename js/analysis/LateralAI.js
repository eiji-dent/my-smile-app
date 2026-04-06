window.LateralAI = {
    /**
     * 1クリック誘導式・双方向コントラスト追跡解析
     */
    detectFromSeed(seedX, seedY, width, height, imageData, aiMask) {
        // 1. 周辺範囲で「色の変化が最も激しい場所」を双方向に探す (クリック位置のズレ補完)
        const noseEdgeX = this._findMaxGradientEdgeBidirectional(seedX, seedY, width, imageData);
        if (noseEdgeX === -1) return null;

        const bgSample = this._getBackgroundColor(imageData, width, height);

        // 2. エッジフォロワー（輪郭追跡）
        let profile = this._traceProfileByContrast(noseEdgeX, seedY, width, height, imageData, bgSample);
        if (profile.length < 40) return null;

        // 3. データの平滑化 (ノイズ除去)
        profile = this._smoothProfile(profile);

        // 4. 特徴点の検出
        return this._extractLandmarksFromProfile(profile);
    },

    /**
     * クリック地点から左右50pxの範囲で、最もコントラストが強い地点をエッジとして特定
     */
    _findMaxGradientEdgeBidirectional(startX, y, width, imageData) {
        let maxGrad = -1;
        let edgeX = -1;
        const radius = 60; // 左右60pxの範囲をスキャン

        for (let x = Math.max(0, startX - radius); x < Math.min(width - 2, startX + radius); x++) {
            const idx1 = (y * width + x) * 4;
            const idx2 = (y * width + (x + 1)) * 4;
            
            // 色距離（勾配）の計算
            const diff = Math.abs(imageData[idx1] - imageData[idx2]) + 
                         Math.abs(imageData[idx1+1] - imageData[idx2+1]) + 
                         Math.abs(imageData[idx1+2] - imageData[idx2+2]);
            
            if (diff > maxGrad) {
                maxGrad = diff;
                edgeX = x;
            }
        }
        return maxGrad > 20 ? edgeX : -1;
    },

    /**
     * 前の段のエッジから、左側や右側に変化する輪郭を追跡
     */
    _traceProfileByContrast(startX, startY, width, height, imageData, bgSample) {
        const profile = [{ x: startX, y: startY }];
        
        // 上方向 (眉間)
        let currX = startX;
        for (let y = startY - 2; y > height * 0.1; y -= 2) {
            const nextX = this._findLocalMaxGradient(currX, y, width, imageData);
            if (nextX === -1) break;
            if (Math.abs(nextX - currX) > 30) break; // 30px以上の急激な横飛びは失敗
            profile.unshift({ x: nextX, y: y });
            currX = nextX;
        }

        // 下方向 (唇・顎)
        currX = startX;
        for (let y = startY + 2; y < height * 0.95; y += 2) {
            const nextX = this._findLocalMaxGradient(currX, y, width, imageData);
            if (nextX === -1) break;
            if (Math.abs(nextX - currX) > 30) break;
            profile.push({ x: nextX, y: y });
            currX = nextX;
        }
        return profile;
    },

    _findLocalMaxGradient(prevX, y, width, imageData) {
        let maxGrad = -1;
        let bestX = -1;
        const range = 25; // 前段のエ位置から左右25pxを探索範囲に

        for (let x = prevX - range; x <= prevX + range; x++) {
            if (x < 0 || x >= width - 2) continue;
            const idx1 = (y * width + x) * 4;
            const idx2 = (y * width + (x + 1)) * 4;
            const diff = Math.abs(imageData[idx1] - imageData[idx2]) + 
                         Math.abs(imageData[idx1+1] - imageData[idx2+1]) + 
                         Math.abs(imageData[idx1+2] - imageData[idx2+2]);
            
            if (diff > maxGrad) {
                maxGrad = diff;
                bestX = x;
            }
        }
        return maxGrad > 15 ? bestX : -1;
    },

    /**
     * データのスムージング
     */
    _smoothProfile(profile) {
        const result = [];
        const windowSize = 3;
        for (let i = 0; i < profile.length; i++) {
            let sumX = 0, count = 0;
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (profile[j]) { sumX += profile[j].x; count++; }
            }
            result.push({ x: sumX / count, y: profile[i].y });
        }
        return result;
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
            // 解析: 右向き(Nose=MaxX)
            const prnIdx = this._findExtremeIndex(profile, true, 'x');
            const prn = profile[prnIdx];

            const gRange = profile.slice(0, prnIdx);
            const gIdx = this._findExtremeIndex(gRange, false, 'x');
            const g = gRange[gIdx] || profile[0];

            const snSearchRange = profile.slice(prnIdx + 2);
            const snSubRange = snSearchRange.slice(0, Math.floor(profile.length * 0.25));
            const snIdx = this._findExtremeIndex(snSubRange, false, 'x');
            const sn = snSubRange[snIdx];

            const lsSearchRange = profile.slice(profile.indexOf(sn) + 1);
            const lsSubRange = lsSearchRange.slice(0, Math.floor(profile.length * 0.15));
            const lsIdx = this._findExtremeIndex(lsSubRange, true, 'x');
            const ls = lsSubRange[lsIdx];

            const liSearchRange = profile.slice(profile.indexOf(ls) + 5);
            const liSubRange = liSearchRange.slice(0, Math.floor(profile.length * 0.22));
            const liIdx = this._findExtremeIndex(liSubRange, true, 'x');
            const li = liSubRange[liIdx];

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
