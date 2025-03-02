const express = require("express");
const bodyParser = require("body-parser");
const line = require("@line/bot-sdk");
const fs = require("fs");
const app = express();

// LINE Botの設定
const config = {
    channelAccessToken: "Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU=",
    channelSecret: "3f32c3ed37eb7b876eed85d378fe76fc"
};

const client = new line.Client(config);

// ファイルパス
const coinsFilePath = "./coins.json";
const messagesFilePath = "./messages.json";
const rolesFilePath = "./roles.json";

// ファイル読み込み関数（タイムアウト処理付き）
function readFileWithTimeout(filePath, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject("ファイル読み込みタイムアウト"), timeout);
        fs.readFile(filePath, "utf8", (err, data) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
}

// ファイル保存関数
function saveFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ユーザーIDを保持する初期データ
const initialData = {
    roles: {},
    coins: {},
    messages: {}
};

// 初期化（データが存在しない場合に初期データを作成）
async function initialize() {
    try {
        await readFileWithTimeout(rolesFilePath);
    } catch (err) {
        saveFile(rolesFilePath, initialData.roles);
    }
    try {
        await readFileWithTimeout(coinsFilePath);
    } catch (err) {
        saveFile(coinsFilePath, initialData.coins);
    }
    try {
        await readFileWithTimeout(messagesFilePath);
    } catch (err) {
        saveFile(messagesFilePath, initialData.messages);
    }
}

initialize();

// 権限管理
const roles = {
    "最高者": 1,
    "権限者": 2,
    "非権限者": 3
};

// メッセージ送信の処理
function sendReply(replyToken, text) {
    return client.replyMessage(replyToken, { type: "text", text });
}

