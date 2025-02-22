const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

// 権限データを読み込む
const loadPermissions = () => {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
};

// コインデータを読み込む
const loadCoins = () => {
    if (!fs.existsSync(COINS_FILE)) return {};
    return JSON.parse(fs.readFileSync(COINS_FILE, "utf-8"));
};

// コインデータを保存する
const saveCoins = (data) => {
    fs.writeFileSync(COINS_FILE, JSON.stringify(data, null, 2), "utf-8");
};

// 権限データを保存する
const savePermissions = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
};

// おみくじの結果を定義
const fortunes = [
    "大吉",
    "吉",
    "中吉",
    "小吉",
    "凶"
];

// じゃんけんの手
const hands = ["グー", "チョキ", "パー"];

// 権限者チェック
const isAuthorized = (userId) => {
    const permissions = loadPermissions();
    return permissions[userId] === "権限者" || permissions[userId] === "最高者";
};

// グループ退出処理
const leaveGroup = async (groupId) => {
    try {
        await axios.post(`https://api.line.me/v2/bot/group/${groupId}/leave`, {}, {
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`
            }
        });
    } catch (error) {
        console.error("グループ退出エラー:", error);
    }
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const events = req.body.events;
    const coins = loadCoins(); // コイン情報を読み込む
    const permissions = loadPermissions(); // 権限情報を読み込む

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

            // 自分のコイン枚数確認
            if (userMessage === "(コイン)") {
                replyText = `あなたのコイン: ${coins[userId] || 0} 枚`;
            }

            // 自分の権限確認
            else if (userMessage === "(権限)") {
                const userPermission = permissions[userId] || "権限なし";
                replyText = `あなたの権限: ${userPermission}`;
            }

            // 権限確認の説明
            else if (userMessage === "権限確認") {
                replyText = "権限の種類:\n" +
                            "最高者: 全ての権限を持つ\n" +
                            "権限者: 指定された機能を使用できる\n" +
                            "権限なし: 特に機能は制限される";
            }

            // 権限削除
            else if (userMessage.startsWith("権限削除ID:")) {
                const targetUserId = userMessage.split(":")[1];
                if (!isAuthorized(userId)) {
                    replyText = "権限がありません。";
                } else if (targetUserId) {
                    permissions[targetUserId] = "権限なし";
                    savePermissions(permissions);
                    replyText = `${targetUserId}の権限を削除しました。`;
                }
            }

            // 権限付与
            else if (userMessage.startsWith("権限付与ID:")) {
                const targetUserId = userMessage.split(":")[1];
                if (!isAuthorized(userId)) {
                    replyText = "権限がありません。";
                } else if (targetUserId) {
                    permissions[targetUserId] = "権限者";
                    savePermissions(permissions);
                    replyText = `${targetUserId}に権限者を付与しました。`;
                }
            }

            // コイン付与（全員）
            else if (userMessage.startsWith("Allcoingive:")) {
                const amount = parseInt(userMessage.split(":")[1]);
                if (!isAuthorized(userId)) {
                    replyText = "権限がありません。";
                } else if (!isNaN(amount) && amount > 0) {
                    Object.keys(coins).forEach(userId => {
                        coins[userId] = (coins[userId] || 0) + amount;
                    });
                    saveCoins(coins);
                    replyText = `全員に${amount}コインを付与しました。`;
                }
            }

            // コイン付与（特定ユーザー）
            else if (userMessage.startsWith("coingiveID:")) {
                const [targetUserId, amount] = userMessage.split(":").slice(1);
                if (!isAuthorized(userId)) {
                    replyText = "権限がありません。";
                } else if (!isNaN(amount) && amount > 0) {
                    coins[targetUserId] = (coins[targetUserId] || 0) + parseInt(amount);
                    saveCoins(coins);
                    replyText = `${targetUserId}に${amount}コインを付与しました。`;
                }
            }

            // 退出処理（権限者のみ）
            else if (userMessage === "bot退出") {
                if (!isAuthorized(userId)) {
                    replyText = "権限がありません。";
                } else if (event.source.type === "group") {
                    await leaveGroup(event.source.groupId);
                    replyText = "グループから退出しました。";
                } else {
                    replyText = "グループでのみ実行できるコマンドです。";
                }
            }

            // check コマンドで userId を返す
            else if (userMessage === "check") {
                replyText = `ユーザーID: ${userId}`;
            }

            // おみくじ
            else if (userMessage === "おみくじ") {
                const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
                replyText = `おみくじの結果は「${fortune}」です！`;
            }

            // スロット
            else if (userMessage === "スロット") {
                if (!coins[userId] || coins[userId] < 1) {
                    replyText = "コインが足りません！（1コイン必要）";
                } else {
                    coins[userId] -= 1; // 1コイン消費
                    const slotResult = [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
                    const slotString = slotResult.join('');
                    replyText = `スロット結果: ${slotString}`;
                    // すべて同じ数字の場合に勝ち
                    if (slotResult[0] === slotResult[1] && slotResult[1] === slotResult[2]) {
                        coins[userId] += 10; // 勝ったら10コイン追加
                        replyText += "\n勝利！ 10コインを獲得しました。";
                    }
                    saveCoins(coins);
                }
            }

            // じゃんけん
            else if (userMessage === "じゃんけん") {
                if (!coins[userId] || coins[userId] < 1) {
                    replyText = "コインが足りません！（1コイン必要）";
                } else {
                    coins[userId] -= 1; // 1コイン消費
                    const userHand = hands[Math.floor(Math.random() * hands.length)];
                    const botHand = hands[Math.floor(Math.random() * hands.length)];
                    const result = determineJankenResult(userHand, botHand);

                    replyText = `あなたの手: ${userHand}\nボットの手: ${botHand}\n結果: ${result}`;

                    // 勝った場合
                    if (result === "あなたの勝ち") {
                        coins[userId] += 10; // 勝ったら10コイン
                        replyText += "\nおめでとう！ 10コインを獲得しました。";
                    }
                    saveCoins(coins);
                }
            }
        }

        if (replyText) {
            sendReply(replyToken, replyText);
        }
    }
});

const determineJankenResult = (userHand, botHand) => {
    if (userHand === botHand) return "あいこ";
    if ((userHand === "グー" && botHand === "チョキ") || 
        (userHand === "チョキ" && botHand === "パー") || 
        (userHand === "パー" && botHand === "グー")) {
        return "あなたの勝ち";
    }
    return "あなたの負け";
};

app.listen(3000, () => console.log("Server running on port 3000"));