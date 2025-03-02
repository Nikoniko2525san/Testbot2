const express = require("express");
const axios = require("axios");
const fs = require("fs");
const app = express();
app.use(express.json());

const ACCESS_TOKEN = "scim9t3j5eY+OB6O0hgo32s1olzFkxqC0f2U7CWcy30k1R3orR5uNc+disMdUHIRBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeR85MS+I2YYt+23YrzC88zIhizNU8cGhNS/eurmqB6n8AdB04t89/1O/w1cDnyilFU="; // LINEアクセストークン
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3"; // 管理者のユーザーID

const DATA_FILE = "permissions.json";
const COINS_FILE = "coins.json";
const KEYWORDS_FILE = "keywords.json";
const MESSAGES_FILE = "messages.json";

const TIMEOUT = 5000; // タイムアウト時間（ミリ秒）

// ファイルの読み込み（タイムアウト処理付き）
function readFileSafe(filename, defaultValue) {
    try {
        const data = fs.readFileSync(filename, "utf8");
        return JSON.parse(data);
    } catch (error) {
        return defaultValue;
    }
}

// ファイルの書き込み
function writeFileSafe(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

let permissions = readFileSafe(DATA_FILE, {});
let coins = readFileSafe(COINS_FILE, {});
let keywords = readFileSafe(KEYWORDS_FILE, {});
let messages = readFileSafe(MESSAGES_FILE, {});

app.post("/webhook", async (req, res) => {
    const events = req.body.events;
    for (const event of events) {
        if (event.type !== "message" || event.message.type !== "text") continue;
        
        const userId = event.source.userId;
        const replyToken = event.replyToken;
        const userMessage = event.message.text;
        
        if (!permissions[userId]) {
            permissions[userId] = "非権限者";
            coins[userId] = 20;
        }
        
        if (userMessage === "権限") {
            await sendReply(replyToken, `あなたの権限は「${permissions[userId]}」です。`);
        } else if (userMessage === "check") {
            await sendReply(replyToken, `あなたのIDは ${userId} です。`);
        } else if (userMessage === "コイン") {
            await sendReply(replyToken, `あなたの残コインは ${coins[userId]} コインです。`);
        } else if (userMessage === "スロット") {
            if (coins[userId] < 1) {
                await sendReply(replyToken, "コインが足りません。最高者に付与を依頼してください。");
            } else {
                coins[userId] -= 1;
                const result = Math.floor(Math.random() * 1000);
                let reward = 0;
                if ([111, 222, 333, 444, 555, 666, 888, 999].includes(result)) reward = 100;
                if (result === 777) reward = 777;
                coins[userId] += reward;
                await sendReply(replyToken, `スロット結果: ${result}\n${reward ? `おめでとうございます！${reward}コイン獲得！` : "ハズレ…"}\n残コイン: ${coins[userId]}`);
            }
        } else if (userMessage.startsWith("coingive:")) {
            if (permissions[userId] !== "最高者") return;
            const [_, targetId, amount] = userMessage.split(":");
            coins[targetId] = (coins[targetId] || 0) + parseInt(amount);
            await sendReply(replyToken, `${targetId} に ${amount} コイン付与しました。`);
        } else if (userMessage.startsWith("allcoingive:")) {
            if (permissions[userId] !== "最高者") return;
            const amount = parseInt(userMessage.split(":")[1]);
            for (const id in coins) coins[id] += amount;
            await sendReply(replyToken, `全員に ${amount} コイン付与しました。`);
        } else if (userMessage.startsWith("coinnotgive:")) {
            if (permissions[userId] !== "最高者") return;
            const [_, targetId, amount] = userMessage.split(":");
            coins[targetId] = Math.max(0, (coins[targetId] || 0) - parseInt(amount));
            await sendReply(replyToken, `${targetId} から ${amount} コイン剥奪しました。`);
        } else if (userMessage.startsWith("allcoinnotgive:")) {
            if (permissions[userId] !== "最高者") return;
            const amount = parseInt(userMessage.split(":")[1]);
            for (const id in coins) coins[id] = Math.max(0, coins[id] - amount);
            await sendReply(replyToken, `全員から ${amount} コイン剥奪しました。`);
        } else if (userMessage.startsWith("権限付与:")) {
            if (permissions[userId] !== "最高者") return;
            permissions[userMessage.split(":")[1]] = "権限者";
            await sendReply(replyToken, "権限を付与しました。");
        } else if (userMessage.startsWith("権限削除:")) {
            if (permissions[userId] !== "最高者") return;
            permissions[userMessage.split(":")[1]] = "非権限者";
            await sendReply(replyToken, "権限を削除しました。");
        } else if (userMessage.startsWith("key:")) {
            if (permissions[userId] !== "権限者" && permissions[userId] !== "最高者") return;
            const [_, key, response] = userMessage.split(":");
            keywords[key] = response;
            await sendReply(replyToken, "キーワード応答を設定しました。");
        } else if (userMessage.startsWith("notkey:")) {
            if (permissions[userId] !== "権限者" && permissions[userId] !== "最高者") return;
            delete keywords[userMessage.split(":")[1]];
            await sendReply(replyToken, "キーワード応答を削除しました。");
        } else if (userMessage === "おみくじ") {
            const results = ["大吉", "中吉", "小吉", "末吉", "凶"];
            const fortune = results[Math.floor(Math.random() * results.length)];
            await sendReply(replyToken, `おみくじ結果: ${fortune}`);
        } else if (keywords[userMessage]) {
            await sendReply(replyToken, keywords[userMessage]);
        }
    }
    writeFileSafe(DATA_FILE, permissions);
    writeFileSafe(COINS_FILE, coins);
    writeFileSafe(KEYWORDS_FILE, keywords);
    res.sendStatus(200);
});

async function sendReply(replyToken, message) {
    await axios.post("https://api.line.me/v2/bot/message/reply", {
        replyToken,
        messages: [{ type: "text", text: message }]
    }, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
}

app.listen(3000, () => console.log("Server is running on port 3000"));
