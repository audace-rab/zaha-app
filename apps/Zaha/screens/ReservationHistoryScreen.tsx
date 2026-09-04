import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { api, type Reservation } from '../lib/api';

const DEMO_USER_ID = 'a1000000-0000-0000-0000-000000000001';

type StatusFilter = 'all' | Reservation['status'];

const STATUS_CONFIG: Record<Reservation['status'], { color: string; bg: string; label: string }> = {
  pending: { color: '#d97706', bg: '#fef3c7', label: 'En attente' },
  confirmed: { color: '#16a34a', bg: '#dcfce7', label: 'Confirmée' },
  cancelled: { color: '#dc2626', bg: '#fee2e2', label: 'Annulée' },
  completed: { color: '#2563eb', bg: '#dbeafe', label: 'Terminée' },
};

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'confirmed', label: 'Confirmées' },
  { key: 'completed', label: 'Terminées' },
  { key: 'cancelled', label: 'Annulées' },
];

type ReservationHistoryScreenProps = {
  onBack?: () => void;
};

export default function ReservationHistoryScreen({ onBack }: ReservationHistoryScreenProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USER_ID);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const id = data?.session?.user?.id;
        if (id) setCurrentUserId(id);
      } catch (e) {
        console.warn('Session indisponible, utilisateur démo utilisé');
      }
    };
    resolve();
  }, []);

  // Intercepter le bouton retour Android pour revenir à Profil
  useEffect(() => {
    if (!onBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const load = useCallback(
    (statusOverride?: StatusFilter) => {
      const statusParam = statusOverride === 'all' ? undefined : (statusOverride ?? filter === 'all' ? undefined : filter);
      setLoading(true);
      setError(null);
      return api
        .getReservations(currentUserId, statusParam)
        .then(({ reservations: items }) => setReservations(items))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [currentUserId, filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelReservation(id);
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r))
      );
    } catch (e) {
      console.warn('Erreur annulation :', e);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Filtres par statut */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrer : ${item.label}`}
            accessibilityState={{ selected: filter === item.key }}
          >
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'Aucune réservation' : 'Aucune réservation dans cette catégorie'}
              </Text>
              <Text style={styles.emptyMessage}>
                {filter === 'all'
                  ? 'Créez une réservation depuis la fiche d\'un lieu.'
                  : 'Essayez un autre filtre.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusCfg = STATUS_CONFIG[item.status];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardPlace}>📍 {(item as any).place?.name ?? item.place_name ?? 'Lieu'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>
              <Text style={styles.cardDate}>
                📅 {item.date}
                {item.time_start ? ` · 🕐 ${item.time_start}` : ''}
                {item.time_end ? ` – ${item.time_end}` : ''}
              </Text>
              <Text style={styles.cardGuests}>
                👥 {item.guests} convive{item.guests > 1 ? 's' : ''}
                {item.room_type ? ` · 🛏️ ${item.room_type}` : ''}
                {item.activity_slot ? ` · 🎭 ${item.activity_slot}` : ''}
              </Text>
              {item.note ? <Text style={styles.cardNote}>💬 {item.note}</Text> : null}
              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancel(item.id)}
                  disabled={cancellingId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler cette réservation"
                >
                  {cancellingId === item.id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', justifyContent: 'flex-start' },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 40,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 40, alignItems: 'flex-start' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyMessage: { color: '#6b7280', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPlace: { fontSize: 15, fontWeight: '600', color: '#111827', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDate: { color: '#374151', fontSize: 14 },
  cardGuests: { color: '#6b7280', fontSize: 13 },
  cardNote: { color: '#6b7280', fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  cancelBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
});
