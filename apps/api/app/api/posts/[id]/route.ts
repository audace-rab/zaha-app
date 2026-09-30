import { requireUser } from '@/lib/api/auth';
import { errorResponse, jsonResponse, optionsResponse } from '@/lib/api/response';
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

    const auth = await requireUser(request);
    if (!auth) {
      return errorResponse('Authentication required', 401);
    }

    const supabase = auth.supabase;

    const { data: post } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return errorResponse('Post not found', 404);
    }

    if (post.author_id !== auth.userId) {
      return errorResponse('Post not found', 404);
    }

    // RLS : seul l'auteur peut supprimer (policy "Authors can delete own posts")
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
