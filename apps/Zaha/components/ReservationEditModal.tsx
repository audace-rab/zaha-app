import { useEffect, useState } from 'react';
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
import { api, type CreateReservationData, type Reservation } from '../lib/api';
import { formatDateDisplay } from '../lib/format';
import { ACTIVITY_SLOTS, ROOM_TYPES } from '../screens/ReservationScreen';
import FontIcon from './FontIcon';
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
  const [roomType, setRoomType] = useState('');
  const [activitySlot, setActivitySlot] = useState('');
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
    setRoomType(reservation.room_type ?? '');
    setActivitySlot(reservation.activity_slot ?? '');
    setNote(reservation.note ?? '');
    setShowDate(false);
    setShowStart(false);
    setShowEnd(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, mode]);

  if (!reservation) return null;

  const isEdit = mode === 'edit';
  const isHotel = isEdit && reservation.reservation_type === 'hotel';
  const isActivity = isEdit && reservation.reservation_type === 'activity';

  const guestsInt = parseInt(guests, 10);
  const guestsError =
    isEdit && (Number.isNaN(guestsInt) || guestsInt < 1 || guestsInt > 50)
      ? 'Le nombre de convives doit être entre 1 et 50.'
      : null;
  const timeError =
    formatTime(timeEndObj) <= formatTime(timeStartObj)
      ? 'L\u2019heure de fin doit être après l\u2019heure de début.'
      : null;
  const roomError = isHotel && !roomType ? 'Sélectionnez un type de chambre.' : null;
  const slotError = isActivity && !activitySlot ? 'Sélectionnez un créneau.' : null;
  const formValid = !guestsError && !timeError && !roomError && !slotError;

  const previousStart = (reservation.time_start ?? '').slice(0, 5);
  const previousEnd = (reservation.time_end ?? '').slice(0, 5);
  const slotChanged =
    formatDateISO(dateObj) !== reservation.date ||
    formatTime(timeStartObj) !== previousStart ||
    formatTime(timeEndObj) !== previousEnd;

  const handleSubmit = async () => {
    if (!formValid) return;

    const payload: Partial<CreateReservationData> = {};
    if (slotChanged) {
      // Les deux horaires sont toujours envoyés ensemble (le serveur contrôle leur ordre).
      payload.date = formatDateISO(dateObj);
      payload.timeStart = formatTime(timeStartObj);
      payload.timeEnd = formatTime(timeEndObj);
    }
    if (isEdit) {
      if (guestsInt !== reservation.guests) payload.guests = guestsInt;
      if (isHotel && roomType !== (reservation.room_type ?? '')) payload.roomType = roomType;
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
    if (selected) setDateObj(selected);
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

            <Text style={styles.label}>{isEdit ? 'Date' : 'Nouvelle date'}</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDate(true)}
              accessibilityRole="button"
              accessibilityLabel="Choisir la date"
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
            {timeError ? <Text style={styles.error}>{timeError}</Text> : null}

            {isEdit && (
              <>
                <Text style={styles.label}>Nombre de convives / participants</Text>
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
                <Text style={styles.label}>Type de chambre</Text>
                <View style={styles.chips}>
                  {ROOM_TYPES.map((rt) => (
                    <TouchableOpacity
                      key={rt}
                      style={[styles.chip, roomType === rt && styles.chipActive]}
                      onPress={() => setRoomType(rt)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chambre : ${rt}`}
                      accessibilityState={{ selected: roomType === rt }}
                    >
                      <Text style={[styles.chipText, roomType === rt && styles.chipTextActive]}>{rt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
