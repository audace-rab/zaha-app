import { useEffect, useRef } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapPlace } from '../lib/api';

type PlacesMapProps = {
  places: MapPlace[];
  onSelectPlace?: (place: MapPlace) => void;
};

const MADAGASCAR_REGION = {
  latitude: -19,
  longitude: 46.5,
  latitudeDelta: 8,
  longitudeDelta: 4,
};

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  hotel: '#2563eb',
  attraction: '#16a34a',
};

const pinColorForCategory = (category?: string) =>
  (category && CATEGORY_COLORS[category]) || '#f59e0b';

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hôtel',
  attraction: 'Site naturel',
};

export default function PlacesMap({ places, onSelectPlace }: PlacesMapProps) {
  const mapRef = useRef<MapView>(null);

  // Cadre automatique sur les lieux affichés dès qu'ils changent.
  useEffect(() => {
    const coords = places.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (!coords.length) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 140, left: 60 },
      animated: true,
    });
  }, [places]);

  const fitToAll = () => {
    const coords = places.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (!coords.length) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 140, left: 60 },
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={MADAGASCAR_REGION}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description={place.address}
            pinColor={pinColorForCategory(place.category)}
            onPress={() => onSelectPlace?.(place)}
          />
        ))}
      </MapView>

      <TouchableOpacity
        style={styles.fitButton}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Recentrer sur les résultats"
        onPress={fitToAll}
      >
        <Text style={styles.fitButtonText}>⌖ Recentrer</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PlacesMapCard({
  place,
  onViewDetail,
}: {
  place: MapPlace | null;
  onViewDetail?: () => void;
}) {
  if (!place) return null;

  return (
    <View style={styles.placeCard}>
      {place.photoUrl ? (
        <Image source={{ uri: place.photoUrl }} style={styles.cardPhoto} />
      ) : (
        <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
          <Text style={styles.cardPhotoPlaceholderText}>📍</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text numberOfLines={1} style={styles.cardName}>
          {place.name}
        </Text>
        <Text style={styles.cardCategory}>
          {CATEGORY_LABELS[place.category] ?? place.category}
          {place.isPro ? ' · PRO' : ''}
        </Text>
        {onViewDetail && (
          <TouchableOpacity
            style={styles.cardButton}
            activeOpacity={0.8}
            onPress={onViewDetail}
          >
            <Text style={styles.cardButtonText}>Voir le détail</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  fitButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fitButtonText: { color: '#2563eb', fontWeight: '600' },
  placeCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardPhoto: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#e5e7eb' },
  cardPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardPhotoPlaceholderText: { fontSize: 26, opacity: 0.4 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { color: '#111827', fontWeight: '700', fontSize: 15 },
  cardCategory: { color: '#6b7280', fontSize: 13 },
  cardButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cardButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
