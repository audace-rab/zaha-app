import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getFeed } from '@/services/feedService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const feed = await getFeed({
      location: searchParams.get('location') ?? undefined,
      query: searchParams.get('query') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    });
    return jsonResponse({ feed });
  } catch (error) {
    console.error('GET /api/feed', error);
    return errorResponse('Failed to fetch feed');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
