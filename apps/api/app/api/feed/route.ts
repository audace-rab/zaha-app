import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getFeed } from '@/services/feedService';

export async function GET() {
  try {
    const feed = await getFeed();
    return jsonResponse({ feed });
  } catch (error) {
    console.error('GET /api/feed', error);
    return errorResponse('Failed to fetch feed');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
