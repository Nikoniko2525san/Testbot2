const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = "Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU"; // LINE Access Token
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

// LINEメッセージ送信 (タイムアウト対策)
const sendReply = async (replyToken, text) => {
    try {
        await axios.post("https://api.line.me/v2/bot/message/reply", {
            replyToken,
            messages: [{ type: "text", text }]
        }, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
            timeout: 30000 // タイムアウト設定（15000ミリ秒）
        });
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error("タイムアウトエラー:", error.message);
            // タイムアウト発生時のリトライ処理
            setTimeout(async () => {
                try {
                    await axios.post("https://api.line.me/v2/bot/message/reply", {
                        replyToken,
                        messages: [{ type: "text", text }]
                    }, {
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
                        timeout: 30000
                    });
                } catch (retryError) {
                    console.error("再試行失敗:", retryError);
                }
            }, 10000); // 2秒後にリトライ
        } else {
            console.error("送信エラー:", error);
        }
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

        // 送信取り消しされた場合
        if (event.type === "message" && message.type === "text" && message.isCancelled) {
            replyText = `送信取り消しされた内容: "${message.text}"`;
        }

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

        // 個別コイン剥奪 (最高者のみ)
        else if (userMessage.startsWith("coinnotgive:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[1];
            const amount = parseInt(userMessage.split(":")[2]);

            if (!isNaN(amount) && amount > 0 && coins[targetId] >= amount) {
                coins[targetId] -= amount;
                saveData(COINS_FILE, coins);
                replyText = `${targetId} から ${amount} コインを剥奪しました。`;
            } else {
                replyText = "無効なコインの額か、コインが不足しています。";
            }
        }

        // 全員のコイン剥奪 (最高者のみ)
        else if (userMessage.startsWith("coinnotgiveall:") && isSuperAdmin(userId)) {
            const amount = parseInt(userMessage.split(":")[1]);

            if (!isNaN(amount) && amount > 0) {
                for (const targetId in coins) {
                    coins[targetId] -= amount;
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
            if (permissions[targetId] === "簡易者") {
                delete permissions[targetId];
                saveData(DATA_FILE, permissions);
                replyText = `${targetId} から簡易権限を剥奪しました。`;
            } else {
                replyText = "そのユーザーは簡易権限を持っていません。";
            }
        }

        // 中権限者付与 (最高者のみ)
        else if (userMessage.startsWith("付与中権限:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[1];
            permissions[targetId] = "中権限者";
            saveData(DATA_FILE, permissions);
            replyText = `${targetId} に中権限を付与しました。`;
        }

        // 中権限者剥奪 (最高者のみ)
        else if (userMessage.startsWith("削除中権限:") && isSuperAdmin(userId)) {
            const targetId = userMessage.split(":")[1];
            if (permissions[targetId] === "中権限者") {
                delete permissions[targetId];
                saveData(DATA_FILE, permissions);
                replyText = `${targetId} から中権限を剥奪しました。`;
            } else {
                replyText = "そのユーザーは中権限を持っていません。";
            }
        }

        // 権限者一覧コマンド
        else if (userMessage === "権限者一覧") {
            let usersWithPermissions = [];
            for (const [id, permission] of Object.entries(permissions)) {
                usersWithPermissions.push(`${id}: ${permission}`);
            }
            replyText = `権限者一覧:\n${usersWithPermissions.join("\n")}`;
        }

        // じゃんけんコマンド
        else if (userMessage === "じゃんけん") {
            const choices = ["グー", "チョキ", "パー"];
            const userChoice = choices[Math.floor(Math.random() * 3)];
            const botChoice = choices[Math.floor(Math.random() * 3)];
            let result = "あいこ";
            if ((userChoice === "グー" && botChoice === "チョキ") ||
                (userChoice === "チョキ" && botChoice === "パー") ||
                (userChoice === "パー" && botChoice === "グー")) {
                result = "あなたの勝ち";
            } else if (userChoice !== botChoice) {
                result = "あなたの負け";
            }
            replyText = `あなたの選択: ${userChoice}\nBotの選択: ${botChoice}\n結果: ${result}`;
        }

        // AIとの会話 (簡易権限以上)
        else if (userMessage.startsWith("talk:") && isSimplifiedOrHigher(userId)) {
            const topic = userMessage.split(":")[1];
            replyText = `AIと「${topic}」について話しています...`;
        }

        // メンション相手のユーザーIDを取得
        else if (userMessage.startsWith("check:@") && isSimplifiedOrHigher(userId)) {
            const mentionedUserId = userMessage.split(":")[1];
            replyText = `メンション相手のユーザーID: ${mentionedUserId}`;
        }

        // 応答が設定されていない場合のデフォルトメッセージ
        if (replyText) {
            sendReply(replyToken, replyText);
        }
    }
});

app.listen(3000, () => {
    console.log("LINE Bot is running...");
});