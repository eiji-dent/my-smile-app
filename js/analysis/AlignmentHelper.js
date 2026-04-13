/**
 * AlignmentHelper
 * 
 * 診断フェーズ間での画像アライメント（傾き同期）を補助するユーティリティクラス。
 */
const AlignmentHelper = {
    /**
     * Phase 3の基準角（瞳孔間線に対する歯列正中の角度差）を計算し、
     * Phase 8の新しい画像回転角を算出します。
     * 
     * @param {Object} p3Pupil - Phase 3の瞳孔間線 {startX, startY, endX, endY}
     * @param {Object} p3Dental - Phase 3の歯列正中 {startX, startY, endX, endY}
     * @param {Array} p8Points - Phase 8でプロットした歯列正中 [{x,y}, {x,y}]
     * @returns {number} 計算された新 imgRotation (ラジアン)
     */
    calculateRotationFromP3(p3Pupil, p3Dental, p8Points) {
        if (!p3Pupil || !p3Dental || !p8Points || p8Points.length < 2) {
            console.error("AlignmentHelper: Insufficient data for calculation");
            return 0;
        }

        // --- 正規化関数 ---
        // ベクトルの向きを一定に揃える (プロット順序に依存しないようにする)
        const normalizeLine = (line, type) => {
            let dx = line.endX - line.startX;
            let dy = line.endY - line.startY;
            if (type === 'horizontal') {
                // 常に左から右へ (dX > 0)
                if (dx < 0) return { startX: line.endX, startY: line.endY, endX: line.startX, endY: line.startY };
            } else {
                // 常に上から下へ (dY > 0)
                if (dy < 0) return { startX: line.endX, startY: line.endY, endX: line.startX, endY: line.startY };
            }
            return line;
        };

        const nP3Pupil = normalizeLine(p3Pupil, 'horizontal');
        const nP3Dental = normalizeLine(p3Dental, 'vertical');

        // 1. Phase 3 での相対角を計算 (ラジアン)
        const p3PupilAng = Math.atan2(nP3Pupil.endY - nP3Pupil.startY, nP3Pupil.endX - nP3Pupil.startX);
        const p3DentalAng = Math.atan2(nP3Dental.endY - nP3Dental.startY, nP3Dental.endX - nP3Dental.startX);
        const relativeAng = p3DentalAng - p3PupilAng;

        // 2. Phase 8 での現在のプロット角を計算 (正規化して向きを揃える)
        const p8LineRaw = { startX: p8Points[0].x, startY: p8Points[0].y, endX: p8Points[1].x, endY: p8Points[1].y };
        const nP8Dental = normalizeLine(p8LineRaw, 'vertical');

        const p8DentalAng = Math.atan2(nP8Dental.endY - nP8Dental.startY, nP8Dental.endX - nP8Dental.startX);

        // 3. 画像回転角を算出
        let newRotation = relativeAng - p8DentalAng;

        // 角度の正規化 (-PI to PI)
        while (newRotation > Math.PI) newRotation -= Math.PI * 2;
        while (newRotation < -Math.PI) newRotation += Math.PI * 2;

        return newRotation;
    }
};

window.AlignmentHelper = AlignmentHelper;
