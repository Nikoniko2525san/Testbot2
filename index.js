const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE'; // LINEアクセストークン
const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const PERMISSION_FILE = "permissions.json"; // 権限データ
const COINS_FILE = "coins.json"; // コインデータ

const adminUserId = "YOUR_ADMIN_USER_ID_HERE"; // 管理者のユーザーID

// ファイル読み込み関数
const loadData = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");

// データ読み込み
let permissions = loadData(PERMISSION_FILE);
let coins = loadData(COINS_FILE);

// おみくじの結果
const fortunes = ["大吉", "吉", "中吉", "小吉", "凶"];

// スロット機能
const spinSlot = () => [...Array(3)].map(() => Math.floor(Math.random() * 10));
const checkSlotResult = (slot) => {
    const slotString = slot.join('');
    if (slotString === '777') return 500;
    if (['111', '222', '333', '444', '555', '666', '888', '999'].includes(slotString)) return 100;
    return 0;
};

// じゃんけん機能
const jankenResults = ["グー", "チョキ", "パー"];
const judgeJanken = (player) => {
    const bot = jankenResults[Math.floor(Math.random() * 3)];
    if (player === bot) return { bot, result: "引き分け" };
    if ((player === "グー" && bot === "チョキ") || (player === "チョキ" && bot === "パー") || (player === "パー" && bot === "グー")) {
        return { bot, result: "勝ち", reward: 10 };
    }
    return { bot, result: "負け" };
};

// LINEメッセージ送信
const sendReply = async (replyToken, replyText) => {
    try {
        await axios.post("https://api.line.me/v2/bot/message/reply", {
            replyToken,
            messages: [{ type: "text", text: replyText }]
        }, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
            timeout: 5000
        });
    } catch (error) {
        console.error('メッセージ送信エラー:', error);
    }
};

// Webhookエンドポイント
app.post("/webhook", async (req, res) => {
    res.sendStatus(200); // タイムアウト対策

    for (const event of req.body.events) {
        if (!event.replyToken || event.type !== "message" || !event.message?.text) continue;
        
        const replyToken = event.replyToken;
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();
        let replyText = null;

        // コマンド処理
        if (userMessage === "check") {
            replyText = `あなたのユーザーID: ${userId}`;
        } else if (userMessage === "コイン") {
            replyText = `あなたのコイン: ${coins[userId] || 0} 枚`;
        } else if (userMessage === "権限") {
            replyText = `あなたの権限: ${permissions[userId] ? "権限者" : "非権限者"}`;
        } else if (userMessage === "権限確認") {
            replyText = "権限の種類:\n・権限者: 特定の操作が可能\n・非権限者: 基本機能のみ利用可能";
        } else if (userMessage === "おみくじ") {
            replyText = `おみくじの結果: 「${fortunes[Math.floor(Math.random() * fortunes.length)]}」`;
        } else if (userMessage === "スロット") {
            if (!coins[userId] || coins[userId] < 1) {
                replyText = "コインが足りません！（1コイン必要）";
            } else {
                coins[userId]--;
                const slotResult = spinSlot();
                const reward = checkSlotResult(slotResult);
                coins[userId] += reward;
                saveData(COINS_FILE, coins);

                replyText = `スロット結果: ${slotResult.join(' ')}\n` +
                            (reward > 0 ? `おめでとう！ ${reward}コイン獲得！` : "はずれ！また挑戦してね！") +
                            `\n残りコイン: ${coins[userId]} 枚`;
            }
        } else if (userMessage.startsWith("じゃんけん:")) {
            const playerChoice = userMessage.split(":")[1];
            if (!["グー", "チョキ", "パー"].includes(playerChoice)) {
                replyText = "「じゃんけん:グー」「じゃんけん:チョキ」「じゃんけん:パー」の形式で入力してください";
            } else if (!coins[userId] || coins[userId] < 1) {
                replyText = "コインが足りません！（1コイン必要）";
            } else {
                coins[userId]--;
                const { bot, result, reward } = judgeJanken(playerChoice);
                if (reward) coins[userId] += reward;
                saveData(COINS_FILE, coins);

                replyText = `あなた: ${playerChoice}\nBot: ${bot}\n結果: ${result}` +
                            (reward ? `\nおめでとう！ 10コイン獲得！` : "") +
                            `\n残りコイン: ${coins[userId]} 枚`;
            }
        } else if (userMessage === "退出" && permissions[userId]) {
            try {
                if (event.source.type === "group") {
                    await axios.post("https://api.line.me/v2/bot/group/" + event.source.groupId + "/leave", {}, {
                        headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
                    });
                }
                replyText = "グループを退出しました。";
            } catch (error) {
                replyText = "退出に失敗しました。";
            }
        }

        // 権限・コイン管理
        else if (userMessage.startsWith("権限付与ID:")) {
            permissions[userMessage.split(":")[1]] = true;
            saveData(PERMISSION_FILE, permissions);
            replyText = "権限を付与しました。";
        } else if (userMessage.startsWith("権限削除ID:")) {
            delete permissions[userMessage.split(":")[1]];
            saveData(PERMISSION_FILE, permissions);
            replyText = "権限を削除しました。";
        } else if (userMessage.startsWith("coingive:ID:")) {
            const [_, targetId, amount] = userMessage.split(":");
            coins[targetId] = (coins[targetId] || 0) + parseInt(amount);
            saveData(COINS_FILE, coins);
            replyText = `ID: ${targetId} に ${amount} コインを付与しました。`;
        } else if (userMessage.startsWith("coinnotgive:ID:")) {
            const [_, targetId, amount] = userMessage.split(":");
            coins[targetId] = Math.max((coins[targetId] || 0) - parseInt(amount), 0);
            saveData(COINS_FILE, coins);
            replyText = `ID: ${targetId} のコインを ${amount} 枚剥奪しました。`;
        }

        if (replyText) await sendReply(replyToken, replyText);
    }
});

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));