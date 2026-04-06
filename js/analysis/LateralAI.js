window.LateralAI = {
    /**
     * FaceMeshのランドマークをベースにした自動側貌解析
     * @param {Array} landmarks - MediaPipe FaceLandmarkerの468点
     */
    detectFromLandmarks(landmarks, width, height, imageData) {
        if (!landmarks || landmarks.length === 0) return null;

        // --- 1. インデックスの定義 ---
        // 8: Glabella(眉間), 4: Pronasale(鼻先), 164: Subnasale(鼻下), 
        // 0: Upper Lip(上唇), 17: Lower Lip(下唇), 199: Pogonion(オトガイ前点), 152: Menton(オトガイ最下点)
        const indices = {
            g: 8, prn: 4, sn: 164, ls: 0, li: 17, pg: 199
        };

        const pts = {};
        for (const [key, idx] of Object.entries(indices)) {
            const lm = landmarks[idx];
            if (!lm) continue;

            // 2D画像座標に変換
            let rx = lm.x * width;
            let ry = lm.y * height;

            // 輪郭（右端）へ吸着させる
            pts[key] = this._snapToRightEdge(rx, ry, width, height, imageData);
        }

        // コルメラ(Col)は鼻先と鼻下の間
        pts.col = { 
            x: (pts.prn.x + pts.sn.x) / 2, 
            y: (pts.prn.y + pts.sn.y) / 2 
        };

        // 簡易的なプロファイルラインの生成 (特徴点を繋ぐ)
        pts.profileLine = this._generateProfileLine(pts);

        return pts;
    },

    /**
     * AIの推定位置から右側へ最大30px走査し、最もコントラストが強い地点（輪郭）に吸着
     */
    _snapToRightEdge(startX, y, width, height, imageData) {
        let maxGrad = -1;
        let edgeX = startX;
        const searchRange = 50; // 最大50px右側を探す
        const ry = Math.floor(y);

        for (let x = Math.floor(startX - 10); x < Math.min(width - 2, startX + searchRange); x++) {
            const idx1 = (ry * width + x) * 4;
            const idx2 = (ry * width + (x + 1)) * 4;
            
            // 明度差（簡易勾配）を計算
            const diff = Math.abs(imageData[idx1] - imageData[idx2]) + 
                         Math.abs(imageData[idx1+1] - imageData[idx2+1]) + 
                         Math.abs(imageData[idx1+2] - imageData[idx2+2]);
            
            if (diff > maxGrad) {
                maxGrad = diff;
                edgeX = x;
            }
        }
        
        // グラディエントが弱すぎる場合はAIの推定値をそのまま使う
        return maxGrad > 15 ? { x: edgeX, y: y } : { x: startX, y: y };
    },

    /**
     * 特徴点間を補完して滑らかな輪郭線を生成 (描画用)
     */
    _generateProfileLine(pts) {
        const order = ['g', 'prn', 'col', 'sn', 'ls', 'li', 'pg'];
        const line = [];
        for (let i = 0; i < order.length - 1; i++) {
            const p1 = pts[order[i]];
            const p2 = pts[order[i+1]];
            if (!p1 || !p2) continue;
            
            // 直線補完 (簡易版)
            const segments = 10;
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                line.push({
                    x: p1.x * (1 - t) + p2.x * t,
                    y: p1.y * (1 - t) + p2.y * t
                });
            }
        }
        return line;
    }
};
