import type { FeedItem } from '@zaha/shared';
import { createAdminClient } from '@/lib/supabase/server';

export async function getFeed(): Promise<FeedItem[]> {
  try {
    const supabase = createAdminClient();

  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      location,
      is_business,
      created_at,
      author:profiles!posts_author_id_fkey (
        id,
        name,
        avatar_url,
        country_flag
      ),
      post_media ( type, url, sort_order ),
      likes ( user_id ),
      comments (
        id,
        text,
        created_at,
        author:profiles!comments_author_id_fkey ( name, avatar_url )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Feed fetch error:', error);
    return getSeedFeed();
  }

  if (!posts?.length) return getSeedFeed();

  return posts.map((post) => {
    const author = Array.isArray(post.author) ? post.author[0] : post.author;
    const media = (post.post_media ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ type: m.type as 'image' | 'video', url: m.url }));

    const commentsList = (post.comments ?? []).map((c) => {
      const commentAuthor = Array.isArray(c.author) ? c.author[0] : c.author;
      return {
        id: c.id,
        author: commentAuthor?.name ?? 'Anonyme',
        authorAvatar: commentAuthor?.avatar_url ?? '',
        text: c.text,
        timestamp: new Date(c.created_at).getTime(),
        mentions: [],
      };
    });

    return {
      id: post.id,
      author: author?.name ?? 'Utilisateur',
      authorAvatar: author?.avatar_url ?? '',
      authorCountryFlag: author?.country_flag ?? undefined,
      media,
      content: post.content,
      likes: post.likes?.length ?? 0,
      commentsList,
      isBusiness: post.is_business,
      location: post.location ?? '',
      timestamp: new Date(post.created_at).toISOString(),
    };
  });
  } catch (error) {
    console.error('Feed service error:', error);
    return getSeedFeed();
  }
}

function getSeedFeed(): FeedItem[] {
  return [
    {
      id: 'seed-1',
      author: 'Alex Voyageur',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      authorCountryFlag: '🇲🇬',
      media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80' }],
      content: 'Vue incroyable depuis le Rova ce matin ! Madagascar est magique.',
      likes: 42,
      commentsList: [],
      isBusiness: false,
      location: 'Antananarivo',
      timestamp: new Date().toISOString(),
    },
  ];
}
