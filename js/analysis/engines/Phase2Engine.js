/**
 * Phase2Engine.js - Lateral Analysis (Silhouette Scanning)
 * Specialized AI for profile view.
 */

window.Phase2Engine = {
    async analyze(card, canvas) {
        console.log("Phase 2 Engine: Running Lateral Analysis...");
        
        // 1. Try to find a similar case first (Learning AI)
        // Note: For lateral, we need a way to extract features from the image directly 
        // if we don't have landmarks yet. Or we run segmentation first.
        
        // 2. Standard Logic (Fallback/Hybrid)
        const segmenter = await window.initImageSegmenter();
        if (!segmenter) throw new Error("セグメンテーションモデルの初期化に失敗しました。");
        
        const result = segmenter.segment(canvas);
        const mask = result.categoryMask.getAsUint8Array();
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        
        // Use the 기존 LateralAI logic (assuming it's available globally)
        const lateralPoints = window.LateralAI.detectFromMask(mask, canvas.width, canvas.height, imageData.data);
        
        if (lateralPoints) {
            card.applyLateralLandmarks(lateralPoints);
            return { success: true, message: "側貌（横顔）の自動解析が完了しました。" };
        } else {
            return { success: false, message: "側貌の輪郭を特定できませんでした。" };
        }
    }
};
