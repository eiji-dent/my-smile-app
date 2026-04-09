/**
 * TouchHandler Class
 * iPad/タッチデバイスでの操作を最適化するためのハンドラ
 */
class TouchHandler {
    constructor(card) {
        this.card = card; // AnalysisCardのインスタンス
        this.canvas = card.canvas;
        this.initListeners();
    }

    initListeners() {
        // タッチイベントをキャプチャし、マウスイベントとして再発行する
        // passive: false にすることで、iPadでのスクロールを抑制し操作を優先させる
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e, 'mousedown'), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e, 'mousemove'), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouch(e, 'mouseup'), { passive: false });
    }

    handleTouch(e, mouseType) {
        if (!this.card.currentImage) return;

        // 2本指以上の操作（ズームなど）はブラウザのデフォルト挙動に任せる
        if (e.touches.length > 1 && mouseType !== 'mouseup') return;

        const touch = e.touches[0] || e.changedTouches[0];
        if (!touch) return;

        // イベントのデフォルト動作（スクロール等）を抑制
        if (mouseType !== 'mouseup') {
            e.preventDefault();
        }

        // マウスイベントをシミュレートして発行
        const mouseEvent = new MouseEvent(mouseType, {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0 // 左クリックとして扱う
        });

        this.canvas.dispatchEvent(mouseEvent);
    }
}
