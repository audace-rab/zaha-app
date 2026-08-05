import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Place } from '@zaha/shared';
import { api } from '../lib/api';

const DEFAULT_COORDS = { latitude: -18.8792, longitude: 47.5079 };

export default function PlacesScreen() {
  const [category, setCategory] = useState('restaurant');
  const [places, setPlaces] = useState<Place[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const result = await api.searchPlaces({
        category,
        coords: DEFAULT_COORDS,
        locationName: 'Antananarivo',
      });
      setPlaces(result.places);
      setSummary(result.summary);
    } catch (e) {
      setSummary(e instanceof Error ? e.message : 'Erreur');
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {(['restaurant', 'hotel', 'activités', 'pharmacie'] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={search} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Rechercher à Antananarivo</Text>
        )}
      </TouchableOpacity>

      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.address}>{item.address}</Text>
            {item.snippet && <Text style={styles.snippet}>{item.snippet}</Text>}
            {item.rating != null && <Text style={styles.rating}>★ {item.rating}</Text>}
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Aucun lieu pour l'instant</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff' },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  summary: { color: '#6b7280', marginBottom: 12 },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  name: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  address: { color: '#6b7280', fontSize: 13 },
  snippet: { marginTop: 6, fontSize: 14 },
  rating: { marginTop: 6, color: '#ca8a04', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 24 },
});
