const ACCESS_TOKEN = 'scim9t3j5eY+OB6O0hgo32s1olzFkxqC0f2U7CWcy30k1R3orR5uNc+disMdUHIRBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeR85MS+I2YYt+23YrzC88zIhizNU8cGhNS/eurmqB6n8AdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン

const express = require("express");
const axios = require("axios");
// fsの重複インポートを削除
// const fs = require('fs');  // 既にインポートされている場合はコメントアウト

function readFileWithTimeout(filePath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`File read timeout: ${filePath}`)), timeout);

    fs.readFile(filePath, 'utf8', (err, data) => {
      clearTimeout(timer);
      if (err) return reject(new Error(`Error reading file ${filePath}: ${err.message}`));

      try {
        resolve(JSON.parse(data));
      } catch (parseErr) {
        reject(new Error(`Error parsing JSON from file ${filePath}: ${parseErr.message}`));
      }
    });
  });
}

const app = express();
app.use(express.json());

const DATA_FILE = "permissions.json";  // 権限を保存するJSONファイル
const MESSAGE_LOG = "messages.json"; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = "coins.json"; // コイン情報を保存するJSONファイル
const KEYWORDS_FILE = "keywords.json"; // キーワード応答を保存するファイル
const BLACKLIST_FILE = "blacklist.json"; // ブラックリスト情報を保存するファイル

// 管理者のユーザーIDを設定（固定）
const adminUserId = "U9a952e1e4e8580107b52b5f5fd4f0ab3";  // 自分のLINE IDに変更

// 初期化
function initializeData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }
  if (!fs.existsSync(COINS_FILE)) {
    fs.writeFileSync(COINS_FILE, JSON.stringify({}));
  }
  if (!fs.existsSync(KEYWORDS_FILE)) {
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify({}));
  }
  if (!fs.existsSync(BLACKLIST_FILE)) {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([]));
  }
}

const fs = require('fs');

function readFileWithTimeout(filePath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`File read timeout: ${filePath}`)), timeout);

    fs.readFile(filePath, 'utf8', (err, data) => {
      clearTimeout(timer);
      if (err) return reject(new Error(`Error reading file ${filePath}: ${err.message}`));

      try {
        resolve(JSON.parse(data));
      } catch (parseErr) {
        reject(new Error(`Error parsing JSON from file ${filePath}: ${parseErr.message}`));
      }
    });
  });
}

// ファイル書き込み関数
function writeFileWithTimeout(filePath, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('File write timeout'), timeout);
    fs.writeFile(filePath, JSON.stringify(data), (err) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve();
    });
  });
}

// コイン初期化
function initializeCoins() {
  const coins = JSON.parse(fs.readFileSync(COINS_FILE, 'utf8'));
  Object.keys(coins).forEach(userId => {
    if (coins[userId] === undefined) {
      coins[userId] = 20; // 初期コイン
    }
  });
  writeFileWithTimeout(COINS_FILE, coins);
}

// 初期化実行
initializeData();
initializeCoins();

