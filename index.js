const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // ここにLINEアクセストークンを直接書き込む

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";  // 自分のLINE IDに変更

// 権限データを読み込む
const loadPermissions = () => {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
};

// 権限データを保存する
const savePermissions = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
};

// 権限を取得する
const getUserRole = (userId) => {
    if (userId === adminUserId) return "admin";
    const permissions = loadPermissions();
    return permissions[userId] || "user";  // 権限がない場合は"user"
};

// メッセージ履歴を読み込む
const loadMessages = () => {
    if (!fs.existsSync(MESSAGE_LOG)) return {};
    return JSON.parse(fs.readFileSync(MESSAGE_LOG, "utf-8"));
};

// メッセージ履歴を保存する
const saveMessages = (data) => {
    fs.writeFileSync(MESSAGE_LOG, JSON.stringify(data, null, 2), "utf-8");
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);
    
    const events = req.body.events;
    const messages = loadMessages(); // メッセージ履歴を読み込む

    // 非同期処理を使ってLINE API呼び出し
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
            // 非同期で返信
            sendReply(replyToken, replyText);
        }
    }
});

// `GET /` エンドポイントの追加
app.get("/", (req, res) => {
    res.send("LINE Bot Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));