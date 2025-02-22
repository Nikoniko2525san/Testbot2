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
                // 「おみくじ」コマンドの処理
        else if (userMessage === "おみくじ") {
            if (userRole === "admin" || userRole === "moderator") {
                replyText = `あなたの運勢は「${fortunes[Math.floor(Math.random() * fortunes.length)]}」です！`;
            } else {
                replyText = "このコマンドを使う権限がありません。";
            }
        } else {
            replyText = `あなたのメッセージ: ${userMessage}`;
        }
            // 「権限一覧」コマンドの処理
            else if (userMessage === "権限一覧") {
                const rolesDescription = `最高者: 全ての権限が可能
権限者: ほとんどの権限が可能
非権限者: 普通の人`;
                replyText = rolesDescription;
            }
            // 「権限付与ID:〇〇」コマンドの処理
            else if (userMessage.startsWith("権限付与ID:")) {
                if (userRole === "最高者") {
                    const targetUserId = userMessage.split(':')[1];
                    const permissionsData = loadPermissions();
                    permissionsData[targetUserId] = "権限者";  // 権限を付与
                    savePermissions(permissionsData);

                    replyText = `${targetUserId}に権限者の権限を付与しました。`;
                } else {
                    replyText = "権限付与を行うには「最高者」の権限が必要です。";
                }
            }

            // 「権限削除ID:〇〇」コマンドの処理
            else if (userMessage.startsWith("権限削除ID:")) {
                if (userRole === "最高者") {
                    const targetUserId = userMessage.split(':')[1];
                    const permissionsData = loadPermissions();
                    permissionsData[targetUserId] = "非権限者";  // 権限を削除
                    savePermissions(permissionsData);

                    replyText = `${targetUserId}の権限を削除しました。`;
                } else {
                    replyText = "権限削除を行うには「最高者」の権限が必要です。";
                }
            }

            // スロットコマンドの処理
            else if (userMessage === "スロット") {
                const userCoins = coins[userId] || 0;

                if (userCoins < 1) {
                    replyText = "コインが足りません。スロットを回すには1コイン必要です。";
                } else {
                    const slot = spinSlot();
                    const result = checkSlotResult(slot);
                    let prize = 0;

                    if (result === 777) {
                        prize = 500;
                        replyText = `おめでとう！スロット結果: ${slot.join(' ')} -> 500コインゲット！`;
                    } else if (result === 100) {
                        prize = 100;
                        replyText = `スロット結果: ${slot.join(' ')} -> 100コインゲット！`;
                    } else {
                        prize = 0;
                        replyText = `スロット結果: ${slot.join(' ')} -> 残念！`;
                    }

                    // コインを更新
                    coins[userId] = (coins[userId] || 0) - 1 + prize;
                    saveCoins(coins);

                    // 残りコイン数を表示
                    replyText += `\n残りのコイン数: ${coins[userId]}コイン`;
                }
            }

            // 「coingive:ID:数」コマンドの処理（個人へのコイン付与）
            else if (userMessage.startsWith("coingive:")) {
                const parts = userMessage.split(":");
                if (parts.length === 3) {
                    const targetUserId = parts[1];
                    const amount = parseInt(parts[2]);

                    if (!isNaN(amount) && amount > 0) {
                        const userCoins = coins[targetUserId] || 0;
                        coins[targetUserId] = userCoins + amount;
                        saveCoins(coins);

                        replyText = `${targetUserId}に${amount}コインを付与しました。`;
                    } else {
                        replyText = "無効なコイン数です。";
                    }
                } else {
                    replyText = "コマンドの形式が正しくありません。";
                }
            }

            // 「Allcoingive:数」コマンドの処理（全員へのコイン付与）
            else if (userMessage.startsWith("Allcoingive:")) {
                const amount = parseInt(userMessage.split(":")[1]);

                if (!isNaN(amount) && amount > 0 && userRole === "最高者") {
                    const allUsers = Object.keys(coins); // すべてのユーザーIDを取得
                    allUsers.forEach(userId => {
                        coins[userId] = (coins[userId] || 0) + amount; // 各ユーザーにコインを付与
                    });
                    saveCoins(coins);

                    replyText = `全員に${amount}コインを付与しました。`;
                } else {
                    replyText = "コイン付与には「最高者」の権限が必要です。";
                }
            }

            // 返信
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