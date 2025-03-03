const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.use(express.json());

const ACCESS_TOKEN = 'Mu985kf4FZjKa6As052f48YrbDQrJTsy65b6cxt6FXjGoiZSiKxSxmaYJQhst2DcBBRkYeUpRWEuc56sL5UQmGZsMLpCj3F3nCGZCBFgCeRkNq2eH9mm2HxHu6i3mINmKTqF8lUZzAM1CISAWU3jKgdB04t89/1O/w1cDnyilFU='; // LINEアクセストークン
const DATA_FILE = 'permissions.json';  // 権限を保存するJSONファイル
const MESSAGE_LOG = 'messages.json'; // メッセージ履歴を保存するJSONファイル
const COINS_FILE = 'coins.json'; // コイン情報を保存するJSONファイル
const KEYWORDS_FILE = 'keywords.json'; // キーワード応答を保存するファイル
const BLACKLIST_FILE = 'blacklist.json'; // ブラックリスト情報

// 管理者のユーザーIDを設定（固定）
const adminUserId = 'U9a952e1e4e8580107b52b5f5fd4f0ab3';  // 管理者のLINE ID

// 権限、コイン、キーワード、ブラックリストを読み込み（非同期でタイムアウト付き）
const readFileWithTimeout = (file, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('File read timeout')), timeout);
    fs.readFile(file, 'utf8', (err, data) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve(JSON.parse(data));
    });
  });
};

// 初期データ読み込み
let permissions = {};
let coins = {};
let keywords = {};
let blacklist = [];

Promise.all([
  readFileWithTimeout(DATA_FILE),
  readFileWithTimeout(COINS_FILE),
  readFileWithTimeout(KEYWORDS_FILE),
  readFileWithTimeout(BLACKLIST_FILE)
])
  .then(([permissionsData, coinsData, keywordsData, blacklistData]) => {
    permissions = permissionsData || {};
    coins = coinsData || {};
    keywords = keywordsData || {};
    blacklist = blacklistData || [];
  })
  .catch(err => console.error('Error loading files:', err));

// ユーザーIDと権限を送信
const getUserPermission = (userId) => {
  return permissions[userId] || '非権限者';
};

// ユーザーIDとコインを送信
const getUserCoins = (userId) => {
  return coins[userId] || 20;
};

