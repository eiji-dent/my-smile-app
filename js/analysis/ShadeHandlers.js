window.ShadeHandlers = {
    // --- Drawing Methods ---
    drawShadeCalibrator(card, mapC) {
        const ctx = card.ctx;
        card.calibPoints.forEach(p => {
            const m = mapC(p.x, p.y);
            ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(m.x - 10, m.y); ctx.lineTo(m.x + 10, m.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(m.x, m.y - 10); ctx.lineTo(m.x, m.y + 10); ctx.stroke();
            ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 12px sans-serif';
            ctx.fillText(p.id, m.x + 12, m.y - 12);
        });
    },

    drawShadeAnalysis(card, mapC) {
        const ctx = card.ctx;
        if (card.shadeDiffA) {
            const m = mapC(card.shadeDiffA.x, card.shadeDiffA.y);
            ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
            ctx.strokeRect(m.x-10, m.y-10, 20, 20);
            ctx.fillStyle = '#3b82f6'; ctx.fillText('A', m.x-10, m.y-15);
        }
        if (card.shadeDiffB) {
            const m = mapC(card.shadeDiffB.x, card.shadeDiffB.y);
            ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2;
            ctx.strokeRect(m.x-10, m.y-10, 20, 20);
            ctx.fillStyle = '#f43f5e'; ctx.fillText('B', m.x-10, m.y-15);
        }
    },

    // --- Statistics and Update Logic ---
    updateShadeStats(card) {
        if (card.phase === 'shade-take') {
            // --- Calibration Display ---
            this.renderCalibPlotList(card);
            const elStatus = card.card.querySelector('#shade-calib-status');
            const elOffset = card.card.querySelector('#shade-offset-values');
            
            if (card.calibPoints && card.calibPoints.length > 0) {
                if (elStatus) elStatus.classList.remove('hidden');
                if (elOffset) {
                    const off = card.shadeOffset;
                    const format = (v) => (v > 0 ? '+' : '') + v.toFixed(1);
                    elOffset.textContent = `(L:${format(off.l)}, a:${format(off.a)}, b:${format(off.b)})`;
                }
            } else {
                if (elStatus) elStatus.classList.add('hidden');
            }

            // --- Sampling/Analysis Display (Closest Shade ID) ---
            // Use card properties set in initShadeUI (correct element references)
            const elId = card.shadeIdValue || card.card.querySelector('#shade-result-id');
            const elL = card.shadeL || card.card.querySelector('#shade-lab-l');
            const elA = card.shadeA || card.card.querySelector('#shade-lab-a');
            const elB = card.shadeB || card.card.querySelector('#shade-lab-b');
            const elDelta = card.shadeDelta || card.card.querySelector('#shade-delta-e');
            const shadeSwatch = card.shadeSwatch || card.card.querySelector('#shade-color-swatch');

            const currentGuide = window.SHADE_GUIDES[card.currentShadeGuideId];
            
            // Show results from shade-picker sample, or lastSampledColor (calibration click)
            const sample = (card.lines && card.lines.shadeSample) ||
                           (card.lastSampledColor ? { ...card.lastSampledColor } : null);
            if (sample) {
                const lab = window.ColorSpace.rgbToLab(sample.r, sample.g, sample.b);
                
                // Update color swatch
                if (shadeSwatch) shadeSwatch.style.backgroundColor = `rgb(${sample.r}, ${sample.g}, ${sample.b})`;

                let minDE = Infinity;
                let bestMatch = null;
                if (currentGuide) {
                    currentGuide.shades.forEach(ref => {
                        const de = window.ColorSpace.deltaE(lab, ref);
                        if (de < minDE) { minDE = de; bestMatch = ref; }
                    });
                }
                // Apply calibration offset to displayed values
                const off = card.shadeOffset || { l: 0, a: 0, b: 0 };
                const calL = lab.l + off.l;
                const calA = lab.a + off.a;
                const calB = lab.b + off.b;

                if (elId) elId.textContent = bestMatch ? bestMatch.id : '--';
                if (elL) elL.textContent = calL.toFixed(1);
                if (elA) elA.textContent = calA.toFixed(1);
                if (elB) elB.textContent = calB.toFixed(1);
                if (elDelta) elDelta.textContent = minDE.toFixed(2);

                // --- Reference values for the matched shade ---
                const elRefL = card.card.querySelector('#shade-ref-l');
                const elRefA = card.card.querySelector('#shade-ref-a');
                const elRefB = card.card.querySelector('#shade-ref-b');
                if (bestMatch) {
                    if (elRefL) elRefL.textContent = bestMatch.l.toFixed(1);
                    if (elRefA) elRefA.textContent = bestMatch.a.toFixed(1);
                    if (elRefB) elRefB.textContent = bestMatch.b.toFixed(1);
                } else {
                    if (elRefL) elRefL.textContent = '--';
                    if (elRefA) elRefA.textContent = '--';
                    if (elRefB) elRefB.textContent = '--';
                }
            }

            // --- Diff Panel Update ---
            const diffPanel = card.card.querySelector('#shade-diff-panel');
            if (diffPanel) {
                const swatchA = diffPanel.querySelector('#diff-swatch-a');
                const swatchB = diffPanel.querySelector('#diff-swatch-b');
                const deltaEVal = diffPanel.querySelector('#diff-delta-e-val');
                const judgment = diffPanel.querySelector('#diff-judgment');
                const statusBadge = diffPanel.querySelector('#diff-status-badge');

                if (card.shadeDiffA) {
                    if (swatchA) swatchA.style.backgroundColor = `rgb(${card.shadeDiffA.r}, ${card.shadeDiffA.g}, ${card.shadeDiffA.b})`;
                }
                if (card.shadeDiffA && card.shadeDiffB) {
                    if (swatchB) swatchB.style.backgroundColor = `rgb(${card.shadeDiffB.r}, ${card.shadeDiffB.g}, ${card.shadeDiffB.b})`;
                    const labA = window.ColorSpace.rgbToLab(card.shadeDiffA.r, card.shadeDiffA.g, card.shadeDiffA.b);
                    const labB = window.ColorSpace.rgbToLab(card.shadeDiffB.r, card.shadeDiffB.g, card.shadeDiffB.b);
                    const de = window.ColorSpace.deltaE(labA, labB);
                    if (deltaEVal) deltaEVal.textContent = de.toFixed(2);
                    
                    if (statusBadge) {
                        statusBadge.classList.remove('status-blue', 'status-yellow', 'status-red');
                        if (de < 1.8) {
                            if (judgment) judgment.textContent = ' 適合良好 (Excellent)';
                            statusBadge.classList.add('status-blue');
                        } else if (de < 3.6) {
                            if (judgment) judgment.textContent = ' 許容範囲 (Acceptable)';
                            statusBadge.classList.add('status-yellow');
                        } else {
                            if (judgment) judgment.textContent = ' 不適合 (Mismatch)';
                            statusBadge.classList.add('status-red');
                        }
                    }
                }
            }

            // --- Shade Map Update (100-Division) --- always visible
            const shadeZoomCanvas = card.card.querySelector('#shade-zoom-canvas');
            
            if (card.shadeMapRect && (card.shadeMapRect.active || card.shadeMapRect.finalized) && card.currentImage && shadeZoomCanvas) {
                this.updateShadeMapZoom(card, shadeZoomCanvas);
            }
        }
    },

    // --- Helper Methods ---
    renderShadePalette(card) {
        if (!card.shadePalette) return;
        const guide = window.SHADE_GUIDES[card.currentShadeGuideId];
        if (!guide) return;
        
        card.shadePalette.innerHTML = '';
        guide.shades.forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shade-btn';
            if (s.id === card.currentCalibId) btn.classList.add('active');
            btn.dataset.shade = s.id;
            btn.textContent = s.id;
            const rgb = window.ColorSpace.labToRgb(s.l, s.a, s.b);
            btn.style.setProperty('--shade-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
            card.shadePalette.appendChild(btn);
        });
    },

    renderCalibPlotList(card) {
        if (!card.shadePlotList) return;
        card.shadePlotList.innerHTML = '';
        card.calibPoints.forEach((p, idx) => {
            const tag = document.createElement('div');
            tag.className = 'plot-tag';
            tag.innerHTML = `<span>${p.id}</span><span class="remove-btn" title="削除">&times;</span>`;
            tag.querySelector('.remove-btn').onclick = (e) => {
                e.stopPropagation();
                card.calibPoints.splice(idx, 1);
                if (card.calibPoints.length === 0) {
                    card.shadeOffset = { l: 0, a: 0, b: 0 };
                } else {
                    let sL = 0, sA = 0, sB = 0;
                    card.calibPoints.forEach(cp => { sL += cp.offset.l; sA += cp.offset.a; sB += cp.offset.b; });
                    card.shadeOffset = { l: sL / card.calibPoints.length, a: sA / card.calibPoints.length, b: sB / card.calibPoints.length };
                }
                card.updateStats();
                card.drawCanvas();
            };
            card.shadePlotList.appendChild(tag);
        });
    },

    showShadeToast(msg) {
        let t = document.getElementById('shade-toast');
        if (!t) {
            t = document.createElement('div'); t.id = 'shade-toast';
            t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(37,99,235,0.9); color:white; padding:10px 20px; border-radius:30px; font-weight:600; z-index:9999; pointer-events:none; transition: opacity 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
            document.body.appendChild(t);
        }
        t.textContent = msg; t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 2000);
    },

    updateShadeMapZoom(card, zoomCanvas) {
        const { x1, y1, x2, y2 } = card.shadeMapRect;
        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        const rw = Math.max(1, Math.abs(x2 - x1));
        const rh = Math.max(1, Math.abs(y2 - y1));

        card.prepareOffScreenCanvas();
        const srcCtx = window.AnalysisCard.offScreenCtx;
        
        // Ensure bounds are valid
        const imgW = card.currentImage.width;
        const imgH = card.currentImage.height;
        if (rx >= imgW || ry >= imgH || rx + rw < 0 || ry + rh < 0) return;

        // Visual Display Size
        const GRID = 20; // 20x20 = 400 cells
        const cw = zoomCanvas.width = 400; 
        const ch = zoomCanvas.height = 400;
        const zCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });
        zCtx.clearRect(0, 0, cw, ch);

        const stepW = rw / GRID;
        const stepH = rh / GRID;

        // Image boundary clamping for extraction
        const safeX = Math.max(0, Math.min(Math.floor(rx), imgW - 1));
        const safeY = Math.max(0, Math.min(Math.floor(ry), imgH - 1));
        const safeW = Math.max(1, Math.min(Math.floor(rw), imgW - safeX));
        const safeH = Math.max(1, Math.min(Math.floor(rh), imgH - safeY));
        
        let imgData;
        try {
             imgData = srcCtx.getImageData(safeX, safeY, safeW, safeH);
        } catch(e) { return; }
        
        const cellW = cw / GRID;
        const cellH = ch / GRID;
        
        // Offset mapping - extracted image coordinates start from 0
        const offsetX = safeX - rx;
        const offsetY = safeY - ry;

        // Get current shade guide for matching
        const currentGuide = window.SHADE_GUIDES && window.SHADE_GUIDES[card.currentShadeGuideId];
        const off = card.shadeOffset || { l: 0, a: 0, b: 0 };

        for (let row = 0; row < GRID; row++) {
            for (let col = 0; col < GRID; col++) {
                const sX = Math.max(0, Math.floor(col * stepW + offsetX));
                const sY = Math.max(0, Math.floor(row * stepH + offsetY));
                let eX = Math.floor((col + 1) * stepW + offsetX);
                let eY = Math.floor((row + 1) * stepH + offsetY);
                
                if (eX > safeW) eX = safeW;
                if (eY > safeH) eY = safeH;

                let sumR = 0, sumG = 0, sumB = 0, count = 0;
                
                for(let y = sY; y < eY; y++) {
                    for(let x = sX; x < eX; x++) {
                        const idx = (y * safeW + x) * 4;
                        sumR += imgData.data[idx];
                        sumG += imgData.data[idx + 1];
                        sumB += imgData.data[idx + 2];
                        count++;
                    }
                }
                
                const cx = col * cellW;
                const cy = row * cellH;
                
                if (count > 0) {
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);

                    // Fill cell with average color
                    zCtx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
                    zCtx.fillRect(cx, cy, cellW, cellH);

                    // Find closest shade ID with calibration offset applied
                    let shadeLabel = '';
                    if (currentGuide && window.ColorSpace) {
                        const lab = window.ColorSpace.rgbToLab(avgR, avgG, avgB);
                        const calLab = { l: lab.l + off.l, a: lab.a + off.a, b: lab.b + off.b };
                        let minDE = Infinity;
                        currentGuide.shades.forEach(ref => {
                            const de = window.ColorSpace.deltaE(calLab, ref);
                            if (de < minDE) { minDE = de; shadeLabel = ref.id; }
                        });
                    }

                    // Draw shade ID text with contrast color
                    if (shadeLabel) {
                        // Perceived brightness for contrast (W3C formula)
                        const lum = 0.299 * (sumR/count) + 0.587 * (sumG/count) + 0.114 * (sumB/count);
                        zCtx.fillStyle = lum > 128 ? 'rgba(0,0,0,0.80)' : 'rgba(255,255,255,0.90)';
                        // Auto-scale font to fit smaller cell
                        const fontSize = Math.max(5, Math.min(8, cellW * 0.55));
                        zCtx.font = `bold ${fontSize}px Inter, sans-serif`;
                        zCtx.textAlign = 'center';
                        zCtx.textBaseline = 'middle';
                        zCtx.fillText(shadeLabel, cx + cellW / 2, cy + cellH / 2);
                    }
                } else {
                    zCtx.fillStyle = '#ccc';
                    zCtx.fillRect(cx, cy, cellW, cellH);
                }

                // Cell border
                zCtx.strokeStyle = 'rgba(255,255,255,0.35)';
                zCtx.lineWidth = 0.5;
                zCtx.strokeRect(cx, cy, cellW, cellH);
            }
        }
    },

    drawShade(card, mapC) {
        if (card.lines.shadeSample) {
            const s = card.lines.shadeSample;
            const m = mapC(s.x, s.y);
            card.ctx.strokeStyle = '#2563eb';
            card.ctx.lineWidth = 2;
            card.ctx.beginPath();
            card.ctx.moveTo(m.x - 15, m.y); card.ctx.lineTo(m.x + 15, m.y);
            card.ctx.moveTo(m.x, m.y - 15); card.ctx.lineTo(m.x, m.y + 15);
            card.ctx.stroke();
            card.ctx.beginPath();
            card.ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
            card.ctx.stroke();
        }

        if (card.activeTool === 'shade-diff' && card.shadeDiffA) {
            const m1 = mapC(card.shadeDiffA.x, card.shadeDiffA.y);
            card.ctx.beginPath();
            card.ctx.arc(m1.x, m1.y, 10, 0, Math.PI*2);
            card.ctx.strokeStyle = '#6366f1';
            card.ctx.lineWidth = 4;
            card.ctx.stroke();
            card.ctx.beginPath();
            card.ctx.arc(m1.x, m1.y, 8, 0, Math.PI*2);
            card.ctx.strokeStyle = 'white';
            card.ctx.lineWidth = 1.5;
            card.ctx.stroke();
            card.ctx.font = 'bold 14px Inter';
            card.ctx.fillStyle = '#6366f1';
            card.ctx.fillText("A (Ref)", m1.x + 15, m1.y - 15);

            if (card.shadeDiffB) {
                const m2 = mapC(card.shadeDiffB.x, card.shadeDiffB.y);
                card.ctx.beginPath();
                card.ctx.arc(m2.x, m2.y, 10, 0, Math.PI*2);
                card.ctx.strokeStyle = '#ec4899';
                card.ctx.lineWidth = 4;
                card.ctx.stroke();
                card.ctx.beginPath();
                card.ctx.arc(m2.x, m2.y, 8, 0, Math.PI*2);
                card.ctx.strokeStyle = 'white';
                card.ctx.lineWidth = 1.5;
                card.ctx.stroke();
                card.ctx.font = 'bold 14px Inter';
                card.ctx.fillStyle = '#ec4899';
                card.ctx.fillText("B (Target)", m2.x + 15, m2.y - 15);
            }
        }

        if (card.calibPoints) {
            card.calibPoints.forEach(p => {
                const m = mapC(p.x, p.y);
                card.ctx.strokeStyle = '#10b981';
                card.ctx.lineWidth = 1;
                card.ctx.beginPath();
                card.ctx.moveTo(m.x - 10, m.y); card.ctx.lineTo(m.x + 10, m.y);
                card.ctx.moveTo(m.x, m.y - 10); card.ctx.lineTo(m.x, m.y + 10);
                card.ctx.stroke();
                card.ctx.font = '10px sans-serif';
                card.ctx.fillStyle = '#10b981';
                card.ctx.fillText(p.id, m.x + 12, m.y - 12);
            });
        }

        if (card.shadeMapRect) {
            const { x1, y1, x2, y2, active, finalized } = card.shadeMapRect;
            const m1 = mapC(x1, y1);
            const m2 = mapC(x2, y2);
            card.ctx.strokeStyle = (active || finalized) ? '#f59e0b' : '#94a3b8'; // Amber or Slate
            card.ctx.lineWidth = finalized ? 2 : 1;
            if (active) card.ctx.setLineDash([5, 5]);
            else card.ctx.setLineDash([]);
            card.ctx.strokeRect(Math.min(m1.x, m2.x), Math.min(m1.y, m2.y), Math.abs(m2.x - m1.x), Math.abs(m2.y - m1.y));
            card.ctx.setLineDash([]);
        }
    }
};
