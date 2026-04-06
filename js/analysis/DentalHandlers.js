window.DentalHandlers = {
    // --- Drawing Methods ---
    drawIntraoral(card, mapC) {
        const tool = card.activeTool;
        const pts = card.lines;
        const temp = card.tempPoints;
        const state = card.drawState;

        // Draw established lines
        if (pts.wlRatio) this.drawWlRatio(card, pts.wlRatio, mapC, false);
        if (pts.redProp) this.drawRedProp(card, pts.redProp, mapC, false);
        if (pts.pinkEsth) this.drawPinkEsth(card, pts.pinkEsth, mapC, false);
        if (pts.axialIncl) this.drawAxial(card, pts.axialIncl, mapC, false);
        if (pts.papilla) this.drawPapilla(card, pts.papilla, mapC, false);

        // Draw preview for active tool
        if (state === 'multi-point' && temp.length > 0) {
            if (tool === 'wl-ratio') this.drawWlRatio(card, temp, mapC, true, card.tempEnd);
            else if (tool === 'red-prop') this.drawRedProp(card, temp, mapC, true);
            else if (tool === 'pink-esth') this.drawPinkEsth(card, temp, mapC, true);
            else if (tool === 'axial-incl') this.drawAxial(card, temp, mapC, true);
            else if (tool === 'papilla') this.drawPapilla(card, temp, mapC, true);
        }
    },

    drawWlRatio(card, pts, mapC, isPre, tempEnd) {
        const ctx = card.ctx;
        const p1 = pts.slice(0, 4);
        ctx.setLineDash(isPre && p1.length < 4 ? [5,5] : []); ctx.lineWidth = 1; ctx.strokeStyle = '#8b5cf6';
        if(p1.length >= 2) {
            const top = mapC(p1[0].x, p1[0].y); const bot = mapC(p1[1].x, p1[1].y);
            ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
        }
        if(p1.length >= 3) {
            const lft = mapC(p1[2].x, p1[2].y); const rht = p1.length===4 ? mapC(p1[3].x, p1[3].y) : mapC(tempEnd.realX, tempEnd.realY);
            ctx.beginPath(); ctx.moveTo(lft.x, lft.y); ctx.lineTo(rht.x, rht.y); ctx.stroke();
            if(p1.length === 4) {
                const top = mapC(p1[0].x, p1[0].y); const bot = mapC(p1[1].x, p1[1].y);
                ctx.setLineDash([2,4]); ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
                ctx.strokeRect(lft.x, top.y, rht.x - lft.x, bot.y - top.y);
            }
        }
        p1.forEach((pt)=>{ const m=mapC(pt.x,pt.y); ctx.fillStyle='#8b5cf6'; ctx.beginPath(); ctx.arc(m.x,m.y,4,0,7); ctx.fill(); });

        if (pts.length >= 4) {
            const p2 = pts.slice(4, 8);
            ctx.setLineDash(isPre && p2.length < 4 ? [5,5] : []); ctx.strokeStyle = '#10b981';
            if(p2.length >= 2) {
                const top = mapC(p2[0].x, p2[0].y); const bot = mapC(p2[1].x, p2[1].y);
                ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
            }
            if(p2.length >= 3) {
                const lft = mapC(p2[2].x, p2[2].y); const rht = p2.length===4 ? mapC(p2[3].x, p2[3].y) : mapC(tempEnd.realX, tempEnd.realY);
                ctx.beginPath(); ctx.moveTo(lft.x, lft.y); ctx.lineTo(rht.x, rht.y); ctx.stroke();
                if(p2.length === 4) {
                    const top = mapC(p2[0].x, p2[0].y); const bot = mapC(p2[1].x, p2[1].y);
                    ctx.setLineDash([2,4]); ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
                    ctx.strokeRect(lft.x, top.y, rht.x - lft.x, bot.y - top.y);
                }
            }
            p2.forEach((pt)=>{ const m=mapC(pt.x,pt.y); ctx.fillStyle='#10b981'; ctx.beginPath(); ctx.arc(m.x,m.y,4,0,7); ctx.fill(); });
        }
    },

    drawRedProp(card, pts, mapC, isPre) {
        const ctx = card.ctx;
        ctx.setLineDash(isPre?[5,5]:[]); ctx.lineWidth = 1; ctx.strokeStyle = '#3b82f6';
        if(pts.length > 0) {
            let sumY = 0; pts.forEach(pt => sumY += pt.y); const avgY = sumY / pts.length;
            pts.forEach((pt, i)=>{ 
               const m=mapC(pt.x,pt.y);
               ctx.beginPath(); ctx.moveTo(m.x, mapC(pt.x, avgY).y - 40); ctx.lineTo(m.x, mapC(pt.x, avgY).y + 40); ctx.stroke();
               ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(m.x,m.y,4,0,7); ctx.fill();
            });
            const f = mapC(pts[0].x, avgY);
            const l = mapC(pts[pts.length-1].x, avgY);
            ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(l.x, f.y); ctx.stroke();
        }
    },

    drawPinkEsth(card, pts, mapC, isPre) {
        const ctx = card.ctx;
        ctx.setLineDash(isPre?[5,5]:[]); ctx.lineWidth = 1; ctx.strokeStyle = '#ec4899';
        pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); ctx.fillStyle='#ec4899'; ctx.beginPath(); ctx.arc(m.x,m.y,4,0,7); ctx.fill(); });
        if(pts.length >= 2) {
            ctx.beginPath();
            pts.forEach((pt, i) => {
                const m = mapC(pt.x, pt.y);
                if(i===0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y);
            });
            ctx.stroke();
        }
    },

    drawAxial(card, pts, mapC, isPre) {
        const ctx = card.ctx;
        ctx.lineWidth = 1;
        pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.arc(m.x,m.y,4,0,7); ctx.fill(); });
        
        if(pts.length >= 2) {
           const p1 = mapC(pts[0].x, pts[0].y); const p2 = mapC(pts[1].x, pts[1].y);
           ctx.setLineDash([5,5]); ctx.strokeStyle = '#06b6d4';
           const dx = p2.x - p1.x; const dy = p2.y - p1.y;
           const len = Math.hypot(dx, dy);
           if (len > 0) {
               const nx = dx/len; const ny = dy/len;
               const maxL = 5000;
               ctx.beginPath(); ctx.moveTo(p1.x - nx*maxL, p1.y - ny*maxL); ctx.lineTo(p1.x + nx*maxL, p1.y + ny*maxL); ctx.stroke();
           } else {
               ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
           }
        }
        ctx.setLineDash(isPre?[5,5]:[]);
        for(let i=2; i<pts.length; i+=2) {
            if(pts[i+1]) {
                const t = mapC(pts[i].x, pts[i].y); const b = mapC(pts[i+1].x, pts[i+1].y);
                ctx.strokeStyle = (i < 8) ? '#10b981' : '#f43f5e'; 
                const dx = b.x - t.x; const dy = b.y - t.y;
                const len = Math.hypot(dx, dy);
                if (len > 0) {
                    const nx = dx/len; const ny = dy/len;
                    const maxL = 5000;
                    ctx.beginPath(); ctx.moveTo(t.x - nx*maxL, t.y - ny*maxL); ctx.lineTo(t.x + nx*maxL, t.y + ny*maxL); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
        }
    },
    
    drawPapilla(card, pts, mapC, isPre) {
        const ctx = card.ctx;
        ctx.setLineDash(isPre?[5,5]:[]); ctx.lineWidth = 1; ctx.strokeStyle = '#8b5cf6';
        pts.forEach((pt)=>{ const m=mapC(pt.x,pt.y); ctx.fillStyle='#8b5cf6'; ctx.beginPath(); ctx.arc(m.x,m.y,5,0,7); ctx.fill(); });
        if(pts.length > 0) {
            pts.forEach((pt) => {
               const m = mapC(pt.x, pt.y);
               ctx.beginPath(); ctx.moveTo(m.x - 30, m.y); ctx.lineTo(m.x + 30, m.y); ctx.stroke();
            });
        }
        if(pts.length === 5) {
            const p1 = mapC(pts[0].x, pts[0].y); const p5 = mapC(pts[4].x, pts[4].y);
            const p2 = mapC(pts[1].x, pts[1].y); const p4 = mapC(pts[3].x, pts[3].y);
            ctx.setLineDash([2,4]); ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p5.x, p5.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
        }
    },

    // --- Statistics and Update Logic ---
    updateIntraoralStats(card) {
        const mm = card.pxToMm || 0.075;

        // WL Ratio
        const elWlR = card.card.querySelector('.wl-r-val');
        const elWlL = card.card.querySelector('.wl-l-val');
        const elWlRProf = card.card.querySelector('.wl-r-profile');
        const elWlLProf = card.card.querySelector('.wl-l-profile');

        if (card.lines.wlRatio) {
            const p = card.lines.wlRatio;
            const getProfile = (ratio) => {
                if (ratio > 85) return 'Long (女性的)';
                if (ratio < 75) return 'Short (男性的)';
                return 'Ideal (理想的)';
            };

            if (p.length >= 4) {
                const h = Math.abs(p[1].y - p[0].y); const w = Math.abs(p[3].x - p[2].x);
                if (h > 0 && elWlR) {
                    const ratio = (w / h) * 100;
                    elWlR.textContent = ratio.toFixed(1) + ' %';
                    if (elWlRProf) elWlRProf.textContent = getProfile(ratio);
                }
            }
            if (p.length === 8) {
                const h = Math.abs(p[5].y - p[4].y); const w = Math.abs(p[7].x - p[6].x);
                if (h > 0 && elWlL) {
                    const ratio = (w / h) * 100;
                    elWlL.textContent = ratio.toFixed(1) + ' %';
                    if (elWlLProf) elWlLProf.textContent = getProfile(ratio);
                }
            }
        }

        // RED Proportion
        if (card.lines.redProp && card.lines.redProp.length === 7) {
            const pts = card.lines.redProp;
            const ws = [
                Math.abs(pts[1].x - pts[0].x), Math.abs(pts[2].x - pts[1].x), Math.abs(pts[3].x - pts[2].x),
                Math.abs(pts[4].x - pts[3].x), Math.abs(pts[5].x - pts[4].x), Math.abs(pts[6].x - pts[5].x)
            ];
            
            // RED % (Next lateral / Prev lateral)
            const redR = (ws[0] / ws[1] * 100).toFixed(1);
            const redL = (ws[5] / ws[4] * 100).toFixed(1);
            const elRedR = card.card.querySelector('.red-r-val');
            const elRedL = card.card.querySelector('.red-l-val');
            if (elRedR) elRedR.textContent = redR + ' %';
            if (elRedL) elRedL.textContent = redL + ' %';

            // Golden % (Sum of R-steps = 50%, Sum of L-steps = 50% for standard view)
            const totalR = ws[0] + ws[1] + ws[2];
            const totalL = ws[3] + ws[4] + ws[5];
            if (totalR > 0 && totalL > 0) {
                const gpR = `${(ws[2]/totalR*50).toFixed(0)}:${(ws[1]/totalR*50).toFixed(0)}:${(ws[0]/totalR*50).toFixed(0)}`;
                const gpL = `${(ws[3]/totalL*50).toFixed(0)}:${(ws[4]/totalL*50).toFixed(0)}:${(ws[5]/totalL*50).toFixed(0)}`;
                const elGpR = card.card.querySelector('.gp-r-val');
                const elGpL = card.card.querySelector('.gp-l-val');
                if (elGpR) elGpR.textContent = gpR;
                if (elGpL) elGpL.textContent = gpL;

                // Relative Ratios (Central : Lateral (1.0) : Canine)
                const slvR = `${(ws[2]/ws[1]).toFixed(2)} : 1.00 : ${(ws[0]/ws[1]).toFixed(2)}`;
                const slvL = `${(ws[3]/ws[4]).toFixed(2)} : 1.00 : ${(ws[5]/ws[4]).toFixed(2)}`;
                const elSlvR = card.card.querySelector('.silver-r-val');
                const elSlvL = card.card.querySelector('.silver-l-val');
                if (elSlvR) elSlvR.textContent = slvR;
                if (elSlvL) elSlvL.textContent = slvL;
            }

            // Symmetry
            const diff1 = Math.abs(ws[2] - ws[3]) * mm;
            const diff2 = Math.abs(ws[1] - ws[4]) * mm;
            const elD1 = card.card.querySelector('.red-diff1-val');
            const elD2 = card.card.querySelector('.red-diff2-val');
            if (elD1) elD1.textContent = diff1.toFixed(1) + ' mm';
            if (elD2) elD2.textContent = diff2.toFixed(1) + ' mm';
        }

        // Pink Esth
        if (card.lines.pinkEsth && card.lines.pinkEsth.length === 6) {
            const pts = card.lines.pinkEsth;
            const diffC = Math.abs(pts[2].y - pts[3].y) * mm;
            const diffK = Math.abs(pts[0].y - pts[5].y) * mm;
            const elAsym = card.card.querySelector('.pz-asym-val');
            const elCanine = card.card.querySelector('.pz-canine-val');
            if (elAsym) elAsym.textContent = diffC.toFixed(1) + ' mm';
            if (elCanine) elCanine.textContent = diffK.toFixed(1) + ' mm';

            // GZL Level (Side tooth relative to C-K line)
            const cY = (pts[2].y + pts[3].y) / 2;
            const kY = (pts[0].y + pts[5].y) / 2;
            const sY = (pts[1].y + pts[4].y) / 2;
            const level = (sY - (cY + kY) / 2) * mm;
            const elLevel = card.card.querySelector('.pz-level-val');
            if (elLevel) elLevel.textContent = level.toFixed(1) + ' mm';
        }

        // Axial
        if (card.lines.axialIncl && card.lines.axialIncl.length === 14) {
            const p = card.lines.axialIncl;
            const gMid = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
            const getAngle = (t, b) => {
                const ang = Math.atan2(b.y - t.y, b.x - t.x);
                let diff = (ang - gMid) * 180 / Math.PI;
                if (diff > 90) diff -= 180; if (diff < -90) diff += 180;
                return Math.abs(diff).toFixed(1);
            };
            const selectors = ['.ax1-r-val','.ax1-l-val','.ax2-r-val','.ax2-l-val','.ax3-r-val','.ax3-l-val'];
            const pairs = [[2,3],[8,9],[4,5],[10,11],[6,7],[12,13]];
            pairs.forEach((pair, i) => {
                const el = card.card.querySelector(selectors[i]);
                if (el) el.textContent = getAngle(p[pair[0]], p[pair[1]]) + ' °';
            });
        }

        // Papilla
        if (card.lines.papilla && card.lines.papilla.length === 5) {
            const pts = card.lines.papilla;
            const elDist = card.card.querySelector('.pap-dist-val');
            const elProx = card.card.querySelector('.pap-prox-val');
            if (elDist) elDist.textContent = (Math.abs(pts[0].y - pts[4].y) * mm).toFixed(1) + ' mm';
            if (elProx) elProx.textContent = (Math.abs(pts[1].y - pts[3].y) * mm).toFixed(1) + ' mm';
        }
    },

    updateStats(card) {
        if (card.phase === 'intraoral') this.updateIntraoralStats(card);
    }
};
