const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
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

        // 「おみくじ」コマンドの処理
        if (userMessage === "おみくじ") {
            if (userRole === "admin" || userRole === "moderator") {
                replyText = `あなたの運勢は「${fortunes[Math.floor(Math.random() * fortunes.length)]}」です！`;
            } else {
                replyText = "このコマンドを使う権限がありません。";
            }
        } 
        // 簡易権限者を追加
        else if (userMessage.startsWith("!mod add ")) {
            if (userRole !== "admin") {
                replyText = "このコマンドを実行する権限がありません。";
            } else {
                const targetUserId = userMessage.replace("!mod add ", "").trim();
                const permissions = loadPermissions();
                permissions[targetUserId] = "moderator";
                savePermissions(permissions);
                replyText = `ユーザー ${targetUserId} を簡易権限者に追加しました。`;
            }
        }
        // 簡易権限者を削除
        else if (userMessage.startsWith("!mod remove ")) {
            if (userRole !== "admin") {
                replyText = "このコマンドを実行する権限がありません。";
            } else {
                const targetUserId = userMessage.replace("!mod remove ", "").trim();
                const permissions = loadPermissions();
                if (permissions[targetUserId]) {
                    delete permissions[targetUserId];
                    savePermissions(permissions);
                    replyText = `ユーザー ${targetUserId} の簡易権限を削除しました。`;
                } else {
                    replyText = "指定されたユーザーは簡易権限者ではありません。";
                }
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