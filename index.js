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
    const slotString = slot.join('');
    if (slotString === '777') return 777;
    if (['111', '222', '333', '444', '555', '666', '888', '999'].includes(slotString)) return 100;
    return 0;
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);

    const events = req.body.events;
    const coins = loadCoins(); // コイン情報を読み込む
    const permissions = loadPermissions(); // 権限情報を読み込む
    const messages = loadMessages(); // メッセージ履歴を読み込む

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
                timeout: 10000 // タイムアウトを10秒に設定
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
            const userMessage = event.message.text;

            // メッセージを記録
            messages[event.message.id] = userMessage;
            saveMessages(messages);

            // 「check」コマンドの処理
            if (userMessage === "check") {
                replyText = `あなたのIDは: ${userId}`;
            } 
            // 「権限」コマンドの処理
            else if (userMessage === "権限") {
                replyText = `あなたの権限は: ${userRole}`;
            }
            // 0コインの人への警告
            else if (userMessage === "コイン確認") {
                const userCoins = coins[userId] || 0;
                if (userCoins === 0) {
                    replyText = "コインが0です。最高者に付与を依頼してください。";
                } else {
                    replyText = `あなたの残りコイン: ${userCoins}`;
                }
            }
            // おみくじコマンド
            else if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果: ${fortune}`;
            }

            // 最高者のみ実行できるコマンド
            if (userRole === "最高者") {
                // 個人にコインを付与
                if (userMessage.startsWith("coingive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        coins[targetUserId] = (coins[targetUserId] || 0) + amount;
                        saveCoins(coins);
                        replyText = `${targetUserId}に${amount}コインを付与しました。`;
                    }
                }
                // 全員にコインを付与
                else if (userMessage.startsWith("allcoingive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (let id in coins) {
                            coins[id] = (coins[id] || 0) + amount;
                        }
                        saveCoins(coins);
                        replyText = `全員に${amount}コインを付与しました。`;
                    }
                }
                // 個人にコインを剥奪
                else if (userMessage.startsWith("coinnotgive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        const targetCoins = coins[targetUserId] || 0;
                        if (targetCoins >= amount) {
                            coins[targetUserId] -= amount;
                            saveCoins(coins);
                            replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                        } else {
                            replyText = `${targetUserId}には${amount}コイン以上がありません。`;
                        }
                    }
                }
                // 全員からコインを剥奪
                else if (userMessage.startsWith("allcoinnotgive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (let id in coins) {
                            if (coins[id] >= amount) {
                                coins[id] -= amount;
                            } else {
                                coins[id] = 0;
                            }
                        }
                        saveCoins(coins);
                        replyText = `全員から${amount}コインを剥奪しました。`;
                    }
                }
                // 権限付与
                else if (userMessage.startsWith("権限付与:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "権限者";  // 権限を付与
                    savePermissions(permissions);
                    replyText = `${targetUserId}に権限者の権限を付与しました。`;
                }
                // 権限削除
                else if (userMessage.startsWith("権限削除:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "非権限者";  // 権限を削除
                    savePermissions(permissions);
                    replyText = `${targetUserId}の権限を削除しました。`;
                }
            }

            // 権限者以上ができる「say」コマンド
            if (userRole === "権限者" || userRole === "最高者") {
                if (userMessage.startsWith("say:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const message = parts.slice(2).join(":");
                    messages[targetUserId] = message;
                    saveMessages(messages);
                    replyText = `${targetUserId}に対して「${message}」と話すように設定しました。`;
                }

                // 「notsay」コマンド
                else if (userMessage.startsWith("notsay:")) {
                    const targetUserId = userMessage.split(":")[1];
                    delete messages[targetUserId];
                    saveMessages(messages);
                    replyText = `${targetUserId}の発言を削除しました。`;
                }
            }
        }

        // 返信
        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }
});

// サーバーを開始する
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});