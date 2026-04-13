    async debugDatabase(phase) {
        if (!window.db) return "DB Not Connected";
        try {
            const snap = await window.db.collection('analyses').where('phase', '==', phase).orderBy('timestamp', 'desc').limit(5).get();
            let out = [];
            snap.forEach(doc => {
                const d = doc.data();
                out.push({
                    id: doc.id,
                    hasFeatures: !!d.features,
                    hash: d.features ? d.features.visualHash : null,
                    hasLandmarks: !!d.results?.landmarks,
                    numLandmarks: d.results?.landmarks ? Object.keys(d.results.landmarks).length : 0,
                    time: d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : 'N/A'
                });
            });
            return out;
        } catch(e) { return e.toString(); }
    }
