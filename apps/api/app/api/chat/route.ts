import type { ChatRequest } from '@zaha/shared';
import { getOptionalUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { chatWithAgent } from '@/services/geminiService';

export async function POST(request: Request) {
  try {
    // Auth optionnelle : le chat reste utilisable sans compte en démo,
    // mais le rate limit est plus strict pour les anonymes.
    const auth = await getOptionalUser(request);

    const key = rateLimitKey(request, auth?.userId, 'chat');
    if (!checkRateLimit(key, auth ? 30 : 10, 60_000)) {
      return errorResponse('Too many requests, please retry later', 429, request);
    }

    const body = (await request.json()) as ChatRequest;

    if (!body.messages?.length) {
      return errorResponse('messages are required', 400, request);
    }

    const result = await chatWithAgent(body.messages, body.userLocation ?? null);
    return jsonResponse(result, 200, request);
  } catch (error) {
    console.error('POST /api/chat', error);
    return errorResponse('Chat request failed', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
