import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

export const ARIX_MODEL = 'gemini-4-hydrogen';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export function extractAnswerAndThoughts(response: GenerateContentResponse): {
  text: string;
  thoughts: string;
} {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const answerChunks: string[] = [];
  const thoughtChunks: string[] = [];

  for (const part of parts) {
    if (typeof part.text !== 'string' || !part.text) continue;
    if ((part as { thought?: boolean }).thought) {
      thoughtChunks.push(part.text.trim());
    } else {
      answerChunks.push(part.text);
    }
  }

  return {
    text: answerChunks.join('').trim() || (response.text || '').trim(),
    thoughts: thoughtChunks.filter(Boolean).join('\n\n').trim(),
  };
}
