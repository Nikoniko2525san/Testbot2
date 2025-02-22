app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);
    
    // 少し待つ（非同期処理で遅延を追加）
    await new Promise(resolve => setTimeout(resolve, 500));  // 500ms待機
    
    const events = req.body.events;
    const messages = loadMessages(); // メッセージ履歴を読み込む

    const sendReply = async (replyToken, replyText) => {
        try {
            await axios.post("https://api.line.me/v2/bot/message/reply", {
                replyToken: replyToken,
                messages: [{ type: "text", text: replyText }]
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                },
                timeout: 5000 // タイムアウトを5秒に設定
            });
        } catch (error) {
            console.error('エラー発生:', error);
        }
    };

    for (const event of events) {
        if (!event.replyToken && event.type !== "unsend") continue;

        const replyToken = event.replyToken;
        const userId = event.source.userId;
        const userRole = getUserRole(userId);

        let replyText = null;

        // メッセージ受信イベント
        if (event.type === "message" && event.message?.text) {
            const messageId = event.message.id;
            const userMessage = event.message.text;

            // メッセージを記録
            messages[messageId] = userMessage;
            saveMessages(messages);

            // 「check」コマンドの処理
            if (userMessage === "check") {
                replyText = `あなたのIDは: ${userId}`;
            } 
            // 「権限」コマンドの処理
            else if (userMessage === "権限") {
                replyText = `あなたの権限は: ${userRole}`;
            }
        } 
        // 送信取り消し（unsend）イベント
        else if (event.type === "unsend") {
            const unsendMessageId = event.unsend.messageId;

            if (messages[unsendMessageId]) {
                replyText = `「${messages[unsendMessageId]}」というメッセージが取り消されました。`;
                delete messages[unsendMessageId]; // 削除されたメッセージを履歴から消す
                saveMessages(messages);
            } else {
                replyText = "メッセージが取り消されました。";
            }
        }

        // 返信メッセージがある場合のみ送信
        if (replyText) {
            sendReply(replyToken, replyText);
        }
    }
});