import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/services/postService';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: postId, commentId } = await params;

    if (!isValidUuid(postId)) {
      return errorResponse('Post not found', 404);
    }

    if (!isValidUuid(commentId)) {
      return errorResponse('Comment not found', 404);
    }

    const body = await request.json().catch(() => ({})) as { authorId?: string };

    if (!body.authorId || !isValidUuid(body.authorId)) {
      return errorResponse('authorId is required and must be a valid UUID', 400);
    }

    const supabase = createAdminClient();

    const { data: comment } = await supabase
      .from('comments')
      .select('id, author_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .maybeSingle();

    if (!comment) {
      return errorResponse('Comment not found', 404);
    }

    if (comment.author_id !== body.authorId) {
      return errorResponse('You can only delete your own comments', 403);
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('DELETE /api/posts/[id]/comments/[commentId]', error);
      return errorResponse('Failed to delete comment');
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/posts/[id]/comments/[commentId]', error);
    return errorResponse('Failed to delete comment');
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
