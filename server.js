import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { callGemini } from "./utils/gemini.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_TOKEN = process.env.PAGE_TOKEN;

app.get("/", (req, res) => {
  res.send("Bot Messenger + Gemini — OK✔");
});

// Validation Facebook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Réception message utilisateur
app.post("/webhook", async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");

  const entries = req.body.entry || [];

  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;

      if (!senderId) continue;

      if (event.message?.text) {
        const userText = event.message.text;

        // Gemini → Meva
        const reply = await callGemini(userText);

        // Messenger reply
        await sendMessage(senderId, reply);
      }
    }
  }
});

// Fonction envoi Messenger
async function sendMessage(recipientId, text) {
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: recipientId },
    message: { text }
  };

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Erreur Messenger:", data);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Bot en ligne sur port ${PORT}`));
