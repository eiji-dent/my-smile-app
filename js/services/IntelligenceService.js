/**
 * IntelligenceService.js
 * Manages the "Memory" of the AI by retrieving similar historical plots from Firestore.
 */

window.IntelligenceService = {
    /**
     * Finds the most similar historical case for a given phase and feature vector.
     * @param {string} phase - e.g., 'lateral', 'e-sound'
     * @param {Object} currentFeatures - Feature vector from PatternMatcher
     * @returns {Promise<Object|null>} The best matching analysis data
     */
    async findSimilarCase(phase, currentFeatures) {
        if (!currentFeatures || !window.db) return null;

        try {
            console.log(`Searching for similar cases in phase: ${phase}...`);
            // 1. Fetch recent successful analyses for this phase
            const snapshot = await window.db.collection('analyses')
                .where('phase', '==', phase)
                .orderBy('timestamp', 'desc')
                .limit(40)
                .get();

            if (snapshot.empty) {
                console.log("No historical data found for this phase.");
                return null;
            }

            let bestMatch = null;
            let minScore = Infinity;

            snapshot.forEach(doc => {
                const record = doc.data();
                // We need historical features. If they don't exist in the record, 
                // we try to extract them from the results (landmarks).
                const historicalLandmarks = record.results?.landmarks;
                if (!historicalLandmarks) return;

                let historicalFeatures = record.features;
                if (!historicalFeatures) {
                    // Fallback: extract features from landmarks if possible
                    if (phase === 'lateral' || phase.includes('frontal')) {
                        // Extract from FaceLandmarker format if compatible
                        // (This is a simplified assumption for the hybrid logic)
                    }
                }

                if (historicalFeatures) {
                    const score = window.PatternMatcher.compare(currentFeatures, historicalFeatures);
                    if (score < minScore) {
                        minScore = score;
                        bestMatch = record.results;
                    }
                }
            });

            // If a match is reasonably close, return it
            // (Threshold needs tuning, using 0.5 as a loose placeholder)
            if (minScore < 0.5) {
                console.log(`Found a similar case! Similarity score: ${minScore.toFixed(4)}`);
                return bestMatch;
            }

            return null;
        } catch (error) {
            console.error("Intelligence Search Error:", error);
            return null;
        }
    },

    /**
     * Helper to prepare data for "Learning" by including features in the save.
     */
    async saveWithIntelligence(phase, data, imageDataURL) {
        // This will be called by AnalysisCard.sendAnalysisData
        // It should extract features BEFORE sending to FirebaseService
        let features = null;
        if (data.landmarks) {
            // Logic to extract features based on phase types
            // For now, we'll implement a robust extraction in the Card or Engine
        }
        return await window.FirebaseService.uploadAnalysis(phase, data, imageDataURL);
    }
};
