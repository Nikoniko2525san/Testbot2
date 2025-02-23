const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = "Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU="; // LINEアクセストークン
const ADMIN_USER_ID = "U9a952e1e4e8580107b52b5f5fd4f0ab3"; // 最高者のLINE ID

const DATA_FILE = "permissions.json"; // 権限データ
const COINS_FILE = "coins.json"; // コインデータ

// 権限の階層
const ROLES = {
    "最高者": 3,
    "中権限者": 2,
    "簡易者": 1,
    "非権限者": 0
};

// データ読み込み
const loadData = (file, defaultData) => {
    if (!fs.existsSync(file)) return defaultData;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
};

// データ保存
const saveData = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
};

const permissions = loadData(DATA_FILE, {});
const coins = loadData(COINS_FILE, {});

// タイムアウト防止
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);
    handleEvent(req.body.events);
});

const handleEvent = async (events) => {
    for (const event of events) {
        if (!event.replyToken) continue;
        const userId = event.source.userId;
        const message = event.message?.text || "";

        if (message === "check") {
            await sendReply(event.replyToken, `あなたのユーザーID: ${userId}`);
        } 
        else if (message === "権限") {
            const role = getRole(userId);
            await sendReply(event.replyToken, `あなたの権限は「${role}」です`);
        }
        else if (message === "権限確認") {
            await sendReply(event.replyToken, `権限の種類:\n最高者: すべての管理が可能\n中権限者: 権限の付与が可能\n簡易者: ゲームが利用可能\n非権限者: 制限あり`);
        }
        else if (message === "コイン") {
            await sendReply(event.replyToken, `あなたのコイン: ${coins[userId] || 0} 枚`);
        }
        else if (message === "おみくじ") {
            if (ROLES[getRole(userId)] < ROLES["簡易者"]) {
                await sendReply(event.replyToken, "あなたには利用権限がありません");
                return;
            }
            const results = ["大吉", "吉", "中吉", "小吉", "凶"];
            const result = results[Math.floor(Math.random() * results.length)];
            await sendReply(event.replyToken, `おみくじの結果: ${result}`);
        }
        else if (message.startsWith("権限付与ID:")) {
            if (ROLES[getRole(userId)] < ROLES["中権限者"]) return;
            const targetId = message.split(":")[1];
            if (targetId) {
                permissions[targetId] = "簡易者";
                saveData(DATA_FILE, permissions);
                await sendReply(event.replyToken, `${targetId}を簡易者にしました`);
            }
        }
        else if (message.startsWith("権限削除ID:")) {
            if (ROLES[getRole(userId)] < ROLES["最高者"]) return;
            const targetId = message.split(":")[1];
            if (targetId) {
                permissions[targetId] = "非権限者";
                saveData(DATA_FILE, permissions);
                await sendReply(event.replyToken, `${targetId}を非権限者にしました`);
            }
        }
        else if (message.startsWith("coingive:")) {
            if (userId !== ADMIN_USER_ID) return;
            const parts = message.split(":");
            const targetId = parts[1];
            const amount = parseInt(parts[2]);
            if (!isNaN(amount) && amount > 0) {
                coins[targetId] = (coins[targetId] || 0) + amount;
                saveData(COINS_FILE, coins);
                await sendReply(event.replyToken, `${targetId}に${amount}コインを付与しました`);
            }
        }
        else if (message.startsWith("coinnotgive:")) {
            if (userId !== ADMIN_USER_ID) return;
            const parts = message.split(":");
            const targetId = parts[1];
            const amount = parseInt(parts[2]);
            if (!isNaN(amount) && amount > 0 && coins[targetId]) {
                coins[targetId] = Math.max(0, coins[targetId] - amount);
                saveData(COINS_FILE, coins);
                await sendReply(event.replyToken, `${targetId}のコインを${amount}枚剥奪しました`);
            }
        }
        else if (message === "bot退出") {
            if (ROLES[getRole(userId)] < ROLES["中権限者"]) return;
            await leaveGroup(event.source.groupId);
        }
    }
};

const getRole = (userId) => permissions[userId] || "非権限者";

const sendReply = async (replyToken, text) => {
    await axios.post("https://api.line.me/v2/bot/message/reply", {
        replyToken,
        messages: [{ type: "text", text }]
    }, { headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` } });
};

app.listen(3000, () => console.log("Server running on port 3000"));