const express = require("express");
const line = require("@line/bot-sdk");
const app = express();
const fs = require("fs");
const timeout = require("timeout");

const client = new line.Client({
    channelAccessToken: "YOUR_CHANNEL_ACCESS_TOKEN",
    channelSecret: "YOUR_CHANNEL_SECRET",
});

const usersFile = "users.json"; // ユーザー情報ファイル
const coinsFile = "coins.json"; // コイン情報ファイル
const messagesFile = "messages.json"; // メッセージ情報ファイル

// タイムアウト処理を適用
const TIMEOUT_DURATION = 5000; // 5秒

// ユーザー情報の読み込み
const loadData = (fileName) => {
    try {
        return JSON.parse(fs.readFileSync(fileName, "utf8"));
    } catch (error) {
        return {};
    }
};

// ユーザー情報の保存
const saveData = (fileName, data) => {
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2), "utf8");
};

// コイン情報の読み込み
const loadCoins = () => loadData(coinsFile);

// コイン情報の保存
const saveCoins = (coins) => saveData(coinsFile, coins);

// メッセージ情報の読み込み
const loadMessages = () => loadData(messagesFile);

// メッセージ情報の保存
const saveMessages = (messages) => saveData(messagesFile, messages);

// タイムアウト付きのファイル読み込み処理
const loadWithTimeout = async (fileName) => {
    try {
        return await timeout(TIMEOUT_DURATION, loadData(fileName));
    } catch (error) {
        throw new Error(`タイムアウトエラー: ${fileName}の読み込みに失敗しました。`);
    }
};

