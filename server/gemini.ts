import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';

export const ARIX_MODEL = 'gemini-4-hydrogen';
export const ARIX_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

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

export function isRateLimitOrTransientError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    raw.includes('resource_exhausted') ||
    raw.includes('429') ||
    raw.includes('rate limit') ||
    raw.includes('quota') ||
    raw.includes('503') ||
    raw.includes('unavailable') ||
    raw.includes('overloaded')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  options?: {
    allowFallback?: boolean;
    onRetry?: (reason: string) => void;
  }
): Promise<GenerateContentResponse> {
  const allowFallback = options?.allowFallback !== false;

  try {
    return await ai.models.generateContent(params);
  } catch (firstErr) {
    if (!isRateLimitOrTransientError(firstErr)) {
      throw firstErr;
    }

    // Brief exponential backoff retry on transient rate bursts
    options?.onRetry?.('Retrying after brief API pause...');
    await sleep(1600);
    try {
      return await ai.models.generateContent(params);
    } catch (secondErr) {
      if (!isRateLimitOrTransientError(secondErr)) {
        throw secondErr;
      }

      if (allowFallback && params.model !== ARIX_FALLBACK_MODEL) {
        options?.onRetry?.('Switching to high-throughput Gemini Flash Lite...');
        const fallbackConfig = params.config ? { ...params.config } : undefined;
        if (fallbackConfig?.thinkingConfig) {
          fallbackConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.LOW,
          };
        }
        return await ai.models.generateContent({
          ...params,
          model: ARIX_FALLBACK_MODEL,
          config: fallbackConfig,
        });
      }

      throw secondErr;
    }
  }
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
