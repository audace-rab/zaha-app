import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, type Reservation } from '../lib/api';
import { useAuthUser } from '../lib/useAuthUser';
import { formatDateDisplay } from '../lib/format';
import FontIcon from '../components/FontIcon';
import ReservationEditModal from '../components/ReservationEditModal';
import { colors, radius } from '../theme';

type StatusFilter = 'all' | Reservation['status'];

const STATUS_CONFIG: Record<Reservation['status'], { color: string; bg: string; label: string }> = {
  pending: { color: colors.warning, bg: colors.warningBg, label: 'En attente' },
  confirmed: { color: colors.success, bg: colors.successBg, label: 'Confirmée' },
  cancelled: { color: colors.danger, bg: colors.dangerBg, label: 'Annulée' },
  completed: { color: colors.primary, bg: colors.info, label: 'Terminée' },
  unavailable: { color: colors.unavailable, bg: colors.unavailableBg, label: 'Indisponible' },
  proposed: { color: colors.proposed, bg: colors.proposedBg, label: 'À confirmer' },
};

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'proposed', label: 'À confirmer' },
  { key: 'unavailable', label: 'Indisponibles' },
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
  const currentUserId = useAuthUser();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Réservation en cours de modification (modale ouverte) :
  // 'edit' = en attente (tout sauf le lieu), 'reschedule' = indisponible (nouveau créneau).
  const [editing, setEditing] = useState<{ reservation: Reservation; mode: 'edit' | 'reschedule' } | null>(null);

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
      // Tant que la session n'est pas résolue, ne rien demander (401 sinon).
      if (!currentUserId) {
        setLoading(false);
        return Promise.resolve();
      }
      const statusParam = statusOverride === 'all' ? undefined : (statusOverride ?? (filter === 'all' ? undefined : filter));
      setLoading(true);
      setError(null);
      return api
        .getReservations(statusParam)
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

  const handleCancel = (id: string) => {
    Alert.alert(
      'Annuler cette réservation ?',
      'Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => confirmCancel(id),
        },
      ]
    );
  };

  // Modification enregistrée. Une reprogrammation repasse la réservation « en attente » :
  // elle quitte alors le filtre « Indisponibles ».
  const handleSaved = (updated: Reservation) => {
    setReservations((prev) =>
      filter !== 'all' && filter !== updated.status
        ? prev.filter((r) => r.id !== updated.id)
        : prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
    );
    setEditing(null);
  };

  // Le client accepte le créneau proposé par l'établissement.
  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    setError(null);
    try {
      const { reservation: updated } = await api.confirmReservation(id);
      handleSaved({ ...updated, status: 'confirmed' });
    } catch (e) {
      console.warn('Erreur confirmation :', e);
      setError(e instanceof Error ? e.message : 'Impossible de confirmer le créneau. Réessayez.');
    } finally {
      setConfirmingId(null);
    }
  };

  const confirmCancel = async (id: string) => {
    setCancellingId(id);
    setError(null);
    try {
      await api.cancelReservation(id);
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r))
      );
    } catch (e) {
      console.warn('Erreur annulation :', e);
      setError('Impossible d\u2019annuler la réservation. Vérifiez votre connexion puis réessayez.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Filtres par statut */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {STATUS_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.key}
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
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <FontIcon name="calendar" width={44} height={44} fill="#9ca3af" />
              </View>
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
                <View style={styles.cardHeaderLeft}>
                  <FontIcon name="location-dot" width={14} height={14} fill="#111827" />
                  <Text style={styles.cardPlace}>{(item as any).place?.name ?? item.place_name ?? 'Lieu'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>
              <View style={styles.cardDateRow}>
                <FontIcon name="calendar" width={14} height={14} fill="#374151" />
                <Text style={styles.cardDate}>{formatDateDisplay(item.date)}</Text>
                {item.time_start ? (
                  <>
                    <FontIcon name="clock" width={14} height={14} fill="#374151" />
                    <Text style={styles.cardDate}>{item.time_start}</Text>
                  </>
                ) : null}
                {item.time_end ? <Text style={styles.cardDate}>– {item.time_end}</Text> : null}
              </View>
              <View style={styles.cardGuestsRow}>
                <View style={styles.cardGuestsItem}>
                  <FontIcon name="users" width={14} height={14} fill="#6b7280" />
                  <Text style={styles.cardGuests}>
                    {item.guests} convive{item.guests > 1 ? 's' : ''}
                  </Text>
                </View>
                {item.room_type ? (
                  <View style={styles.cardGuestsItem}>
                    <FontIcon name="bed" width={14} height={14} fill="#6b7280" />
                    <Text style={styles.cardGuests}>{item.room_type}</Text>
                  </View>
                ) : null}
                {item.activity_slot ? (
                  <View style={styles.cardGuestsItem}>
                    <FontIcon name="masks-theater" width={14} height={14} fill="#6b7280" />
                    <Text style={styles.cardGuests}>{item.activity_slot}</Text>
                  </View>
                ) : null}
              </View>
              {item.note ? (
                <View style={styles.cardNoteRow}>
                  <FontIcon name="comment" width={14} height={14} fill="#6b7280" />
                  <Text style={styles.cardNote}>{item.note}</Text>
                </View>
              ) : null}
              {item.status === 'unavailable' && (
                <Text style={styles.unavailableNote}>
                  Ce créneau n’est pas disponible. Proposez-en un autre pour que votre réservation soit traitée.
                </Text>
              )}
              {item.status === 'proposed' && (
                <Text style={styles.proposedNote}>
                  L’établissement vous propose ce nouveau créneau. Confirmez-le pour valider votre réservation, ou annulez-la.
                </Text>
              )}
              {(item.status === 'pending' || item.status === 'unavailable' || item.status === 'proposed') && (
                <View style={styles.actionsRow}>
                  {item.status === 'proposed' && (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => handleConfirm(item.id)}
                      disabled={confirmingId === item.id || cancellingId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Confirmer le nouveau créneau"
                    >
                      {confirmingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <FontIcon name="check" width={14} height={14} fill="#fff" />
                          <Text style={styles.confirmBtnText}>Confirmer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {item.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => setEditing({ reservation: item, mode: 'edit' })}
                      accessibilityRole="button"
                      accessibilityLabel="Modifier cette réservation"
                    >
                      <FontIcon name="pen" width={14} height={14} fill="#2563eb" />
                      <Text style={styles.editBtnText}>Modifier</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'unavailable' && (
                    <TouchableOpacity
                      style={styles.rescheduleBtn}
                      onPress={() => setEditing({ reservation: item, mode: 'reschedule' })}
                      accessibilityRole="button"
                      accessibilityLabel="Reprogrammer cette réservation"
                    >
                      <FontIcon name="calendar" width={14} height={14} fill="#fff" />
                      <Text style={styles.rescheduleBtnText}>Reprogrammer</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(item.id)}
                    disabled={cancellingId === item.id || confirmingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel="Annuler cette réservation"
                  >
                    {cancellingId === item.id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}            </View>
          );
        }}
      />

      <ReservationEditModal
        reservation={editing?.reservation ?? null}
        mode={editing?.mode ?? 'edit'}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'flex-start' },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    maxHeight : 36,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.textStrong, fontWeight: '500' },
  filterTextActive: { color: colors.surface },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingTop: 8 },
  list: { justifyContent: 'flex-start', paddingTop: 0, paddingHorizontal: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptyMessage: { color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  cardPlace: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDate: { color: colors.textStrong, fontSize: 14 },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardGuests: { color: colors.textSecondary, fontSize: 13 },
  cardGuestsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  cardGuestsItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardNote: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', marginTop: 0, flexShrink: 1 },
  unavailableNote: {
    color: colors.unavailable,
    backgroundColor: colors.unavailableBg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 4,
  },
  proposedNote: {
    color: colors.proposed,
    backgroundColor: colors.proposedBg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 4,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  confirmBtnText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  editBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  rescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  rescheduleBtnText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  cancelBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelBtnText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
