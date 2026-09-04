import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api, type Comment } from '../lib/api';
import { supabase } from '../lib/supabase';

const DEMO_USER_ID = 'a1000000-0000-0000-0000-000000000001';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 32;

type FeedItem = {
  id: string;
  authorId: string;
  author: string;
  authorAvatar: string;
  authorCountryFlag?: string;
  media: { type: 'image' | 'video'; url: string }[];
  content: string;
  likes: number;
  commentsList: any[];
  isBusiness: boolean;
  location: string;
  timestamp: string;
  hasLiked?: boolean;
  isFollowing?: boolean;
};

type FeedScreenProps = {
  query?: string;
  onClearSearch?: () => void;
};

export default function FeedScreen({ query, onClearSearch }: FeedScreenProps) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USER_ID);


  // Create post
  const [createVisible, setCreateVisible] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postPhotos, setPostPhotos] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const resolveUserId = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const id = data?.session?.user?.id;
        if (id) setCurrentUserId(id);
      } catch (e) {
        console.warn('Session Supabase indisponible, utilisateur démo utilisé :', e);
      }
    };
    resolveUserId();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height + 20); // Bug android
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const load = useCallback(
    (q?: string) => {
      setLoading(true);
      setError(null);
      return api.getFeed(undefined, q, currentUserId)
        .then(({ feed: items }) => setFeed(items))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [currentUserId]
  );

  useEffect(() => {
    load(query);
  }, [query, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  // Like
  const handleToggleLike = (postId: string) => {
    const applyToggle = (list: FeedItem[]) =>
      list.map((item) =>
        item.id === postId
          ? { ...item, hasLiked: !item.hasLiked, likes: item.likes + (item.hasLiked ? -1 : 1) }
          : item
      );
    setFeed(applyToggle);
    api
      .toggleLike(postId, currentUserId)
      .then(({ liked, likes }) => {
        setFeed((prev) =>
          prev.map((item) => (item.id === postId ? { ...item, hasLiked: liked, likes } : item))
        );
      })
      .catch((e: Error) => {
        console.warn('Erreur like/unlike :', e.message);
        setFeed(applyToggle);
      });
  };

  // Follow
  const handleToggleFollow = (userId: string) => {
    const applyToggle = (list: FeedItem[]) =>
      list.map((item) =>
        item.authorId === userId ? { ...item, isFollowing: !item.isFollowing } : item
      );
    setFeed(applyToggle);
    const current = feed.find((i) => i.authorId === userId)?.isFollowing;
    const request = current
      ? api.unfollowUser(currentUserId, userId)
      : api.followUser(currentUserId, userId);
    request
      .then(({ following }) => {
        setFeed((prev) =>
          prev.map((item) =>
            item.authorId === userId ? { ...item, isFollowing: following } : item
          )
        );
      })
      .catch((e: Error) => {
        console.warn('Erreur follow/unfollow :', e.message);
        setFeed(applyToggle);
      });
  };

  // Create post
  const pickPhotos = () => {
    launchImageLibrary({ mediaType: 'mixed', selectionLimit: 5 }, (res) => {
      if (res.assets && res.assets.length > 0) {
        setPostPhotos((prev) => [
          ...prev,
          ...res.assets!
            .map((a) => {
              if (!a.uri) return null;
              const isVideo = a.type?.startsWith('video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(a.uri);
              return { uri: a.uri, type: (isVideo ? 'video' : 'image') as 'image' | 'video' };
            })
            .filter(Boolean) as { uri: string; type: 'image' | 'video' }[],
        ]);
      }
    });
  };

  const removePhoto = (index: number) => {
    setPostPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPost = async () => {
    if (!postContent.trim() && postPhotos.length === 0) return;
    setCreatingPost(true);
    try {
      const media: { url: string; type: string }[] = [];
      for (const item of postPhotos) {
        const { url } = await api.uploadPostMedia(currentUserId, item.uri);
        media.push({ url, type: item.type });
      }
      await api.createPost(currentUserId, postContent.trim(), undefined, media.length > 0 ? media : undefined);
      setPostContent('');
      setPostPhotos([]);
      setCreateVisible(false);
      await load(query);
    } catch (e) {
      console.warn('Erreur création post :', e);
    } finally {
      setCreatingPost(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.hint}>Vérifiez que l'API tourne (npm run dev:api)</Text>
      </View>
    );
  }

  const hasFilter = Boolean(query);

  return (
    <View style={styles.root}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }

        ListEmptyComponent={
          loading ? (
            <FeedSkeleton />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{hasFilter ? '🔍' : '📡'}</Text>
              <Text style={styles.emptyTitle}>
                {hasFilter ? 'Aucun résultat' : 'Feed indisponible'}
              </Text>
              <Text style={styles.emptyMessage}>
                {hasFilter
                  ? 'Aucune publication ne correspond à votre recherche.'
                  : 'Impossible de charger le feed pour le moment.'}
              </Text>
              {hasFilter ? (
                <TouchableOpacity style={styles.emptyButton} onPress={() => onClearSearch?.()} accessibilityRole="button" accessibilityLabel="Réinitialiser les filtres">
                  <Text style={styles.emptyButtonText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={() => load(query)} accessibilityRole="button" accessibilityLabel="Vérifiez votre connexion et réessayez">
                  <Text style={styles.emptyButtonText}>Vérifiez votre connexion</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostCard
            item={item}
            currentUserId={currentUserId}
            onToggleLike={handleToggleLike}
            onToggleFollow={handleToggleFollow}
            onRefreshFeed={() => load(query)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Créer un nouveau post"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create post modal */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { marginBottom: keyboardHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau post</Text>
              <TouchableOpacity onPress={() => { setCreateVisible(false); setPostContent(''); setPostPhotos([]); }} accessibilityRole="button" accessibilityLabel="Fermer">
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={postContent}
              onChangeText={setPostContent}
              placeholder="Quoi de neuf ?"
              multiline
              maxLength={2000}
            />
            {postPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPhotos}>
                {postPhotos.map((item, i) => (
                  <View key={i} style={styles.modalPhotoWrap}>
                    <Image source={{ uri: item.uri }} style={styles.modalPhoto} />
                    {item.type === 'video' && (
                      <View style={styles.videoOverlay}>
                        <Text style={styles.videoIcon}>▶</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.modalPhotoRemove} onPress={() => removePhoto(i)} accessibilityRole="button" accessibilityLabel="Retirer le média">
                      <Text style={styles.modalPhotoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAddPhoto} onPress={pickPhotos} accessibilityRole="button" accessibilityLabel="Ajouter des photos">
                <Text style={styles.modalAddPhotoText}>📷 Photos / Vidéos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, (!postContent.trim() && postPhotos.length === 0) && styles.modalSubmitDisabled]}
                onPress={submitPost}
                disabled={creatingPost || (!postContent.trim() && postPhotos.length === 0)}
                accessibilityRole="button"
                accessibilityLabel="Publier"
              >
                {creatingPost ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Publier</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PostCard({
  item,
  currentUserId,
  onToggleLike,
  onToggleFollow,
  onRefreshFeed,
}: {
  item: FeedItem;
  currentUserId: string;
  onToggleLike: (postId: string) => void;
  onToggleFollow: (userId: string) => void;
  onRefreshFeed: () => void;
}) {
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [comments, setComments] = useState<Comment[]>(item.commentsList ?? []);

  const refreshComments = async () => {
    try {
      const { comments: list } = await api.getComments(item.id);
      setComments(list);
    } catch (e) {
      console.warn('Erreur chargement commentaires :', e);
    }
  };

  const handleAddComment = async () => {
    const text = commentDraft.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      post_id: item.id,
      author_id: currentUserId,
      text,
      created_at: new Date().toISOString(),
      author: { name: 'Moi' },
    };
    setComments((prev) => [...prev, optimistic]);
    setCommentDraft('');
    try {
      const { comment } = await api.addComment(item.id, currentUserId, text);
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? comment : c)));
    } catch (e) {
      console.warn('Erreur ajout commentaire :', e);
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setCommentDraft(text);
    } finally {
      setSendingComment(false);
      onRefreshFeed();
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    if (comment.author_id !== currentUserId) return;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      await api.deleteComment(item.id, comment.id, currentUserId);
    } catch (e) {
      console.warn('Erreur suppression commentaire :', e);
    }
  };

  const visibleComments = showAllComments ? comments : comments.slice(0, 3);
  const hiddenCount = comments.length - visibleComments.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.author}>
            {item.authorCountryFlag ? `${item.authorCountryFlag} ` : ''}
            {item.author}
          </Text>
          <Text style={styles.location}>{item.location}</Text>
        </View>
        {item.authorId && item.authorId !== currentUserId && (
          <TouchableOpacity
            style={[styles.followBtn, item.isFollowing && styles.followBtnActive]}
            onPress={() => onToggleFollow(item.authorId)}
            accessibilityRole="button"
            accessibilityLabel={item.isFollowing ? `Ne plus suivre ${item.author}` : `Suivre ${item.author}`}
          >
            <Text style={[styles.followText, item.isFollowing && styles.followTextActive]}>
              {item.isFollowing ? 'Suivi' : 'Suivre'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {item.media.length > 1 ? (
        <PostCarousel media={item.media} />
      ) : item.media[0] ? (
        <View style={styles.singleMediaWrap}>
          <Image source={{ uri: item.media[0].url }} style={styles.media} />
          {item.media[0].type === 'video' && (
            <View style={styles.singleVideoOverlay}>
              <Text style={styles.singleVideoIcon}>▶</Text>
            </View>
          )}
        </View>
      ) : null}

      <Text style={styles.content}>{item.content}</Text>
      <View style={styles.metaRow}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onToggleLike(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={item.hasLiked ? 'Retirer le j\u2019aime' : 'Aimer cette publication'}
          accessibilityState={{ selected: Boolean(item.hasLiked) }}
        >
          <Text style={styles.likeIcon}>{item.hasLiked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}</Text>
          <Text style={[styles.likeCount, item.hasLiked && styles.likeCountActive]}>{item.likes}</Text>
        </TouchableOpacity>
        <View style={styles.commentButton}>
          <Text style={styles.commentCountIcon}>💬</Text>
          <Text style={styles.commentCount}>{comments.length}</Text>
        </View>
      </View>

      {/* Commentaires */}
      {visibleComments.length > 0 && (
        <View style={styles.commentsSection}>
          {visibleComments.map((c) => {
            const isMine = c.author_id === currentUserId;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.commentRow}
                onLongPress={() => isMine && handleDeleteComment(c)}
                delayLongPress={400}
                accessibilityRole="button"
                accessibilityLabel={isMine ? 'Commentaire, appui long pour supprimer' : `Commentaire de ${c.author?.name ?? ''}`}
                disabled={!isMine}
              >
                <View style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>
                    {c.author?.name ?? c.author_name ?? 'Anonyme'}
                    {isMine ? ' · toi' : ''}
                  </Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {hiddenCount > 0 && (
            <TouchableOpacity onPress={() => setShowAllComments(true)} accessibilityRole="button" accessibilityLabel={`Voir les ${hiddenCount} autres commentaires`}>
              <Text style={styles.viewAllText}>
                Voir les {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} commentaire{hiddenCount > 1 ? 's' : ''}...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input commentaire */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          value={commentDraft}
          onChangeText={setCommentDraft}
          placeholder="Écrire un commentaire..."
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity
          style={[styles.commentSubmit, (!commentDraft.trim() || sendingComment) && styles.commentSubmitDisabled]}
          onPress={handleAddComment}
          disabled={!commentDraft.trim() || sendingComment}
          accessibilityRole="button"
          accessibilityLabel="Publier le commentaire"
        >
          {sendingComment ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.commentSubmitText}>Publier</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PostCarousel({ media }: { media: { type: string; url: string }[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <View>
      <FlatList
        data={media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `media-${i}`}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setActiveIndex(Math.min(idx, media.length - 1));
        }}
        renderItem={({ item }) => (
          <View style={[styles.carouselSlide, { width: CARD_WIDTH }]}>
            <Image source={{ uri: item.url }} style={[styles.media, { width: CARD_WIDTH }]} />
            {item.type === 'video' && (
              <View style={styles.carouselVideoOverlay}>
                <Text style={styles.carouselVideoIcon}>▶</Text>
              </View>
            )}
          </View>
        )}
      />
      {media.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {media.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function FeedSkeleton() {
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonHeaderLines}>
              <View style={[styles.skeletonLine, { width: 120 }]} />
              <View style={[styles.skeletonLine, { width: 80 }]} />
            </View>
          </View>
          <View style={[styles.skeletonLine, styles.skeletonMedia]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 16, paddingBottom: 80 },



  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  headerText: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  author: { fontWeight: '600', fontSize: 15 },
  location: { color: '#6b7280', fontSize: 13 },

  // Follow
  followBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2563eb' },
  followBtnActive: { backgroundColor: '#2563eb' },
  followText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  followTextActive: { color: '#fff' },

  // Media
  media: { width: '100%', height: 220 },
  carouselSlide: { position: 'relative' },
  carouselVideoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  carouselVideoIcon: { color: '#fff', fontSize: 40 },
  singleMediaWrap: { position: 'relative' },
  singleVideoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  singleVideoIcon: { color: '#fff', fontSize: 40 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff' },

  // Content
  content: { padding: 12, fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 12, paddingBottom: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIcon: { fontSize: 18 },
  likeCount: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  likeCountActive: { color: '#ef4444' },
  commentButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentCountIcon: { fontSize: 16 },
  commentCount: { color: '#6b7280', fontSize: 14, fontWeight: '600' },

  // Comments
  commentsSection: { paddingHorizontal: 12, paddingBottom: 4, gap: 6 },
  commentRow: { flexDirection: 'row' },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#111827', lineHeight: 19 },
  viewAllText: { color: '#2563eb', fontSize: 13, fontWeight: '600', paddingVertical: 6 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    padding: 10,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#111827',
  },
  commentSubmit: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    minWidth: 64,
    alignItems: 'center',
  },
  commentSubmitDisabled: { opacity: 0.5 },
  commentSubmitText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Error / empty
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 8 },
  hint: { color: '#6b7280', textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyMessage: { color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  emptyButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  emptyButtonText: { color: '#fff', fontWeight: '600' },

  // Skeleton
  skeletonCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 16, padding: 12 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' },
  skeletonHeaderLines: { gap: 8 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: '#e5e7eb' },
  skeletonMedia: { height: 180, borderRadius: 8 },

  // FAB
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 20, color: '#6b7280', padding: 4 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 14, minHeight: 80, textAlignVertical: 'top', fontSize: 15, backgroundColor: '#f8fafc', marginBottom: 12 },
  modalPhotos: { marginBottom: 12 },
  modalPhotoWrap: { position: 'relative', marginRight: 8 },
  modalPhoto: { width: 80, height: 80, borderRadius: 10 },
  modalPhotoRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  modalPhotoRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  videoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  videoIcon: { color: '#fff', fontSize: 24 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalAddPhoto: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  modalAddPhotoText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  modalSubmit: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
