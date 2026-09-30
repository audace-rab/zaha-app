import { getOptionalUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { getFeed } from '@/services/feedService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Viewer dérivé du JWT (jamais d'un query param spoofable)
    const auth = await getOptionalUser(request);

    const limitRaw = Number(searchParams.get('limit'));
    const { items, nextCursor } = await getFeed({
      location: searchParams.get('location') ?? undefined,
      query: searchParams.get('query') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      viewerId: auth?.userId,
    });
    return jsonResponse({ feed: items, nextCursor }, 200, request);
  } catch (error) {
    console.error('GET /api/feed', error);
    return errorResponse('Failed to fetch feed', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
