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
    try {
        if (!fs.existsSync(COINS_FILE)) return {};
        return JSON.parse(fs.readFileSync(COINS_FILE, "utf-8"));
    } catch (err) {
        console.error("ファイル読み込みエラー:", err);
        return {};
    }
};

// コインデータを保存する
const saveCoins = (data) => {
    try {
        fs.writeFileSync(COINS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
        console.error("ファイル保存エラー:", err);
    }
};

// 権限データを読み込む
const loadPermissions = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (err) {
        console.error("ファイル読み込みエラー:", err);
        return {};
    }
};

// 権限データを保存する
const savePermissions = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
        console.error("ファイル保存エラー:", err);
    }
};

// 権限を取得する
const getUserRole = (userId) => {
    if (userId === adminUserId) return "最高者";  // 管理者を「最高者」とする
    const permissions = loadPermissions();
    return permissions[userId] || "非権限者";  // 権限がない場合は「非権限者」
};

// メッセージ履歴を読み込む
const loadMessages = () => {
    try {
        if (!fs.existsSync(MESSAGE_LOG)) return {};
        return JSON.parse(fs.readFileSync(MESSAGE_LOG, "utf-8"));
    } catch (err) {
        console.error("ファイル読み込みエラー:", err);
        return {};
    }
};

// メッセージ履歴を保存する
const saveMessages = (data) => {
    try {
        fs.writeFileSync(MESSAGE_LOG, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
        console.error("ファイル保存エラー:", err);
    }
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
            const userMessage = event.message.text;

            // メッセージを記録
            messages[event.message.id] = userMessage;
            saveMessages(messages);

            // 「check」コマンドの処理
            if (userMessage === "check") {
                replyText = `あなたのIDは: ${userId}`;
            } 
            // 「コイン」コマンドの処理
            else if (userMessage === "コイン") {
                replyText = `あなたの残りコイン: ${coins[userId] || 0}コイン`;
            }
            // 「スロット」コマンドの処理
            else if (userMessage === "スロット") {
                const userCoins = coins[userId] || 0;

                if (userCoins < 1) {
                    replyText = "コインが足りません。";
                } else {
                    coins[userId] = userCoins - 1; // コインを1つ消費
                    const slot = spinSlot();
                    const result = checkSlotResult(slot);

                    coins[userId] += result; // 結果に応じてコインを加算
                    saveCoins(coins);

                    replyText = `スロット結果: ${slot.join(" | ")}\nあなたの残りコイン: ${coins[userId]}\n${result > 0 ? `おめでとうございます！${result}コインゲット！` : "残念、次回頑張ってください！"}`;
                }
            }
            // 「おみくじ」コマンドの処理
            else if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `あなたのおみくじの結果は: ${fortune}`;
            }

            // 最高者だけができるコマンド
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
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                }

                // 全てのコインを付与
                if (userMessage.startsWith("allcoingive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);

                    if (!isNaN(amount) && amount > 0) {
                        Object.keys(coins).forEach(user => {
                            coins[user] += amount;
                        });
                        saveCoins(coins);

                        replyText = `全員に${amount}コインを付与しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                }

                // 個人にコインを剥奪
                if (userMessage.startsWith("coinnotgive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);

                    if (!isNaN(amount) && amount > 0) {
                        if (coins[targetUserId] >= amount) {
                            coins[targetUserId] -= amount;
                            saveCoins(coins);

                            replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                        } else {
                            replyText = `${targetUserId}には${amount}コインが足りません。`;
                        }
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                }

                // 全てのコインを剥奪
                if (userMessage.startsWith("allcoinnotgive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);

                    if (!isNaN(amount) && amount > 0) {
                        Object.keys(coins).forEach(user => {
                            coins[user] -= amount;
                        });
                        saveCoins(coins);

                        replyText = `全員から${amount}コインを剥奪しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                }

                // 特定のIDが話す言葉を設定
                if (userMessage.startsWith("say:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const words = parts.slice(2).join(":");

                    messages[targetUserId] = words;
                    saveMessages(messages);

                    replyText = `${targetUserId}が話す言葉を「${words}」に設定しました。`;
                }

                // 特定のIDの言葉を削除
                if (userMessage.startsWith("notsay:")) {
                    const targetUserId = userMessage.split(":")[1];

                    if (messages[targetUserId]) {
                        delete messages[targetUserId];
                        saveMessages(messages);

                        replyText = `${targetUserId}の話した言葉を削除しました。`;
                    } else {
                        replyText = `${targetUserId}の話した言葉は存在しません。`;
                    }
                }
            }

            // 0コインになった場合
            if (coins[userId] === 0) {
                replyText = "あなたのコインが0になりました。最高者にお願いしてください。";
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