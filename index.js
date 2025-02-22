const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

// コインデータを読み込む
const loadCoins = () => {
    if (!fs.existsSync(COINS_FILE)) return {};
    return JSON.parse(fs.readFileSync(COINS_FILE, "utf-8"));
};

// コインデータを保存する
const saveCoins = (data) => {
    fs.writeFileSync(COINS_FILE, JSON.stringify(data, null, 2), "utf-8");
};

// おみくじの結果を定義
const fortunes = [
    "大吉",
    "吉",
    "中吉",
    "小吉",
    "凶"
];

// スロットを回す関数
const spinSlot = () => {
    return [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10)
    ];
};

// スロットの結果を判定する関数
const checkSlotResult = (slot) => {
    const slotString = slot.join('');
    if (slotString === '777') return 777;
    if (['111', '222', '333', '444', '555', '666', '888', '999'].includes(slotString)) return 100;
    return 0;
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const events = req.body.events;
    const coins = loadCoins(); // コイン情報を読み込む

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
                timeout: 5000
            });
        } catch (error) {
            console.error('エラー発生:', error);
        }
    };

    for (const event of events) {
        if (!event.replyToken) continue; 

        const replyToken = event.replyToken;
        const userId = event.source.userId;

        let replyText = null;

        if (event.type === "message" && event.message?.text) {
            const userMessage = event.message.text;

            // コイン確認
            if (userMessage === "coincheck") {
                replyText = `あなたのコイン: ${coins[userId] || 0} 枚`;
            }

            // コイン付与（全員）
            else if (userMessage.startsWith("Allcoingive:")) {
                const amount = parseInt(userMessage.split(":")[1]);

                if (!isNaN(amount) && amount > 0) {
                    Object.keys(coins).forEach(userId => {
                        coins[userId] = (coins[userId] || 0) + amount;
                    });
                    saveCoins(coins);

                    replyText = `全員に${amount}コインを付与しました。`;
                } else {
                    replyText = "無効なコイン数です。";
                }
            }

            // コイン付与（個人）
            else if (userMessage.startsWith("coingiveID:")) {
                const parts = userMessage.split(":");
                const targetUserId = parts[1];
                const amount = parseInt(parts[2]);

                if (!isNaN(amount) && amount > 0) {
                    coins[targetUserId] = (coins[targetUserId] || 0) + amount;
                    saveCoins(coins);

                    replyText = `${targetUserId}に${amount}コインを付与しました。`;
                } else {
                    replyText = "コインの数が不正です。";
                }
            }

            // おみくじ
            else if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果は「${fortune}」です！`;
            }

            // スロット
            else if (userMessage === "slot") {
                if (!coins[userId] || coins[userId] < 1) {
                    replyText = "コインが足りません！（1コイン必要）";
                } else {
                    coins[userId] -= 1; // 1コイン消費
                    const slotResult = spinSlot();
                    const reward = checkSlotResult(slotResult);
                    coins[userId] += reward; // 当たったら報酬を追加
                    saveCoins(coins);

                    replyText = `スロットの結果: ${slotResult.join(' ')}\n` +
                                (reward > 0 ? `おめでとう！ ${reward}コイン獲得！` : "はずれ！また挑戦してね！") +
                                `\nあなたの残りコイン: ${coins[userId]} 枚`;
                }
            }

            if (replyText) {
                await sendReply(replyToken, replyText);
            }
        }
    }
});

// サーバーを起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});