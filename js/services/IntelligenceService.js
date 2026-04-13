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
            // Remove orderBy to avoid Firebase Composite Index requirement
            const snapshot = await window.db.collection('analyses')
                .where('phase', '==', phase)
                .limit(100)
                .get();

            if (snapshot.empty) return null;

            // Sort locally in JS by timestamp (descending)
            const docs = snapshot.docs.sort((a, b) => {
                const ta = a.data().timestamp?.seconds || 0;
                const tb = b.data().timestamp?.seconds || 0;
                return tb - ta; // Descending
            });

            let bestMatch = null;
            let minScore = Infinity;
            let matchCount = 0;

            for (const doc of docs) {
                const record = doc.data();
                if (!record.results?.landmarks) continue;
                matchCount++;

                let historicalFeatures = record.features || {};

                const score = window.PatternMatcher.compare(currentFeatures, historicalFeatures);
                if (score < minScore) {
                    minScore = score;
                    bestMatch = record.results;
                }
            }

            // Threshold: Relaxed to 4.0. Hamming distance scale is 0-10.
            // 4.0 allows for significant but not total bit difference.
            if (minScore < 4.0) {
                console.log(`[AI Match] Success! Score: ${minScore.toFixed(4)} (Threshold: 4.0)`);
                return bestMatch;
            } else {
                console.log(`[AI Match] No match found. Best score: ${minScore.toFixed(4)}, Candidates: ${matchCount}`);
            }

            return null;
        } catch (error) {
            console.error("Intelligence Search Error:", error);
            return null;
        }
    },

    /**
     * Fetches the total analysis count for all phases from Firestore.
     * Includes extra logging for debugging.
     */
    async getPhaseCounts() {
        if (!window.db) {
            console.warn("[AI Stats] Database not initialized yet.");
            return {};
        }
        try {
            console.log("[AI Stats] Querying Firestore for analysis counts...");
            // Use a timeout to prevent hanging on slow connections
            const fetchPromise = window.db.collection('analyses').limit(1500).get();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
            
            const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
            const counts = {};
            
            snapshot.forEach(doc => {
                const data = doc.data();
                let phase = data.phase ? data.phase.toLowerCase() : null;
                
                // Normalization: Map old or slightly different names to current canonical names
                if (phase === 'intraoral-analysis' || phase === 'dental' || phase === 'intraoral') phase = 'intraoral';
                if (phase === 'e-midline' || phase === 'emidline') phase = 'e-midline';
                
                if (phase) counts[phase] = (counts[phase] || 0) + 1;
            });
            
            console.log("[AI Stats] Current counts fetched:", counts);
            return counts;
        } catch (e) {
            console.error("[AI Stats] Stats Fetch Error:", e);
            throw e; // Let app.js handle the retry
        }
    },

    /**
     * Retroactively calculates visual hashes for historical data that lacks them.
     * This "teaches" the AI about images sent before the fingerprinting update.
     * Processes the 40 most recent records to stay within performance limits.
     */
    async syncHistoricalHashes() {
        if (!window.db || !window.PatternMatcher) return 0;
        console.log("Starting historical AI analysis data sync...");
        
        try {
            const snapshot = await window.db.collection('analyses')
                .limit(100)
                .get();
                
            const docs = snapshot.docs.sort((a, b) => {
                const ta = a.data().timestamp?.seconds || 0;
                const tb = b.data().timestamp?.seconds || 0;
                return tb - ta;
            });
                
            let syncCount = 0;
            // Process sequentially to avoid overwhelming the browser/CORS
            for (const doc of docs) {
                const data = doc.data();
                const features = data.features || {};
                
                if (data.imageUrl && !features.visualHash) {
                    try {
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.src = data.imageUrl;
                        
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = () => reject(new Error("Load Fail"));
                            setTimeout(() => reject(new Error("Timeout")), 8000);
                        });
                        
                        const hash = window.PatternMatcher.calculateVisualHash(img);
                        if (hash) {
                            const updatedFeatures = { ...features, visualHash: hash };
                            await doc.ref.update({ features: updatedFeatures });
                            syncCount++;
                            console.log(`AI Learned from historical image: ${doc.id}`);
                        }
                    } catch (e) {
                        console.warn(`Skipping historical sync for ${doc.id}:`, e.message);
                    }
                }
            }
            
            if (syncCount > 0) console.log(`Historical AI sync complete. Learned ${syncCount} new image patterns.`);
            return syncCount;
        } catch (error) {
            console.error("Historical Sync Error:", error);
            return 0;
        }
    },

    /**
     * Helper to prepare data for "Learning" by including features in the save.
     */
    async saveWithIntelligence(phase, data, imageDataURL) {
        return await window.FirebaseService.uploadAnalysis(phase, data, imageDataURL);
    }
};