// LINE Webhookイベント処理
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (events && events.length > 0) {
    const event = events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const message = event.message.text;

   try {
  let data = await readFileWithTimeout(DATA_FILE);
  let coins = await readFileWithTimeout(COINS_FILE);
  let keywords = await readFileWithTimeout(KEYWORDS_FILE);
  let blacklist = await readFileWithTimeout(BLACKLIST_FILE);

  // その他の処理
} catch (error) {
  console.error('エラーが発生しました:', error);
  await reply(replyToken, '処理中にエラーが発生しました。もう一度試してください。');
}

      // 2. ブラックリストに登録されているかをチェック
      if (blacklist.includes(userId)) {
        // ブラックリストに含まれている場合、何もせずに処理を終了
        console.log(`ユーザー ${userId} はブラックリストに登録されています`);
        return res.sendStatus(200);  // 応答として200を返して終了
      }

      // 1. キーワード応答とID応答
      if (keywords[message]) {
        await reply(replyToken, keywords[message]);
        return;
      }

      // 2. 権限と送るとその人の権限状態を送る
      if (message === '権限') {
        const permission = data[userId] || '非権限者';
        await reply(replyToken, `あなたの権限は: ${permission}`);
      }

      // 3. checkと送るとその人のIDを送る
      if (message === 'check') {
        await reply(replyToken, `あなたのIDは: ${userId}`);
      }

      // 4. // スロットの結果を生成する仮の関数
const slotMachine = () => {
  const outcomes = ['111', '222', '333', '444', '555', '666', '777', '888', '999'];
  const randomIndex = Math.floor(Math.random() * outcomes.length);
  return outcomes[randomIndex];
};

// スロットの結果に基づいた報酬を計算する仮の関数
const getSlotReward = (result) => {
  switch (result) {
    case '777':
      return 777;
    case '111':
    case '222':
    case '333':
    case '444':
    case '555':
    case '666':
    case '888':
    case '999':
      return 100;
    default:
      return 0;
  }
};

// 4. コインと送るとその人の残コインを送る
if (message === 'コイン') {
  const userCoins = coins[userId] || 0;
  await reply(replyToken, `あなたの残りコインは: ${userCoins}`);
}

// 5. スロット
if (message === 'スロット') {
  let userCoins = coins[userId] || 0;
  if (userCoins >= 1) {
    userCoins -= 1; // コインを消費
    const result = slotMachine();
    const reward = getSlotReward(result);
    if (reward > 0) {
      userCoins += reward;
      await reply(replyToken, `スロット結果: ${result}\nあなたの残りコインは: ${userCoins}`);
    } else {
      await reply(replyToken, `スロット結果: ${result}\nあなたの残りコインは: ${userCoins}`);
    }
    coins[userId] = userCoins; // ユーザーのコインを更新
    await writeFileWithTimeout(COINS_FILE, JSON.stringify(coins)); // コイン情報をファイルに保存
  } else {
    await reply(replyToken, 'コインが足りません。最高者にコインの付与を依頼してください。');
  }
}

// 6-11. 最高者専用コマンド
if (userId === adminUserId) {
  // ⑥ 個人にコインを付与
  if (message.startsWith('coingive:')) {
    const [_, targetUserId, amount] = message.split(':');
    coins[targetUserId] = (coins[targetUserId] || 0) + parseInt(amount);
    await reply(replyToken, `ユーザー ${targetUserId} に ${amount} コインを付与しました。`);
    await writeFileWithTimeout(COINS_FILE, JSON.stringify(coins)); // コイン情報をファイルに保存
  }

  // ⑦ 全てのコインを付与
  if (message.startsWith('allcoingive:')) {
    const amount = parseInt(message.split(':')[1]);
    for (const user in coins) {
      coins[user] += amount;
    }
    await reply(replyToken, `全てのユーザーに ${amount} コインを付与しました。`);
    await writeFileWithTimeout(COINS_FILE, JSON.stringify(coins)); // コイン情報をファイルに保存
  }

  // ⑧ 個人にコインを剥奪
  if (message.startsWith('coinnotgive:')) {
    const [_, targetUserId, amount] = message.split(':');
    coins[targetUserId] = (coins[targetUserId] || 0) - parseInt(amount);
    await reply(replyToken, `ユーザー ${targetUserId} から ${amount} コインを剥奪しました。`);
    await writeFileWithTimeout(COINS_FILE, JSON.stringify(coins)); // コイン情報をファイルに保存
  }

  // ⑨ 全てのコインを剥奪
  if (message.startsWith('allcoinnotgive:')) {
    const amount = parseInt(message.split(':')[1]);
    for (const user in coins) {
      coins[user] -= amount;
    }
    await reply(replyToken, `全てのユーザーから ${amount} コインを剥奪しました。`);
    await writeFileWithTimeout(COINS_FILE, JSON.stringify(coins)); // コイン情報をファイルに保存
  }
}
// 10. 権限を付与
        if (message.startsWith('権限付与:')) {
          const targetUserId = message.split(':')[1];
          data[targetUserId] = '権限者';
          await reply(replyToken, `ユーザー ${targetUserId} に権限を付与しました。`);
          writeFileWithTimeout(DATA_FILE, data);
        }
        // 11. 権限を剥奪
        if (message.startsWith('権限削除:')) {
          const targetUserId = message.split(':')[1];
          data[targetUserId] = '非権限者';
          await reply(replyToken, `ユーザー ${targetUserId} の権限を剥奪しました。`);
          writeFileWithTimeout(DATA_FILE, data);
        }
      }

      // 12-18. 権限者以上ができるコマンド
      if (data[userId] === '権限者' || data[userId] === '最高者') {
        // ⑫ 特定のIDにメッセージを送る
        if (message.startsWith('say:')) {
          const [_, targetUserId, response] = message.split(':');
          keywords[targetUserId] = response;
          await reply(replyToken, `ID ${targetUserId} に対する応答を設定しました。`);
          writeFileWithTimeout(KEYWORDS_FILE, keywords);
        }
        // ⑬ 特定のIDのメッセージを削除
        if (message.startsWith('notsay:')) {
          const targetUserId = message.split(':')[1];
          delete keywords[targetUserId];
          await reply(replyToken, `ID ${targetUserId} の応答を削除しました。`);
          writeFileWithTimeout(KEYWORDS_FILE, keywords);
        }
        // ⑭ キーワード応答の設定
        if (message.startsWith('key:')) {
          const [_, keyword, response] = message.split(':');
          keywords[keyword] = response;
          await reply(replyToken, `キーワード「${keyword}」に応答「${response}」を設定しました。`);
          writeFileWithTimeout(KEYWORDS_FILE, keywords);
        }
        // ⑮ キーワード応答の削除
        if (message.startsWith('notkey:')) {
          const keyword = message.split(':')[1];
          delete keywords[keyword];
          await reply(replyToken, `キーワード「${keyword}」を削除しました。`);
          writeFileWithTimeout(KEYWORDS_FILE, keywords);
        }
        // ⑯ 退出コマンド
        if (message === '退出') {
          await leaveGroup();
        }
        // ⑰ ブラックリストに登録
        if (message.startsWith('black:')) {
          const targetUserId = message.split(':')[1];
          blacklist.push(targetUserId);
          await reply(replyToken, `ユーザー ${targetUserId} をブラックリストに登録しました。`);
          writeFileWithTimeout(BLACKLIST_FILE, blacklist);
        }
        // ⑱ ブラックリストから削除
        if (message.startsWith('notblack:')) {
          const targetUserId = message.split(':')[1];
          blacklist = blacklist.filter(id => id !== targetUserId);
          await reply(replyToken, `ユーザー ${targetUserId} をブラックリストから削除しました。`);
          writeFileWithTimeout(BLACKLIST_FILE, blacklist);
        }
      }

      // 19. おみくじ
      if (message === 'おみくじ') {
        const result = lottery();
        await reply(replyToken, `おみくじ結果: ${result}`);
      }

      // 20-23. その他のコマンド
      if (message.startsWith('権限:')) {
        const targetUserId = message.split(':')[1];
        const permission = data[targetUserId] || '非権限者';
        await reply(replyToken, `ユーザー ${targetUserId} の権限: ${permission}`);
      }
      if (message.startsWith('check:@')) {
        const targetUserId = message.split('@')[1];
        await reply(replyToken, `ID: ${targetUserId}`);
      }
      if (message === 'ブラックリスト確認') {
        await reply(replyToken, `ブラックリスト: ${JSON.stringify(blacklist)}`);
      }
      if (message.startsWith('+削除')) {
        const msgId = message.split(' ')[1];
        await deleteMessage(msgId);
        await reply(replyToken, `メッセージ ${msgId} を削除しました。`);
      }

    } catch (err) {
      console.error('Error:', err);
      await reply(replyToken, 'エラーが発生しました。');
    }
  }
  res.sendStatus(200);
});

// Helper Functions
async function reply(replyToken, message) {
  await axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken,
    messages: [{ type: 'text', text: message }]
  }, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
}

function slotMachine() {
  const symbols = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return `${symbols[Math.floor(Math.random() * 9)]}${symbols[Math.floor(Math.random() * 9)]}${symbols[Math.floor(Math.random() * 9)]}`;
}

function getSlotReward(result) {
  const rewards = {
    '111': 100,
    '222': 100,
    '333': 100,
    '444': 100,
    '555': 100,
    '666': 100,
    '888': 100,
    '999': 100,
    '777': 777
  };
  return rewards[result] || 0;
}

function lottery() {
  const outcomes = ['大吉', '中吉', '小吉', '凶'];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

async function leaveGroup() {
  // グループ退出処理
}

async function deleteMessage(msgId) {
  await axios.post('https://api.line.me/v2/bot/message/' + msgId + '/delete', {}, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
}

app.listen(3000, () => console.log('Server is running on port 3000'));