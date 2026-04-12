/**
 * FirebaseService.js
 * Handles Cloud Firestore and Firebase Storage integration for dentistry analysis data.
 * Uses the compat version of Firebase SDK for easier integration with existing scripts.
 */

const firebaseConfig = {
  apiKey: "AIzaSyBakjqqWCPn6xCO2craPVoBhNelgT70zEg",
  authDomain: "reprosmile.firebaseapp.com",
  projectId: "reprosmile",
  storageBucket: "reprosmile.firebasestorage.app",
  messagingSenderId: "20505235350",
  appId: "1:20505235350:web:5ed897abb6161fab4ed7b7",
  measurementId: "G-2CSQ1XLNSW"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const storage = firebase.storage();
window.db = db;
window.storage = storage;

class FirebaseService {
    /**
     * Uploads anonymized analysis data and the associated image to Firebase.
     * @param {string} phase - e.g., 'frontal', 'lateral'
     * @param {Object} data - Analysis results JSON
     * @param {string} imageDataURL - Base64 image data
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<Object>} - The uploaded document reference
     */
    static async uploadAnalysis(phase, data, imageDataURL, onProgress = () => {}) {
        const timestamp = new Date().getTime();
        // Generate a random ID for the storage folder if one doesn't exist for this session
        if (!window._currentCaseAnonymousId) {
            window._currentCaseAnonymousId = 'case_' + Math.random().toString(36).substring(2, 15);
        }
        const anonymousId = window._currentCaseAnonymousId;
        
        try {
            // 1. Upload Image to Firebase Storage (Anonymized path)
            onProgress("画像をクラウドへアップロード中 (匿名化済)...");
            const fileName = `analyses/${anonymousId}/${phase}_${timestamp}.jpg`;
            const storageRef = storage.ref().child(fileName);
            
            // Convert Base64 to Blob
            const blob = await fetch(imageDataURL).then(res => res.blob());
            const uploadTask = storageRef.put(blob);
            
            // Wait for upload
            const snapshot = await uploadTask;
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // 2. Save Metadata to Cloud Firestore (Anonymized + Intel)
            onProgress("解析データを同期中 (匿名化済)...");
            const analysisRecord = {
                phase,
                caseId: anonymousId, // Non-identifying unique ID
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                results: data,
                features: data.features || null, // Capture learning features
                imageUrl: downloadURL,
                imagePath: fileName,
                platform: "web-v1-anonymous-intel"
            };
            
            const docRef = await db.collection('analyses').add(analysisRecord);
            console.log("Anonymous cloud sync successful:", docRef.id);
            
            return {
                id: docRef.id,
                url: downloadURL,
                caseId: anonymousId
            };
        } catch (error) {
            console.error("Firebase Anonymization Error:", error);
            throw error;
        }
    }
}

// Expose to window
window.FirebaseService = FirebaseService;
