/**
 * PatternMatcher.js
 * Analyzes facial and dental landmarks to extract geometric feature vectors.
 * These vectors are used to find "similar" historical cases in the Cloud.
 */

window.PatternMatcher = {
    /**
     * Extracts features from FaceLandmarker results.
     * @param {Object} landmarks - Array of normalized landmarks from MediaPipe
     * @returns {Object} Feature vector (normalized ratios)
     */
    extractFacialFeatures(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;

        // Key indices in MediaPipe Face Mesh:
        // Left Eye Inner: 133, Right Eye Inner: 362
        // Nose Tip: 1, Mouth Center: 13
        // Chin Bottom: 152, Forehead Top: 10
        // Face Left: 234, Face Right: 454
        
        const getPt = (idx) => landmarks[idx];
        const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

        const faceWidth = dist(getPt(234), getPt(454));
        const faceHeight = dist(getPt(10), getPt(152));
        const eyeDist = dist(getPt(133), getPt(362));
        const noseToMouth = dist(getPt(1), getPt(13));
        const mouthWidth = dist(getPt(61), getPt(291));

        return {
            whRatio: faceWidth / faceHeight,
            eyeRatio: eyeDist / faceWidth,
            midRatio: noseToMouth / faceHeight,
            mouthRatio: mouthWidth / faceWidth,
            version: "v1"
        };
    },

    /**
     * Extracts features from Dental landmarks (Unit 8).
     * @param {Object} lines - The lines object from AnalysisCard
     * @returns {Object} Feature vector
     */
    extractDentalFeatures(lines) {
        // Find wlRatio (width/length ratio) if coordinates exist
        const wl = lines.wlRatio;
        if (!wl || wl.length < 2) return { type: 'unknown_dental' };

        // We can capture the basic geometric distribution of the 8 teeth markers
        const width = Math.abs(wl[3].x - wl[2].x);
        const height = Math.abs(wl[1].y - wl[0].y);

        return {
            whRatio: width / height,
            type: 'dental_incisor'
        };
    },

    /**
     * Calculates Euclidean distance between two feature vectors.
     * Lower is more similar.
     */
    compare(f1, f2) {
        if (!f1 || !f2) return Infinity;
        let sum = 0;
        const keys = Object.keys(f1).filter(k => typeof f1[k] === 'number');
        keys.forEach(k => {
            if (f2[k] !== undefined) {
                sum += Math.pow(f1[k] - f2[k], 2);
            }
        });
        return Math.sqrt(sum);
    }
};
