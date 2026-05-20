// =====================================================================
// LINE × Gemini AI 自動応答ボット（GAS版 / MVPスケボー）
// ---------------------------------------------------------------------
// このファイルをGoogle Apps Scriptの「Code.gs」にコピペしてください。
// 下の「設定エリア」だけ書き換えればすぐ動きます。
// =====================================================================


// -------- ① 設定エリア（ここだけ書き換える！）-------------------------

// ★【LINEアクセストークン】★
// LINE Developers → 該当のチャネル → 「Messaging API設定」タブ →
// 一番下の「チャネルアクセストークン（長期）」の【発行】ボタンで作成し、
// 表示された文字列を下のシングルクォート（'）の中に貼り付けてください。
const LINE_ACCESS_TOKEN = 'ここにLINEのチャネルアクセストークンを貼り付け';

// ★【Gemini APIキー】★
// https://aistudio.google.com/app/apikey にアクセスし、
// 「Create API key」で作成したキーを下のシングルクォート（'）の中に貼り付けてください。
const GEMINI_API_KEY = 'ここにGeminiのAPIキーを貼り付け';

// 使用するGeminiモデル（無料枠で動く軽量モデル。基本そのままでOK）
const GEMINI_MODEL = 'gemini-2.0-flash';


// -------- ② AIのキャラクター設定（システムプロンプト）------------------
const SYSTEM_PROMPT = [
  'あなたはAIプログラミングセミナーの受講生をサポートする優しいアシスタントです。',
  '',
  '【絶対に守るルール】',
  '1. 受講生からエラー画面やエラーメッセージが送られてきたら、回答の冒頭で必ず',
  '   「ナイスチャレンジです!エラーはシステムと対話している証拠ですよ」',
  '   と褒めてから本題に入ってください。',
  '',
  '2. 答えのコード(完成形)を直接教えるのは禁止です。',
  '   代わりに「AIにどう質問すれば解決するか」というプロンプトの書き方のヒントを示してください。',
  '   例:「『〇〇というエラーが出ました。原因として考えられることを3つ教えてください』と',
  '   AIに聞いてみるとよいですよ」のように、質問のテンプレートを提示します。',
  '',
  '3. 相手はプログラミング初心者です。専門用語はやさしい言葉で言い換え、',
  '   絵文字を少しだけ使って親しみやすく話してください。',
  '',
  '4. 回答は300文字以内を目安に、要点を絞って短く返してください。'
].join('\n');


// =====================================================================
// ここから下はロジック本体。基本的に変更不要です。
// =====================================================================

/**
 * LINEのWebhookから呼ばれるエンドポイント。
 * GASを「ウェブアプリ」としてデプロイすると、このdoPostが公開URLになります。
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const event = body.events && body.events[0];

    // テキストメッセージ以外(スタンプ・画像・友だち追加など)はスルー
    if (!event || event.type !== 'message' || event.message.type !== 'text') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'skipped' }));
    }

    const replyToken = event.replyToken;
    const userText = event.message.text;

    // AIに回答を作ってもらう
    const aiText = callGemini(userText);

    // LINEに返信
    replyToLine(replyToken, aiText);

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }));
  } catch (err) {
    console.error('doPost error:', err);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error' }));
  }
}

/**
 * Gemini APIに問い合わせて回答テキストを返す
 */
function callGemini(userText) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: userText }]
    }]
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    console.error('Gemini error:', res.getResponseCode(), res.getContentText());
    return 'すみません、AIの呼び出しに失敗しました🙏 少し時間をおいてもう一度試してみてください。';
  }

  const json = JSON.parse(res.getContentText());
  return json.candidates[0].content.parts[0].text.trim();
}

/**
 * LINEに返信を送る (Reply API)
 */
function replyToLine(replyToken, text) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + LINE_ACCESS_TOKEN },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    console.error('LINE reply error:', res.getResponseCode(), res.getContentText());
  }
}

/**
 * 動作確認用。GASエディタ上で「実行」→ログを見ればAIの返事が確認できます。
 * (LINEを使わずにGemini API側だけテストしたいときに便利)
 */
function testGemini() {
  const reply = callGemini('TypeError: Cannot read properties of undefined というエラーが出ました');
  console.log(reply);
}
