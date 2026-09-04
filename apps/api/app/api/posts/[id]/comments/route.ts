import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createServerClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    if (!isValidUuid(postId)) {
      return errorResponse('Post not found', 404);
    }

    const supabase = createAdminClient();

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        author:profiles!comments_author_id_fkey ( name, avatar_url )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET /api/posts/[id]/comments', error);
      return errorResponse('Failed to fetch comments');
    }

    const items = (comments ?? []).map((c) => {
      const author = Array.isArray(c.author) ? c.author[0] : c.author;
      return { ...c, author };
    });

    return jsonResponse({ comments: items });
  } catch (error) {
    console.error('GET /api/posts/[id]/comments', error);
    return errorResponse('Failed to fetch comments');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    if (!isValidUuid(postId)) {
      return errorResponse('Post not found', 404);
    }

    const body = (await request.json()) as {
      authorId?: string;
      text?: string;
    };

    if (!body.authorId || !isValidUuid(body.authorId)) {
      return errorResponse('authorId is required and must be a valid UUID', 400);
    }

    if (!body.text || !body.text.trim()) {
      return errorResponse('text is required and must not be empty', 400);
    }

    const supabase = createAdminClient();

    const { data: post } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return errorResponse('Post not found', 404);
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: body.authorId, text: body.text.trim() })
      .select(`
        *,
        author:profiles!comments_author_id_fkey ( name, avatar_url )
      `)
      .maybeSingle();

    if (error) {
      console.error('POST /api/posts/[id]/comments', error);
      return errorResponse('Failed to create comment');
    }

    const author = Array.isArray(comment?.author) ? comment?.author[0] : comment?.author;

    return jsonResponse({ comment: { ...comment, author } }, 201);
  } catch (error) {
    console.error('POST /api/posts/[id]/comments', error);
    return errorResponse('Failed to create comment');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
