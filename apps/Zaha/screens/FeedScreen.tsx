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
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

const DEMO_USER_ID = 'a1000000-0000-0000-0000-000000000001';
const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const [feedMode, setFeedMode] = useState<'personal' | 'all'>('all');

  // Create post
  const [createVisible, setCreateVisible] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postPhotos, setPostPhotos] = useState<string[]>([]);
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
      const fetcher =
        feedMode === 'personal'
          ? api.getFeed(undefined, undefined, currentUserId)
          : api.getFeed(undefined, q, currentUserId);
      return fetcher
        .then(({ feed: items }) => setFeed(items))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [currentUserId, feedMode]
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
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 5 }, (res) => {
      if (res.assets && res.assets.length > 0) {
        setPostPhotos((prev) => [...prev, ...res.assets!.map((a) => a.uri!).filter(Boolean)]);
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
      for (const uri of postPhotos) {
        const { url } = await api.uploadPostMedia(currentUserId, uri);
        media.push({ url, type: 'image' });
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
        ListHeaderComponent={
          <View style={styles.feedToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, feedMode === 'all' && styles.toggleBtnActive]}
              onPress={() => setFeedMode('all')}
              accessibilityRole="button"
              accessibilityLabel="Voir tout le feed"
              accessibilityState={{ selected: feedMode === 'all' }}
            >
              <Text style={[styles.toggleText, feedMode === 'all' && styles.toggleTextActive]}>Tout voir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, feedMode === 'personal' && styles.toggleBtnActive]}
              onPress={() => setFeedMode('personal')}
              accessibilityRole="button"
              accessibilityLabel="Voir le feed personnalisé"
              accessibilityState={{ selected: feedMode === 'personal' }}
            >
              <Text style={[styles.toggleText, feedMode === 'personal' && styles.toggleTextActive]}>Feed perso</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <FeedSkeleton />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{hasFilter ? '🔍' : feedMode === 'personal' ? '👤' : '📡'}</Text>
              <Text style={styles.emptyTitle}>
                {hasFilter ? 'Aucun résultat' : feedMode === 'personal' ? 'Rien à voir ici' : 'Feed indisponible'}
              </Text>
              <Text style={styles.emptyMessage}>
                {hasFilter
                  ? 'Aucune publication ne correspond à votre recherche.'
                  : feedMode === 'personal'
                    ? 'Suivez des utilisateurs pour voir leurs publications ici.'
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
                  onPress={() => handleToggleFollow(item.authorId)}
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
              <Image source={{ uri: item.media[0].url }} style={styles.media} />
            ) : null}

            <Text style={styles.content}>{item.content}</Text>
            <View style={styles.metaRow}>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => handleToggleLike(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={item.hasLiked ? 'Retirer le j\u2019aime' : 'Aimer cette publication'}
                accessibilityState={{ selected: Boolean(item.hasLiked) }}
              >
                <Text style={styles.likeIcon}>{item.hasLiked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}</Text>
                <Text style={[styles.likeCount, item.hasLiked && styles.likeCountActive]}>{item.likes}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
                {postPhotos.map((uri, i) => (
                  <View key={i} style={styles.modalPhotoWrap}>
                    <Image source={{ uri }} style={styles.modalPhoto} />
                    <TouchableOpacity style={styles.modalPhotoRemove} onPress={() => removePhoto(i)} accessibilityRole="button" accessibilityLabel="Retirer la photo">
                      <Text style={styles.modalPhotoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAddPhoto} onPress={pickPhotos} accessibilityRole="button" accessibilityLabel="Ajouter des photos">
                <Text style={styles.modalAddPhotoText}>📷 Photos</Text>
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
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(Math.min(idx, media.length - 1));
        }}
        renderItem={({ item }) => (
          <Image source={{ uri: item.url }} style={[styles.media, { width: SCREEN_WIDTH }]} />
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

  // Feed toggle
  feedToggle: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  toggleText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '700' },

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
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff' },

  // Content
  content: { padding: 12, fontSize: 15, lineHeight: 22 },
  metaRow: { paddingHorizontal: 12, paddingBottom: 12 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  likeIcon: { fontSize: 18 },
  likeCount: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  likeCountActive: { color: '#ef4444' },

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
  modalActions: { flexDirection: 'row', gap: 10 },
  modalAddPhoto: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  modalAddPhotoText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  modalSubmit: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
