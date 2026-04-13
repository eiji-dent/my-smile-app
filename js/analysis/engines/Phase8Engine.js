/**
 * Phase8Engine.js - Intraoral Analysis (Dental)
 * Specialized for teeth proportions (Golden Percentage, WL Ratio).
 * Primarily uses Learning AI because standard face landmarker is not applicable.
 */
window.Phase8Engine = {
    async analyze(card, canvas) {
        console.log("Phase 8 Engine: Running Intraoral Analysis...");
        
        // 1. Feature extraction from dental image (using base image for invariant hashing)
        const features = window.PatternMatcher.extractDentalFeatures(card.lines, card.currentImage);
        
        // 2. Search for similar case in Cloud (Learning AI)
        const learnedData = await window.IntelligenceService.findSimilarCase(card.phase, features);
        
        // 3. Show Debug Visualizer
        if (card.showAiDebugInfoAsync) {
            // Check Intelligence service last score if we can, or just show features.
            // (We could fetch the score returned, but for now we'll just show the generated features)
            card.showAiDebugInfoAsync(features, learnedData ? "Matched" : "No Match", learnedData ? "Found" : null);
        }

        if (learnedData && learnedData.landmarks) {
            console.log("Applying learned dental templates from Cloud.");
            if (learnedData.landmarks.wlRatio) card.lines.wlRatio = learnedData.landmarks.wlRatio;
            if (learnedData.landmarks.redProp) card.lines.redProp = learnedData.landmarks.redProp;
            if (learnedData.landmarks.axialIncl) card.lines.axialIncl = learnedData.landmarks.axialIncl;
            return { success: true, message: "過去の類似症例に基づいたプロットを復元しました。" };
        } else {
            // Placeholder/Initial guidance to user
            return { 
                success: false, 
                message: "クラウドに学習データが見つかりませんでした。手動でプロットを行うと、AIが次回の参考にします。" 
            };
        }
    }
};
