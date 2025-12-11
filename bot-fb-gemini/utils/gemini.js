// utils/gemini.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Contrôle basique
if (!GEMINI_API_KEY) {
  console.error('❌ ERREUR: GEMINI_API_KEY manquant dans les env vars.');
}

/**
 * callGemini(userText)
 * - Envoie le prompt (Meva prof de français) + userText à Gemini
 * - Retourne la chaîne de réponse
 *
 * Si ton accès Gemini exige un autre modèle/endpoint, modifier GEMINI_URL.
 */
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Prompt de système — Meva prof de français
 * On met des consignes claires pour la meilleure cohérence.
 */
const SYSTEM_PROMPT = `Tu es Meva, professeure de français. 
Tu es douce, patiente et pédagogique. 
Ta mission: corriger et expliquer la langue française, donner exemples, corriger erreurs et proposer une version améliorée.
Réponds en français, de façon claire et concise.`;

export async function callGemini(userText) {
  if (!GEMINI_API_KEY) {
    return "Clé Gemini non configurée.";
  }

  // Construire prompt final
  const prompt = `${SYSTEM_PROMPT}\n\nÉlève: ${userText}\n\nMeva:`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    // Generation config optionnel — optimiser selon besoin
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 512
    }
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // timeout nativement pas supporté par node-fetch v3 sans AbortController
    });

    const data = await res.json();

    // Différents formats possibles; on essaye d'extraire le texte
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.output?.[0]?.content ||
      data?.error?.message ||
      null;

    if (!text) {
      console.warn('Réponse Gemini inattendue:', JSON.stringify(data));
      return "Désolé, je n'ai pas de réponse pour l'instant.";
    }

    // Nettoyage simple (enlever espaces superflus)
    return text.toString().trim();
  } catch (err) {
    console.error('Erreur lors de l\'appel à Gemini:', err);
    return "Erreur interne lors de génération.";
  }
}
