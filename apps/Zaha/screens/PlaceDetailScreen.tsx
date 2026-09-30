import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAuthUser } from '../lib/useAuthUser';
import ReservationScreen from './ReservationScreen';
import FontIcon from '../components/FontIcon';
import { colors, radius } from '../theme';

type Place = {
  id: string;
  name: string;
  category?: string;
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
  const currentUserId = useAuthUser();
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
  const [reservationSuccess, setReservationSuccess] = useState(false);
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
    setReservationSuccess(false);
  }, [place?.id]);

  // Charger les reviews du lieu.
  const placeId = place?.id;
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    const load = async () => {
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const result = await api.fetchReviews(placeId);
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
  }, [placeId, currentUserId]);

  // Charger le statut bookmark initial quand le lieu ou l'utilisateur change.
  useEffect(() => {
    if (!placeId || !currentUserId) return;
    let cancelled = false;
    api
      .isBookmarked(placeId)
      .then(({ bookmarked: value }) => {
        if (!cancelled) setBookmarked(value);
      })
      .catch(() => {
        // Statut inconnu : garder false par défaut
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, currentUserId]);

  const handleSubmitReview = async () => {
    if (!place || formRating < 1 || formRating > 5) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.submitReview(place.id, formRating, formComment || undefined);
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

  // Feedback réservation (auto-effacé). Déclaré AVANT le early return
  // ci-dessous pour respecter l'ordre des hooks.
  useEffect(() => {
    if (!reservationSuccess) return;
    const timer = setTimeout(() => setReservationSuccess(false), 4000);
    return () => clearTimeout(timer);
  }, [reservationSuccess]);

  if (!place) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Aucun lieu sélectionné</Text>
      </View>
    );
  }

  const openPhone = async () => {
    if (!place.phoneNumber) return;
    const tel = `tel:${place.phoneNumber.replace(/[^+\d]/g, '')}`;
    try {
      await Linking.openURL(tel);
    } catch {
      Alert.alert('Impossible', 'Aucune application ne peut passer cet appel.');
    }
  };

  const openWebsite = async () => {
    if (!place.websiteUri) return;
    const url = place.websiteUri.startsWith('http') ? place.websiteUri : `https://${place.websiteUri}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Impossible', 'Aucune application ne peut ouvrir ce site.');
    }
  };

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
      .toggleBookmark(place.id)
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
          <ReservationScreen
            place={{ id: place.id, name: place.name, category: place.category, address: place.address }}
            onDone={() => {
              setShowReservation(false);
              setReservationSuccess(true);
            }}
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
          <FontIcon name="location-dot" width={56} height={56} fill="#9ca3af" />
        </View>
      )}

      <View style={styles.body}>
        {reservationSuccess && (
          <View style={styles.reservationBanner}>
            <FontIcon name="check" width={16} height={16} fill="#16a34a" />
            <Text style={styles.reservationBannerText}>Réservation envoyée</Text>
          </View>
        )}

        <View style={styles.titleRow}>
          {place.isPro && <Text style={styles.proBadge}>PRO</Text>}
          <Text style={styles.name}>{place.name}</Text>
        </View>

        {place.rating != null && (
          <Text style={styles.rating}>★ {place.rating}</Text>
        )}

        {place.address && (place.googleMapsUri || place.location) ? (
          <TouchableOpacity
            style={styles.mapsButton}
            onPress={openInMaps}
            accessibilityRole="link"
            accessibilityLabel="Voir la fiche Google Maps du lieu"
          >
            <View style={styles.iconButtonContent}>
              <FontIcon name="globe" width={16} height={16} fill="#2563eb" />
              <Text style={styles.mapsButtonText}>Voir la fiche Google</Text>
            </View>
          </TouchableOpacity>
        ) : place.address ? (
          <Text style={styles.line}>{place.address}</Text>
        ) : null}
        {place.openingHours ? (
          <View style={styles.lineIconRow}>
            <FontIcon name="clock" width={14} height={14} fill="#374151" />
            <Text style={styles.line}>{place.openingHours}</Text>
          </View>
        ) : null}
        {place.phoneNumber ? (
          <TouchableOpacity
            style={styles.lineIconRow}
            onPress={openPhone}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel={`Appeler ${place.phoneNumber}`}
          >
            <FontIcon name="phone" width={14} height={14} fill="#374151" />
            <Text style={[styles.line, styles.linkLine]}>{place.phoneNumber}</Text>
          </TouchableOpacity>
        ) : null}
        {place.websiteUri ? (
          <TouchableOpacity
            style={styles.lineIconRow}
            onPress={openWebsite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Ouvrir le site web"
          >
            <FontIcon name="globe" width={14} height={14} fill="#374151" />
            <Text style={[styles.line, styles.linkLine]} numberOfLines={1}>
              {place.websiteUri.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {place.snippet ? <Text style={styles.snippet}>{place.snippet}</Text> : null}

        <TouchableOpacity
          style={styles.reserveButton}
          onPress={() => setShowReservation(true)}
          accessibilityRole="button"
          accessibilityLabel="Réserver ce lieu"
        >
          <View style={styles.iconButtonContent}>
            <FontIcon name="calendar" width={16} height={16} fill="#fff" />
            <Text style={styles.reserveButtonText}>Réserver</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          {place.location && (
            <TouchableOpacity
              style={[styles.actionButton, showMap && styles.mapButtonActive]}
              onPress={() => setShowMap((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ selected: showMap }}
              accessibilityLabel={showMap ? 'Masquer la carte' : 'Voir sur la carte'}
            >
              <View style={styles.iconButtonContent}>
                <FontIcon name="map" width={16} height={16} fill="#2563eb" />
                <Text
                  style={[styles.mapButtonText, showMap && styles.mapButtonTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {showMap ? 'Masquer la carte' : 'Voir la carte'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, bookmarked && styles.bookmarkButtonActive]}
            onPress={handleToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <View style={styles.iconButtonContent}>
                {bookmarked ? (
                  <FontIcon name="heart" width={14} height={14} fill="#ef4444" />
                ) : (
                  <FontIcon name="heart-outline" width={14} height={14} fill="#374151" />
                )}
                <Text
                  style={[styles.bookmarkButtonText, bookmarked && styles.bookmarkButtonTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {bookmarked ? 'Sauvegardé' : 'Sauvegarder'}
                </Text>
              </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={sharePlace}
            accessibilityRole="button"
            accessibilityLabel="Partager ce lieu"
          >
            <View style={styles.shareButtonContent}>
              <FontIcon name="share" width={18} height={18} fill="#2563eb" />
              <Text
                style={styles.shareButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                Partager
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {showMap && place.location && (
          <View style={styles.mapContainer}>
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
            <TouchableOpacity
              style={styles.mapDirectionsButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Itinéraire vers ce lieu"
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${place.location!.latitude},${place.location!.longitude}`
                ).catch(() => {})
              }
            >
              <View style={styles.directionsButtonContent}>
                <FontIcon name="route" width={16} height={16} fill="#fff" />
                <Text style={styles.mapDirectionsButtonText}>Itinéraire</Text>
              </View>
            </TouchableOpacity>
          </View>
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
              {myReview ? (
                <View style={styles.iconButtonContent}>
                  <FontIcon name="pen" width={14} height={14} fill="#2563eb" />
                  <Text style={styles.reviewFormToggleText}>Modifier votre avis</Text>
                </View>
              ) : (
                <View style={styles.iconButtonContent}>
                  <FontIcon name="comment" width={14} height={14} fill="#2563eb" />
                  <Text style={styles.reviewFormToggleText}>Écrire un avis</Text>
                </View>
              )}
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
                    style={styles.starButton}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
                    accessibilityState={{ selected: star <= formRating }}
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
                  {formSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.reviewFormSubmitText}>Publier</Text>
                  )}
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
                    <FontIcon name="user" width={18} height={18} fill="#9ca3af" />
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
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1, backgroundColor: colors.background },
  reservationOverlay: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15 },
  photoHeader: { position: 'relative' },
  gallery: { position: 'relative' },
  photo: { width: '100%', height: 240, backgroundColor: colors.border },
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
  detailMap: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: 4,
  },
  mapContainer: {
    position: 'relative',
  },
  mapDirectionsButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapDirectionsButtonText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  directionsButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { padding: 16, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  proBadge: {
    backgroundColor: colors.primary,
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  rating: { color: colors.rating, fontWeight: '700', fontSize: 16 },
  line: { color: colors.textStrong, fontSize: 15 },
  linkLine: { color: colors.primary },
  lineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reservationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reservationBannerText: { color: colors.success, fontWeight: '600', fontSize: 14 },
  mapsButton: {
    backgroundColor: colors.primaryPale,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  mapsButtonText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  snippet: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  mapButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  mapButtonTextActive: { color: colors.primary, fontWeight: '700' },
  iconButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shareButtonText: { color: colors.textStrong, fontWeight: '600', fontSize: 13 },
  shareButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reserveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  reserveButtonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  bookmarkButtonActive: {
    borderColor: colors.like,
    backgroundColor: colors.likeSoft,
  },
  bookmarkButtonText: { color: colors.textStrong, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  bookmarkButtonTextActive: { color: colors.like, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'stretch',
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
    backgroundColor: colors.surface,
  },
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginTop: 16,
    gap: 12,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewsTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  reviewsStats: { color: colors.rating, fontWeight: '600', fontSize: 14 },
  reviewsEmpty: { color: colors.textMuted, fontSize: 14 },
  reviewFormToggle: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reviewFormToggleText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  reviewForm: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  reviewFormLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  starsRow: { flexDirection: 'row', gap: 2 },
  starButton: { padding: 8, alignItems: 'center', justifyContent: 'center' },
  star: { fontSize: 28, color: colors.borderStrong },
  starActive: { color: colors.rating },
  reviewCommentInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 72,
    backgroundColor: colors.inputBg,
  },
  reviewFormError: { color: colors.danger, fontSize: 13 },
  reviewFormActions: { flexDirection: 'row', gap: 8 },
  reviewFormCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reviewFormCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  reviewFormSubmit: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reviewFormSubmitDisabled: { opacity: 0.5 },
  reviewFormSubmitText: { color: colors.surface, fontWeight: '600', fontSize: 14 },
  reviewsLoading: { paddingVertical: 16, alignItems: 'center' },
  reviewsError: { color: colors.danger, fontSize: 13 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border },
  reviewAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCardMeta: { flex: 1 },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  reviewDate: { fontSize: 12, color: colors.textMuted },
  reviewStarsSmall: { flexDirection: 'row' },
  starSmall: { fontSize: 14, color: colors.borderStrong },
  starSmallActive: { color: colors.rating },
  reviewComment: { color: colors.textStrong, fontSize: 14, lineHeight: 20 },
});
