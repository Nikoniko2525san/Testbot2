const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = Cc+w+YEYWfn2tpGDIjWD1mZ3UJFiz1ty/sNbPnl0aipRC0VGzbexMmmj/qUqhf5lBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeTmCEW6VlTaaqur0pQOOx3q6KTgXXIzJHxhiH5CNAu77QdB04t89/1O/w1cDnyilFU=
const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル

// おみくじの結果リスト
const fortunes = ["大吉", "中吉", "小吉", "吉", "末吉", "凶", "大凶"];

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

app.post("/webhook", async (req, res) => {
    const events = req.body.events;

    for (const event of events) {
        if (!event.replyToken || !event.message?.text) continue;

        const replyToken = event.replyToken;
        const userMessage = event.message.text;
        const userId = event.source.userId;

        let replyText = "";
        const userRole = getUserRole(userId);

        // 「checkメンション」コマンドの処理
        if (userMessage === "checkメンション" && event.message?.mention) {
            const mentions = event.message.mention.mentee;  // メンションされたユーザー情報
            if (mentions && mentions.length > 0) {
                const mentionUserId = mentions[0].userId;  // 最初のメンション相手のIDを取得
                replyText = `メンションされたユーザーID: ${mentionUserId}`;
            } else {
                replyText = "メンションが見つかりませんでした。";
            }
        } 
        // おみくじコマンド
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
