/**
 * PDFGenerator.js
 * Faithful reproduction of the PDF generation logic from app.js.
 * Responsible for DOM capture and assembly into jsPDF.
 */
class PDFGenerator {
    /**
     * @param {Object} options 
     * @param {Function} onProgress - Callback for page progress updates
     */
    /**
     * @param {Object} onProgress - Callback for page progress updates
     * @param {Object} options - { includeAnalysis, includeLab }
     */
    static async generate(onProgress, options = { includeAnalysis: true, includeLab: true }) {
        if (!window.jspdf) {
            throw new Error('PDFライブラリが読み込まれていません。');
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        document.body.classList.add('is-exporting');

        const hideUI = (c) => {
            const actions = c.querySelector('.card-actions');
            const slider = c.querySelector('.vertical-zoom-slider');
            const toolbars = c.querySelectorAll('.horizontal-toolbar, .rotation-controls');
            
            if (actions) actions.style.display = 'none';
            if (slider) slider.style.display = 'none';
            toolbars.forEach(t => t.style.display = 'none');
            
            return { actions, slider, toolbars };
        };

        const showUI = (c, ui) => {
            if (ui.actions) ui.actions.style.display = '';
            if (ui.slider) ui.slider.style.display = '';
            ui.toolbars.forEach(t => t.style.display = '');
        };

        try {
            let currentPageNum = 0;
            // --- Cover Page ---
            const coverTemplate = document.getElementById('pdf-cover-template');
            if (coverTemplate) {
                const pName = document.getElementById('patient-name-input')?.value || '--';
                const pNo = document.getElementById('patient-no-input')?.value || '--';
                const caseTitle = document.querySelector('.patient-info h2')?.textContent || '--';
                
                document.getElementById('pdf-cover-date').textContent = new Date().toLocaleDateString('ja-JP');
                document.getElementById('pdf-cover-case-title').textContent = caseTitle;
                document.getElementById('pdf-cover-patient-name').textContent = pName;
                document.getElementById('pdf-cover-patient-id').textContent = pNo;

                // Build dynamic title for cover
                let mainTitle = '歯科分析レポート';
                if (pName !== '--' && pNo !== '--') {
                    mainTitle = `No.${pNo} ${pName} 様 歯科分析レポート`;
                } else if (pName !== '--') {
                    mainTitle = `${pName} 様 歯科分析レポート`;
                } else if (pNo !== '--') {
                    mainTitle = `No.${pNo} 歯科分析レポート`;
                }
                const mainTitleElem = document.getElementById('pdf-report-main-title');
                if (mainTitleElem) mainTitleElem.textContent = mainTitle;

                // Ensure icons are rendered
                if (window.lucide) {
                    window.lucide.createIcons({
                        attrs: { class: 'lucide' },
                        nameAttr: 'data-lucide'
                    });
                }

                // Capture cover
                const coverCanvas = await html2canvas(coverTemplate, { 
                    scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff'
                });
                const coverImgData = coverCanvas.toDataURL('image/jpeg', 0.8);
                pdf.addImage(coverImgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
                currentPageNum = 1;
                if (onProgress) onProgress('Cover');
            }

            // --- Analysis Section (1-8) ---
            if (options.includeAnalysis) {
                const analysisCards = Array.from(document.querySelectorAll('#analysis-view .analysis-card'));

                for (let i = 0; i < analysisCards.length; i++) {
                    const card = analysisCards[i];

                    // Phase 1 & 2 integration
                    if (card.id === 'card-frontal') {
                        currentPageNum++;
                        if (onProgress) onProgress(currentPageNum);
                        if (currentPageNum > 1) pdf.addPage();

                        pdf.setFontSize(10); pdf.setTextColor(150);
                        pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 1 & 2)`, margin, 8);

                        const ui1 = hideUI(card);
                        const canvas1 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                        showUI(card, ui1);

                        const cardLat = document.getElementById('card-lateral');
                        let canvas2 = null;
                        if (cardLat) {
                            const ui2 = hideUI(cardLat);
                            canvas2 = await html2canvas(cardLat, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                            showUI(cardLat, ui2);
                        }

                        const imgData1 = canvas1.toDataURL('image/jpeg', 0.6);
                        const h1 = (canvas1.height * contentWidth) / canvas1.width;
                        if (canvas2) {
                            const imgData2 = canvas2.toDataURL('image/jpeg', 0.6);
                            const h2 = (canvas2.height * contentWidth) / canvas2.width;
                            const totalNeeds = h1 + h2 + 10;
                            const availableH = pageHeight - 35;
                            let scale = 1.0;
                            if (totalNeeds > availableH) scale = availableH / totalNeeds;
                            const sh1 = h1 * scale; const sh2 = h2 * scale; const sw = contentWidth * scale;
                            pdf.addImage(imgData1, 'JPEG', margin + (contentWidth - sw)/2, 15, sw, sh1, undefined, 'FAST');
                            pdf.addImage(imgData2, 'JPEG', margin + (contentWidth - sw)/2, 15 + sh1 + 10, sw, sh2, undefined, 'FAST');
                        } else {
                            pdf.addImage(imgData1, 'JPEG', margin, 15, contentWidth, h1, undefined, 'FAST');
                        }
                        pdf.setFontSize(9); pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
                        continue;
                    }

                    if (card.id === 'card-lateral') continue;

                    // Phase 8: Photo then Results
                    if (card.id === 'card-intraoral') {
                        currentPageNum++;
                        if (onProgress) onProgress(currentPageNum);
                        if (currentPageNum > 1) pdf.addPage();
                        
                        pdf.setFontSize(10); pdf.setTextColor(150);
                        pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

                        const ui = hideUI(card);
                        const canvasWrapper = card.querySelector('.canvas-wrapper');
                        const quickStats = card.querySelector('.quick-stats');
                        const labForm = card.querySelector('.lab-form-container');

                        if (quickStats) quickStats.style.display = 'none';
                        if (labForm) labForm.style.display = 'none';
                        const canvasP1 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

                        if (quickStats) quickStats.style.display = '';
                        if (labForm) labForm.style.display = '';
                        if (canvasWrapper) canvasWrapper.style.display = 'none';
                        const canvasP2 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

                        showUI(card, ui);
                        if (canvasWrapper) canvasWrapper.style.display = '';

                        const hP1 = (canvasP1.height * contentWidth) / canvasP1.width;
                        pdf.addImage(canvasP1.toDataURL('image/jpeg', 0.7), 'JPEG', margin, 15, contentWidth, hP1, undefined, 'FAST');
                        pdf.addPage(); currentPageNum++; if (onProgress) onProgress(currentPageNum);
                        const hP2 = (canvasP2.height * contentWidth) / canvasP2.width;
                        pdf.addImage(canvasP2.toDataURL('image/jpeg', 0.7), 'JPEG', margin, 15, contentWidth, hP2, undefined, 'FAST');
                        continue;
                    }

                    // Standard Analysis Cards
                    currentPageNum++;
                    if (onProgress) onProgress(currentPageNum);
                    if (currentPageNum > 1) pdf.addPage();
                    pdf.setFontSize(10); pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

                    const uiS = hideUI(card);
                    const canvasS = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(card, uiS);

                    const hS = (canvasS.height * contentWidth) / canvasS.width;
                    pdf.addImage(canvasS.toDataURL('image/jpeg', 0.6), 'JPEG', margin, 15, contentWidth, hS, undefined, 'FAST');
                    pdf.setFontSize(9); pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
                }
            }

            // --- Lab Section (Chapters 9-12) ---
            if (options.includeLab) {
                // Chapter 9: Horizontal Bar
                const hbar9A = document.getElementById('card-horizontal-bar-front');
                const hbar9B = document.getElementById('card-horizontal-bar-top');
                if (hbar9A && hbar9B) {
                    currentPageNum++; if (onProgress) onProgress(currentPageNum);
                    pdf.addPage();
                    pdf.setFontSize(10); pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Chapter 9: Horizontal Bar)`, margin, 8);

                    const uiA = hideUI(hbar9A);
                    const canvasA = await html2canvas(hbar9A, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(hbar9A, uiA);

                    const uiB = hideUI(hbar9B);
                    const canvasB = await html2canvas(hbar9B, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(hbar9B, uiB);

                    const hA = (canvasA.height * contentWidth) / canvasA.width;
                    const hB = (canvasB.height * contentWidth) / canvasB.width;
                    pdf.addImage(canvasA.toDataURL('image/jpeg', 0.6), 'JPEG', margin, 15, contentWidth, hA, undefined, 'FAST');
                    pdf.addImage(canvasB.toDataURL('image/jpeg', 0.6), 'JPEG', margin, 15 + hA + 5, contentWidth, hB, undefined, 'FAST');
                }

                // Chapter 10: Shade Analysis
                const shade10 = document.getElementById('card-shade-take');
                if (shade10) {
                    currentPageNum++; if (onProgress) onProgress(currentPageNum);
                    pdf.addPage();
                    pdf.setFontSize(10); pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Chapter 10: Shade Analysis)`, margin, 8);

                    const ui10 = hideUI(shade10);
                    const canvas10 = await html2canvas(shade10, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(shade10, ui10);

                    const h10 = (canvas10.height * contentWidth) / canvas10.width;
                    pdf.addImage(canvas10.toDataURL('image/jpeg', 0.7), 'JPEG', margin, 15, contentWidth, Math.min(h10, pageHeight-35), undefined, 'FAST');
                }

                // Chapter 11 & 12: Supplemental & Instructions
                const chapter11 = document.getElementById('chapter-supplemental');
                const chapter12 = document.getElementById('chapter-instructions');
                if (chapter11 || chapter12) {
                    currentPageNum++; if (onProgress) onProgress(currentPageNum);
                    pdf.addPage();
                    pdf.setFontSize(10); pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Supplemental & Instructions)`, margin, 8);

                    let y = 15;
                    if (chapter11) {
                        const canvas11 = await html2canvas(chapter11, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                        const h11 = (canvas11.height * contentWidth) / canvas11.width;
                        pdf.addImage(canvas11.toDataURL('image/jpeg', 0.7), 'JPEG', margin, y, contentWidth, h11, undefined, 'FAST');
                        y += h11 + 10;
                    }
                    if (chapter12 && y < pageHeight - 50) {
                        const canvas12 = await html2canvas(chapter12, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                        const h12 = (canvas12.height * contentWidth) / canvas12.width;
                        pdf.addImage(canvas12.toDataURL('image/jpeg', 0.7), 'JPEG', margin, y, contentWidth, Math.min(h12, pageHeight-y- margin), undefined, 'FAST');
                    }
                }

                // Chapter 13: Material Choice
                const chapter13 = document.getElementById('chapter-material');
                if (chapter13) {
                    currentPageNum++; if (onProgress) onProgress(currentPageNum);
                    pdf.addPage();
                    pdf.setFontSize(10); pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Chapter 13: Material Choice)`, margin, 8);

                    const ui13 = hideUI(chapter13);
                    const canvas13 = await html2canvas(chapter13, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(chapter13, ui13);

                    const h13 = (canvas13.height * contentWidth) / canvas13.width;
                    pdf.addImage(canvas13.toDataURL('image/jpeg', 0.8), 'JPEG', margin, 15, contentWidth, Math.min(h13, pageHeight-30), undefined, 'FAST');
                }
            }

            return pdf;
        } finally {
            document.body.classList.remove('is-exporting');
        }
    }
}

window.PDFGenerator = PDFGenerator;
