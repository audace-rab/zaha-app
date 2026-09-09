import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    if (!isValidUuid(postId)) {
      return errorResponse('Post not found', 404);
    }

    const body = await request.json().catch(() => ({})) as { userId?: string };

    if (!body.userId || !isValidUuid(body.userId)) {
      return errorResponse('userId is required and must be a valid UUID', 400);
    }

    const supabase = createAdminClient();

    const { data: post } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return errorResponse('Post not found', 404);
    }

    if (post.author_id !== body.userId) {
      return errorResponse('Post not found', 404);
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('DELETE /api/posts/[id]', error);
      return errorResponse('Failed to delete post');
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/posts/[id]', error);
    return errorResponse('Failed to delete post');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
