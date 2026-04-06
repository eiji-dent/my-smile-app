window.DentalHandlers = {
    // --- Drawing Methods ---
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
        // Red Prop
        const elRed = card.card.querySelector('.red-value');
        if (card.lines.redProp && card.lines.redProp.length === 7 && elRed) {
            const pts = card.lines.redProp;
            const w1 = Math.abs(pts[1].x - pts[0].x); const w2 = Math.abs(pts[2].x - pts[1].x); const w3 = Math.abs(pts[3].x - pts[2].x);
            const w4 = Math.abs(pts[4].x - pts[3].x); const w5 = Math.abs(pts[5].x - pts[4].x); const w6 = Math.abs(pts[6].x - pts[5].x);
            const r1 = (w1/w2).toFixed(2); const r2 = (w2/w3).toFixed(2); const r3 = (w4/w3).toFixed(2); const r4 = (w5/w4).toFixed(2); const r5 = (w6/w5).toFixed(2);
            elRed.textContent = `${r1} : ${r2} : 1.0 (正中) 1.0 : ${r4} : ${r5}`;
        } else if (elRed) elRed.textContent = '----';

        // WL Ratio
        const elWlR = card.card.querySelector('.wl-r-value');
        const elWlL = card.card.querySelector('.wl-l-value');
        if (card.lines.wlRatio) {
            const p = card.lines.wlRatio;
            if(p.length >= 4) {
               const h = Math.abs(p[1].y - p[0].y); const w = Math.abs(p[3].x - p[2].x);
               if(h>0) elWlR.textContent = ((w/h)*100).toFixed(1) + ' %';
            }
            if(p.length === 8) {
               const h = Math.abs(p[5].y - p[4].y); const w = Math.abs(p[7].x - p[6].x);
               if(h>0) elWlL.textContent = ((w/h)*100).toFixed(1) + ' %';
            }
        }

        // Pink Esth
        const elPink = card.card.querySelector('.pink-value');
        if (card.lines.pinkEsth && card.lines.pinkEsth.length === 6 && elPink) {
            const pts = card.lines.pinkEsth;
            const rMid = pts[2].y; const lMid = pts[3].y;
            const rDist = Math.min(pts[0].y, pts[1].y) - rMid;
            const lDist = Math.min(pts[4].y, pts[5].y) - lMid;
            elPink.textContent = (Math.abs(rDist - lDist) * card.pxToMm < 1.0) ? '左右対称 (良好)' : '非対称';
            elPink.style.color = (Math.abs(rDist - lDist) * card.pxToMm < 1.0) ? 'var(--success)' : 'var(--danger)';
        }

        // Axial
        const elAxial = card.card.querySelector('.axial-value');
        if (card.lines.axialIncl && card.lines.axialIncl.length === 14 && elAxial) {
            elAxial.textContent = '計測完了（目視評価）';
        }

        // Papilla
        const elPapilla = card.card.querySelector('.papilla-value');
        if (card.lines.papilla && card.lines.papilla.length === 5 && elPapilla) {
            const pts = card.lines.papilla;
            const diffs = [Math.abs(pts[0].y - pts[4].y), Math.abs(pts[1].y - pts[3].y)];
            const maxDiffMm = Math.max(...diffs) * card.pxToMm;
            elPapilla.textContent = maxDiffMm.toFixed(1) + ' mm 差';
            elPapilla.style.color = (maxDiffMm <= 2.0) ? 'var(--success)' : 'var(--danger)';
        }
    },

    updateStats(card) {
        if (card.phase === 'intraoral') this.updateIntraoralStats(card);
    }
};
