import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RoomType } from '../lib/api';
import { formatMoney, formatNights } from '../lib/format';
import FontIcon from './FontIcon';
import { colors, radius } from '../theme';

type RoomPickerProps = {
  rooms: RoomType[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  onSelect: (roomId: string) => void;
  /** Nombre de nuits du séjour (0 = dates invalides : pas de total affiché). */
  nights: number;
  onRetry?: () => void;
};

/** Choix de chambre façon Booking.com : une carte par type de chambre, avec prix. */
export default function RoomPicker({
  rooms,
  loading,
  error,
  selectedId,
  onSelect,
  nights,
  onRetry,
}: RoomPickerProps) {
  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Chargement des chambres…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Réessayer">
            <Text style={styles.retry}>Réessayer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (rooms.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>
          Aucune chambre n’est proposée pour le moment. Contactez l’hôtel pour réserver.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {rooms.map((room) => {
        const selected = room.id === selectedId;
        return (
          <TouchableOpacity
            key={room.id}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => onSelect(room.id)}
            accessibilityRole="button"
            accessibilityLabel={`Chambre ${room.name}, ${formatMoney(room.pricePerNight, room.currency)} par nuit`}
            accessibilityState={{ selected }}
          >
            <View style={styles.cardHeader}>
              <FontIcon name="bed" width={16} height={16} fill={selected ? colors.primary : colors.textSecondary} />
              <Text style={styles.name}>{room.name}</Text>
              {selected ? <FontIcon name="check" width={16} height={16} fill={colors.primary} /> : null}
            </View>
            {room.description ? <Text style={styles.description}>{room.description}</Text> : null}
            <Text style={styles.capacity}>
              Jusqu’à {room.capacity} personne{room.capacity > 1 ? 's' : ''}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(room.pricePerNight, room.currency)}</Text>
              <Text style={styles.perNight}> / nuit</Text>
            </View>
            {nights > 0 ? (
              <Text style={styles.total}>
                {formatMoney(room.pricePerNight * nights, room.currency)} pour {formatNights(nights)}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  description: { fontSize: 13, color: colors.textStrong },
  capacity: { fontSize: 12, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  price: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  perNight: { fontSize: 13, color: colors.textSecondary },
  total: { fontSize: 12, color: colors.textSecondary },
  state: { paddingVertical: 12, gap: 8, alignItems: 'flex-start' },
  stateText: { fontSize: 13, color: colors.textSecondary },
  errorText: { fontSize: 13, color: colors.danger },
  retry: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
