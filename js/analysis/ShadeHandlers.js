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
    }
};
