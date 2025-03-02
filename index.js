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
    } catch (error) {
        console.error("コインデータの読み込みエラー:", error);
        return {};
    }
};

// コインデータを保存する
const saveCoins = (data) => {
    try {
        fs.writeFileSync(COINS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        console.error("コインデータの保存エラー:", error);
    }
};

// 権限データを読み込む
const loadPermissions = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (error) {
        console.error("権限データの読み込みエラー:", error);
        return {};
    }
};

// 権限データを保存する
const savePermissions = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        console.error("権限データの保存エラー:", error);
    }
};

// 権限を取得する
const getUserRole = (userId) => {
    const permissions = loadPermissions();
    return permissions[userId] || "非権限者";  // 権限がない場合は「非権限者」
};

// メッセージ履歴を読み込む
const loadMessages = () => {
    try {
        if (!fs.existsSync(MESSAGE_LOG)) return {};
        return JSON.parse(fs.readFileSync(MESSAGE_LOG, "utf-8"));
    } catch (error) {
        console.error("メッセージ履歴の読み込みエラー:", error);
        return {};
    }
};

// メッセージ履歴を保存する
const saveMessages = (data) => {
    try {
        fs.writeFileSync(MESSAGE_LOG, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        console.error("メッセージ履歴の保存エラー:", error);
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
            // 「権限」コマンドの処理
            else if (userMessage === "権限") {
                replyText = `あなたの権限は: ${userRole}`;
            }
            // 「コイン」コマンドの処理
            else if (userMessage === "コイン") {
                const userCoins = coins[userId] || 0;
                replyText = `あなたの残りコイン: ${userCoins}`;
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
            // 「coingive:ID:数」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("coingive:") && userRole === "最高者") {
                const parts = userMessage.split(":");
                const targetUserId = parts[1];
                const amount = parseInt(parts[2]);

                if (!isNaN(amount) && amount > 0) {
                    const targetUserCoins = coins[targetUserId] || 0;
                    coins[targetUserId] = targetUserCoins + amount;
                    saveCoins(coins);
                    replyText = `${targetUserId}に${amount}コインを付与しました。`;
                } else {
                    replyText = "無効なコインの数量です。";
                }
            }
            // 「allcoingive:数」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("allcoingive:") && userRole === "最高者") {
                const amount = parseInt(userMessage.split(":")[1]);

                if (!isNaN(amount) && amount > 0) {
                    for (const user in coins) {
                        coins[user] += amount;
                    }
                    saveCoins(coins);
                    replyText = `全員に${amount}コインを付与しました。`;
                } else {
                    replyText = "無効なコインの数量です。";
                }
            }
            // 「coinnotgive:ID:数量」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("coinnotgive:") && userRole === "最高者") {
                const parts = userMessage.split(":");
                const targetUserId = parts[1];
                const amount = parseInt(parts[2]);

                if (!isNaN(amount) && amount > 0) {
                    const targetUserCoins = coins[targetUserId] || 0;
                    coins[targetUserId] = targetUserCoins - amount;
                    saveCoins(coins);
                    replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                } else {
                    replyText = "無効なコインの数量です。";
                }
            }
            // 「allcoinnotgive:数量」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("allcoinnotgive:") && userRole === "最高者") {
                const amount = parseInt(userMessage.split(":")[1]);

                if (!isNaN(amount) && amount > 0) {
                    for (const user in coins) {
                        coins[user] = Math.max(0, coins[user] - amount);
                    }
                    saveCoins(coins);
                    replyText = `全員から${amount}コインを剥奪しました。`;
                } else {
                    replyText = "無効なコインの数量です。";
                }
            }
            // 「権限付与:ID」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("権限付与:") && userRole === "最高者") {
                const targetUserId = userMessage.split(":")[1];
                const permissionsData = loadPermissions();
                permissionsData[targetUserId] = "権限者";  // 権限を付与
                savePermissions(permissionsData);

                replyText = `${targetUserId}に権限者の権限を付与しました。`;
            }
            // 「権限削除:ID」コマンドの処理 (最高者のみ)
            else if (userMessage.startsWith("権限削除:") && userRole === "最高者") {
                const targetUserId = userMessage.split(":")[1];
                const permissionsData = loadPermissions();
                permissionsData[targetUserId] = "非権限者";  // 権限を削除
                savePermissions(permissionsData);

                replyText = `${targetUserId}の権限を削除しました。`;
            }
            // 「say:ID:言葉」コマンドの処理 (権限者以上)
            else if (userMessage.startsWith("say:") && (userRole === "権限者" || userRole === "最高者")) {
                const parts = userMessage.split(":");
                const targetUserId = parts[1];
                const message = parts[2];

                messages[targetUserId] = message;  // 特定のユーザーに話す内容を設定
                saveMessages(messages);

                replyText = `${targetUserId}にメッセージ「${message}」を設定しました。`;
            }
            // 「notsay:ID」コマンドの処理 (権限者以上)
            else if (userMessage.startsWith("notsay:") && (userRole === "権限者" || userRole === "最高者")) {
                const targetUserId = userMessage.split(":")[1];
                delete messages[targetUserId];  // 特定のユーザーのメッセージを削除
                saveMessages(messages);

                replyText = `${targetUserId}のメッセージを削除しました。`;
            }
            // 「key:特定の言葉:応答内容」コマンドの処理 (権限者以上)
            else if (userMessage.startsWith("key:") && (userRole === "権限者" || userRole === "最高者")) {
                const parts = userMessage.split(":");
                const keyword = parts[1];
                const response = parts[2];

                messages[keyword] = response;  // 特定の言葉に対する応答を設定
                saveMessages(messages);

                replyText = `「${keyword}」に対する応答内容を設定しました。`;
            }
            // 「notkey:特定の言葉」コマンドの処理 (権限者以上)
            else if (userMessage.startsWith("notkey:") && (userRole === "権限者" || userRole === "最高者")) {
                const keyword = userMessage.split(":")[1];
                delete messages[keyword];  // 特定の言葉の応答を削除
                saveMessages(messages);

                replyText = `「${keyword}」に対する応答を削除しました。`;
            }
            // おみくじコマンド
            else if (userMessage === "おみくじ") {
                const result = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果は「${result}」です。`;
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