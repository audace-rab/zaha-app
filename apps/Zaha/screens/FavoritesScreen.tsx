import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../lib/api';
import FontIcon from '../components/FontIcon';
import PlaceDetailScreen from './PlaceDetailScreen';
import { colors, radius } from '../theme';

type FavoritePlace = {
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
  openingHours?: string;
  isPro?: boolean;
  location?: { latitude: number; longitude: number };
};

type FavoritesScreenProps = {
  onBack?: () => void;
};

export default function FavoritesScreen({ onBack }: FavoritesScreenProps) {
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FavoritePlace | null>(null);

  // Bouton retour Android : fermer le détail, sinon revenir au profil.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [selected, onBack]);

  const load = useCallback(() => {
    setError(null);
    return api
      .fetchBookmarkedPlaces()
      .then(({ places: items }) => setPlaces(items as FavoritePlace[]))
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRemove = (place: FavoritePlace) => {
    Alert.alert(
      'Retirer des favoris ?',
      place.name,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            const previous = places;
            setPlaces((prev) => prev.filter((p) => p.id !== place.id));
            api.toggleBookmark(place.id).catch(() => {
              setPlaces(previous);
              Alert.alert('Erreur', 'Impossible de retirer ce favori. Réessaie plus tard.');
            });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontIcon name="heart-outline" width={44} height={44} fill="#9ca3af" />
            <Text style={styles.emptyTitle}>
              {error ? 'Impossible de charger tes favoris' : 'Aucun favori'}
            </Text>
            <Text style={styles.emptyMessage}>
              {error
                ? 'Vérifie ta connexion puis réessaie.'
                : 'Touche le cœur sur un lieu pour le retrouver ici.'}
            </Text>
            {error ? (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  setLoading(true);
                  load();
                }}
                accessibilityRole="button"
                accessibilityLabel="Réessayer de charger les favoris"
              >
                <Text style={styles.emptyButtonText}>Réessayer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setSelected(item)}
            accessibilityRole="button"
            accessibilityLabel={`Voir le lieu ${item.name}`}
          >
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <FontIcon name="location-dot" width={22} height={22} fill="#9ca3af" />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              {item.address ? (
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {item.address}
                </Text>
              ) : null}
              {typeof item.rating === 'number' && item.rating > 0 ? (
                <Text style={styles.cardRating}>★ {item.rating.toFixed(1)}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${item.name} des favoris`}
            >
              <FontIcon name="heart" width={20} height={20} fill={colors.like} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {selected && (
        <View style={styles.detailOverlay}>
          <PlaceDetailScreen place={selected} onBack={() => setSelected(null)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photo: { width: 72, height: 72 },
  photoPlaceholder: {
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, paddingHorizontal: 12, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary },
  cardRating: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  removeBtn: { padding: 14 },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f9fafb',
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptyMessage: { color: colors.textSecondary, textAlign: 'center' },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyButtonText: { color: colors.surface, fontWeight: '600' },
});