// メッセージ受信時の処理
app.post('/webhook', (req, res) => {
  const events = req.body.events;

  events.forEach(event => {
    const userId = event.source.userId;
    const text = event.message.text.trim();

    if (blacklist.includes(userId)) return;

    if (text === '権限') {
      // 権限確認
      return replyMessage(event.replyToken, `あなたの権限は ${getUserPermission(userId)} です。`);
    }

    if (text === 'check') {
      // ユーザーID確認
      return replyMessage(event.replyToken, `あなたのIDは ${userId} です。`);
    }

    if (text === 'コイン') {
      // コイン確認
      return replyMessage(event.replyToken, `あなたの残コインは ${getUserCoins(userId)} コインです。`);
    }

    if (text === 'スロット' && getUserCoins(userId) > 0) {
      // スロットゲーム
      const slotResult = Math.floor(Math.random() * 10);
      const userCoins = getUserCoins(userId);
      let reward = 0;
      let message = 'スロット結果: ';

      if ([1, 2, 3, 4, 5, 6, 8, 9].includes(slotResult)) {
        reward = 100;
        message += `当たり！100コイン獲得！`;
      } else if (slotResult === 7) {
        reward = 777;
        message += `777コイン獲得！`;
      } else {
        message += '外れ';
      }

      coins[userId] = userCoins - 1 + reward;
      fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
      return replyMessage(event.replyToken, `${message}\n残りコイン: ${coins[userId]}`);
    }

    // 管理者だけのコマンド
    if (getUserPermission(userId) === '最高者') {
      if (text.startsWith('coingive:')) {
        // 個別コイン付与
        const [_, targetId, amount] = text.split(':');
        coins[targetId] = (coins[targetId] || 0) + parseInt(amount, 10);
        fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
        return replyMessage(event.replyToken, `${targetId} に ${amount} コインを付与しました。`);
      }

      if (text.startsWith('allcoingive:')) {
        // 全コイン付与
        const [_, amount] = text.split(':');
        Object.keys(coins).forEach(id => {
          coins[id] = (coins[id] || 0) + parseInt(amount, 10);
        });
        fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
        return replyMessage(event.replyToken, `全ユーザーに ${amount} コインを付与しました。`);
      }

      if (text.startsWith('coinnotgive:')) {
        // 個別コイン剥奪
        const [_, targetId, amount] = text.split(':');
        coins[targetId] = (coins[targetId] || 0) - parseInt(amount, 10);
        fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
        return replyMessage(event.replyToken, `${targetId} から ${amount} コインを剥奪しました。`);
      }

      if (text.startsWith('allcoinnotgive:')) {
        // 全コイン剥奪
        const [_, amount] = text.split(':');
        Object.keys(coins).forEach(id => {
          coins[id] = (coins[id] || 0) - parseInt(amount, 10);
        });
        fs.writeFileSync(COINS_FILE, JSON.stringify(coins, null, 2));
        return replyMessage(event.replyToken, `全ユーザーから ${amount} コインを剥奪しました。`);
      }

      if (text.startsWith('権限:')) {
        // 権限付与
        const [_, targetId] = text.split(':');
        permissions[targetId] = '権限者';
        fs.writeFileSync(DATA_FILE, JSON.stringify(permissions, null, 2));
        return replyMessage(event.replyToken, `${targetId} に権限を付与しました。`);
      }

      if (text.startsWith('not権限:')) {
        // 権限削除
        const [_, targetId] = text.split(':');
        permissions[targetId] = '非権限者';
        fs.writeFileSync(DATA_FILE, JSON.stringify(permissions, null, 2));
        return replyMessage(event.replyToken, `${targetId} の権限を削除しました。`);
      }
    }

    // 権限者以上のコマンド
    if (['最高者', '権限者'].includes(getUserPermission(userId))) {
      if (text.startsWith('say:')) {
        // ID応答: メッセージを受信時に特定の言葉を話す
        const [_, targetId, words] = text.split(':');
        keywords[targetId] = words;
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
        return replyMessage(event.replyToken, `ID ${targetId} に応答内容を設定しました。`);
      }

      if (text.startsWith('notsay:')) {
        // ID応答: メッセージを受信時に特定の言葉を消す
        const [_, targetId] = text.split(':');
        delete keywords[targetId];
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
        return replyMessage(event.replyToken, `ID ${targetId} の応答内容を削除しました。`);
      }

      if (text.startsWith('key:')) {
        // キーワード応答設定
        const [_, keyword, response] = text.split(':');
        keywords[keyword] = response;
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
        return replyMessage(event.replyToken, `キーワード「${keyword}」に応答「${response}」を設定しました。`);
      }

      if (text.startsWith('notkey:')) {
        // キーワード応答削除
        const [_, keyword] = text.split(':');
        delete keywords[keyword];
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
        return replyMessage(event.replyToken, `キーワード「${keyword}」の応答を削除しました。`);
      }

      if (text === 'ブラックリスト') {
        // ブラックリスト一覧
        return replyMessage(event.replyToken, `ブラックリスト: ${blacklist.join(', ')}`);
      }

      if (text.startsWith('black:')) {
        // ブラックリストに登録
        const [_, targetId] = text.split(':');
        if (!blacklist.includes(targetId)) {
          blacklist.push(targetId);
          fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
          return replyMessage(event.replyToken, `${targetId} をブラックリストに登録しました。`);
        }
      }

      if (text.startsWith('notblack:')) {
        // ブラックリストから削除
        const [_, targetId] = text.split(':');
        blacklist = blacklist.filter(id => id !== targetId);
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
        return replyMessage(event.replyToken, `${targetId} をブラックリストから削除しました。`);
      }

      if (text === '退出') {
        // 権限者以上が送るとそのグループから退出
        return leaveGroup(event.replyToken);
      }
    }

    if (text === 'おみくじ') {
      // おみくじ機能
      const fortunes = ['大吉', '中吉', '小吉', '凶'];
      const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
      return replyMessage(event.replyToken, `あなたのおみくじは「${fortune}」です。`);
    }
  });

  res.status(200).send('OK');
});

// メッセージ返信
const replyMessage = (replyToken, message) => {
  axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken,
    messages: [{ type: 'text', text: message }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    }
  });
};

// グループ退出
const leaveGroup = (replyToken) => {
  axios.post('https://api.line.me/v2/bot/group/leave', {
    replyToken
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    }
  });
};

// サーバー起動
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});