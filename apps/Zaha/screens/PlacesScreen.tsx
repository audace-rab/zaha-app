import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../lib/api';
import { readCache, writeCache } from '../lib/cache';
import FontIcon, { type FontIconName } from '../components/FontIcon';
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
  openingHours?: string;
  isPro?: boolean;
  distance_km?: number;
  location?: { latitude: number; longitude: number };
};

// Distance orthodromique en km (formule de haversine).
function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

type PlacesScreenProps = {
  onSelectPlace?: (place: Place) => void;
};

const CATEGORY_CONFIG = [
  { key: 'restaurant', icon: 'utensils', label: 'Restaurant', color: colors.like },
  { key: 'hotel', icon: 'bed', label: 'Hôtel', color: colors.primary },
] as const;

const VISIBLE_CATEGORIES = new Set(['restaurant', 'hotel']);

function keepVisible(p: Place): boolean {
  return p.category != null && VISIBLE_CATEGORIES.has(p.category);
}

type CategoryKey = (typeof CATEGORY_CONFIG)[number]['key'];

export default function PlacesScreen({ onSelectPlace }: PlacesScreenProps) {
  const [category, setCategory] = useState<CategoryKey | ''>('');
  const [locationName, setLocationName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Formulaire de filtres replié par défaut ; déroulé si aucun résultat.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Mode « Autour de moi » : résultats triés par proximité GPS.
  const [nearbyActive, setNearbyActive] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // Résumé une ligne pour la barre repliée : « lieu · recherche/catégorie ».
  const filtersSummaryParts: string[] = [];
  if (nearbyActive) filtersSummaryParts.push('Autour de moi');
  else if (locationName.trim()) filtersSummaryParts.push(locationName.trim());
  if (searchQuery.trim() || category) {
    filtersSummaryParts.push(searchQuery.trim() || category);
  }
  const filtersSummary =
    filtersSummaryParts.length > 0 ? filtersSummaryParts.join(' · ') : 'Filtres actifs';

  // Icônes résumant le filtre actif, affichées avant le texte.
  const summaryIcons: FontIconName[] = [];
  if (nearbyActive) summaryIcons.push('location-dot');
  else if (locationName.trim()) summaryIcons.push('location-dot');
  if (searchQuery.trim() || category) summaryIcons.push('magnifying-glass');

  // Chargement automatique : tous les lieux de la catégorie courante,
  // sans filtre. Rechargé uniquement au montage et au changement de catégorie.
  // Stale-while-revalidate : le cache AsyncStorage est affiché immédiatement,
  // puis rafraîchi par le réseau.
  useEffect(() => {
    let cancelled = false;
    const cacheKey = `cache:places:v1:${category || 'all'}`;
    const load = async () => {
      setNearbyActive(false);
      setUserCoords(null);
      setNearbyError(null);
      const cached = await readCache<{ places: Place[]; summary: string }>(cacheKey);
      const hasCache = Boolean(cached && cached.places.length > 0);
      if (hasCache && !cancelled) {
        setPlaces(cached!.places);
        setSummary(cached!.summary);
        setFiltersOpen(false);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const result = await api.searchPlaces({
          category: category || 'all',
        });
        if (cancelled) return;
        const filtered = result.places.filter(keepVisible);
        setPlaces(filtered);
        setSummary(result.summary);
        // Résultats → filtres repliés ; vide/erreur → formulaire déroulé.
        setFiltersOpen(filtered.length === 0);
        writeCache(cacheKey, { places: filtered, summary: result.summary });
      } catch (e) {
        if (cancelled) return;
        console.warn('Erreur chargement des lieux :', e);
        // Garder le cache affiché si disponible ; sinon montrer l'erreur.
        if (!hasCache) {
          setSummary('Impossible de charger les lieux. Vérifiez votre connexion puis réessayez.');
          setPlaces([]);
          setFiltersOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const runSearch = async (opts?: { reset?: boolean }) => {
    setNearbyActive(false);
    setUserCoords(null);
    setNearbyError(null);
    setLoading(true);
    try {
      const result = await api.searchPlaces({
        category: category || 'all',
        locationName: opts?.reset ? undefined : locationName.trim() || undefined,
        searchQuery: opts?.reset ? undefined : searchQuery.trim() || undefined,
      });
      const filtered = result.places.filter(keepVisible);
      setPlaces(filtered);
      setSummary(result.summary);
      // Nouvelle recherche validée → replier si résultats, dérouler sinon.
      setFiltersOpen(filtered.length === 0);
    } catch (e) {
      console.warn('Erreur recherche :', e);
      setSummary('Impossible de charger les lieux. Vérifiez votre connexion puis réessayez.');
      setPlaces([]);
      setFiltersOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setLocationName('');
    setSearchQuery('');
    runSearch({ reset: true });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (nearbyActive && userCoords) {
      await loadNearby(userCoords.latitude, userCoords.longitude);
    } else {
      await runSearch();
    }
    setRefreshing(false);
  };

  // Charge les lieux à proximité (5 km) autour des coordonnées données.
  const loadNearby = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const result = await api.fetchNearby(lat, lng, 5000);
      const filtered = (result.places ?? []).filter(keepVisible);
      setPlaces(filtered);
      setSummary('Lieux autour de vous (rayon 5 km)');
      setFiltersOpen(filtered.length === 0);
    } catch (e) {
      console.warn('Erreur nearby :', e);
      setPlaces([]);
      setSummary('Impossible de charger les lieux autour de vous. Vérifiez votre connexion puis réessayez.');
      setFiltersOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // « Autour de moi » : demande la permission de localisation puis lance la recherche nearby.
  const handleNearby = async () => {
    setNearbyError(null);
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission de localisation',
            message: 'Zaha a besoin de votre position pour trouver les lieux autour de vous.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          setNearbyError('Permission de localisation refusée. Autorisez-la dans les réglages.');
          return;
        }
      } else {
        // iOS : la lib gère la demande système.
        Geolocation.requestAuthorization(() => {}, () => {});
      }
    } catch {
      // Certaines plateformes n'exposent pas la demande — non bloquant.
    }
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ latitude, longitude });
        setNearbyActive(true);
        loadNearby(latitude, longitude);
      },
      (error) => {
        if (error.code === 1) {
          setNearbyError('Permission de localisation refusée. Autorisez-la dans les réglages.');
        } else if (error.code === 2) {
          setNearbyError('GPS indisponible. Vérifiez que la localisation est activée.');
        } else {
          setNearbyError('Impossible de récupérer votre position. Réessayez.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const hasActiveSearch = Boolean(locationName.trim() || searchQuery.trim());

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.filtersBar}
        activeOpacity={0.8}
        onPress={() => setFiltersOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={
          filtersOpen ? 'Replier les filtres de recherche' : 'Dérouler les filtres de recherche'
        }
      >
        <View style={styles.filtersBarSummaryArea}>
          {summaryIcons.map((icon, i) => (
            <FontIcon key={i} name={icon} width={14} height={14} fill="#2563eb" />
          ))}
          <Text numberOfLines={1} style={styles.filtersBarSummary}>
            {filtersSummary}
          </Text>
        </View>
        <Text style={styles.filtersBarChevron}>{filtersOpen ? '▲ Replier' : '▼ Dérouler'}</Text>
      </TouchableOpacity>

      {filtersOpen && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <TouchableOpacity
              style={[styles.chip, category === '' && styles.chipAllActive]}
              onPress={() => setCategory('')}
              accessibilityRole="button"
              accessibilityLabel="Toutes les catégories"
              accessibilityState={{ selected: category === '' }}
            >
              <FontIcon
                name="globe"
                width={18}
                height={18}
                fill={category === '' ? colors.surface : colors.textStrong}
              />
              <Text style={[styles.chipText, category === '' && styles.chipTextActive]}>Tous</Text>
            </TouchableOpacity>
            {CATEGORY_CONFIG.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.chip,
                  category === cat.key && { backgroundColor: cat.color },
                ]}
                onPress={() => setCategory(cat.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filtrer par catégorie : ${cat.label}`}
                accessibilityState={{ selected: category === cat.key }}
              >
                <FontIcon
                  name={cat.icon}
                  width={18}
                  height={18}
                  fill={category === cat.key ? colors.surface : colors.textStrong}
                />
                <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Recherche libre (nom, plat…)"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Ville (optionnel)"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={() => runSearch()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Rechercher des lieux"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Rechercher</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {summary ? (
        <Text style={styles.summary}>
          {places.length > 0 ? `${places.length} lieu${places.length > 1 ? 'x' : ''} trouvé${places.length > 1 ? 's' : ''}` : summary}
        </Text>
      ) : null}

      {nearbyError ? <Text style={styles.nearbyError}>{nearbyError}</Text> : null}

      {!loading && (places.length > 0 || nearbyActive) ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.mapToggle, nearbyActive && styles.mapToggleActive]}
            activeOpacity={0.8}
            onPress={handleNearby}
            accessibilityRole="button"
            accessibilityLabel="Trouver des lieux autour de moi"
          >
            <View style={styles.mapToggleInner}>
              <FontIcon
                name="location-dot"
                width={16}
                height={16}
                fill={nearbyActive ? colors.surface : colors.primary}
              />
              <Text style={[styles.mapToggleText, nearbyActive && styles.mapToggleActiveText]}>
                Autour de moi
              </Text>
              {nearbyActive ? (
                <FontIcon name="check" width={13} height={13} fill="#fff" />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor="#2563eb"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onSelectPlace?.(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <FontIcon name="location-dot" width={28} height={28} fill="#9ca3af" />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                {item.isPro && <Text style={styles.proBadge}>PRO</Text>}
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <View style={styles.addressRow}>
                <Text style={styles.address} numberOfLines={1}>
                  {item.address}
                </Text>
                {(() => {
                  const km =
                    item.distance_km ??
                    (userCoords && item.location
                      ? haversineKm(userCoords, item.location)
                      : null);
                  return km != null ? (
                    <Text style={styles.distance}>{formatDistance(km)}</Text>
                  ) : null;
                })()}
              </View>
              {item.snippet && <Text style={styles.snippet}>{item.snippet}</Text>}
              {item.rating != null && <Text style={styles.rating}>★ {item.rating}</Text>}
            </View>
            <View style={styles.cardChevron}>
              <FontIcon name="chevron-right" width={16} height={16} fill="#9ca3af" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <FontIcon name="location-dot" width={44} height={44} fill="#9ca3af" />
              </View>
              <Text style={styles.emptyTitle}>Aucun lieu trouvé</Text>
              <Text style={styles.emptyMessage}>
                {hasActiveSearch
                  ? 'Aucun lieu ne correspond à votre recherche.'
                  : 'Impossible de charger les lieux pour le moment.'}
              </Text>
              {hasActiveSearch ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={resetFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Réinitialiser les filtres"
                >
                  <Text style={styles.emptyButtonText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => runSearch()}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer le chargement des lieux"
                >
                  <Text style={styles.emptyButtonText}>Réessayer</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  filtersBarSummaryArea: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  filtersBarSummary: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  filtersBarChevron: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  nearbyError: { color: colors.danger, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  mapToggleInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapToggleActive: { backgroundColor: colors.primary },
  mapToggleActiveText: { color: colors.surface },
  chipsRow: { gap: 10, marginBottom: 50, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.chipBg,
    height: 40,
  },
  chipAllActive: { backgroundColor: colors.textStrong },
  chipText: { fontSize: 15, color: colors.textStrong, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: colors.surface, fontWeight: '600' },
  summary: { color: colors.textSecondary, marginBottom: 12 },
  mapToggle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  mapToggleText: { color: colors.primary, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 12,
  },
  thumbnail: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.chipBg },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  proBadge: {
    backgroundColor: colors.primary,
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  name: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  address: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distance: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  snippet: { marginTop: 6, fontSize: 14 },
  rating: { marginTop: 6, color: colors.rating, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptyMessage: { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: { color: colors.surface, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  cardChevron: { alignSelf: 'center' },
});
