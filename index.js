const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

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
    if (userId === adminUserId) return "最高者";
    const permissions = loadPermissions();
    return permissions[userId] || "非権限者";  // 権限がない場合は"非権限者"
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

// おみくじの結果を定義
const fortunes = [
    "大吉",
    "吉",
    "中吉",
    "小吉",
    "凶"
];

// Webhookエンドポイント
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
        if (!event.replyToken) continue; // replyTokenがない場合は処理しない

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
            // 「権限一覧」コマンドの処理
            else if (userMessage === "権限一覧") {
                const permissions = loadPermissions();
                let rolesList = "権限一覧:\n";
                for (const user in permissions) {
                    rolesList += `${user}: ${permissions[user]}\n`;
                }
                replyText = rolesList || "権限が設定されていません。";
            }
            // 「付与@〇〇」コマンドの処理 (最高者が権限を付与)
            else if (userMessage.startsWith("付与@") && userRole === "最高者") {
                const mentions = event.message.mentions;
                if (mentions.length > 0) {
                    const mentionedUser = mentions[0];  // 最初のメンションユーザーを取得
                    const permissions = loadPermissions();
                    permissions[mentionedUser.userId] = "権限者";  // 権限者に設定
                    savePermissions(permissions);
                    replyText = `ユーザー ${mentionedUser.userId} を権限者に設定しました。`;
                } else {
                    replyText = "メンションされたユーザーが見つかりません。";
                }
            }
            // 「剥奪@〇〇」コマンドの処理 (最高者が権限を剥奪)
            else if (userMessage.startsWith("剥奪@") && userRole === "最高者") {
                const mentions = event.message.mentions;
                if (mentions.length > 0) {
                    const mentionedUser = mentions[0];  // 最初のメンションユーザーを取得
                    const permissions = loadPermissions();
                    permissions[mentionedUser.userId] = "非権限者";  // 非権限者に設定
                    savePermissions(permissions);
                    replyText = `ユーザー ${mentionedUser.userId} の権限を剥奪しました。`;
                } else {
                    replyText = "メンションされたユーザーが見つかりません。";
                }
            }
            // 「check@〇〇」コマンドの処理 (権限者以上がメンションされたユーザーのIDを取得)
            else if (userMessage.startsWith("check@") && (userRole === "最高者" || userRole === "権限者")) {
                const mentions = event.message.mentions;
                if (mentions.length > 0) {
                    const mentionedUser = mentions[0];  // 最初のメンションユーザーを取得
                    replyText = `メンションされたユーザーのID: ${mentionedUser.userId}`;
                } else {
                    replyText = "メンションされたユーザーが見つかりません。";
                }
            }
            // 「おみくじ」コマンドの処理
            else if (userMessage === "おみくじ") {
                if (userRole === "最高者" || userRole === "権限者") {
                    replyText = `あなたの運勢は「${fortunes[Math.floor(Math.random() * fortunes.length)]}」です！`;
                } else {
                    replyText = "このコマンドを使う権限がありません。";
                }
            }
        }

        // 返信メッセージがある場合のみ送信
        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }
});

// `GET /` エンドポイントの追加
app.get("/", (req, res) => {
    res.send("LINE Bot Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));