import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { api, type CreateReservationData, type Reservation, type RoomType } from '../lib/api';
import { countNights, formatDateDisplay, formatNights } from '../lib/format';
import { ACTIVITY_SLOTS } from '../screens/ReservationScreen';
import FontIcon from './FontIcon';
import RoomPicker from './RoomPicker';
import { colors, radius } from '../theme';

type ReservationEditModalProps = {
  /** Réservation à modifier (null = modale fermée). */
  reservation: Reservation | null;
  /**
   * 'edit'       : réservation en attente — tout est modifiable sauf le lieu.
   * 'reschedule' : réservation indisponible — seul le créneau change (date + horaires).
   */
  mode: 'edit' | 'reschedule';
  onClose: () => void;
  /** Appelé avec la réservation mise à jour renvoyée par le serveur. */
  onSaved: (reservation: Reservation) => void;
};

const formatDateISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "2026-10-21" -> Date locale (évite le décalage UTC de new Date(string)). */
function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "19:00" ou "19:00:00" -> Date du jour à cette heure. */
function parseTime(value: string | undefined, fallbackHour: number): Date {
  const date = new Date();
  const match = value?.match(/^(\d{2}):(\d{2})/);
  date.setHours(match ? Number(match[1]) : fallbackHour, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function ReservationEditModal({
  reservation,
  mode,
  onClose,
  onSaved,
}: ReservationEditModalProps) {
  const [dateObj, setDateObj] = useState<Date>(startOfToday());
  const [timeStartObj, setTimeStartObj] = useState<Date>(parseTime(undefined, 19));
  const [timeEndObj, setTimeEndObj] = useState<Date>(parseTime(undefined, 21));
  const [showDate, setShowDate] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [guests, setGuests] = useState('1');
  const [activitySlot, setActivitySlot] = useState('');

  // Hôtel : arrivée = dateObj, départ = checkOutObj, chambre choisie parmi celles du lieu.
  const [checkOutObj, setCheckOutObj] = useState<Date>(addDays(startOfToday(), 1));
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Préremplit avec les valeurs actuelles (une date passée est ramenée à aujourd'hui).
  const reservationId = reservation?.id;
  useEffect(() => {
    if (!reservation) return;
    const previous = parseDate(reservation.date);
    const today = startOfToday();
    setDateObj(previous < today ? today : previous);
    setTimeStartObj(parseTime(reservation.time_start, 19));
    setTimeEndObj(parseTime(reservation.time_end, 21));
    setGuests(String(reservation.guests ?? 1));
    setActivitySlot(reservation.activity_slot ?? '');
    setNote(reservation.note ?? '');
    setRoomTypeId(reservation.room_type_id ?? '');
    const previousEnd = reservation.date_end ? parseDate(reservation.date_end) : null;
    const minEnd = addDays(previous < today ? today : previous, 1);
    setCheckOutObj(previousEnd && previousEnd >= minEnd ? previousEnd : minEnd);
    setShowDate(false);
    setShowStart(false);
    setShowEnd(false);
    setShowCheckOut(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, mode]);

  // Hôtel (modification complète) : chambres disponibles du lieu.
  const needsRooms = mode === 'edit' && reservation?.reservation_type === 'hotel';
  const placeId = reservation?.place_id;
  const loadRooms = useCallback(async () => {
    if (!placeId) return;
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const { rooms: list } = await api.fetchRooms(placeId);
      setRooms(list);
    } catch (e) {
      setRoomsError(e instanceof Error ? e.message : 'Impossible de charger les chambres.');
    } finally {
      setRoomsLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    if (needsRooms) loadRooms();
  }, [needsRooms, loadRooms]);

  if (!reservation) return null;

  const isEdit = mode === 'edit';
  const isHotelType = reservation.reservation_type === 'hotel';
  const isHotel = isEdit && isHotelType;
  const isActivity = isEdit && reservation.reservation_type === 'activity';

  const nights = isHotelType ? countNights(dateObj, checkOutObj) : 0;
  const selectedRoom = rooms.find((r) => r.id === roomTypeId) ?? null;
  // Ancienne réservation d'hôtel sans chambre : le choix n'est exigé que si on change les dates.
  const legacyHotel = isHotelType && !reservation.room_type_id;

  const guestsInt = parseInt(guests, 10);
  const guestsError =
    isEdit && (Number.isNaN(guestsInt) || guestsInt < 1 || guestsInt > 50)
      ? `Le nombre de ${isHotelType ? 'voyageurs' : 'convives'} doit être entre 1 et 50.`
      : isHotel && selectedRoom && guestsInt > selectedRoom.capacity
        ? `Cette chambre accueille ${selectedRoom.capacity} personne${selectedRoom.capacity > 1 ? 's' : ''} maximum.`
        : null;
  const timeError =
    !isHotelType && formatTime(timeEndObj) <= formatTime(timeStartObj)
      ? 'L\u2019heure de fin doit être après l\u2019heure de début.'
      : null;
  const datesError = isHotelType && nights < 1 ? 'Le départ doit être après l\u2019arrivée.' : null;

  const previousStart = (reservation.time_start ?? '').slice(0, 5);
  const previousEnd = (reservation.time_end ?? '').slice(0, 5);
  const slotChanged = isHotelType
    ? formatDateISO(dateObj) !== reservation.date ||
      formatDateISO(checkOutObj) !== (reservation.date_end ?? '')
    : formatDateISO(dateObj) !== reservation.date ||
      formatTime(timeStartObj) !== previousStart ||
      formatTime(timeEndObj) !== previousEnd;
  const roomChanged = isHotel && roomTypeId !== (reservation.room_type_id ?? '');

  const roomError =
    isHotel && !roomTypeId && (!legacyHotel || slotChanged)
      ? 'Sélectionnez une chambre.'
      : null;
  const slotError = isActivity && !activitySlot ? 'Sélectionnez un créneau.' : null;
  const formValid = !guestsError && !timeError && !datesError && !roomError && !slotError;

  const handleSubmit = async () => {
    if (!formValid) return;

    const payload: Partial<CreateReservationData> = {};
    if (isHotelType) {
      // Hôtel : arrivée + départ (le serveur recalcule le prix) ; pas d'horaires.
      if (slotChanged || roomChanged) {
        payload.date = formatDateISO(dateObj);
        payload.dateEnd = formatDateISO(checkOutObj);
        if (isHotel && roomTypeId) payload.roomTypeId = roomTypeId;
      }
    } else if (slotChanged) {
      // Les deux horaires sont toujours envoyés ensemble (le serveur contrôle leur ordre).
      payload.date = formatDateISO(dateObj);
      payload.timeStart = formatTime(timeStartObj);
      payload.timeEnd = formatTime(timeEndObj);
    }
    if (isEdit) {
      if (guestsInt !== reservation.guests) payload.guests = guestsInt;
      if (isActivity && activitySlot !== (reservation.activity_slot ?? '')) {
        payload.activitySlot = activitySlot;
      }
      if (note.trim() !== (reservation.note ?? '')) payload.note = note.trim();
    }

    if (Object.keys(payload).length === 0) {
      if (isEdit) {
        onClose(); // rien n'a changé
      } else {
        setError('Choisissez un créneau différent de celui qui est indisponible.');
      }
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { reservation: updated } = await api.updateReservation(reservation.id, payload);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\u2019enregistrer la modification.');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowDate(Platform.OS === 'ios');
    if (selected) {
      setDateObj(selected);
      // Hôtel : le départ reste toujours après l'arrivée.
      if (isHotelType && countNights(selected, checkOutObj) < 1) {
        setCheckOutObj(addDays(selected, 1));
      }
    }
  };
  const onCheckOutChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowCheckOut(Platform.OS === 'ios');
    if (selected) setCheckOutObj(selected);
  };
  const onStartChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowStart(Platform.OS === 'ios');
    if (selected) setTimeStartObj(selected);
  };
  const onEndChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowEnd(Platform.OS === 'ios');
    if (selected) setTimeEndObj(selected);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEdit ? 'Modifier la réservation' : 'Reprogrammer la réservation'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={styles.info}>
              {isEdit
                ? 'Vous pouvez tout modifier sauf le lieu, tant que la réservation est en attente.'
                : 'Le créneau choisi n’est pas disponible. Proposez-en un autre : la réservation repassera « En attente ».'}
            </Text>

            <Text style={styles.label}>
              {isHotelType
                ? isEdit ? 'Arrivée' : 'Nouvelle arrivée'
                : isEdit ? 'Date' : 'Nouvelle date'}
            </Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDate(true)}
              accessibilityRole="button"
              accessibilityLabel={isHotelType ? 'Choisir la date d\'arrivée' : 'Choisir la date'}
            >
              <View style={styles.inputRow}>
                <FontIcon name="calendar" width={16} height={16} fill="#6b7280" />
                <Text style={styles.inputText}>{formatDateDisplay(dateObj)}</Text>
              </View>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                minimumDate={startOfToday()}
              />
            )}

            {isHotelType && (
              <>
                <Text style={styles.label}>{isEdit ? 'Départ' : 'Nouveau départ'}</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowCheckOut(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir la date de départ"
                >
                  <View style={styles.inputRow}>
                    <FontIcon name="calendar" width={16} height={16} fill="#6b7280" />
                    <Text style={styles.inputText}>{formatDateDisplay(checkOutObj)}</Text>
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
                {nights > 0 ? <Text style={styles.nights}>{formatNights(nights)}</Text> : null}
                {datesError ? <Text style={styles.error}>{datesError}</Text> : null}
              </>
            )}

            {!isHotelType && (
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Heure début</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowStart(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir l'heure de début"
                >
                  <View style={styles.inputRow}>
                    <FontIcon name="clock" width={16} height={16} fill="#6b7280" />
                    <Text style={styles.inputText}>{formatTime(timeStartObj)}</Text>
                  </View>
                </TouchableOpacity>
                {showStart && (
                  <DateTimePicker
                    value={timeStartObj}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onStartChange}
                  />
                )}
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Heure fin</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowEnd(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir l'heure de fin"
                >
                  <View style={styles.inputRow}>
                    <FontIcon name="clock" width={16} height={16} fill="#6b7280" />
                    <Text style={styles.inputText}>{formatTime(timeEndObj)}</Text>
                  </View>
                </TouchableOpacity>
                {showEnd && (
                  <DateTimePicker
                    value={timeEndObj}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onEndChange}
                  />
                )}
              </View>
            </View>
            )}
            {timeError ? <Text style={styles.error}>{timeError}</Text> : null}

            {isEdit && (
              <>
                <Text style={styles.label}>
                  {isHotelType ? 'Nombre de voyageurs' : 'Nombre de convives / participants'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={guests}
                  onChangeText={setGuests}
                  keyboardType="numeric"
                  maxLength={3}
                />
                {guestsError ? <Text style={styles.error}>{guestsError}</Text> : null}
              </>
            )}

            {isHotel && (
              <>
                <Text style={styles.label}>Chambre</Text>
                <RoomPicker
                  rooms={rooms}
                  loading={roomsLoading}
                  error={roomsError}
                  selectedId={roomTypeId}
                  onSelect={setRoomTypeId}
                  nights={nights}
                  onRetry={loadRooms}
                />
                {roomError ? <Text style={styles.error}>{roomError}</Text> : null}
              </>
            )}

            {isActivity && (
              <>
                <Text style={styles.label}>Créneau</Text>
                <View style={styles.chips}>
                  {ACTIVITY_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.chip, activitySlot === slot && styles.chipActive]}
                      onPress={() => setActivitySlot(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Créneau : ${slot}`}
                      accessibilityState={{ selected: activitySlot === slot }}
                    >
                      <Text style={[styles.chipText, activitySlot === slot && styles.chipTextActive]}>
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {slotError ? <Text style={styles.error}>{slotError}</Text> : null}
              </>
            )}

            {isEdit && (
              <>
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
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Annuler"
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!formValid || saving) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!formValid || saving}
              accessibilityRole="button"
              accessibilityLabel={isEdit ? 'Enregistrer les modifications' : 'Proposer ce créneau'}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{isEdit ? 'Enregistrer' : 'Proposer ce créneau'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  close: { fontSize: 18, color: colors.textSecondary },
  body: { paddingBottom: 8, gap: 2 },
  info: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textStrong, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputText: { fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textStrong, fontWeight: '500' },
  chipTextActive: { color: colors.surface },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  nights: { color: colors.primaryDark, fontSize: 13, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
