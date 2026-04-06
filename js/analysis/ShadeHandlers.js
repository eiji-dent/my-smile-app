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
            const elId = card.card.querySelector('.shade-id-value');
            const elL = card.card.querySelector('.shadeL');
            const elA = card.card.querySelector('.shadeA');
            const elB = card.card.querySelector('.shadeB');
            const elDelta = card.card.querySelector('.shadeDelta');

            const currentGuide = window.SHADE_GUIDES[card.currentShadeGuideId];
            
            if ((card.activeTool === 'shade-picker' || card.activeTool === 'shade-calibrator') && card.lastSampledColor) {
                const s = card.lastSampledColor;
                const lab = window.ColorSpace.rgbToLab(s.r, s.g, s.b);
                
                let minDE = Infinity;
                let bestMatch = null;
                if (currentGuide) {
                    currentGuide.shades.forEach(ref => {
                        const de = window.ColorSpace.deltaE(lab, ref);
                        if (de < minDE) { minDE = de; bestMatch = ref; }
                    });
                }
                if (elId) elId.textContent = bestMatch ? bestMatch.id : '--';
                if (elL) elL.textContent = lab.l.toFixed(1);
                if (elA) elA.textContent = lab.a.toFixed(1);
                if (elB) elB.textContent = lab.b.toFixed(1);
                if (elDelta) elDelta.textContent = minDE.toFixed(2);
            }

            // --- Diff Panel Update ---
            const diffPanel = card.card.querySelector('.shade-comparison-panel');
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
        const cw = zoomCanvas.width = 300; 
        const ch = zoomCanvas.height = 300;
        const zCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });
        zCtx.clearRect(0, 0, cw, ch);

        const stepW = rw / 10;
        const stepH = rh / 10;

        // Image boundary clamping for extraction
        const safeX = Math.max(0, Math.min(Math.floor(rx), imgW - 1));
        const safeY = Math.max(0, Math.min(Math.floor(ry), imgH - 1));
        const safeW = Math.max(1, Math.min(Math.floor(rw), imgW - safeX));
        const safeH = Math.max(1, Math.min(Math.floor(rh), imgH - safeY));
        
        let imgData;
        try {
             imgData = srcCtx.getImageData(safeX, safeY, safeW, safeH);
        } catch(e) { return; }
        
        const cellW = cw / 10;
        const cellH = ch / 10;
        
        // Offset mapping - extracted image coordinates start from 0
        const offsetX = safeX - rx;
        const offsetY = safeY - ry;

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
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
                
                if (count > 0) {
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);
                    zCtx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
                } else {
                    zCtx.fillStyle = '#ccc';
                }
                
                zCtx.fillRect(col * cellW, row * cellH, cellW, cellH);
                zCtx.strokeStyle = 'rgba(255,255,255,0.3)';
                zCtx.lineWidth = 1;
                zCtx.strokeRect(col * cellW, row * cellH, cellW, cellH);
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
