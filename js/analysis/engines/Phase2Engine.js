/**
 * Phase2Engine.js - Lateral Analysis (Silhouette Scanning)
 * Specialized AI for profile view.
 */

window.Phase2Engine = {
    async analyze(card, canvas) {
        console.log("Phase 2 Engine: Running Lateral Analysis (Search-Only Memory mode)...");
        
        // 1. Calculate image fingerprint (visual hash)
        // Use card.currentImage if available for maximum consistency with previous uploads
        const hash = window.PatternMatcher.calculateVisualHash(card.currentImage || canvas);
        if (!hash) throw new Error("画像ハッシュの解析に失敗しました。");

        const features = {
            visualHash: hash,
            type: 'lateral_profile' // Identifier for clinical profile matching
        };

        // 2. Search Cloud for existing human-corrected analysis (Learning AI)
        const learnedData = await window.IntelligenceService.findSimilarCase(card.phase, features);
        
        if (learnedData && learnedData.landmarks) {
            console.log("Phase 2 Engine: Found matched historical landmarks in Cloud.");
            
            // Restore historical landmark arrays
            const lm = learnedData.landmarks;
            if (lm.eLine) card.lines.eLine = lm.eLine;
            if (lm.nla) card.lines.nla = lm.nla;
            if (lm.convexity) card.lines.convexity = lm.convexity;
            if (lm.mmeasure) card.lines.mmeasure = lm.mmeasure;
            
            return { 
                success: true, 
                message: "クラウド上の過去データから最適なプロットを復元しました。",
                landmarks: learnedData.landmarks,
                isLearned: true
            };
        } else {
            console.log("Phase 2 Engine: No learning data found in Cloud for this fingerprint.");
            
            // Like Phase 8, we do not run automated detection if it's inaccurate.
            // We wait for the user to plot once to "teach" the AI.
            return { 
                success: false, 
                message: "クラウドに学習データが見つかりませんでした。手動プロットを一度行い「送信」して学習させてください。" 
            };
        }
    }
};
