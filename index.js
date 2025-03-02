const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル
const KEYWORDS_FILE = "keywords.json"; // キーワード応答を保存するファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

// タイムアウト付きのファイル読み込み関数
const loadFileWithTimeout = (filePath, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('タイムアウト'), timeout);
        fs.readFile(filePath, "utf-8", (err, data) => {
            clearTimeout(timer);
            if (err) return reject(err);
            try {
                resolve(JSON.parse(data));
            } catch (parseError) {
                reject('パースエラー');
            }
        });
    });
};

// ファイルへの書き込み関数
const saveToFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        console.error("ファイル保存エラー:", error);
    }
};

// 権限データを読み込む
const loadPermissions = async () => {
    try {
        return await loadFileWithTimeout(DATA_FILE);
    } catch (error) {
        return {}; // エラーが発生した場合は空のオブジェクトを返す
    }
};

// コインデータを読み込む
const loadCoins = async () => {
    try {
        return await loadFileWithTimeout(COINS_FILE);
    } catch (error) {
        return {}; // エラーが発生した場合は空のオブジェクトを返す
    }
};

// キーワード応答データを読み込む
const loadKeywords = async () => {
    try {
        return await loadFileWithTimeout(KEYWORDS_FILE);
    } catch (error) {
        return {}; // エラーが発生した場合は空のオブジェクトを返す
    }
};

// 権限を取得する
const getUserRole = (userId) => {
    return permissions[userId] || "非権限者";  // 権限がない場合は「非権限者」
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    // 最初に200 OKを返す
    res.sendStatus(200);

    const events = req.body.events;
    const coins = await loadCoins(); // コイン情報を読み込む
    const permissions = await loadPermissions(); // 権限情報を読み込む
    const keywords = await loadKeywords(); // キーワード情報を読み込む
    const messages = await loadMessages(); // メッセージ履歴を読み込む

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

            // キーワード応答
            if (keywords[userMessage]) {
                replyText = keywords[userMessage];
            }

            // メッセージを記録
            messages[event.message.id] = userMessage;
            saveToFile(MESSAGE_LOG, messages);

            // 権限コマンド
            if (userMessage === "権限") {
                replyText = `あなたの権限は: ${userRole}`;
            } 
            // checkコマンド
            else if (userMessage === "check") {
                replyText = `あなたのIDは: ${userId}`;
            }
            // コインコマンド
            else if (userMessage === "コイン") {
                replyText = `あなたの残りコインは: ${coins[userId] || 0}`;
            }
            // スロットコマンド
            else if (userMessage === "スロット") {
                const userCoins = coins[userId] || 0;

                if (userCoins < 1) {
                    replyText = "コインが足りません。";
                } else {
                    coins[userId] = userCoins - 1; // コインを1つ消費
                    const slot = spinSlot();
                    const result = checkSlotResult(slot);

                    coins[userId] += result; // 結果に応じてコインを加算
                    saveToFile(COINS_FILE, coins);

                    replyText = `スロット結果: ${slot.join(" | ")}\nあなたの残りコイン: ${coins[userId]}\n${result > 0 ? `おめでとうございます！${result}コインゲット！` : "残念、次回頑張ってください！"}`;
                }
            }

            // おみくじコマンド
            else if (userMessage === "おみくじ") {
                const result = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果: ${result}`;
            }

            // 0コインのユーザーにメッセージを表示
            else if (coins[userId] === 0) {
                replyText = "コインが足りません。最高者に言ってください。";
            }

            // 最高者のみ権限付与・削除
            else if (userRole === "最高者") {
                if (userMessage.startsWith("権限付与:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "権限者";
                    saveToFile(DATA_FILE, permissions);
                    replyText = `${targetUserId}に権限を付与しました。`;
                }
                else if (userMessage.startsWith("権限削除:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "非権限者";
                    saveToFile(DATA_FILE, permissions);
                    replyText = `${targetUserId}の権限を削除しました。`;
                }

                if (userMessage.startsWith("coingive:")) {
                    const [_, targetUserId, amount] = userMessage.split(":");
                    coins[targetUserId] = (coins[targetUserId] || 0) + parseInt(amount);
                    saveToFile(COINS_FILE, coins);
                    replyText = `${targetUserId}に${amount}コインを付与しました。`;
                }

                if (userMessage.startsWith("coinnotgive:")) {
                    const [_, targetUserId, amount] = userMessage.split(":");
                    coins[targetUserId] = (coins[targetUserId] || 0) - parseInt(amount);
                    saveToFile(COINS_FILE, coins);
                    replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                }

                if (userMessage.startsWith("allcoingive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    for (const targetUserId in coins) {
                        coins[targetUserId] += amount;
                    }
                    saveToFile(COINS_FILE, coins);
                    replyText = `全員に${amount}コインを付与しました。`;
                }

                if (userMessage.startsWith("allcoinnotgive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    for (const targetUserId in coins) {
                        coins[targetUserId] -= amount;
                    }
                    saveToFile(COINS_FILE, coins);
                    replyText = `全員から${amount}コインを剥奪しました。`;
                }
            }

            // じゃんけん
            else if (userMessage === "じゃんけん") {
                const handOptions = ["グー", "チョキ", "パー"];
                const userHand = handOptions[Math.floor(Math.random() * 3)];
                const botHand = handOptions[Math.floor(Math.random() * 3)];

                replyText = `あなたの手: ${userHand}\nBotの手: ${botHand}\n結果: ${getJankenResult(userHand, botHand)}`;
            }

            // 権限者以上
            if (userRole === "権限者" || userRole === "最高者") {
                if (userMessage.startsWith("say:")) {
                    const [_, targetId, message] = userMessage.split(":");
                    messages[targetId] = message;
                    saveToFile(MESSAGE_LOG, messages);
                    replyText = `${targetId}のメッセージを設定しました。`;
                }
            }

            // 最終返信
            if (replyText) {
                await sendReply(replyToken, replyText);
            }
        }
    }
});

// じゃんけんの結果を返す関数
function getJankenResult(userHand, botHand) {
    if (userHand === botHand) return "引き分け";
    if ((userHand === "グー" && botHand === "チョキ") || 
        (userHand === "チョキ" && botHand === "パー") || 
        (userHand === "パー" && botHand === "グー")) return "勝ち";
    return "負け";
}

// スロットを回す
function spinSlot() {
    return [Math.floor(Math.random() * 7), Math.floor(Math.random() * 7), Math.floor(Math.random() * 7)];
}

// スロットの結果を確認する
function checkSlotResult(slot) {
    const [a, b, c] = slot;
    if (a === b && b === c) {
        if (a === 7) return 777;
        return 10; // その他の同じ数字は10コイン
    }
    return 0; // 当たりなし
}

// サーバーを起動
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});