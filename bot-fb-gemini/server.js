// server.js
import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { callGemini } from './utils/gemini.js';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Variables d'environnement (contrôle strict)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_TOKEN = process.env.PAGE_TOKEN;
if (!VERIFY_TOKEN || !PAGE_TOKEN) {
  console.error('❌ ERREUR: VERIFY_TOKEN ou PAGE_TOKEN manquant dans les env vars.');
  // on continue mais les erreurs seront loggées pour sécurité
}

// Healthcheck simple
app.get('/', (req, res) => res.send('Bot Messenger + Gemini — OK'));

// Endpoint pour validation Facebook
app.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook vérifié avec succès.');
      return res.status(200).send(challenge);
    }
    console.warn('❌ Échec vérification webhook: token mismatch or wrong mode.');
    return res.sendStatus(403);
  } catch (err) {
    console.error('Erreur GET /webhook:', err);
    return res.sendStatus(500);
  }
});

// Endpoint pour recevoir les messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Facebook envoie "page" pour les pages Messenger
    if (body.object !== 'page') {
      return res.sendStatus(404);
    }

    // Répondre 200 rapidement à Facebook (acknowledge)
    res.status(200).send('EVENT_RECEIVED');

    // Traiter les entrées asynchronement (mais dans le même processus)
    // On parcourt entries et messaging
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (!senderId) continue;

        // Messages texte
        if (event.message && event.message.text) {
          const userText = event.message.text;
          console.log(`📩 Message reçu de ${senderId}:`, userText);

          // Appel Gemini (Meva)
          let reply;
          try {
            reply = await callGemini(userText);
          } catch (err) {
            console.error('Erreur callGemini:', err);
            reply = "Désolé, j'ai un problème pour générer la réponse. Réessaie un peu plus tard.";
          }

          // Envoi de la réponse
          try {
            await sendMessage(senderId, reply);
          } catch (err) {
            console.error('Erreur sendMessage:', err);
          }
        }

        // Ici tu peux gérer d'autres événements (attachments, postbacks, etc.)
        if (event.postback) {
          console.log('Postback reçu:', event.postback);
          // Exemple: répondre au postback
          if (event.postback.payload) {
            await sendMessage(senderId, "Merci pour ton clic ! 😊");
          }
        }
      }
    }
  } catch (err) {
    console.error('Erreur POST /webhook:', err);
    // Facebook attend 200 pour ack; on renverra 500 si erreur critique
    try { res.sendStatus(500); } catch(e) {/* ignore */}
  }
});

// Envoi de message vers la Graph API
async function sendMessage(recipientId, text) {
  if (!PAGE_TOKEN) {
    console.error('PAGE_TOKEN manquant — impossible d\'envoyer le message.');
    return;
  }

  const body = {
    messaging_type: 'RESPONSE',
    recipient: { id: recipientId },
    message: { text }
  };

  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Erreur API Graph:', data);
    throw new Error(`Facebook API erreur: ${JSON.stringify(data)}`);
  }
  console.log('✅ Message envoyé à', recipientId);
  return data;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Bot en ligne sur le port ${PORT}`));
