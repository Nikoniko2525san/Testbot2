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
    if (userId === adminUserId) return "最高者";  // 管理者を「最高者」とする
    const permissions = loadPermissions();
    return permissions[userId] || "非権限者";  // 権限がない場合は「非権限者」
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

// スロットを回す関数
const spinSlot = () => {
    const slot = [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10)
    ];
    return slot;
};

// スロットの結果を判定する関数
const checkSlotResult = (slot) => {
    const result = slot.join('');
    const specialResults = ['777', '111', '222', '333', '444', '555', '666', '888', '999'];
    
    if (result === '777') {
        return { message: "100コインの当たり", coins: 777 };
    }
    
    if (specialResults.includes(result)) {
        return { message: "100コインの当たり", coins: 100 };
    }
    
    return { message: "残念！", coins: 0 };
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);
    
    const events = req.body.events;
    const messages = loadMessages(); // メッセージ履歴を読み込む
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
                const rolesDescription = `最高者: 全ての権限が可能
権限者: ほとんどの権限が可能
非権限者: 普通の人`;
                replyText = rolesDescription;
            }
            // スロットコマンド
            else if (userMessage === "スロット") {
                const userCoins = coins[userId] || 0;
                
                if (userCoins <= 0) {
                    replyText = "コインがありません。";
                } else {
                    coins[userId] -= 1;  // 1コインを消費
                    const slot = spinSlot();
                    const result = checkSlotResult(slot);
                    coins[userId] += result.coins;  // 当たりに応じてコインを増加
                    saveCoins(coins); // コインデータを保存
                    replyText = `${slot.join(' ')}\n${result.message}\n残り${coins[userId]}コイン`;
                }
            }
            // 「〇〇coingiveid:ID」コマンド（コインを個別に増減）
            else if (userMessage.startsWith("coingiveid:") && userRole === "最高者") {
                const [_, amount, targetId] = userMessage.split(':');
                const coinAmount = parseInt(amount, 10);
                if (isNaN(coinAmount) || !targetId) {
                    replyText = "コマンドが正しくありません。";
                } else {
                    coins[targetId] = (coins[targetId] || 0) + coinAmount;
                    saveCoins(coins); // コインデータを保存
                    replyText = `${targetId}のコインが${coinAmount}コイン増えました。`;
                }
            }
            // 「〇〇Allcoingive」コマンド（全員にコインを増加）
            else if (userMessage.startsWith("Allcoingive") && userRole === "最高者") {
                const [_, amount] = userMessage.split(' ');
                const coinAmount = parseInt(amount, 10);
                if (isNaN(coinAmount)) {
                    replyText = "コマンドが正しくありません。";
                } else {
                    Object.keys(coins).forEach(userId => {
                        coins[userId] += coinAmount;
                    });
                    saveCoins(coins); // コインデータを保存
                    replyText = `全員に${coinAmount}コインが追加されました。`;
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