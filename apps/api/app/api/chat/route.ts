import type { ChatRequest } from '@zaha/shared';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { chatWithAgent } from '@/services/geminiService';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.messages?.length) {
      return errorResponse('messages are required', 400);
    }

    const result = await chatWithAgent(body.messages, body.userLocation ?? null);
    return jsonResponse(result);
  } catch (error) {
    console.error('POST /api/chat', error);
    return errorResponse('Chat request failed');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
