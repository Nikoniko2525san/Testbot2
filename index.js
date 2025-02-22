const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // ここにLINEアクセストークンを直接書き込む

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル

// おみくじの結果リスト
const fortunes = ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"];

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
    if (userId === adminUserId) return "admin";
    const permissions = loadPermissions();
    return permissions[userId] || "user";  // 権限がない場合は"user"
};

app.post("/webhook", async (req, res) => {
    const events = req.body.events;

    for (const event of events) {
        if (!event.replyToken || !event.message?.text) continue;

        const replyToken = event.replyToken;
        const userMessage = event.message.text;
        const userId = event.source.userId;

        let replyText = "";
        const userRole = getUserRole(userId);

        // 「check」コマンドの処理
        if (userMessage === "check") {
            replyText = `あなたのユーザーIDは: ${userId}`;
        } 
        // 「おみくじ」コマンドの処理
        else if (userMessage === "おみくじ") {
            if (userRole === "admin" || userRole === "moderator") {
                replyText = `あなたの運勢は「${fortunes[Math.floor(Math.random() * fortunes.length)]}」です！`;
            } else {
                replyText = "このコマンドを使う権限がありません。";
            }
        } else {
            replyText = `あなたのメッセージ: ${userMessage}`;
        }

        await axios.post("https://api.line.me/v2/bot/message/reply", {
            replyToken: replyToken,
            messages: [{ type: "text", text: replyText }]
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ACCESS_TOKEN}`
            }
        });
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));