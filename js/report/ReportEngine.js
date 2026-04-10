/**
 * ReportEngine.js
 * Manages PDF report UI (buttons, overlay, progress updates).
 */
class ReportEngine {
    constructor() {
        this.exportBtn = document.getElementById('export-pdf-btn');
        this.loadingOverlay = document.getElementById('pdf-loading-overlay');
        this.progressStep = document.getElementById('pdf-progress-step');
        
        if (this.exportBtn) {
            this.init();
        }
    }

    init() {
        this.exportBtn.addEventListener('click', async () => {
            await this.handleExport();
        });
    }

    async handleExport() {
        if (!window.PDFGenerator) {
            alert('PDF生成エンジンが読み込まれていません。');
            return;
        }

        try {
            this.showLoading(true);
            
            const pdf = await window.PDFGenerator.generate((step) => {
                if (this.progressStep) this.progressStep.textContent = step;
            });

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
                if (this.progressStep) this.progressStep.textContent = '0';
            } else {
                this.loadingOverlay.classList.add('hidden');
            }
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.ReportEngine = new ReportEngine();
});
