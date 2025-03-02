const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル
const SAY_LOG_FILE = "sayLog.json"; // sayコマンドのログ

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

// SAYコマンドのログを読み込む
const loadSayLog = () => {
    if (!fs.existsSync(SAY_LOG_FILE)) return {};
    return JSON.parse(fs.readFileSync(SAY_LOG_FILE, "utf-8"));
};

// SAYコマンドのログを保存する
const saveSayLog = (data) => {
    fs.writeFileSync(SAY_LOG_FILE, JSON.stringify(data, null, 2), "utf-8");
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

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);

    const events = req.body.events;
    const coins = loadCoins(); // コイン情報を読み込む
    const permissions = loadPermissions(); // 権限情報を読み込む
    const messages = loadMessages(); // メッセージ履歴を読み込む
    const sayLog = loadSayLog(); // SAYコマンドログを読み込む

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

            // コイン関連コマンド
            if (userMessage.startsWith("coingive:")) {
                if (userRole === "最高者") {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);

                    if (!isNaN(amount) && amount > 0) {
                        coins[targetUserId] = (coins[targetUserId] || 0) + amount; // コインを付与
                        saveCoins(coins);
                        replyText = `${targetUserId}に${amount}コインを付与しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                } else {
                    replyText = "このコマンドは最高者のみ実行できます。";
                }
            }

            if (userMessage.startsWith("allcoingive:")) {
                if (userRole === "最高者") {
                    const amount = parseInt(userMessage.split(":")[1]);

                    if (!isNaN(amount) && amount > 0) {
                        for (const userId in coins) {
                            coins[userId] += amount; // 全員にコインを付与
                        }
                        saveCoins(coins);
                        replyText = `全員に${amount}コインを付与しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                } else {
                    replyText = "このコマンドは最高者のみ実行できます。";
                }
            }

            if (userMessage.startsWith("coinnotgive:")) {
                if (userRole === "最高者") {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);

                    if (!isNaN(amount) && amount > 0) {
                        coins[targetUserId] = (coins[targetUserId] || 0) - amount; // コインを剥奪
                        saveCoins(coins);
                        replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                } else {
                    replyText = "このコマンドは最高者のみ実行できます。";
                }
            }

            if (userMessage.startsWith("allcoinnotgive:")) {
                if (userRole === "最高者") {
                    const amount = parseInt(userMessage.split(":")[1]);

                    if (!isNaN(amount) && amount > 0) {
                        for (const userId in coins) {
                            coins[userId] -= amount; // 全員からコインを剥奪
                        }
                        saveCoins(coins);
                        replyText = `全員から${amount}コインを剥奪しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                } else {
                    replyText = "このコマンドは最高者のみ実行できます。";
                }
            }

            // SAYコマンド
            if (userMessage.startsWith("say:")) {
                if (userRole !== "非権限者") {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const phrase = parts.slice(2).join(":");

                    sayLog[targetUserId] = phrase; // SAYログを保存
                    saveSayLog(sayLog);
                    replyText = `${targetUserId}が話すと、「${phrase}」と言います。`;
                } else {
                    replyText = "このコマンドは権限者以上のみ実行できます。";
                }
            }

            // NOTSAYコマンド
            if (userMessage.startsWith("notsay:")) {
                if (userRole !== "非権限者") {
                    const targetUserId = userMessage.split(":")[1];

                    delete sayLog[targetUserId]; // SAYログを削除
                    saveSayLog(sayLog);
                    replyText = `${targetUserId}が話しても何も言わなくなります。`;
                } else {
                    replyText = "このコマンドは権限者以上のみ実行できます。";
                }
            }

            // 0コインのユーザーへのメッセージ
            if (coins[userId] === 0) {
                replyText = "コインが不足しています。最高者に言ってください。";
            }

            // おみくじ
            if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじ結果: ${fortune}`;
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