const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
const fs = require('fs').promises;

// LINE BOTの設定
const config = {
    channelAccessToken: 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU=',
    channelSecret: '3f32c3ed37eb7b876eed85d378fe76fc'
};

const client = new Client(config);
const app = express();

// ユーザーの情報、コイン、権限を保存するためのデータ構造
let users = {}; // {userId: {coins: 20, role: '非権限者'}}
let messages = {}; // {userId: 'message'}

const saveData = async () => {
    await fs.writeFile('users.json', JSON.stringify(users));
    await fs.writeFile('messages.json', JSON.stringify(messages));
};

const loadData = async () => {
    try {
        const usersData = await fs.readFile('users.json');
        users = JSON.parse(usersData);
    } catch (e) {
        console.log('No users data found, starting fresh.');
    }

    try {
        const messagesData = await fs.readFile('messages.json');
        messages = JSON.parse(messagesData);
    } catch (e) {
        console.log('No messages data found, starting fresh.');
    }
};

loadData();

// リクエストボディをJSONとしてパース
app.use(bodyParser.json());

// メッセージ受信時の処理
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const userMessage = event.message.text;
            const replyToken = event.replyToken;

            // ユーザーが初めてメッセージを送った場合、デフォルトコイン20と非権限者に設定
            if (!users[userId]) {
                users[userId] = { coins: 20, role: '非権限者' };
                await saveData();
            }

            const userRole = users[userId].role;
            let replyText = "";

            // キーワード応答・ID応答
            if (userMessage.startsWith("key:")) {
                const [_, key, response] = userMessage.split(":");
                messages[key] = response;
                await saveData();
                replyText = `キーワード応答設定: ${key} => ${response}`;
            }

            if (userMessage.startsWith("notkey:")) {
                const [_, key] = userMessage.split(":");
                delete messages[key];
                await saveData();
                replyText = `キーワード応答削除: ${key}`;
            }

            if (messages[userMessage]) {
                replyText = messages[userMessage];
            }

            // ID応答設定と削除
            if ((userRole === "権限者" || userRole === "最高者") && userMessage.startsWith("say:")) {
                const [_, targetId, response] = userMessage.split(":");
                messages[targetId] = response;
                await saveData();
                replyText = `ID応答設定: ${targetId} => ${response}`;
            }

            if ((userRole === "権限者" || userRole === "最高者") && userMessage.startsWith("notsay:")) {
                const [_, targetId] = userMessage.split(":");
                delete messages[targetId];
                await saveData();
                replyText = `ID応答削除: ${targetId}`;
            }

            // コイン情報
            if (userMessage === "コイン") {
                replyText = `あなたの残コインは${users[userId].coins}コインです。`;
            }

            // 権限情報
            if (userMessage === "権限") {
                replyText = `あなたの権限は「${userRole}」です。`;
            }

            // チェック（ユーザーID送信）
            if (userMessage === "check") {
                replyText = `あなたのIDは${userId}です。`;
            }

            // スロットゲーム
            if (userMessage === "スロット") {
                if (users[userId].coins < 1) {
                    replyText = "コインが足りません。最高者にコインの付与を依頼してください。";
                } else {
                    users[userId].coins -= 1;
                    const slotResult = Math.floor(Math.random() * 1000); // 0-999
                    let reward = 0;
                    if (slotResult === 777) reward = 777;
                    else if ([111, 222, 333, 444, 555, 666, 888, 999].includes(slotResult)) reward = 100;

                    users[userId].coins += reward;
                    await saveData();
                    replyText = `スロット結果: ${slotResult}\n${reward}コイン獲得！\n残りコイン: ${users[userId].coins}`;
                }
            }

            // コイン付与・剥奪（最高者のみ）
            if (userRole === "最高者") {
                if (userMessage.startsWith("coingive:")) {
                    const [_, targetId, amount] = userMessage.split(":");
                    users[targetId].coins += parseInt(amount);
                    await saveData();
                    replyText = `${targetId}に${amount}コインを付与しました。`;
                }

                if (userMessage.startsWith("allcoingive:")) {
                    const [_, amount] = userMessage.split(":");
                    for (const targetUserId in users) {
                        users[targetUserId].coins += parseInt(amount);
                    }
                    await saveData();
                    replyText = `全員に${amount}コインを付与しました。`;
                }

                if (userMessage.startsWith("coinnotgive:")) {
                    const [_, targetId, amount] = userMessage.split(":");
                    users[targetId].coins -= parseInt(amount);
                    await saveData();
                    replyText = `${targetId}から${amount}コインを剥奪しました。`;
                }

                if (userMessage.startsWith("allcoinnotgive:")) {
                    const [_, amount] = userMessage.split(":");
                    for (const targetUserId in users) {
                        users[targetUserId].coins -= parseInt(amount);
                    }
                    await saveData();
                    replyText = `全員から${amount}コインを剥奪しました。`;
                }

                if (userMessage.startsWith("権限付与:")) {
                    const [_, targetId] = userMessage.split(":");
                    users[targetId].role = "権限者";
                    await saveData();
                    replyText = `${targetId}に権限者を付与しました。`;
                }

                if (userMessage.startsWith("権限削除:")) {
                    const [_, targetId] = userMessage.split(":");
                    users[targetId].role = "非権限者";
                    await saveData();
                    replyText = `${targetId}から権限者を削除しました。`;
                }
            }

            // 退出コマンド（権限者以上）
            if (userRole === "権限者" || userRole === "最高者") {
                if (userMessage === "退出") {
                    replyText = "グループから退出します。";
                    // ここで実際にLINE Botがグループから退出するコードを追加します
                }
            }

            // おみくじ機能（誰でも）
            if (userMessage === "おみくじ") {
                const fortune = ["大吉", "吉", "中吉", "小吉", "凶"];
                const randomFortune = fortune[Math.floor(Math.random() * fortune.length)];
                replyText = `おみくじ結果: ${randomFortune}`;
            }

            // 返信
            if (replyText) {
                await client.replyMessage(replyToken, {
                    type: 'text',
                    text: replyText
                });
            }
        }
    }

    res.status(200).send("OK");
});

// サーバー開始
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});