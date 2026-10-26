import { requireUser } from '@/lib/api/auth';
import { checkRateLimit, rateLimitKey } from '@/lib/api/rateLimit';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { isValidUuid } from '@/services/postService';
import { trackPlaceClick, type ClickAction, type ClickSource } from '@/services/clickTrackingService';

const ACTIONS: ClickAction[] = ['reserve', 'call'];
const SOURCES: ClickSource[] = ['detail', 'feed'];

/**
 * Enregistre un clic sur « Réserver » ou « Appeler » pour un lieu (statistiques du dashboard).
 * Body : { "action": "reserve" | "call", "source"?: "detail" | "feed" }
 * L'utilisateur vient toujours du JWT.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    if (!isValidUuid(placeId)) {
      return errorResponse('Place not found', 404, request);
    }

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401, request);
    }

    // Évite qu'un client scripté gonfle les compteurs (best-effort, par utilisateur).
    if (!checkRateLimit(rateLimitKey(request, auth.userId, 'place-click'), 60, 60_000)) {
      return errorResponse('Too many requests', 429, request);
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      source?: string;
    };
    if (!body.action || !ACTIONS.includes(body.action as ClickAction)) {
      return errorResponse(`action must be one of: ${ACTIONS.join(', ')}`, 400, request);
    }
    const source = (body.source ?? 'detail') as ClickSource;
    if (!SOURCES.includes(source)) {
      return errorResponse(`source must be one of: ${SOURCES.join(', ')}`, 400, request);
    }

    const recorded = await trackPlaceClick({
      placeId,
      userId: auth.userId,
      action: body.action as ClickAction,
      source,
    });
    if (!recorded) {
      return errorResponse('Place not found', 404, request);
    }

    return jsonResponse({ tracked: true }, 201, request);
  } catch (error) {
    console.error('POST /api/places/[id]/clicks', error);
    return errorResponse('Failed to track click', 500, request);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
