const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル
const KEYWORDS_FILE = "keywords.json"; // キーワード応答のファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

// コインデータを読み込む
const loadCoins = () => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(COINS_FILE)) {
            resolve({});
        } else {
            fs.readFile(COINS_FILE, "utf-8", (err, data) => {
                if (err) reject(err);
                else resolve(JSON.parse(data));
            });
        }
    });
};

// コインデータを保存する
const saveCoins = (data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(COINS_FILE, JSON.stringify(data, null, 2), "utf-8", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// 権限データを読み込む
const loadPermissions = () => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(DATA_FILE)) {
            resolve({});
        } else {
            fs.readFile(DATA_FILE, "utf-8", (err, data) => {
                if (err) reject(err);
                else resolve(JSON.parse(data));
            });
        }
    });
};

// 権限データを保存する
const savePermissions = (data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// キーワード応答データを読み込む
const loadKeywords = () => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(KEYWORDS_FILE)) {
            resolve({});
        } else {
            fs.readFile(KEYWORDS_FILE, "utf-8", (err, data) => {
                if (err) reject(err);
                else resolve(JSON.parse(data));
            });
        }
    });
};

// キーワード応答データを保存する
const saveKeywords = (data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(KEYWORDS_FILE, JSON.stringify(data, null, 2), "utf-8", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// 権限を取得する
const getUserRole = (userId) => {
    return loadPermissions().then((permissions) => {
        if (userId === adminUserId) return "最高者";  // 管理者を「最高者」とする
        return permissions[userId] || "非権限者";  // 権限がない場合は「非権限者」
    });
};

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

// おみくじの結果を定義
const fortunes = [
    "大吉",
    "吉",
    "中吉",
    "小吉",
    "凶"
];

// メッセージ応答処理
const handleKeywords = (text) => {
    return loadKeywords().then((keywords) => {
        for (let key in keywords) {
            if (text.includes(key)) {
                return keywords[key];
            }
        }
        return null;
    });
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const events = req.body.events;
    const coins = await loadCoins();
    const permissions = await loadPermissions();
    const keywords = await loadKeywords();

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
        const userRole = await getUserRole(userId);

        let replyText = null;

        // メッセージ受信イベント
        if (event.type === "message" && event.message?.text) {
            const userMessage = event.message.text;

            // 「権限」コマンドの処理
            if (userMessage === "権限") {
                replyText = `あなたの権限は: ${userRole}`;
            }
            // 「check」コマンドの処理
            else if (userMessage === "check") {
                replyText = `あなたのIDは: ${userId}`;
            }
            // 「コイン」コマンドの処理
            else if (userMessage === "コイン") {
                const userCoins = coins[userId] || 0;
                replyText = `あなたの残コイン: ${userCoins}`;
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
                    await saveCoins(coins);

                    replyText = `スロット結果: ${slot.join(" | ")}\nあなたの残りコイン: ${coins[userId]}\n${result > 0 ? `おめでとうございます！${result}コインゲット！` : "残念、次回頑張ってください！"}`;
                }
            }

            // 「おみくじ」コマンドの処理
            else if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果は: ${fortune}`;
            }

            // 最高者だけができるコマンド
            else if (userRole === "最高者") {
                // 個人コイン付与
                if (userMessage.startsWith("coingive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        coins[targetUserId] = (coins[targetUserId] || 0) + amount;
                        await saveCoins(coins);
                        replyText = `${targetUserId}に${amount}コインを付与しました。`;
                    }
                }
                // 全てのコイン付与
                else if (userMessage.startsWith("allcoingive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (const targetUserId in coins) {
                            coins[targetUserId] = (coins[targetUserId] || 0) + amount;
                        }
                        await saveCoins(coins);
                        replyText = `${amount}コインを全員に付与しました。`;
                    }
                }
                // 個人コイン剥奪
                else if (userMessage.startsWith("coinnotgive:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);
                    if (!isNaN(amount) && amount > 0) {
                        coins[targetUserId] = Math.max((coins[targetUserId] || 0) - amount, 0);
                        await saveCoins(coins);
                        replyText = `${targetUserId}から${amount}コインを剥奪しました。`;
                    }
                }
                // 全てのコイン剥奪
                else if (userMessage.startsWith("allcoinnotgive:")) {
                    const amount = parseInt(userMessage.split(":")[1]);
                    if (!isNaN(amount) && amount > 0) {
                        for (const targetUserId in coins) {
                            coins[targetUserId] = Math.max((coins[targetUserId] || 0) - amount, 0);
                        }
                        await saveCoins(coins);
                        replyText = `${amount}コインを全員から剥奪しました。`;
                    }
                }
                // 権限付与
                else if (userMessage.startsWith("権限付与:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "権限者";
                    await savePermissions(permissions);
                    replyText = `${targetUserId}に権限者を付与しました。`;
                }
                // 権限削除
                else if (userMessage.startsWith("権限削除:")) {
                    const targetUserId = userMessage.split(":")[1];
                    permissions[targetUserId] = "非権限者";
                    await savePermissions(permissions);
                    replyText = `${targetUserId}の権限を削除しました。`;
                }
            }

            // 権限者以上ができるコマンド
            else if (userRole === "権限者" || userRole === "最高者") {
                // 特定IDにメッセージ送信
                if (userMessage.startsWith("say:")) {
                    const parts = userMessage.split(":");
                    const targetUserId = parts[1];
                    const message = parts.slice(2).join(":");
                    keywords[targetUserId] = message;
                    await saveKeywords(keywords);
                    replyText = `${targetUserId}に「${message}」を送信するように設定しました。`;
                }
                // 特定IDのメッセージ削除
                else if (userMessage.startsWith("notsay:")) {
                    const targetUserId = userMessage.split(":")[1];
                    delete keywords[targetUserId];
                    await saveKeywords(keywords);
                    replyText = `${targetUserId}のメッセージ設定を削除しました。`;
                }
                // キーワード応答設定
                else if (userMessage.startsWith("key:")) {
                    const parts = userMessage.split(":");
                    const key = parts[1];
                    const response = parts.slice(2).join(":");
                    keywords[key] = response;
                    await saveKeywords(keywords);
                    replyText = `キーワード「${key}」に対する応答を「${response}」に設定しました。`;
                }
                // キーワード応答削除
                else if (userMessage.startsWith("notkey:")) {
                    const key = userMessage.split(":")[1];
                    delete keywords[key];
                    await saveKeywords(keywords);
                    replyText = `キーワード「${key}」の応答設定を削除しました。`;
                }
            }
        }

        // キーワード応答の処理
        if (replyText === null) {
            replyText = await handleKeywords(event.message.text);
        }

        // 返信メッセージ
        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }
});

// サーバーの起動
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});