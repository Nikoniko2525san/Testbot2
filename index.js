const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(bodyParser.json());

const COINS_FILE = 'coins.json';
const MESSAGES_FILE = 'messages.json';
const TIMEOUT_LIMIT = 10000; // タイムアウト制限

// コイン情報とメッセージ情報の読み込み関数
async function loadFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) reject(err);
            resolve(JSON.parse(data));
        });
    });
}

// コイン情報とメッセージ情報の保存関数
async function saveFile(filePath, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(data), 'utf8', (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

// 権限管理
const roles = {
    '最高者': ['最高者', '権限者', '非権限者'],
    '権限者': ['権限者', '非権限者'],
    '非権限者': ['非権限者'],
};

// ユーザー情報を取得
async function getUserData(userId) {
    const coins = await loadFile(COINS_FILE);
    const messages = await loadFile(MESSAGES_FILE);
    return {
        coins: coins[userId] || 0,
        role: coins[userId]?.role || '非権限者',
        message: messages[userId] || '',
    };
}

// ユーザーのコイン、権限、メッセージを設定
async function setUserData(userId, coins, role, message) {
    const allCoins = await loadFile(COINS_FILE);
    const allMessages = await loadFile(MESSAGES_FILE);
    allCoins[userId] = { coins, role };
    allMessages[userId] = message;
    await saveFile(COINS_FILE, allCoins);
    await saveFile(MESSAGES_FILE, allMessages);
}

// タイムアウト処理
function executeWithTimeout(func, timeout) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('タイムアウト')), timeout);
        func()
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeoutId));
    });
}

// LINEのメッセージ送信関数
async function sendReply(replyToken, message) {
    const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
    const LINE_ACCESS_TOKEN = 'YOUR_LINE_ACCESS_TOKEN';
    await axios.post(LINE_API_URL, {
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
        }
    });
}

// イベント処理
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    for (const event of events) {
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();
        const replyToken = event.replyToken;

        try {
            const { coins, role, message } = await getUserData(userId);
            let replyText = '';

            // ①キーワード応答とID応答
            if (message) {
                if (userMessage === message) {
                    replyText = `あなたのメッセージは：${message}`;
                }
            }

            // ②権限状態の表示
            if (userMessage === '権限') {
                replyText = `あなたの権限は: ${role}`;
            }

            // ③ID表示
            if (userMessage === 'check') {
                replyText = `あなたのIDは: ${userId}`;
            }

            // ④コイン残高表示
            if (userMessage === 'コイン') {
                replyText = `あなたの残コインは: ${coins}Nコイン`;
            }

            // ⑤スロット機能
            if (userMessage === 'スロット' && coins >= 1) {
                const slotResult = Math.floor(Math.random() * 100);
                let resultMessage = '';
                if (slotResult < 10) {
                    coins += 10;
                    resultMessage = 'おめでとうございます！10Nコインの当たりです！';
                } else {
                    coins -= 1;
                    resultMessage = '残念、コインが1つ消費されました。';
                }
                await setUserData(userId, coins, role, message);
                replyText = `${resultMessage}\n残りのコイン: ${coins}Nコイン`;
            }

            // ⑥個人にコインを付与（最高者のみ）
            if (userMessage.startsWith('coingive:') && role === '最高者') {
                const [, targetId, amount] = userMessage.split(':');
                const targetUser = await getUserData(targetId);
                targetUser.coins += parseInt(amount);
                await setUserData(targetId, targetUser.coins, targetUser.role, targetUser.message);
                replyText = `${targetId}に${amount}Nコインを付与しました。`;
            }

            // ⑦全てのコインを付与（最高者のみ）
            if (userMessage.startsWith('allcoingive:') && role === '最高者') {
                const [, amount] = userMessage.split(':');
                const allCoins = await loadFile(COINS_FILE);
                for (const targetUserId in allCoins) {
                    allCoins[targetUserId].coins += parseInt(amount);
                }
                await saveFile(COINS_FILE, allCoins);
                replyText = `全員に${amount}Nコインを付与しました。`;
            }

            // ⑧個人にコインを剥奪（最高者のみ）
            if (userMessage.startsWith('coinnotgive:') && role === '最高者') {
                const [, targetId, amount] = userMessage.split(':');
                const targetUser = await getUserData(targetId);
                targetUser.coins -= parseInt(amount);
                await setUserData(targetId, targetUser.coins, targetUser.role, targetUser.message);
                replyText = `${targetId}から${amount}Nコインを剥奪しました。`;
            }

            // ⑨全てのコインを剥奪（最高者のみ）
            if (userMessage.startsWith('allcoinnotgive:') && role === '最高者') {
                const [, amount] = userMessage.split(':');
                const allCoins = await loadFile(COINS_FILE);
                for (const targetUserId in allCoins) {
                    allCoins[targetUserId].coins -= parseInt(amount);
                }
                await saveFile(COINS_FILE, allCoins);
                replyText = `全員から${amount}Nコインを剥奪しました。`;
            }

            // ⑩権限付与（最高者のみ）
            if (userMessage.startsWith('権限付与:') && role === '最高者') {
                const [, targetId] = userMessage.split(':');
                const targetUser = await getUserData(targetId);
                targetUser.role = '権限者';
                await setUserData(targetId, targetUser.coins, targetUser.role, targetUser.message);
                replyText = `${targetId}の権限を「権限者」に付与しました。`;
            }

            // ⑪権限削除（最高者のみ）
            if (userMessage.startsWith('権限削除:') && role === '最高者') {
                const [, targetId] = userMessage.split(':');
                const targetUser = await getUserData(targetId);
                targetUser.role = '非権限者';
                await setUserData(targetId, targetUser.coins, targetUser.role, targetUser.message);
                replyText = `${targetId}の権限を「非権限者」に削除しました。`;
            }

            // 12-15 キーワード応答（権限者以上）
            if (role === '権限者' || role === '最高者') {
                if (userMessage.startsWith('key:')) {
                    const [_, keyword, response] = userMessage.split(':');
                    // キーワード応答を設定
                    // (保存処理)
                    replyText = `キーワード「${keyword}」に対する応答を「${response}」に設定しました。`;
                } else if (userMessage.startsWith('notkey:')) {
                    const [, keyword] = userMessage.split(':');
                    // キーワード応答を削除
                    // (削除処理)
                    replyText = `キーワード「${keyword}」の応答を削除しました。`;
                }
            }

            // 16 0コインのユーザーに警告
            if (coins === 0) {
                replyText = 'コインが0です。最高者に言ってください。';
            }

            // 17 おみくじ
            if (userMessage === 'おみくじ') {
                const fortune = ['大吉', '中吉', '小吉', '凶'][Math.floor(Math.random() * 4)];
                replyText = `おみくじの結果は: ${fortune}`;
            }

            // 18 退出コマンド
            if (userMessage === '退出' && (role === '権限者' || role === '最高者')) {
                replyText = 'このグループから退出しました。';
                // グループ退出処理を実行
            }

            // 返信
            if (replyText) {
                await sendReply(replyToken, replyText);
            }
        } catch (error) {
            console.error(error);
            await sendReply(replyToken, '処理中にエラーが発生しました。');
        }
    }

    res.sendStatus(200);
});

// サーバー開始
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});