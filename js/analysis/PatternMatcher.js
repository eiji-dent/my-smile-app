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
     * Extracts features from Lateral landmarks (Silhouette scanner).
     * @param {Object} lms - Landmarks (prn, sn, ls, li, pg, g)
     * @returns {Object} Feature vector
     */
    extractLateralFeatures(lms, canvas = null) {
        if (!lms || !lms.prn || !lms.sn || !lms.pg || !lms.g) return null;

        const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        const angle = (p1, p2, p3) => {
            const a = dist(p2, p3);
            const b = dist(p1, p3);
            const c = dist(p1, p2);
            // Law of Cosines
            const cosVal = (a*a + c*c - b*b) / (2 * a * c);
            const alpha = Math.acos(Math.max(-1, Math.min(1, cosVal))) * (180 / Math.PI);
            return alpha;
        };

        const features = {
            convexityAngle: angle(lms.g, lms.sn, lms.pg),
            nasalProjection: dist(lms.sn, lms.prn) / dist(lms.sn, lms.pg),
            lipRatio: dist(lms.sn, lms.ls) / dist(lms.ls, lms.pg),
            profileVersion: "p1"
        };

        if (canvas) {
            features.visualHash = this.calculateVisualHash(canvas);
        }

        return features;
    },

    /**
     * Extracts features from Dental landmarks (Unit 8).
     * @param {Object} lines - The lines object from AnalysisCard
     * @param {HTMLCanvasElement} canvas - Optional canvas to extract visual features
     * @returns {Object} Feature vector
     */
    extractDentalFeatures(lines, canvas = null) {
        const features = { type: 'dental_incisor' };

        // 1. Geometric Features (If plots exist)
        const wl = lines.wlRatio;
        if (wl && wl.length >= 2) {
            const width = Math.abs(wl[3] ? wl[3].x - wl[2].x : 100);
            const height = Math.abs(wl[1].y - wl[0].y);
            features.whRatio = width / height;
        }

        // 2. Visual Features (Perceptual Hash)
        if (canvas) {
            features.visualHash = this.calculateVisualHash(canvas);
        }

        // 2. Visual Features (Perceptual Hash)
        if (canvas) {
            features.visualHash = this.calculateVisualHash(canvas);
        }

        return features;
    },

    /**
     * Calculates a 64-bit Average Hash (aHash) for image identification.
     * @param {HTMLCanvasElement|HTMLImageElement} source
     */
    calculateVisualHash(source) {
        try {
            const size = 8;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // Step 1 & 2: Resize and Grayscale (Simplified by drawing to 8x8)
            ctx.drawImage(source, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            
            const gray = [];
            let sum = 0;
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                gray.push(avg);
                sum += avg;
            }
            
            // Step 3: Calculate Mean
            const mean = sum / (size * size);
            
            // Step 4: Build bitstring (Hash)
            let hash = "";
            for (let i = 0; i < gray.length; i++) {
                hash += gray[i] >= mean ? "1" : "0";
            }
            
            return hash; // 64-bit binary string
        } catch (e) {
            console.warn("Visual Hash Calculation Failed:", e);
            return null;
        }
    },

    /**
     * Calculates Euclidean distance between two feature vectors.
     * Lower is more similar.
     */
    compare(f1, f2) {
        if (!f1 || !f2) return Infinity;
        let score = 0;
        
        // 1. Visual Match (Hamming Distance for bitstrings)
        if (f1.visualHash && f2.visualHash) {
            let diff = 0;
            const h1 = f1.visualHash; const h2 = f2.visualHash;
            for (let i = 0; i < h1.length; i++) {
                if (h1[i] !== h2[i]) diff++;
            }
            // Hamming distance normalized (0 to 1). 
            // We give it a high weight (10x) because a visual match is very strong.
            const hamming = diff / h1.length;
            score += hamming * 10; 
        } else if (f1.visualHash || f2.visualHash) {
            // Cannot visually match them. Heavy penalty to avoid false positive matches.
            score += 10.0;
        }

        // 2. Geometric Match (Euclidean distance for numbers)
        const keys = Object.keys(f1).filter(k => typeof f1[k] === 'number');
        let geoSum = 0;
        let geoCount = 0;
        keys.forEach(k => {
            if (typeof f2[k] === 'number') {
                geoSum += Math.pow(f1[k] - f2[k], 2);
                geoCount++;
            }
        });
        
        if (geoCount > 0) {
            score += Math.sqrt(geoSum);
        } else if (!(f1.visualHash && f2.visualHash)) {
            // Cannot match on visual (one or both missing) AND cannot match geometrically.
            // DO NOT FALSE MATCH.
            return Infinity;
        }

        return score;
    }
};
