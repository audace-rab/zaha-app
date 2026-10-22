import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { api, type RoomType } from '../lib/api';
import { useAuthUser } from '../lib/useAuthUser';
import { countNights, formatDateDisplay, formatMoney, formatNights } from '../lib/format';
import FontIcon, { type FontIconName } from '../components/FontIcon';
import RoomPicker from '../components/RoomPicker';
import { colors, radius } from '../theme';

type PlaceMini = {
  id: string;
  name: string;
  category?: string;
  address?: string;
};

type ReservationType = 'table' | 'hotel' | 'activity' | 'general';

type ReservationScreenProps = {
  place: PlaceMini;
  /** Appelé à la fermeture de l'écran (annulation OU réservation envoyée). */
  onDone: () => void;
  /** Appelé uniquement quand la réservation a bien été créée (avant onDone). */
  onCreated?: () => void;
};

export const ACTIVITY_SLOTS = ['Matin', 'Après-midi', 'Journée complète'];

const TYPE_INFO: Record<ReservationType, { label: string; icon: FontIconName }> = {
  table: { label: 'Réservation de table', icon: 'utensils' },
  hotel: { label: 'Réservation d\'hôtel', icon: 'bed' },
  activity: { label: 'Réservation d\'activité', icon: 'masks-theater' },
  general: { label: 'Réservation', icon: 'clipboard-list' },
};

function deriveType(category?: string): ReservationType {
  const c = (category ?? '').toLowerCase();
  if (c === 'restaurant') return 'table';
  if (c === 'hotel') return 'hotel';
  if (['nature', 'activités', 'activité', 'attraction'].includes(c)) return 'activity';
  return 'general';
}

const formatDateISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const today = new Date();

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export default function ReservationScreen({ place, onDone, onCreated }: ReservationScreenProps) {
  const currentUserId = useAuthUser();
  const reservationType = deriveType(place.category);

  const [dateObj, setDateObj] = useState<Date>(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Hôtel : arrivée / départ (pas d'heures) + choix de la chambre.
  const [checkOutObj, setCheckOutObj] = useState<Date>(() => addDays(today, 1));
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(reservationType === 'hotel');
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState('');

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const { rooms: list } = await api.fetchRooms(place.id);
      setRooms(list);
      // Une seule chambre proposée : présélectionnée.
      if (list.length === 1) setRoomTypeId(list[0].id);
    } catch (e) {
      setRoomsError(e instanceof Error ? e.message : 'Impossible de charger les chambres.');
    } finally {
      setRoomsLoading(false);
    }
  }, [place.id]);

  useEffect(() => {
    if (reservationType === 'hotel') loadRooms();
  }, [reservationType, loadRooms]);

  const [timeStartObj, setTimeStartObj] = useState<Date>(() => {
    const d = new Date(); d.setHours(19, 0, 0, 0); return d;
  });
  const [showTimeStart, setShowTimeStart] = useState(false);

  const [timeEndObj, setTimeEndObj] = useState<Date>(() => {
    const d = new Date(); d.setHours(21, 0, 0, 0); return d;
  });
  const [showTimeEnd, setShowTimeEnd] = useState(false);

  const [guests, setGuests] = useState('1');
  const [activitySlot, setActivitySlot] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) {
      setDateObj(selected);
      // Hôtel : le départ reste toujours après l'arrivée.
      if (reservationType === 'hotel' && countNights(selected, checkOutObj) < 1) {
        setCheckOutObj(addDays(selected, 1));
      }
    }
  };

  const onCheckOutChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowCheckOut(Platform.OS === 'ios');
    if (selected) setCheckOutObj(selected);
  };

  const onTimeStartChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowTimeStart(Platform.OS === 'ios');
    if (selected) setTimeStartObj(selected);
  };

  const onTimeEndChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowTimeEnd(Platform.OS === 'ios');
    if (selected) setTimeEndObj(selected);
  };

  const handleSubmit = async () => {
    if (!formValid) return;
    if (!currentUserId) {
      setError('Tu dois être connecté pour réserver.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.createReservation(
        reservationType === 'hotel'
          ? {
              placeId: place.id,
              reservationType,
              date: formatDateISO(dateObj), // arrivée
              dateEnd: formatDateISO(checkOutObj), // départ
              guests: guestsInt || 1,
              roomTypeId,
              note: note.trim() || undefined,
            }
          : {
              placeId: place.id,
              reservationType,
              date: formatDateISO(dateObj),
              timeStart: formatTime(timeStartObj),
              timeEnd: formatTime(timeEndObj),
              guests: guestsInt || 1,
              activitySlot: reservationType === 'activity' ? activitySlot || undefined : undefined,
              note: note.trim() || undefined,
            }
      );
      onCreated?.();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réservation.');
    } finally {
      setLoading(false);
    }
  };

  const guestsInt = parseInt(guests, 10);
  const guestsValid = !Number.isNaN(guestsInt) && guestsInt >= 1 && guestsInt <= 50;
  const isHotel = reservationType === 'hotel';
  const selectedRoom = rooms.find((r) => r.id === roomTypeId) ?? null;
  const nights = isHotel ? countNights(dateObj, checkOutObj) : 0;

  const guestsError = !guests.trim() || !guestsValid
    ? `Le nombre de ${isHotel ? 'voyageurs' : 'convives'} doit être entre 1 et 50.`
    : isHotel && selectedRoom && guestsInt > selectedRoom.capacity
      ? `Cette chambre accueille ${selectedRoom.capacity} personne${selectedRoom.capacity > 1 ? 's' : ''} maximum.`
      : null;

  // Les horaires ne concernent pas les hôtels (arrivée / départ à la place).
  const timeError = !isHotel && formatTime(timeEndObj) <= formatTime(timeStartObj)
    ? 'L\u2019heure de fin doit être après l\u2019heure de début.'
    : null;

  const datesError = isHotel && nights < 1
    ? 'Le départ doit être après l\u2019arrivée.'
    : null;

  const roomError = isHotel && !selectedRoom
    ? 'Sélectionnez une chambre.'
    : null;
  const slotError = reservationType === 'activity' && !activitySlot
    ? 'Sélectionnez un créneau.'
    : null;

  const formValid = !guestsError && !timeError && !datesError && !roomError && !slotError;
  const totalPrice = selectedRoom && nights > 0 ? selectedRoom.pricePerNight * nights : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.placeNameRow}>
        <FontIcon name="location-dot" width={18} height={18} fill="#111827" />
        <Text style={styles.placeName}>{place.name}</Text>
      </View>
      {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}

      {/* Type dérivé (lecture seule) */}
      <View style={styles.typeBadge}>
        <FontIcon
          name={TYPE_INFO[reservationType].icon}
          width={14}
          height={14}
          fill="#1d4ed8"
        />
        <Text style={styles.typeBadgeText}>{TYPE_INFO[reservationType].label}</Text>
      </View>

      {/* Date */}
      <Text style={styles.label}>{isHotel ? 'Arrivée *' : 'Date *'}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} accessibilityRole="button" accessibilityLabel={isHotel ? 'Choisir la date d\'arrivée' : 'Choisir la date'}>
        <View style={styles.dateTextRow}>
          <FontIcon name="calendar" width={16} height={16} fill="#6b7280" />
          <Text style={styles.dateText}>{formatDateDisplay(dateObj)}</Text>
        </View>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={today}
        />
      )}

      {/* Départ (hôtel : arrivée + départ, sans horaires) */}
      {isHotel && (
        <>
          <Text style={styles.label}>Départ *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowCheckOut(true)} accessibilityRole="button" accessibilityLabel="Choisir la date de départ">
            <View style={styles.dateTextRow}>
              <FontIcon name="calendar" width={16} height={16} fill="#6b7280" />
              <Text style={styles.dateText}>{formatDateDisplay(checkOutObj)}</Text>
            </View>
          </TouchableOpacity>
          {showCheckOut && (
            <DateTimePicker
              value={checkOutObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onCheckOutChange}
              minimumDate={addDays(dateObj, 1)}
            />
          )}
          {nights > 0 ? <Text style={styles.nightsText}>{formatNights(nights)}</Text> : null}
          {datesError ? <Text style={styles.errorInline}>{datesError}</Text> : null}
        </>
      )}

      {/* Horaires (hors hôtel) */}
      {!isHotel && (
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Heure début</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimeStart(true)} accessibilityRole="button" accessibilityLabel="Choisir l'heure de début">
            <View style={styles.dateTextRow}>
              <FontIcon name="clock" width={16} height={16} fill="#6b7280" />
              <Text style={styles.dateText}>{formatTime(timeStartObj)}</Text>
            </View>
          </TouchableOpacity>
          {showTimeStart && (
            <DateTimePicker
              value={timeStartObj}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeStartChange}
            />
          )}
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Heure fin</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimeEnd(true)} accessibilityRole="button" accessibilityLabel="Choisir l'heure de fin">
            <View style={styles.dateTextRow}>
              <FontIcon name="clock" width={16} height={16} fill="#6b7280" />
              <Text style={styles.dateText}>{formatTime(timeEndObj)}</Text>
            </View>
          </TouchableOpacity>
          {showTimeEnd && (
            <DateTimePicker
              value={timeEndObj}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeEndChange}
            />
          )}
        </View>
      </View>
      )}

      {/* Nombre de personnes */}
      <Text style={styles.label}>
        {isHotel ? 'Nombre de voyageurs *' : 'Nombre de convives / participants *'}
      </Text>
      <TextInput
        style={styles.input}
        value={guests}
        onChangeText={setGuests}
        placeholder="1"
        keyboardType="numeric"
        maxLength={3}
      />
      {guestsError ? <Text style={styles.errorInline}>{guestsError}</Text> : null}

      {timeError ? <Text style={styles.errorInline}>{timeError}</Text> : null}

      {/* Choix de la chambre (hôtel) : cartes avec prix, façon Booking.com */}
      {isHotel && (
        <>
          <Text style={styles.label}>Choisissez votre chambre *</Text>
          <RoomPicker
            rooms={rooms}
            loading={roomsLoading}
            error={roomsError}
            selectedId={roomTypeId}
            onSelect={setRoomTypeId}
            nights={nights}
            onRetry={loadRooms}
          />
          {!roomsLoading && !roomsError && rooms.length > 0 && roomError ? (
            <Text style={styles.errorInline}>{roomError}</Text>
          ) : null}
        </>
      )}

      {/* Créneau d'activité */}
      {reservationType === 'activity' && (
        <>
          <Text style={styles.label}>Créneau *</Text>
          <View style={styles.typeRow}>
            {ACTIVITY_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.typeChip, activitySlot === slot && styles.typeChipActive]}
                onPress={() => setActivitySlot(slot)}
                accessibilityRole="button"
                accessibilityLabel={`Créneau : ${slot}`}
                accessibilityState={{ selected: activitySlot === slot }}
              >
                <Text style={[styles.typeChipText, activitySlot === slot && styles.typeChipTextActive]}>{slot}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {slotError ? <Text style={styles.errorInline}>{slotError}</Text> : null}
        </>
      )}

      {/* Note */}
      <Text style={styles.label}>Note / commentaire</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={note}
        onChangeText={setNote}
        placeholder="Demandes spéciales, allergies, etc."
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Récapitulatif */}
      <View style={styles.recap}>
        <Text style={styles.recapTitle}>Récapitulatif</Text>
        <View style={styles.recapRow}>
          <Text style={styles.recapLabel}>Lieu</Text>
          <Text style={styles.recapValue}>{place.name}</Text>
        </View>
        {isHotel ? (
          <>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Arrivée</Text>
              <Text style={styles.recapValue}>{formatDateDisplay(dateObj)}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Départ</Text>
              <Text style={styles.recapValue}>{formatDateDisplay(checkOutObj)}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Durée</Text>
              <Text style={styles.recapValue}>{nights > 0 ? formatNights(nights) : '—'}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Date</Text>
              <Text style={styles.recapValue}>{formatDateDisplay(dateObj)}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Horaires</Text>
              <Text style={styles.recapValue}>{formatTime(timeStartObj)} – {formatTime(timeEndObj)}</Text>
            </View>
          </>
        )}
        <View style={styles.recapRow}>
          <Text style={styles.recapLabel}>{isHotel ? 'Voyageurs' : 'Convives'}</Text>
          <Text style={styles.recapValue}>{guestsInt || 1}</Text>
        </View>
        {isHotel && selectedRoom ? (
          <>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Chambre</Text>
              <Text style={styles.recapValue}>{selectedRoom.name}</Text>
            </View>
            <View style={styles.recapRow}>
              <Text style={styles.recapLabel}>Tarif</Text>
              <Text style={styles.recapValue}>
                {formatMoney(selectedRoom.pricePerNight, selectedRoom.currency)} / nuit
              </Text>
            </View>
            {totalPrice !== null ? (
              <View style={styles.recapRow}>
                <Text style={styles.recapTotalLabel}>Total</Text>
                <Text style={styles.recapTotalValue}>{formatMoney(totalPrice, selectedRoom.currency)}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        {reservationType === 'activity' && activitySlot ? (
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel}>Créneau</Text>
            <Text style={styles.recapValue}>{activitySlot}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onDone} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (!formValid || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!formValid || loading}
          accessibilityRole="button"
          accessibilityLabel="Confirmer la réservation"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Réserver</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  placeName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  placeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeAddress: { color: colors.textSecondary, fontSize: 14, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textStrong, marginTop: 12, marginBottom: 6 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    marginBottom: 4,
  },
  typeBadgeText: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  dateTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { fontSize: 13, color: colors.textStrong, fontWeight: '500' },
  typeChipTextActive: { color: colors.surface },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  errorInline: { color: colors.danger, fontSize: 13, marginTop: 4 },
  recap: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
  },
  recapTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  recapLabel: { color: colors.textSecondary, fontSize: 14 },
  recapValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  recapTotalLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  recapTotalValue: { color: colors.primaryDark, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  nightsText: { color: colors.primaryDark, fontSize: 13, fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.surface, fontWeight: '700' },
});
