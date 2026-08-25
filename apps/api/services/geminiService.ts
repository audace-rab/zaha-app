import { GoogleGenAI } from '@google/genai';
import type { ChatMessage, Coordinates } from '@zaha/shared';

const MODEL_NAME = 'gemini-3.6-flash';

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

export async function chatWithAgent(
  messages: ChatMessage[],
  userLocation: Coordinates | null
): Promise<{ text: string; sources?: { uri: string; title: string }[] }> {
  try {
    const ai = getAI();
    const conversationContext = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: conversationContext as never,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Tu es Zaha, l'assistant expert de Zaha App.
Localisation : ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : 'Non spécifiée'}.
Réponds en 4 lignes max, en français.`,
      },
    });

    const text = response.text || "Désolé, je n'ai pas pu générer de réponse.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks.flatMap((chunk) =>
      chunk.web?.uri
        ? [{ uri: chunk.web.uri, title: chunk.web.title || 'Source web' }]
        : []
    );

    return { text, sources };
  } catch (error) {
    console.error('Agent Chat Error:', error);
    return { text: 'Problème technique temporaire. Peux-tu reformuler ta question ?' };
  }
}

