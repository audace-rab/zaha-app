import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import ReservationScreen from './ReservationScreen';

const DEMO_USER_ID = 'a1000000-0000-0000-0000-000000000001';

type Place = {
  id: string;
  name: string;
  rating?: number;
  address?: string;
  snippet?: string;
  phoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  photos?: string[];
  openingHours?: string;
  isPro?: boolean;
  location?: { latitude: number; longitude: number };
};

type PlaceDetailScreenProps = {
  place: Place | null;
  onBack: () => void;
};

type Review = {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  user?: { name: string; avatar_url?: string };
};

// Le retour se fait via le bouton physique du téléphone (BackHandler dans App.tsx).
export default function PlaceDetailScreen({ place }: PlaceDetailScreenProps) {
  const [photoLoading, setPhotoLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USER_ID);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showReservation, setShowReservation] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  // Galerie : photos[] si disponible, complétée par photoUrl (déduupliquée).
  const photoList = place
    ? Array.from(
        new Set([...(place.photos ?? []), ...(place.photoUrl ? [place.photoUrl] : [])]),
      )
    : [];

  // Reset galerie/carte/quand on ouvre un autre lieu + avis.
  useEffect(() => {
    setActivePhotoIndex(0);
    setPhotoLoading(true);
    setShowMap(false);
    setBookmarked(false);
    setReviews([]);
    setAverageRating(0);
    setReviewCount(0);
    setReviewsLoading(true);
    setReviewsError(null);
    setFormVisible(false);
    setFormRating(0);
    setFormComment('');
    setFormSubmitting(false);
    setFormError(null);
  }, [place?.id]);

  // Charger les reviews du lieu.
  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    const load = async () => {
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const result = await api.fetchReviews(place.id);
        if (cancelled) return;
        setReviews(result.reviews ?? []);
        setAverageRating(result.averageRating ?? 0);
        setReviewCount(result.reviewCount ?? 0);
        const mine = (result.reviews ?? []).find((r) => r.user_id === currentUserId);
        if (mine && !cancelled) {
          setFormRating(mine.rating);
          setFormComment(mine.comment ?? '');
        }
      } catch (e) {
        if (!cancelled) setReviewsError(e instanceof Error ? e.message : 'Erreur de chargement des avis');
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [place?.id, currentUserId]);

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

  // Charger le statut bookmark initial quand le lieu ou l'utilisateur change.
  useEffect(() => {
    if (!place || !currentUserId) return;
    let cancelled = false;
    api
      .isBookmarked(currentUserId, place.id)
      .then(({ bookmarked }) => {
        if (!cancelled) setBookmarked(bookmarked);
      })
      .catch(() => {
        // Statut inconnu : garder false par défaut
      });
    return () => {
      cancelled = true;
    };
  }, [place?.id, currentUserId]);

  const handleSubmitReview = async () => {
    if (!place || formRating < 1 || formRating > 5) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.submitReview(place.id, currentUserId, formRating, formComment || undefined);
      // Recharger les avis.
      const result = await api.fetchReviews(place.id);
      setReviews(result.reviews ?? []);
      setAverageRating(result.averageRating ?? 0);
      setReviewCount(result.reviewCount ?? 0);
      setFormVisible(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur lors de la publication');
    } finally {
      setFormSubmitting(false);
    }
  };

  const myReview = reviews.find((r) => r.user_id === currentUserId);

  if (!place) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Aucun lieu sélectionné</Text>
      </View>
    );
  }

  const openInMaps = async () => {
    let url = place.googleMapsUri;
    if (!url && place.location) {
      url = `https://maps.google.com/?q=${place.location.latitude},${place.location.longitude}`;
    }
    if (!url && place.address) {
      url = `https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.address)}`;
    }
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // Lien ignoré si aucune app capable de l'ouvrir
    }
  };

  const sharePlace = async () => {
    let detail = place.googleMapsUri;
    if (!detail) detail = place.address ? `${place.name} — ${place.address}` : place.name;
    try {
      await Share.share({ message: `${place.name}\n${detail}` });
    } catch {
      // Partage annulé par l'utilisateur
    }
  };

  const handleToggleBookmark = () => {
    const previous = bookmarked;
    setBookmarked(!previous);
    api
      .toggleBookmark(currentUserId, place.id)
      .then(({ bookmarked: serverValue }) => setBookmarked(serverValue))
      .catch((e: Error) => {
        console.warn('Erreur bookmark :', e.message);
        setBookmarked(previous);
      });
  };

  return (
    <View style={styles.container}>
      {showReservation && place ? (
        <View style={styles.reservationOverlay}>
          <View style={styles.reservationHeader}>
            <TouchableOpacity
              onPress={() => setShowReservation(false)}
              accessibilityRole="button"
              accessibilityLabel="Retour au lieu"
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Retour</Text>
            </TouchableOpacity>
          </View>
          <ReservationScreen
            place={{ id: place.id, name: place.name, address: place.address }}
            onDone={() => setShowReservation(false)}
          />
        </View>
      ) : (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {photoList.length > 1 ? (
        <View style={styles.gallery}>
          <FlatList
            data={photoList}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri) => uri}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setActivePhotoIndex(Math.min(index, photoList.length - 1));
            }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={[styles.photo, { width: screenWidth }]}
                onLoadStart={() => setPhotoLoading(true)}
                onLoadEnd={() => setPhotoLoading(false)}
              />
            )}
          />
          {photoLoading && (
            <View style={styles.photoLoading} pointerEvents="none">
              <ActivityIndicator color="#2563eb" />
            </View>
          )}
          <View style={styles.dots} pointerEvents="none">
            {photoList.map((uri, index) => (
              <View
                key={`dot-${index}`}
                style={[styles.dot, index === activePhotoIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      ) : photoList.length === 1 ? (
        <View style={styles.photoHeader}>
          <Image
            source={{ uri: photoList[0] }}
            style={styles.photo}
            onLoadStart={() => setPhotoLoading(true)}
            onLoadEnd={() => setPhotoLoading(false)}
          />
          {photoLoading && (
            <View style={styles.photoLoading} pointerEvents="none">
              <ActivityIndicator color="#2563eb" />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>📍</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {place.isPro && <Text style={styles.proBadge}>PRO</Text>}
          <Text style={styles.name}>{place.name}</Text>
        </View>

        {place.rating != null && (
          <Text style={styles.rating}>★ {place.rating}</Text>
        )}

        {place.address && (place.googleMapsUri || place.location) ? (
          <TouchableOpacity
            onPress={openInMaps}
            accessibilityRole="link"
            accessibilityLabel="Ouvrir dans Google Maps"
          >
            <Text style={[styles.line, styles.addressLink]}>
              {place.address} ↗
            </Text>
          </TouchableOpacity>
        ) : place.address ? (
          <Text style={styles.line}>{place.address}</Text>
        ) : null}
        {place.openingHours ? <Text style={styles.line}>🕒 {place.openingHours}</Text> : null}
        {place.phoneNumber ? <Text style={styles.line}>📞 {place.phoneNumber}</Text> : null}
        {place.snippet ? <Text style={styles.snippet}>{place.snippet}</Text> : null}

        <View style={styles.actionsRow}>
          {place.location && (
            <TouchableOpacity
              style={[styles.actionButton, styles.mapsButton]}
              onPress={() => setShowMap((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showMap ? 'Masquer la carte' : 'Voir sur la carte'}
            >
              <Text style={styles.mapsButtonText}>
                {showMap ? '🗺️ Masquer la carte' : '🗺️ Voir sur la carte'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.bookmarkButton, bookmarked && styles.bookmarkButtonActive]}
            onPress={handleToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Text style={[styles.bookmarkButtonText, bookmarked && styles.bookmarkButtonTextActive]}>
              {bookmarked ? '❤️ Sauvegardé' : '♡ Sauvegarder'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={sharePlace}
          >
            <Text style={styles.shareButtonText}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.reserveButton]}
            onPress={() => setShowReservation(true)}
            accessibilityRole="button"
            accessibilityLabel="Réserver ce lieu"
          >
            <Text style={styles.reserveButtonText}>📅 Réserver</Text>
          </TouchableOpacity>
        </View>

        {showMap && place.location && (
          <MapView
            key={place.id}
            style={styles.detailMap}
            scrollEnabled
            zoomEnabled
            initialRegion={{
              latitude: place.location.latitude,
              longitude: place.location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              }}
              title={place.name}
              pinColor="#2563eb"
            />
          </MapView>
        )}

        {/* ── Avis ── */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>Avis</Text>
            {reviewCount > 0 && (
              <Text style={styles.reviewsStats}>
                ★ {averageRating.toFixed(1)} · {reviewCount} avis
              </Text>
            )}
          </View>

          {!reviewsLoading && reviewCount === 0 && !formVisible && (
            <Text style={styles.reviewsEmpty}>
              Aucun avis pour le moment. Soyez le premier !
            </Text>
          )}

          {/* Bouton « Écrire un avis » / « Modifier votre avis » */}
          {!reviewsLoading && !formVisible && (
            <TouchableOpacity
              style={styles.reviewFormToggle}
              activeOpacity={0.8}
              onPress={() => {
                setFormVisible(true);
                if (myReview) {
                  setFormRating(myReview.rating);
                  setFormComment(myReview.comment ?? '');
                } else {
                  setFormRating(0);
                  setFormComment('');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={myReview ? 'Modifier votre avis' : 'Écrire un avis'}
            >
              <Text style={styles.reviewFormToggleText}>
                {myReview ? '✏️ Modifier votre avis' : '💬 Écrire un avis'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Formulaire d'avis */}
          {formVisible && (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewFormLabel}>
                {myReview ? 'Modifier votre avis' : 'Votre avis'}
              </Text>

              {/* Sélecteur d'étoiles */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setFormRating(star)}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
                  >
                    <Text style={[styles.star, star <= formRating && styles.starActive]}>
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.reviewCommentInput}
                placeholder="Votre commentaire (optionnel)"
                value={formComment}
                onChangeText={setFormComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {formError ? <Text style={styles.reviewFormError}>{formError}</Text> : null}

              <View style={styles.reviewFormActions}>
                <TouchableOpacity
                  style={styles.reviewFormCancel}
                  activeOpacity={0.8}
                  onPress={() => setFormVisible(false)}
                >
                  <Text style={styles.reviewFormCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reviewFormSubmit, formRating < 1 && styles.reviewFormSubmitDisabled]}
                  activeOpacity={0.8}
                  onPress={handleSubmitReview}
                  disabled={formRating < 1 || formSubmitting}
                >
                  <Text style={styles.reviewFormSubmitText}>
                    {formSubmitting ? '…' : 'Publier'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {reviewsLoading && (
            <View style={styles.reviewsLoading}>
              <ActivityIndicator color="#2563eb" />
            </View>
          )}

          {reviewsError ? <Text style={styles.reviewsError}>{reviewsError}</Text> : null}

          {/* Liste des avis */}
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                {review.user?.avatar_url ? (
                  <Image source={{ uri: review.user.avatar_url }} style={styles.reviewAvatar} />
                ) : (
                  <View style={styles.reviewAvatarFallback}>
                    <Text style={styles.reviewAvatarFallbackText}>🗿</Text>
                  </View>
                )}
                <View style={styles.reviewCardMeta}>
                  <Text style={styles.reviewAuthor}>{review.user?.name ?? 'Anonyme'}</Text>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.reviewStarsSmall}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Text key={s} style={[styles.starSmall, s <= review.rating && styles.starSmallActive]}>
                      ★
                    </Text>
                  ))}
                </View>
              </View>
              {review.comment ? (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollView: { flex: 1, backgroundColor: '#f9fafb' },
  reservationOverlay: { flex: 1, backgroundColor: '#f9fafb' },
  reservationHeader: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backButton: { paddingVertical: 6 },
  backButtonText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  emptyTitle: { color: '#6b7280', fontSize: 15 },
  photoHeader: { position: 'relative' },
  gallery: { position: 'relative' },
  photo: { width: '100%', height: 240, backgroundColor: '#e5e7eb' },
  photoLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 56, opacity: 0.4 },
  detailMap: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  body: { padding: 16, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  proBadge: {
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', flexShrink: 1 },
  rating: { color: '#ca8a04', fontWeight: '700', fontSize: 16 },
  line: { color: '#374151', fontSize: 15 },
  addressLink: { textDecorationLine: 'underline' },
  snippet: { color: '#6b7280', fontSize: 15, lineHeight: 22, marginTop: 4 },
  mapsButton: {
    backgroundColor: '#2563eb',
  },
  mapsButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  shareButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#fff',
  },
  shareButtonText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  reserveButton: {
    backgroundColor: '#2563eb',
  },
  reserveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  bookmarkButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  bookmarkButtonActive: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  bookmarkButtonText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
  bookmarkButtonTextActive: { color: '#ef4444' },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 16,
    gap: 12,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewsTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  reviewsStats: { color: '#ca8a04', fontWeight: '600', fontSize: 14 },
  reviewsEmpty: { color: '#9ca3af', fontSize: 14 },
  reviewFormToggle: {
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewFormToggleText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  reviewForm: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  reviewFormLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  starsRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 28, color: '#d1d5db' },
  starActive: { color: '#ca8a04' },
  reviewCommentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 72,
  },
  reviewFormError: { color: '#dc2626', fontSize: 13 },
  reviewFormActions: { flexDirection: 'row', gap: 8 },
  reviewFormCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewFormCancelText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  reviewFormSubmit: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewFormSubmitDisabled: { opacity: 0.5 },
  reviewFormSubmitText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  reviewsLoading: { paddingVertical: 16, alignItems: 'center' },
  reviewsError: { color: '#dc2626', fontSize: 13 },
  reviewCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' },
  reviewAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarFallbackText: { fontSize: 18 },
  reviewCardMeta: { flex: 1 },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#9ca3af' },
  reviewStarsSmall: { flexDirection: 'row' },
  starSmall: { fontSize: 14, color: '#d1d5db' },
  starSmallActive: { color: '#ca8a04' },
  reviewComment: { color: '#374151', fontSize: 14, lineHeight: 20 },
});
