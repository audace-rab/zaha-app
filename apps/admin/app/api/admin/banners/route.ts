import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';
import { MAX_BANNER_TITLE, parseLink } from '@/lib/banners';

/** Liste de toutes les bannières (actives ou non), de la plus récente à la plus ancienne. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const { data, error } = await admin.supabase
      .from('ad_banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return jsonResponse({ banners: data ?? [] });
  } catch (error) {
    console.error('GET /api/admin/banners', error);
    return errorResponse('Failed to fetch banners');
  }
}

/** Création d'une bannière. Body : { title, imageUrl, linkUrl?, isActive? } */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      imageUrl?: string;
      linkUrl?: string | null;
      isActive?: boolean;
    };

    const title = body.title?.trim();
    if (!title) return errorResponse('title is required', 400);
    if (title.length > MAX_BANNER_TITLE) {
      return errorResponse(`title max ${MAX_BANNER_TITLE} caractères`, 400);
    }

    const imageUrl = body.imageUrl?.trim();
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return errorResponse('imageUrl is required (http(s) URL)', 400);
    }

    const linkUrl = parseLink(body.linkUrl);
    if (linkUrl === undefined && body.linkUrl !== undefined) {
      return errorResponse('linkUrl must be a valid http(s) URL', 400);
    }

    const { data, error } = await admin.supabase
      .from('ad_banners')
      .insert({
        title,
        image_url: imageUrl,
        link_url: linkUrl ?? null,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw error;

    return jsonResponse({ banner: data }, 201);
  } catch (error) {
    console.error('POST /api/admin/banners', error);
    return errorResponse('Failed to create banner');
  }
}
