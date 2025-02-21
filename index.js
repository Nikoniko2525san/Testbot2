const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

app.post("/webhook", async (req, res) => {
    const events = req.body.events;
    for (const event of events) {
        if (event.type === "message") {
            const replyToken = event.replyToken;
            const userMessage = event.message.text;

            await axios.post("https://api.line.me/v2/bot/message/reply", {
                replyToken: replyToken,
                messages: [{ type: "text", text: `あなたのメッセージ: ${userMessage}` }]
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                }
            });
        }
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));