window.LateralAI = {
    /**
     * 1クリック誘導式・コントラスト追跡解析
     */
    detectFromSeed(seedX, seedY, width, height, imageData, aiMask) {
        const bgSample = this._getBackgroundColor(imageData, width, height);

        // 1. 最もコントラストが強い「真のエッジ」を特定 (クリック点から右へ走査)
        const noseEdgeX = this._findMaxGradientEdge(seedX, seedY, width, imageData);
        if (noseEdgeX === -1) return null;

        // 2. エッジフォロワー（輪郭追跡）
        let profile = this._traceProfileByContrast(noseEdgeX, seedY, width, height, imageData, bgSample);
        if (profile.length < 40) return null;

        // 3. データの平滑化 (ノイズ除去)
        profile = this._smoothProfile(profile);

        // 4. 特徴点の検出
        return this._extractLandmarksFromProfile(profile);
    },

    /**
     * クリック点から右へ向かって、色が最も大きく変化した地点（勾配最大値）を探す
     */
    _findMaxGradientEdge(startX, y, width, imageData) {
        let maxGrad = -1;
        let edgeX = -1;
        const searchRange = 100; // クリック点から右に100pxまで探索

        for (let x = startX; x < Math.min(width - 2, startX + searchRange); x++) {
            const idx1 = (y * width + x) * 4;
            const idx2 = (y * width + (x + 1)) * 4;
            
            // 隣接ピクセル間の色距離（グラディエント）を計算
            const diff = Math.abs(imageData[idx1] - imageData[idx2]) + 
                         Math.abs(imageData[idx1+1] - imageData[idx2+1]) + 
                         Math.abs(imageData[idx1+2] - imageData[idx2+2]);
            
            if (diff > maxGrad) {
                maxGrad = diff;
                edgeX = x;
            }
        }
        // あまりに変化が小さい（背景にクリックしている等）場合は失敗
        return maxGrad > 20 ? edgeX : -1;
    },

    /**
     * コントラストの変化を垂直に追跡するエッジフォロワー
     */
    _traceProfileByContrast(startX, startY, width, height, imageData, bgSample) {
        const profile = [{ x: startX, y: startY }];
        
        // 上方向 (眉間)
        let currX = startX;
        for (let y = startY - 2; y > height * 0.1; y -= 2) {
            const nextX = this._findLocalMaxGradient(currX, y, width, imageData);
            if (nextX === -1) break;
            // 極端な横飛びを防止 (25px以上のジャンプは無視)
            if (Math.abs(nextX - currX) > 25) break; 
            profile.unshift({ x: nextX, y: y });
            currX = nextX;
        }

        // 下方向 (唇・顎)
        currX = startX;
        for (let y = startY + 2; y < height * 0.95; y += 2) {
            const nextX = this._findLocalMaxGradient(currX, y, width, imageData);
            if (nextX === -1) break;
            if (Math.abs(nextX - currX) > 25) break;
            profile.push({ x: nextX, y: y });
            currX = nextX;
        }
        return profile;
    },

    _findLocalMaxGradient(prevX, y, width, imageData) {
        let maxGrad = -1;
        let bestX = -1;
        const range = 20; // 前の位置の前後20pxを探索

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
     * 移動平均による輪郭線のスムージング
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
