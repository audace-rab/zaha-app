import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse, getPagination, isValidUuid } from '@/lib/api';

/** Liste paginée des posts avec auteur, médias et commentaires (avec leur auteur). */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { from, to, page, limit } = getPagination(request.url);

    const { data, count, error } = await admin.supabase
      .from('posts')
      // FK explicites : posts<->profiles existe aussi via likes (many-to-many) → ambigu sinon.
      .select(
        '*, profiles!posts_author_id_fkey(name, avatar_url), place:places!posts_place_id_fkey(id, name, status), post_media(type, url), comments(id, text, created_at, profiles!comments_author_id_fkey(name))',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'comments', ascending: true })
      .range(from, to);

    if (error) throw error;

    const posts = (data ?? []).map((p) => {
      const profile = p.profiles as unknown as { name: string; avatar_url: string | null } | null;
      const rawPlace = (Array.isArray(p.place) ? p.place[0] : p.place) as unknown as
        | { id: string; name: string; status: string }
        | null
        | undefined;
      const rawComments = (p.comments ?? []) as unknown as Array<{
        id: string;
        text: string;
        created_at: string;
        profiles: { name: string } | null;
      }>;
      return {
        id: p.id,
        content: p.content,
        location: p.location,
        is_business: p.is_business,
        is_sponsored: p.is_sponsored,
        created_at: p.created_at,
        authorName: profile?.name ?? null,
        authorAvatar: profile?.avatar_url ?? null,
        place: rawPlace ? { id: rawPlace.id, name: rawPlace.name, status: rawPlace.status } : null,
        media: (p.post_media as unknown as Array<{ type: string; url: string }>) ?? [],
        comments: rawComments.map((c) => ({
          id: c.id,
          text: c.text,
          created_at: c.created_at,
          authorName: c.profiles?.name ?? null,
        })),
      };
    });

    return jsonResponse({ posts, total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/posts', error);
    return errorResponse('Failed to fetch posts');
  }
}

const MAX_MEDIA = 10;

/**
 * Crée un post SPONSORISÉ depuis le back-office : il est épinglé tout en haut du feed
 * de tous les utilisateurs. L'auteur est le compte admin connecté.
 * Body : { content?, location?, placeId?, media?: [{ url, type? }] }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const body = (await request.json()) as {
      content?: string;
      location?: string;
      placeId?: string | null;
      media?: Array<{ url?: string; type?: string }>;
    };

    const content = body.content?.trim() ?? '';
    const media = (body.media ?? []).filter(
      (m): m is { url: string; type?: string } => typeof m?.url === 'string' && m.url.trim() !== ''
    );
    if (!content && media.length === 0) {
      return errorResponse('content or media is required', 400);
    }
    if (media.length > MAX_MEDIA) {
      return errorResponse(`Maximum ${MAX_MEDIA} médias par post`, 400);
    }
    if (media.some((m) => !/^https?:\/\//i.test(m.url.trim()))) {
      return errorResponse('media url must be an http(s) URL', 400);
    }

    let placeId: string | null = null;
    if (body.placeId) {
      if (!isValidUuid(body.placeId)) {
        return errorResponse('placeId must be a valid UUID', 400);
      }
      const { data: place } = await admin.supabase
        .from('places')
        .select('id')
        .eq('id', body.placeId)
        .maybeSingle();
      if (!place) return errorResponse('Place not found', 404);
      placeId = place.id;
    }

    const { data: post, error } = await admin.supabase
      .from('posts')
      .insert({
        author_id: admin.userId,
        content,
        location: body.location?.trim() ?? '',
        is_business: true,
        is_sponsored: true,
        place_id: placeId,
      })
      .select('id')
      .single();
    if (error) throw error;

    if (media.length > 0) {
      const { error: mediaError } = await admin.supabase.from('post_media').insert(
        media.map((m, i) => ({
          post_id: post.id,
          url: m.url.trim(),
          type: m.type === 'video' ? 'video' : 'image',
          sort_order: i,
        }))
      );
      if (mediaError) {
        // Pas de post sponsorisé à moitié créé : on annule.
        await admin.supabase.from('posts').delete().eq('id', post.id);
        throw mediaError;
      }
    }

    return jsonResponse({ post: { id: post.id } }, 201);
  } catch (error) {
    console.error('POST /api/admin/posts', error);
    return errorResponse('Failed to create post');
  }
}

