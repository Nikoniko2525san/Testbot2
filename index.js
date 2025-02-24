const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = "Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU="; // LINE Access Token
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

// LINEメッセージ送信 (即座に返す処理)
const sendReply = async (replyToken, text) => {
    try {
        await axios.post("https://api.line.me/v2/bot/message/reply", {
            replyToken,
            messages: [{ type: "text", text }]
        }, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
            timeout: 5000 // タイムアウト設定（5000ミリ秒）
        });
    } catch (error) {
        console.error("送信エラー:", error);
    }
};

// 新規ユーザーへの初期コイン付与
const initializeUser = (userId) => {
    if (!(userId in coins)) {
        coins[userId] = 20; // 新規ユーザーに20コインを付与
        saveData(COINS_FILE, coins);
    }
};

// コインが0枚になった場合に補充案内
const checkCoinBalance = (userId, replyToken) => {
    if (coins[userId] <= 0) {
        sendReply(replyToken, "コインが足りません。コインの補充は、https://line.me/ti/p/RjFqRVVzDCにご連絡を");
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

        initializeUser(userId); // 新規ユーザーへのコイン初期化処理
        checkCoinBalance(userId, replyToken); // コインチェック

        if (!userMessage) continue;

        // 権限確認コマンド
        if (userMessage === "権限") {
            replyText = `あなたの権限は: ${getPermissionLevel(userId)} です。`;
        }

        // コイン残高確認コマンド
        else if (userMessage === "コイン") {
            replyText = `あなたのコイン残高は: ${coins[userId]} 枚です。`;
        }

        // ユーザーID確認コマンド
        else if (userMessage === "check") {
            replyText = `あなたのユーザーID: ${userId}`;
        }

        // スロットコマンド
        else if (userMessage.startsWith("スロット:") && isSimplifiedOrHigher(userId)) {
            const betAmount = parseInt(userMessage.split(":")[1]);

            if (isNaN(betAmount) || betAmount <= 0) {
                replyText = "かけるコインの金額は1以上でなければなりません。";
            } else if (betAmount > 20) {
                replyText = "コインの上限は20枚です。";
            } else if ((coins[userId] || 0) < betAmount) {
                replyText = "コインが足りません！（かけるコインが残高を超えています）";
            } else {
                coins[userId] -= betAmount;  // コインをかける
                const slotResult = [
                    Math.floor(Math.random() * 10),
                    Math.floor(Math.random() * 10),
                    Math.floor(Math.random() * 10)
                ];

                // スロットの当たり確率を低く設定
                const reward = slotResult.every(v => v === 7) ? 777 : 
                               (slotResult[0] === slotResult[1] && slotResult[1] === slotResult[2] ? 100 : 0);
                
                if (reward > 0) {
                    coins[userId] += reward;
                    replyText = `スロットの結果: ${slotResult.join(' ')}\nおめでとう！ ${reward} コイン獲得！\n残りコイン: ${coins[userId]} 枚`;
                } else {
                    replyText = `スロットの結果: ${slotResult.join(' ')}\nはずれ！\n残りコイン: ${coins[userId]} 枚`;
                }

                saveData(COINS_FILE, coins);
            }
        }

        // おみくじコマンド
        else if (userMessage === "おみくじ") {
            const fortunes = ["大吉", "中吉", "小吉", "吉", "凶"];
            const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            replyText = `あなたの運勢は: ${fortune}`;
        }

        // メンション相手のユーザーIDを取得 (check:@メンション)
        else if (userMessage.startsWith("check:@")) {
            const mentionedUserId = userMessage.split(":")[1];
            replyText = `メンションされたユーザーID: ${mentionedUserId}`;
        }

        // IDのユーザーの権限とコインの枚数を確認 (最高者のみ)
        else if (userMessage.startsWith("check:id:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[2];
            const permissionLevel = getPermissionLevel(targetId);
            const coinBalance = coins[targetId] || 0;
            replyText = `${targetId} の権限: ${permissionLevel}\nコイン残高: ${coinBalance} 枚`;
        }

        // 個別コイン付与 (最高者のみ)
        else if (userMessage.startsWith("coingive:") && isSuperAdmin(userId)) {
            const parts = userMessage.split(":");
            const targetId = parts[1];
            const amount = parseInt(parts[2]);

            if (!isNaN(amount) && amount > 0) {
                coins[targetId] = (coins[targetId] || 0) + amount;
                saveData(COINS_FILE, coins);
                replyText = `${targetId} に ${amount} コインを付与しました。`;
            } else {
                replyText = "無効なコインの額です。";
            }
        }

        // 全員にコイン付与 (最高者のみ)
        else if (userMessage.startsWith("coingiveall:") && isSuperAdmin(userId)) {
            const amount = parseInt(userMessage.split(":")[1]);

            if (!isNaN(amount) && amount > 0) {
                for (const targetId in coins) {
                    coins[targetId] += amount;
                }
                saveData(COINS_FILE, coins);
                replyText = `全てのユーザーに ${amount} コインを付与しました。`;
            } else {
                replyText = "無効なコインの額です。";
            }
        }

        // コイン剥奪 (最高者のみ)
        else if (userMessage.startsWith("coinnotgive:") && isSuperAdmin(userId)) {
            const parts = userMessage.split(":");
            const targetId = parts[1];
            const amount = parseInt(parts[2]);

            if (!isNaN(amount) && amount > 0 && coins[targetId] >= amount) {
                coins[targetId] -= amount;
                saveData(COINS_FILE, coins);
                replyText = `${targetId} から ${amount} コインを剥奪しました。`;
            } else {
                replyText = "無効なコインの額または不足しています。";
            }
        }

        // 全員からコイン剥奪 (最高者のみ)
        else if (userMessage.startsWith("coinnotgiveall:") && isSuperAdmin(userId)) {
            const amount = parseInt(userMessage.split(":")[1]);

            if (!isNaN(amount) && amount > 0) {
                for (const targetId in coins) {
                    coins[targetId] = Math.max(0, coins[targetId] - amount);
                }
                saveData(COINS_FILE, coins);
                replyText = `全てのユーザーから ${amount} コインを剥奪しました。`;
            } else {
                replyText = "無効なコインの額です。";
            }
        }

        // 簡易権限付与 (中権限者以上)
        else if (userMessage.startsWith("付与簡易:") && isAdminOrHigher(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "簡易者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} に簡易権限を付与しました。`;
        }

        // 簡易権限剥奪 (中権限者以上)
        else if (userMessage.startsWith("削除簡易:") && isAdminOrHigher(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "非権限者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} から簡易権限を剥奪しました。`;
        }

        // 権限者一覧
        else if (userMessage === "権限者一覧") {
            let list = "権限者一覧:\n";
            for (const userId in permissions) {
                list += `${userId}: ${permissions[userId]}\n`;
            }
            replyText = list;
        }

        if (replyText) {
            sendReply(replyToken, replyText);
        }
    }
});

app.listen(3000, () => console.log("LINE Bot Server is running on port 3000"));