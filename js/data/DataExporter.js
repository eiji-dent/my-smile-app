/**
 * DataExporter.js
 * Manages the collection and export of analysis data for machine learning teacher data.
 */
class DataExporter {
    constructor() {
        this.loadingOverlay = document.getElementById('pdf-loading-overlay'); 
        this.progressStep = document.getElementById('pdf-progress-step');
    }

    init() {
        // No longer initializes standalone button listeners
    }

    /**
     * Batch uploads all relevant analysis data to Firebase Cloud.
     */
    async syncAllToCloud() {
        if (!window.appCards || window.appCards.length === 0) {
            alert('診断データが見つかりません。');
            return;
        }

        const cardsToSync = window.appCards.filter(c => c.currentImage !== null);
        if (cardsToSync.length === 0) {
            alert('画像が読み込まれているフェーズがありません。画像を読み込んでから送信してください。');
            return;
        }

        try {
            this.showLoading(true, '全データのクラウド同期を開始します...');
            
            let successCount = 0;
            const total = cardsToSync.length;

            for (let i = 0; i < total; i++) {
                const card = cardsToSync[i];
                this.updateProgress(`同期中: ${i + 1} / ${total} (フェーズ: ${card.phase})`);
                
                try {
                    const data = card.getPlotData();
                    const imageData = await card.getImageDataURL(1024);
                    
                    // Prepare learning features (Same logic as individual send)
                    if (card.phase === 'intraoral' || card.phase === 'golden-prop') {
                        data.features = window.PatternMatcher.extractDentalFeatures(card.lines);
                    } else {
                        let landmarks = card.faceLandmarks;
                        if (!landmarks) {
                            card.prepareOffScreenCanvas();
                            const landmarker = await window.initFaceLandmarker();
                            const res = landmarker.detect(window.AnalysisCard.offScreenCanvas);
                            if (res.faceLandmarks?.length > 0) landmarks = res.faceLandmarks[0];
                        }
                        if (landmarks) data.features = window.PatternMatcher.extractFacialFeatures(landmarks);
                    }

                    // Execute upload
                    await window.FirebaseService.uploadAnalysis(
                        card.phase,
                        data,
                        imageData,
                        (msg) => this.updateProgress(`${i + 1}/${total}: ${msg}`)
                    );

                    // Update UI status on the card
                    const sendBtn = card.card.querySelector('.send-cloud-btn');
                    if (sendBtn) {
                        sendBtn.innerHTML = '<i data-lucide="cloud-check"></i> 同期済み';
                        sendBtn.classList.add('btn-success');
                        if (window.lucide) window.lucide.createIcons({ root: sendBtn });
                    }
                    
                    successCount++;
                } catch (cardErr) {
                    console.error(`Error syncing phase ${card.phase}:`, cardErr);
                    // Continue with next card even if one fails
                }
            }

            this.updateProgress(`同期完了: ${successCount} 件のデータをクラウドに保存しました。`);
            setTimeout(() => {
                alert(`一括同期が完了しました (${successCount}/${total})。`);
                this.showLoading(false);
            }, 500);

        } catch (err) {
            console.error('Batch Sync Error:', err);
            alert('一括同期中に重大なエラーが発生しました。');
            this.showLoading(false);
        }
    }

    showLoading(isLoading, text = '') {
        if (this.loadingOverlay) {
            if (isLoading) {
                this.loadingOverlay.classList.remove('hidden');
                if (this.progressStep) this.progressStep.textContent = text;
            } else {
                this.loadingOverlay.classList.add('hidden');
            }
        }
    }

    updateProgress(text) {
        if (this.progressStep) this.progressStep.textContent = text;
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.DataExporter = new DataExporter();
});
