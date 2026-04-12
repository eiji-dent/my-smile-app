/**
 * Phase5Engine.js - S-sound (Speaking Space) 
 * Specialized for vertical clearance during phonation.
 */
window.Phase5Engine = {
    async analyze(card, canvas) {
        const landmarker = await window.initFaceLandmarker();
        const result = landmarker.detect(canvas);
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            const w = card.currentImage.width, h = card.currentImage.height;
            // S-measure (Indices 13, 14 for upper/lower inner lip)
            card.lines.smeasure = {
                startX: landmarks[13].x * w, startY: landmarks[13].y * h,
                endX: landmarks[14].x * w, endY: landmarks[14].y * h
            };
            return { success: true, message: "S音位（スピーキングスペース）の解析が完了しました。" };
        }
        return { success: false, message: "解析に失敗しました。" };
    }
};