app.post("/callback", line.middleware({ channelSecret: "YOUR_CHANNEL_SECRET" }), async (req, res) => {
    const events = req.body.events;
    for (const event of events) {
        if (event.type === "message" && event.message.type === "text") {
            const userId = event.source.userId;
            const userMessage = event.message.text.trim();
            let replyText = "";

            // ユーザー情報とコイン情報のロード
            const users = await loadWithTimeout(usersFile);
            const coins = await loadWithTimeout(coinsFile);
            const messages = await loadWithTimeout(messagesFile);

            let userRole = users[userId] || "非権限者";
            let userCoins = coins[userId] || 0;

            // ① キーワード応答とID応答常時実行
            if (messages[userId]) {
                replyText = messages[userId];
            } else if (userMessage.startsWith("key:")) {
                // キーワード応答設定
                const [_, keyword, response] = userMessage.split(":");
                messages[keyword] = response;
                saveMessages(messages);
                replyText = `キーワード「${keyword}」の応答を設定しました。`;
            }

            // ② 権限と送るとその人の権限状態を送る
            if (userMessage === "権限") {
                replyText = `あなたの権限は「${userRole}」です。`;
            }

            // ③ checkと送るとその人のIDを送る
            if (userMessage === "check") {
                replyText = `あなたのIDは「${userId}」です。`;
            }

            // ④ コインと送るとその人の残コインを送る
            if (userMessage === "コイン") {
                replyText = `あなたの残りコインは「${userCoins}Nコイン」です。`;
            }

            // ⑤ スロットと送ると1コインを消費してスロット
            if (userMessage === "スロット" && userCoins >= 1) {
                userCoins -= 1; // コインを1消費
                const slotResult = Math.floor(Math.random() * 10); // スロット結果
                if (slotResult === 7) {
                    userCoins += 10; // 7が出たら10コイン
                    replyText = `おめでとうございます！！ 10Nコインの当たりです。あなたの残りは${userCoins}Nコインです。`;
                } else {
                    replyText = `残念！ もう一度試してください。あなたの残りは${userCoins}Nコインです。`;
                }
                coins[userId] = userCoins;
                saveCoins(coins);
            }

            // ⑥～⑩ 最高者のコマンド
            if (userRole === "最高者") {
                if (userMessage.startsWith("coingive:")) {
                    const [_, targetId, amount] = userMessage.split(":");
                    coins[targetId] = (coins[targetId] || 0) + parseInt(amount, 10);
                    saveCoins(coins);
                    replyText = `${targetId}に${amount}Nコインを付与しました。`;
                }

                if (userMessage.startsWith("allcoingive:")) {
                    const [_, amount] = userMessage.split(":");
                    for (const targetUserId in coins) {
                        coins[targetUserId] += parseInt(amount, 10);
                    }
                    saveCoins(coins);
                    replyText = `全員に${amount}Nコインを付与しました。`;
                }

                if (userMessage.startsWith("coinnotgive:")) {
                    const [_, targetId, amount] = userMessage.split(":");
                    coins[targetId] -= parseInt(amount, 10);
                    saveCoins(coins);
                    replyText = `${targetId}から${amount}Nコインを剥奪しました。`;
                }

                if (userMessage.startsWith("allcoinnotgive:")) {
                    const [_, amount] = userMessage.split(":");
                    for (const targetUserId in coins) {
                        coins[targetUserId] -= parseInt(amount, 10);
                    }
                    saveCoins(coins);
                    replyText = `全員から${amount}Nコインを剥奪しました。`;
                }

                if (userMessage.startsWith("権限付与:")) {
                    const [_, targetId] = userMessage.split(":");
                    users[targetId] = "権限者";
                    saveData(usersFile, users);
                    replyText = `${targetId}に権限を付与しました。`;
                }

                if (userMessage.startsWith("権限削除:")) {
                    const [_, targetId] = userMessage.split(":");
                    users[targetId] = "非権限者";
                    saveData(usersFile, users);
                    replyText = `${targetId}の権限を削除しました。`;
                }
            }

            // ⑪～⑮ 権限者以上のコマンド
            if (userRole === "権限者" || userRole === "最高者") {
                if (userMessage.startsWith("say:")) {
                    const [_, targetId, message] = userMessage.split(":");
                    messages[targetId] = message;
                    saveMessages(messages);
                    replyText = `${targetId}に対して「${message}」を設定しました。`;
                }

                if (userMessage.startsWith("notsay:")) {
                    const [_, targetId] = userMessage.split(":");
                    delete messages[targetId];
                    saveMessages(messages);
                    replyText = `${targetId}に対するメッセージを削除しました。`;
                }

                if (userMessage.startsWith("key:")) {
                    const [_, keyword, response] = userMessage.split(":");
                    messages[keyword] = response;
                    saveMessages(messages);
                    replyText = `キーワード「${keyword}」の応答を設定しました。`;
                }

                if (userMessage.startsWith("notkey:")) {
                    const [_, keyword] = userMessage.split(":");
                    delete messages[keyword];
                    saveMessages(messages);
                    replyText = `キーワード「${keyword}」の応答を削除しました。`;
                }
            }

            // ⑯ コインが0の人に「最高者に言ってください」メッセージ
            if (userCoins === 0) {
                replyText = "コインが0です。最高者に言ってください。";
            }

            // ⑰ おみくじ
            if (userMessage === "おみくじ") {
                const fortune = ["大吉", "吉", "凶"];
                const result = fortune[Math.floor(Math.random() * fortune.length)];
                replyText = `おみくじの結果は「${result}」です！`;
            }

            // ⑱ 招待者が非権限者の場合グループから抜ける
            if (userMessage === "招待") {
                if (userRole === "非権限者") {
                    replyText = "非権限者なので、グループから退出します。";
                    await client.leaveGroup(event.source.groupId);
                }
            }

            // ⑲ 権限者が「退出」と送ったら退出する
            if (userMessage === "退出" && userRole === "権限者") {
                await client.leaveGroup(event.source.groupId);
            }

            // メッセージの返信
            await client.replyMessage(event.replyToken, {
                type: "text",
                text: replyText,
            });
        }
    }
    res.status(200).send("OK");
});

// サーバーを開始
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});