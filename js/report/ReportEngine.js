/**
 * ReportEngine.js
 * Manages PDF report UI (buttons, overlay, progress updates).
 */
class ReportEngine {
    constructor() {
        this.exportBtn = document.getElementById('export-combined-btn');
        this.loadingOverlay = document.getElementById('pdf-loading-overlay');
        this.progressStep = document.getElementById('pdf-progress-step');
        
        if (this.exportBtn) {
            this.init();
        }
    }

    init() {
        this.exportBtn.addEventListener('click', () => {
            this.showSelectionModal();
        });

        // Modal Elements
        this.modal = document.getElementById('pdf-selection-modal');
        this.cancelBtn = document.getElementById('btn-pdf-cancel');
        this.confirmBtn = document.getElementById('btn-pdf-confirm');
        this.selAnalysis = document.getElementById('sel-analysis');
        this.selLab = document.getElementById('sel-lab');

        if (this.modal) {
            this.cancelBtn.addEventListener('click', () => this.hideSelectionModal());
            this.selAnalysis.addEventListener('click', () => this.toggleSelection(this.selAnalysis));
            this.selLab.addEventListener('click', () => this.toggleSelection(this.selLab));
            this.confirmBtn.addEventListener('click', () => this.handleExport());
        }
    }

    showSelectionModal() {
        if (this.modal) this.modal.classList.add('active');
        if (window.lucide) window.lucide.createIcons();
    }

    hideSelectionModal() {
        if (this.modal) this.modal.classList.remove('active');
    }

    toggleSelection(card) {
        card.classList.toggle('active');
        const anyActive = this.selAnalysis.classList.contains('active') || this.selLab.classList.contains('active');
        this.confirmBtn.disabled = !anyActive;
    }

    async handleExport() {
        if (!window.PDFGenerator || !window.DataExporter) {
            alert('レポート生成またはデータ同期モジュールが見つかりません。');
            return;
        }

        const options = {
            includeAnalysis: this.selAnalysis.classList.contains('active'),
            includeLab: this.selLab.classList.contains('active')
        };

        this.hideSelectionModal();

        try {
            this.showLoading(true);
            
            // Step 1: Force Cloud Sync (Automatically extracting features for learning)
            if (window.DataExporter && window.DataExporter.syncAllToCloud) {
                this.updateProgress('解析データをクラウドに送信中...');
                await window.DataExporter.syncAllToCloud();
            }

            // Step 2: Generate PDF
            this.updateProgress('PDFレポートを生成中...');
            const pdf = await window.PDFGenerator.generate((step) => {
                this.updateProgress(step);
            }, options);

            if (pdf) {
                const dateStr = new Date().toISOString().split('T')[0];
                const pName = document.getElementById('patient-name-input')?.value || '';
                const pNo = document.getElementById('patient-no-input')?.value || '';
                
                let fileName = '歯科分析レポート';
                if (pName && pNo) {
                    fileName = `No${pNo}_${pName}_歯科分析レポート`;
                } else if (pName) {
                    fileName = `${pName}_歯科分析レポート`;
                } else if (pNo) {
                    fileName = `No${pNo}_歯科分析レポート`;
                }

                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${fileName}_${dateStr}.pdf`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }

        } catch (err) {
            console.error('ReportEngine Error:', err);
            alert('PDFの生成中にエラーが発生しました。詳細はコンソールを確認してください。');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(isLoading) {
        if (this.loadingOverlay) {
            if (isLoading) {
                this.loadingOverlay.classList.remove('hidden');
                this.updateProgress('準備中...');
            } else {
                this.loadingOverlay.classList.add('hidden');
            }
        }
    }

    updateProgress(text) {
        if (this.progressStep) {
            this.progressStep.textContent = text;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.ReportEngine = new ReportEngine();
});
