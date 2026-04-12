/**
 * Phase3Engine.js - E-Midline (Hybrid Analysis)
 * Combines FaceLandmarker for facial lines with Learning AI for dental midline.
 */

window.Phase3Engine = {
    async analyze(card, canvas) {
        console.log("Phase 3 Engine: Running Hybrid Analysis...");
        
        // 1. Face AI for interpupillary and facial midline
        const landmarker = await window.initFaceLandmarker();
        const result = landmarker.detect(canvas);
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            
            // Extract features for the Learning AI
            const features = window.PatternMatcher.extractFacialFeatures(landmarks);
            
            // Search for similar case in Cloud (Learning AI)
            const learnedData = await window.IntelligenceService.findSimilarCase(card.phase, features);
            
            // Apply Facial Lines from Face AI
            this.applyFacialLines(card, landmarks);
            
            // Apply Dental Midline from Learning AI or Heuristics
            if (learnedData && learnedData.landmarks?.['d-midline']) {
                console.log("Applying learned dental midline from similar case.");
                card.lines['d-midline'] = learnedData.landmarks['d-midline'];
            } else {
                // Fallback to existing heuristic for dental midline
                this.applyHeuristicDentalMidline(card, landmarks);
            }
            
            return { success: true, message: "顔貌基準線と症例学習に基づいた解析が完了しました。" };
        } else {
            return { success: false, message: "顔の特徴を検出できませんでした。" };
        }
    },

    applyFacialLines(card, landmarks) {
        // Interpupillary Line (Indices 33, 263 are eye corners)
        const p1 = landmarks[33];
        const p2 = landmarks[263];
        card.lines['interpupillary-e'] = {
            startX: p1.x * card.currentImage.width,
            startY: p1.y * card.currentImage.height,
            endX: p2.x * card.currentImage.width,
            endY: p2.y * card.currentImage.height
        };

        // Facial Midline (Indices 10 and 152 are forehead/chin)
        const f1 = landmarks[10];
        const f2 = landmarks[152];
        card.lines['f-midline'] = {
            startX: f1.x * card.currentImage.width,
            startY: f1.y * card.currentImage.height,
            endX: f2.x * card.currentImage.width,
            endY: f2.y * card.currentImage.height
        };
    },

    applyHeuristicDentalMidline(card, landmarks) {
        // Simple heuristic: around the lips (Indices 13, 14)
        const mouthTop = landmarks[13];
        const mouthBottom = landmarks[14];
        card.lines['d-midline'] = {
            startX: mouthTop.x * card.currentImage.width,
            startY: mouthTop.y * card.currentImage.height - 20,
            endX: mouthBottom.x * card.currentImage.width,
            endY: mouthBottom.y * card.currentImage.height + 20
        };
    }
};
