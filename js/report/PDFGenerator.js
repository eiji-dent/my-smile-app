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
    static async generate(onProgress) {
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
            if (actions) actions.style.display = 'none';
            if (slider) slider.style.display = 'none';
            return { actions, slider };
        };

        const showUI = (c, ui) => {
            if (ui.actions) ui.actions.style.display = '';
            if (ui.slider) ui.slider.style.display = '';
        };

        try {
            let currentPageNum = 0;
            // --- Cover Page ---
            const coverTemplate = document.getElementById('pdf-cover-template');
            if (coverTemplate) {
                // Update template data
                const caseTitle = document.querySelector('.patient-info h2')?.textContent || '--';
                const pName = document.getElementById('patient-name-input')?.value || '--';
                const pNo = document.getElementById('patient-no-input')?.value || '--';
                
                const dateElem = document.getElementById('pdf-cover-date');
                const titleElem = document.getElementById('pdf-cover-case-title');
                const nameElem = document.getElementById('pdf-cover-patient-name');
                const idElem = document.getElementById('pdf-cover-patient-id');

                if (dateElem) dateElem.textContent = new Date().toLocaleDateString('ja-JP');
                if (titleElem) titleElem.textContent = caseTitle;
                if (nameElem) nameElem.textContent = pName;
                if (idElem) idElem.textContent = pNo;

                // Build dynamic title for cover
                let mainTitle = '歯科分析レポート';
                if (pName !== '--' && pNo !== '--') {
                    mainTitle = `No${pNo} ${pName} 様 歯科分析レポート`;
                } else if (pName !== '--') {
                    mainTitle = `${pName} 様 歯科分析レポート`;
                } else if (pNo !== '--') {
                    mainTitle = `No${pNo} 歯科分析レポート`;
                }
                
                const mainTitleElem = document.getElementById('pdf-report-main-title');
                if (mainTitleElem) mainTitleElem.textContent = mainTitle;

                // Ensure icons are rendered
                if (window.lucide) {
                    window.lucide.createIcons({
                        attrs: {
                            class: 'lucide'
                        },
                        nameAttr: 'data-lucide'
                    });
                }

                // Capture cover
                const coverCanvas = await html2canvas(coverTemplate, { 
                    scale: 1.2, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                const coverImgData = coverCanvas.toDataURL('image/jpeg', 0.8);
                pdf.addImage(coverImgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
                currentPageNum = 1;
                if (onProgress) onProgress('Cover');
            }

            const cards = Array.from(document.querySelectorAll('.analysis-card'));

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];

                // Phase 9-B は 9-A の中で処理するためスキップ
                if (card.id === 'card-horizontal-bar-top') continue;

                // --- Phase 1 & 2 integration ---
                if (card.id === 'card-frontal') {
                    currentPageNum++;
                    if (onProgress) onProgress(currentPageNum);
                    if (currentPageNum > 1) pdf.addPage();

                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 1 & 2)`, margin, 8);

                    // Capture Phase 1
                    const ui1 = hideUI(card);
                    const canvas1 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    showUI(card, ui1);

                    // Capture Phase 2
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
                        
                        // Adjust layout to fit A4 height
                        const totalNeeds = h1 + h2 + 10;
                        const availableH = pageHeight - 35;
                        let s = 1.0;
                        if (totalNeeds > availableH) {
                            s = availableH / totalNeeds;
                        }
                        const sh1 = h1 * s;
                        const sh2 = h2 * s;
                        const sw = contentWidth * s;
                        const x = margin + (contentWidth - sw) / 2;

                        pdf.addImage(imgData1, 'JPEG', x, 15, sw, sh1, undefined, 'FAST');
                        pdf.addImage(imgData2, 'JPEG', x, 15 + sh1 + 10, sw, sh2, undefined, 'FAST');
                    } else {
                        const h = (canvas1.height * contentWidth) / canvas1.width;
                        pdf.addImage(imgData1, 'JPEG', margin, 15, contentWidth, h, undefined, 'FAST');
                    }

                    pdf.setFontSize(9);
                    pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
                    continue;
                }

                // Phase 2 は統合済みのためスキップ
                if (card.id === 'card-lateral') continue;

                // 技工用ツールコンテナ自体はスキップし、内部を個別に処理する
                if (card.id === 'card-lab-tools') continue;

                // --- Phase 8 (Special Case: Photo then Results) ---
                if (card.id === 'card-intraoral') {
                    currentPageNum++;
                    if (onProgress) onProgress(currentPageNum);
                    if (currentPageNum > 1) pdf.addPage();
                    
                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

                    const ui = hideUI(card);
                    const canvasWrapper = card.querySelector('.canvas-wrapper');
                    const horizontalToolbar = card.querySelector('.horizontal-toolbar');
                    const quickStats = card.querySelector('.quick-stats');
                    const labForm = card.querySelector('.lab-form-container');

                    // 1ページ目: 写真 (結果とフォームを隠す)
                    if (quickStats) quickStats.style.display = 'none';
                    if (labForm) labForm.style.display = 'none';
                    const canvasP1 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

                    // 2ページ目用準備: 写真エリアを隠し、結果を表示
                    if (quickStats) quickStats.style.display = '';
                    if (labForm) labForm.style.display = '';
                    if (canvasWrapper) canvasWrapper.style.display = 'none';
                    if (horizontalToolbar) horizontalToolbar.style.display = 'none';
                    const canvasP2 = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

                    // 表示をすべて元に戻す
                    showUI(card, ui);
                    if (canvasWrapper) canvasWrapper.style.display = '';
                    if (horizontalToolbar) horizontalToolbar.style.display = '';

                    const imgDataP1 = canvasP1.toDataURL('image/jpeg', 0.7);
                    const imgDataP2 = canvasP2.toDataURL('image/jpeg', 0.7);
                    const hP1 = (canvasP1.height * contentWidth) / canvasP1.width;
                    const hP2 = (canvasP2.height * contentWidth) / canvasP2.width;

                    // 1ページ目: 写真
                    pdf.addImage(imgDataP1, 'JPEG', margin, 15, contentWidth, hP1, undefined, 'FAST');
                    pdf.setFontSize(9);
                    pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });

                    // 2ページ目: 解析結果
                    pdf.addPage();
                    currentPageNum++;
                    if (onProgress) onProgress(currentPageNum);
                    pdf.setFontSize(10);
                    pdf.setTextColor(150);
                    pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 8 Results & Form)`, margin, 8);
                    pdf.addImage(imgDataP2, 'JPEG', margin, 15, contentWidth, hP2, undefined, 'FAST');
                    pdf.setFontSize(9);
                    pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });

                    continue;
                }

                // --- Standard Card Processing ---
                currentPageNum++;
                if (onProgress) onProgress(currentPageNum);

                const ui1 = hideUI(card);
                const canvas = await html2canvas(card, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                showUI(card, ui1);

                if (currentPageNum > 1) pdf.addPage();

                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(`Smile Analysis Report - Page ${currentPageNum}`, margin, 8);

                // --- 通常のカード ---
                const imgData = canvas.toDataURL('image/jpeg', 0.6);
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                pdf.addImage(imgData, 'JPEG', margin, 15, contentWidth, imgHeight, undefined, 'FAST');

                pdf.setFontSize(9);
                pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }

            // --- 10ページ目: Phase 9 (水平バー統合) ---
            const card9A = document.getElementById('card-horizontal-bar-front');
            const card9B = document.getElementById('card-horizontal-bar-top');
            if (card9A && card9B) {
                currentPageNum++;
                if (onProgress) onProgress(currentPageNum);
                pdf.addPage();
                
                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 9: Horizontal Bar)`, margin, 8);

                const uiA = hideUI(card9A);
                const canvasA = await html2canvas(card9A, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                showUI(card9A, uiA);

                const uiB = hideUI(card9B);
                const canvasB = await html2canvas(card9B, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                showUI(card9B, uiB);

                const imgA = canvasA.toDataURL('image/jpeg', 0.6);
                const imgB = canvasB.toDataURL('image/jpeg', 0.6);
                const hA = (canvasA.height * contentWidth) / canvasA.width;
                const hB = (canvasB.height * contentWidth) / canvasB.width;

                pdf.addImage(imgA, 'JPEG', margin, 15, contentWidth, hA, undefined, 'FAST');
                pdf.addImage(imgB, 'JPEG', margin, 15 + hA + 5, contentWidth, hB, undefined, 'FAST');

                pdf.setFontSize(9);
                pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }

            // --- 11ページ目: Phase 10 (シェードテイク) ---
            const card10 = document.getElementById('card-shade-take');
            if (card10) {
                currentPageNum++;
                if (onProgress) onProgress(currentPageNum);
                pdf.addPage();

                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Phase 10: Shade Analysis)`, margin, 8);

                const ui10 = hideUI(card10);
                const canvas10 = await html2canvas(card10, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                showUI(card10, ui10);

                const img10 = canvas10.toDataURL('image/jpeg', 0.7);
                const h10 = (canvas10.height * contentWidth) / canvas10.width;
                // A4に収まるように調整
                const maxH = pageHeight - 35;
                const finalH = Math.min(h10, maxH);

                pdf.addImage(img10, 'JPEG', margin, 15, contentWidth, finalH, undefined, 'FAST');
                
                pdf.setFontSize(9);
                pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }

            // --- 12ページ目: 補足画像 ＋ 技工指示内容 ---
            const cardSupp = document.getElementById('card-supplemental-images');
            const cardInst = document.getElementById('card-lab-instructions');
            if (cardSupp || cardInst) {
                currentPageNum++;
                if (onProgress) onProgress(currentPageNum);
                pdf.addPage();

                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(`Smile Analysis Report - Page ${currentPageNum} (Supplemental & Instructions)`, margin, 8);

                let currentY = 15;

                if (cardSupp) {
                    const canvasSupp = await html2canvas(cardSupp, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    const imgSupp = canvasSupp.toDataURL('image/jpeg', 0.7);
                    const hSupp = (canvasSupp.height * contentWidth) / canvasSupp.width;
                    pdf.addImage(imgSupp, 'JPEG', margin, currentY, contentWidth, hSupp, undefined, 'FAST');
                    currentY += hSupp + 10;
                }

                if (cardInst && currentY < pageHeight - 50) {
                    const canvasInst = await html2canvas(cardInst, { scale: 1.2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    const imgInst = canvasInst.toDataURL('image/jpeg', 0.7);
                    const hInst = (canvasInst.height * contentWidth) / canvasInst.width;
                    // 指示内容がはみ出さないようにクリップ/リサイズ
                    const remainingH = pageHeight - currentY - 15;
                    const finalHInst = Math.min(hInst, remainingH);
                    pdf.addImage(imgInst, 'JPEG', margin, currentY, contentWidth, finalHInst, undefined, 'FAST');
                }

                pdf.setFontSize(9);
                pdf.text(`Aesthetic Dentistry Analysis Tool`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }

            return pdf;

        } finally {
            document.body.classList.remove('is-exporting');
        }
    }
}

window.PDFGenerator = PDFGenerator;
