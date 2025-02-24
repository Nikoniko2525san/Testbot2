const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = "Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU=";
const DATA_FILE = "permissions.json";
const COINS_FILE = "coins.json";

const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3"; // 最高者のID

// データ読み込み
const loadData = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");

const permissions = loadData(DATA_FILE);
const coins = loadData(COINS_FILE);

// 権限チェック
const getPermissionLevel = (userId) => permissions[userId] || "非権限者";
const isSuperAdmin = (userId) => userId === adminUserId;
const isAdminOrHigher = (userId) => ["最高者", "中権限者"].includes(getPermissionLevel(userId));
const isSimplifiedOrHigher = (userId) => ["最高者", "中権限者", "簡易者"].includes(getPermissionLevel(userId));

// LINEメッセージ送信
const sendReply = async (replyToken, text) => {
    try {
        await axios.post("https://api.line.me/v2/bot/message/reply", {
            replyToken,
            messages: [{ type: "text", text }]
        }, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
            timeout: 5000
        });
    } catch (error) {
        console.error("エラー発生:", error);
    }
};

// Webhook
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    for (const event of req.body.events) {
        if (!event.replyToken || !event.source || !event.source.userId) continue;

        const { replyToken, source, message } = event;
        const userId = source.userId;
        const userMessage = message?.text;

        let replyText = null;

        if (!userMessage) continue;

        // 権限コマンド
        if (userMessage.startsWith("付与簡易:") && isAdminOrHigher(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "簡易者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} を簡易者にしました。`;
        } else if (userMessage.startsWith("削除簡易:") && isAdminOrHigher(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "非権限者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} を非権限者にしました。`;
        } else if (userMessage.startsWith("付与中権限:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "中権限者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} を中権限者にしました。`;
        } else if (userMessage.startsWith("削除中権限:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "非権限者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} の権限を削除しました。`;
        }

        // コインコマンド（最高者のみ）
        else if (userMessage.startsWith("coingive:") && isSuperAdmin(userId)) {
            const [_, targetId, amount] = userMessage.split(":");
            const numAmount = parseInt(amount);
            if (!isNaN(numAmount) && numAmount > 0) {
                coins[targetId] = (coins[targetId] || 0) + numAmount;
                saveData(COINS_FILE, coins);
                replyText = `${targetId} に ${numAmount} コインを付与しました。`;
            }
        } else if (userMessage.startsWith("coinnotgive:") && isSuperAdmin(userId)) {
            const [_, targetId, amount] = userMessage.split(":");
            const numAmount = parseInt(amount);
            if (!isNaN(numAmount) && numAmount > 0) {
                coins[targetId] = Math.max((coins[targetId] || 0) - numAmount, 0);
                saveData(COINS_FILE, coins);
                replyText = `${targetId} から ${numAmount} コインを剥奪しました。`;
            }
        }

        // ユーザー情報確認
        else if (userMessage === "check") {
            replyText = `あなたのユーザーID: ${userId}`;
        } else if (userMessage === "権限") {
            replyText = `あなたの権限: ${getPermissionLevel(userId)}`;
        } else if (userMessage === "コイン") {
            replyText = `あなたのコイン: ${coins[userId] || 0} 枚`;
        }

        // 遊び機能（簡易者以上）
        else if (userMessage === "おみくじ" && isSimplifiedOrHigher(userId)) {
            const fortunes = ["大吉", "吉", "中吉", "小吉", "凶"];
            replyText = `おみくじの結果は「${fortunes[Math.floor(Math.random() * fortunes.length)]}」です！`;
        } else if (userMessage === "スロット" && permissions(userId)) {
            if ((coins[userId] || 0) < 1) {
                replyText = "コインが足りません！（1コイン必要）";
            } else {
                coins[userId] -= 1;
                const slotResult = [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
                const reward = slotResult.every(v => v === 7) ? 777 : (slotResult[0] === slotResult[1] && slotResult[1] === slotResult[2] ? 100 : 0);
                coins[userId] += reward;
                saveData(COINS_FILE, coins);
                replyText = `スロットの結果: ${slotResult.join(' ')}\n${reward ? `おめでとう！ ${reward}コイン獲得！` : "はずれ！"}\nあなたの残りコイン: ${coins[userId]} 枚`;
            }
        }

        // Botの自動退出
        if (event.type === "join" && source.type === "group") {
            const hasAdmin = Object.values(permissions).includes("中権限者");
            if (!hasAdmin) {
                await axios.post("https://api.line.me/v2/bot/group/" + source.groupId + "/leave", {}, {
                    headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
                });
                return;
            }
        }

        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }
});

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));