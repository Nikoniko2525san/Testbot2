const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル
const SAY_FILE = "say.json"; // sayコマンド用の情報を保存するファイル

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

// sayコマンドデータを読み込む
const loadSay = () => {
    if (!fs.existsSync(SAY_FILE)) return {};
    return JSON.parse(fs.readFileSync(SAY_FILE, "utf-8"));
};

// sayコマンドデータを保存する
const saveSay = (data) => {
    fs.writeFileSync(SAY_FILE, JSON.stringify(data, null, 2), "utf-8");
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
    const sayData = loadSay(); // sayコマンド用データを読み込む

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
            // 0コインの時、アラート送信
            else if (userMessage === "コイン残高") {
                const userCoins = coins[userId] || 0;
                if (userCoins === 0) {
                    replyText = "コインが0です。最高者に言ってください。";
                } else {
                    replyText = `残りコイン: ${userCoins}Nコイン`;
                }
            }
            // おみくじ
            else if (userMessage === "おみくじ") {
                const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果は: ${randomFortune}`;
            }

            // 最高者だけが実行できるコマンド
            if (userRole === "最高者") {
                // コイン付与コマンド
                if (userMessage.startsWith("coingive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        const targetCoins = coins[targetUserId] || 0;
                        coins[targetUserId] = targetCoins + amount;
                        saveCoins(coins);
                        replyText = `${targetUserId}に${amount}Nコインを付与しました。`;
                    } else {
                        replyText = "無効なコマンドです。";
                    }
                }
                // 全てにコイン付与コマンド
                else if (userMessage.startsWith("allcoingive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (const user in coins) {
                            coins[user] += amount;
                        }
                        saveCoins(coins);
                        replyText = `全員に${amount}Nコインを付与しました。`;
                    } else {
                        replyText = "無効なコマンドです。";
                    }
                }
                // コイン剥奪コマンド
                else if (userMessage.startsWith("coinnotgive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        const targetCoins = coins[targetUserId] || 0;
                        if (targetCoins >= amount) {
                            coins[targetUserId] = targetCoins - amount;
                            saveCoins(coins);
                            replyText = `${targetUserId}から${amount}Nコインを剥奪しました。`;
                        } else {
                            replyText = `${targetUserId}は${amount}Nコインを持っていません。`;
                        }
                    } else {
                        replyText = "無効なコマンドです。";
                    }
                }
                // 全員からコイン剥奪
                else if (userMessage.startsWith("allcoinnotgive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (const user in coins) {
                            if (coins[user] >= amount) {
                                coins[user] -= amount;
                            }
                        }
                        saveCoins(coins);
                        replyText = `全員から${amount}Nコインを剥奪しました。`;
                    } else {
                        replyText = "無効なコマンドです。";
                    }
                }
                // 権限付与コマンド
                else if (userMessage.startsWith("権限付与:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "権限者";
                    savePermissions(permissions);
                    replyText = `${targetUserId}に権限者を付与しました。`;
                }
                // 権限削除コマンド
                else if (userMessage.startsWith("権限削除:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "非権限者";
                    savePermissions(permissions);
                    replyText = `${targetUserId}の権限を削除しました。`;
                }
            }

            // 権限者以上のユーザーが使えるコマンド（say, notsay）
            if (userRole === "権限者" || userRole === "最高者") {
                // sayコマンド
                if (userMessage.startsWith("say:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const message = parts.slice(2).join(":");
                    sayData[targetUserId] = message;
                    saveSay(sayData);
                    replyText = `${targetUserId}が話したら、「${message}」と言います。`;
                }
                // notsayコマンド
                else if (userMessage.startsWith("notsay:")) {
                    const targetUserId = userMessage.split(":")[1];
                    delete sayData[targetUserId];
                    saveSay(sayData);
                    replyText = `${targetUserId}の「say」設定を削除しました。`;
                }
            }
        }

        // replyTextが設定されていれば返信
        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }
});

// サーバーを開始する
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});