// コマンドの処理
app.post("/webhook", bodyParser.json(), async (req, res) => {
    const events = req.body.events;
    for (let event of events) {
        const replyToken = event.replyToken;
        const userId = event.source.userId;
        const userMessage = event.message.text;

        let replyText = "";

        // 権限の取得（ファイルから）
        const rolesData = await readFileWithTimeout(rolesFilePath);
        const coinsData = await readFileWithTimeout(coinsFilePath);
        const messagesData = await readFileWithTimeout(messagesFilePath);

        let userRole = rolesData[userId] || "非権限者";
        let userCoins = coinsData[userId] || 0;

        // 権限チェック
        const checkRole = (role) => roles[userRole] <= roles[role];

        // キーワード応答（常時実行）
        if (userMessage.startsWith("key:")) {
            const [_, keyword, response] = userMessage.split(":");
            messagesData[keyword] = response;
            saveFile(messagesFilePath, messagesData);
            replyText = `キーワード「${keyword}」に対する応答を設定しました。`;
        }

        // ID応答（常時実行）
        if (userMessage.startsWith("say:")) {
            const [_, targetId, response] = userMessage.split(":");
            messagesData[targetId] = response;
            saveFile(messagesFilePath, messagesData);
            replyText = `${targetId}へのメッセージを設定しました。`;
        }

        // ①ユーザーの権限状態送信
        if (userMessage === "権限") {
            replyText = `あなたの現在の権限は「${userRole}」です。`;
        }

        // ②checkコマンドでユーザーID送信
        if (userMessage === "check") {
            replyText = `あなたのIDは「${userId}」です。`;
        }

        // ③コイン残高表示
        if (userMessage === "コイン") {
            replyText = `あなたの残りコインは「${userCoins}」です。`;
        }

        // ④スロット
        if (userMessage === "スロット" && userCoins >= 1) {
            userCoins -= 1;
            const slotResult = Math.floor(Math.random() * 10); // ランダムでスロット結果
            if (slotResult === 7) {
                userCoins += 10; // 当たり
                replyText = `おめでとうございます！ 10コインを獲得しました。残りコインは「${userCoins}」です。`;
            } else {
                replyText = `残念！残りコインは「${userCoins}」です。`;
            }
            coinsData[userId] = userCoins;
            saveFile(coinsFilePath, coinsData);
        }

        // ⑥個人にコインを付与するコマンド（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("coingive:")) {
            const [_, targetId, amount] = userMessage.split(":");
            coinsData[targetId] = (coinsData[targetId] || 0) + parseInt(amount);
            saveFile(coinsFilePath, coinsData);
            replyText = `${targetId}に${amount}コインを付与しました。`;
        }

        // ⑦全員にコインを付与するコマンド（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("allcoingive:")) {
            const [_, amount] = userMessage.split(":");
            for (let targetUserId in coinsData) {
                coinsData[targetUserId] += parseInt(amount);
            }
            saveFile(coinsFilePath, coinsData);
            replyText = `全員に${amount}コインを付与しました。`;
        }

        // ⑧個人にコインを剥奪するコマンド（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("coinnotgive:")) {
            const [_, targetId, amount] = userMessage.split(":");
            coinsData[targetId] = (coinsData[targetId] || 0) - parseInt(amount);
            saveFile(coinsFilePath, coinsData);
            replyText = `${targetId}から${amount}コインを剥奪しました。`;
        }

        // ⑨全員からコインを剥奪するコマンド（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("allcoinnotgive:")) {
            const [_, amount] = userMessage.split(":");
            for (let targetUserId in coinsData) {
                coinsData[targetUserId] -= parseInt(amount);
            }
            saveFile(coinsFilePath, coinsData);
            replyText = `全員から${amount}コインを剥奪しました。`;
        }

        // ⑩権限付与:ID（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("権限付与:")) {
            const [_, targetId] = userMessage.split(":");
            rolesData[targetId] = "権限者";
            saveFile(rolesFilePath, rolesData);
            replyText = `${targetId}に権限を付与しました。`;
        }

        // ⑪権限削除:ID（最高者のみ）
        if (checkRole("最高者") && userMessage.startsWith("権限削除:")) {
            const [_, targetId] = userMessage.split(":");
            rolesData[targetId] = "非権限者";
            saveFile(rolesFilePath, rolesData);
            replyText = `${targetId}の権限を削除しました。`;
        }

        // ⑫ID応答（特定のIDのメッセージに反応するコマンド、権限者以上）
        if (checkRole("権限者") && userMessage.startsWith("say:")) {
            const [_, targetId, message] = userMessage.split(":");
            messagesData[targetId] = message;
            saveFile(messagesFilePath, messagesData);
            replyText = `${targetId}にメッセージを設定しました。`;
        }

        // ⑬say削除コマンド（権限者以上）
        if (checkRole("権限者") && userMessage.startsWith("notsay:")) {
            const [_, targetId] = userMessage.split(":");
            delete messagesData[targetId];
            saveFile(messagesFilePath, messagesData);
            replyText = `${targetId}のメッセージを削除しました。`;
        }

        // ⑭キーワード応答設定（権限者以上）
        if (checkRole("権限者") && userMessage.startsWith("key:")) {
            const [_, keyword, response] = userMessage.split(":");
            messagesData[keyword] = response;
            saveFile(messagesFilePath, messagesData);
            replyText = `キーワード「${keyword}」に応答内容を設定しました。`;
        }

        // ⑮キーワード削除（権限者以上）
        if (checkRole("権限者") && userMessage.startsWith("notkey:")) {
            const [_, keyword] = userMessage.split(":");
            delete messagesData[keyword];
            saveFile(messagesFilePath, messagesData);
            replyText = `キーワード「${keyword}」の応答を削除しました。`;
        }

        // ⑯0コインの人にメッセージ
        if (userCoins === 0) {
            replyText = `あなたの残りコインは0です。最高者に問い合わせてください。`;
        }

        // ⑰おみくじコマンド
        if (userMessage === "おみくじ") {
            const result = ["大吉", "吉", "中吉", "凶", "大凶"][Math.floor(Math.random() * 5)];
            replyText = `おみくじの結果は「${result}」です。`;
        }

        // ⑱招待者が非権限者の場合退出
        if (event.source.type === "group" && event.source.userId !== "U9a952e1e4e8580107b52b5f5fd4f0ab3") {
            await client.leaveGroup(event.source.groupId);
            replyText = "あなたは権限がないため、グループを退出しました。";
        }

        // 返信
        if (replyText) {
            await sendReply(replyToken, replyText);
        }
    }

    res.status(200).send("OK");
});

// サーバーを起動する
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});