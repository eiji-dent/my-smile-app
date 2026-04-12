/**
 * TouchHandler Class
 * iPad/タッチデバイスでの操作を最適化するためのハンドラ
 * 「点に触れれば即移動」「余白をスワイプでスクロール」「余白をタップで新規配置」を実現するスマート制御
 */
class TouchHandler {
    constructor(card) {
        this.card = card; // AnalysisCardのインスタンス
        this.canvas = card.canvas;
        
        this.isDragging = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.MOVE_THRESHOLD = 10; // px（この距離以下のタップなら新規配置とみなす）
        
        this.initListeners();
    }

    initListeners() {
        // キャンバス上のスクロールを許容するため passive: false でリスナー登録し、適宜 preventDefault する
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
    }

    handleTouchStart(e) {
        if (!this.card.currentImage) return;

        // 2本指以上の操作（ズームなど）は完全にブラウザに任せる
        if (e.touches.length > 1) return;

        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.isDragging = false;

        // タッチした場所の近くに既存のプロット点があるか検索（当たり判定：半径30px）
        const coords = this.card.getMouseCoords({ clientX: touch.clientX, clientY: touch.clientY });
        const hitPoint = this.card.findHoverPoint(coords, true);

        if (hitPoint) {
            // 【点の近くを触った場合】 -> 即座にドラッグモードへ移行
            this.isDragging = true;
            this.card.hoveredPoint = hitPoint; // AnalysisCardに掴んだ点を教える
            
            e.preventDefault(); // スクロールを禁止
            this.dispatchMouseEvent('mousedown', touch);
            
            // ルーペの表示
            this.card.updateMagnifier(new MouseEvent('mousedown', {clientX: touch.clientX, clientY: touch.clientY}));
        } else {
            // 【何もない場所を触った場合】 -> スクロール待機の状態
            // preventDefault() しないことで、iPadはそのまま滑らかに画面をスクロールできる
            this.isDragging = false;
        }
    }

    handleTouchMove(e) {
        if (!this.card.currentImage) return;
        if (e.touches.length > 1) return;

        const touch = e.touches[0];

        if (this.isDragging) {
            // 【ドラッグ中の場合】 -> プロットを移動させる
            e.preventDefault(); // スクロールを禁止し続ける
            this.dispatchMouseEvent('mousemove', touch);
            // ルーペの更新
            this.card.updateMagnifier(new MouseEvent('mousemove', {clientX: touch.clientX, clientY: touch.clientY}));
        }
        // ドラッグ中でない（＝何もない場所を触っている）場合は何もせず、ブラウザの標準スクロールに任せる
    }

    handleTouchEnd(e) {
        const touch = e.changedTouches[0];

        if (this.isDragging) {
            // 【ドラッグ終了】
            e.preventDefault();
            this.dispatchMouseEvent('mouseup', touch);
            this.isDragging = false;
            
            // ルーペを非表示にする
            if(this.card.loupeContainer) this.card.loupeContainer.classList.add('hidden');
        } else {
            // 【何もない場所から指が離れた場合】 -> スワイプ(スクロール)だったのか、タップだったのかを判定
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;
            
            if (Math.hypot(dx, dy) <= this.MOVE_THRESHOLD) {
                // 指がほとんど動いていない ＝ 「新しい点を配置したいタップ操作」とみなす
                // ※AnalysisCard側での誤動作を防ぐため、e.preventDefault() はしないか、必要に応じて設定
                this.dispatchMouseEvent('mousedown', touch);
                // ほんの少し遅らせてmouseupを発行し、点の確実な配置処理を回す
                setTimeout(() => this.dispatchMouseEvent('mouseup', touch), 50);
            }
        }
    }

    dispatchMouseEvent(type, touch) {
        const mouseEvent = new MouseEvent(type, {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
        });

        // タッチ由来であることを記録（AnalysisCard側でこのフラグを見て当たり判定半径を大きく保つ）
        mouseEvent.isTouchShim = true;
        this.canvas.dispatchEvent(mouseEvent);
    }
}
