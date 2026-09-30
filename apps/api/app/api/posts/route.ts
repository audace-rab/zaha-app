import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';

interface MediaItem {
  url: string;
  type?: string;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const body = (await request.json()) as {
      content?: string;
      location?: string;
      media?: MediaItem[];
    };

    if (!body.content?.trim() && !body.media?.length) {
      return errorResponse('content or media is required', 400);
    }

    const supabase = auth.supabase;

    // Créer le post (RLS : author_id = auth.uid())
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: auth.userId,
        content: body.content?.trim() ?? '',
        location: body.location?.trim() ?? '',
      })
      .select('id')
      .maybeSingle();

    if (postError || !post) {
      console.error('Post create error:', postError);
      return errorResponse('Failed to create post', 500);
    }

    // Insérer les médias si fournis
    if (body.media?.length) {
      const mediaRows = body.media.map((m, i) => ({
        post_id: post.id,
        url: m.url,
        type: m.type === 'video' ? 'video' : 'image',
        sort_order: i,
      }));

      const { error: mediaError } = await supabase
        .from('post_media')
        .insert(mediaRows);

      if (mediaError) {
        console.error('Post media insert error:', mediaError);
        // Le post existe déjà — on le retourne quand même
      }
    }

    // Retourner le post complet avec médias
    const { data: fullPost } = await supabase
      .from('posts')
      .select('*, post_media(type, url, sort_order)')
      .eq('id', post.id)
      .maybeSingle();

    return jsonResponse({ post: fullPost ?? post });
  } catch (error) {
    console.error('POST /api/posts', error);
    return errorResponse('Failed to create post');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
