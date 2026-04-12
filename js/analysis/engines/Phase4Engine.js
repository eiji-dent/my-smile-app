/**
 * Phase4Engine.js - E-sound / Smile Analysis
 * Specialized for smile arc and incisal exposure.
 */

window.Phase4Engine = {
    async analyze(card, canvas) {
        console.log("Phase 4 Engine: Running Smile Analysis...");
        
        const landmarker = await window.initFaceLandmarker();
        const result = landmarker.detect(canvas);
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            const features = window.PatternMatcher.extractFacialFeatures(landmarks);
            const learnedData = await window.IntelligenceService.findSimilarCase(card.phase, features);
            
            if (learnedData && learnedData.landmarks) {
                console.log("Applying learned smile templates.");
                if (learnedData.landmarks.smileArc) card.lines.smileArc = learnedData.landmarks.smileArc;
                if (learnedData.landmarks.corridor) card.lines.corridor = learnedData.landmarks.corridor;
                if (learnedData.landmarks.gingival) card.lines.gingival = learnedData.landmarks.gingival;
            } else {
                // Heuristic mapping for smile components if no learned data
                this.applyHeuristicSmile(card, landmarks);
            }
            
            return { success: true, message: "スマイルと口唇状態の解析が完了しました。" };
        }
        return { success: false, message: "解析に失敗しました。" };
    },

    applyHeuristicSmile(card, landmarks) {
        const w = card.currentImage.width;
        const h = card.currentImage.height;
        
        // Smile Arc (approx from lip indices 61, 291, 13, 14, etc.)
        const leftM = landmarks[61];
        const rightM = landmarks[291];
        const topM = landmarks[13];
        const botM = landmarks[14];
        
        // This is a simplified fallback
        card.lines.smileArc = [
            {x: leftM.x * w, y: leftM.y * h},
            {x: topM.x * w, y: topM.y * h},
            {x: rightM.x * w, y: rightM.y * h},
            {x: leftM.x * w, y: (botM.y + 0.05) * h},
            {x: botM.x * w, y: (botM.y + 0.1) * h},
            {x: rightM.x * w, y: (botM.y + 0.05) * h}
        ];
    }
};
