import { useState } from 'react';
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
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const DEMO_USER_ID = 'a1000000-0000-0000-0000-000000000001';

type PlaceMini = {
  id: string;
  name: string;
  category?: string;
  address?: string;
};

type ReservationScreenProps = {
  place: PlaceMini;
  onDone: () => void;
};

const RESERVATION_TYPES = [
  { key: 'general', label: 'Général', icon: '📋' },
  { key: 'table', label: 'Table', icon: '🍽️' },
  { key: 'hotel', label: 'Hôtel', icon: '🏨' },
  { key: 'activity', label: 'Activité', icon: '🎭' },
] as const;

const ROOM_TYPES = ['Simple', 'Double', 'Suite', 'Familiale'];
const ACTIVITY_SLOTS = ['Matin', 'Après-midi', 'Journée complète'];

const formatDateISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateDisplay = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const today = new Date();

export default function ReservationScreen({ place, onDone }: ReservationScreenProps) {
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USER_ID);
  const [reservationType, setReservationType] = useState<string>('general');

  const [dateObj, setDateObj] = useState<Date>(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [timeStartObj, setTimeStartObj] = useState<Date>(() => {
    const d = new Date(); d.setHours(19, 0, 0, 0); return d;
  });
  const [showTimeStart, setShowTimeStart] = useState(false);

  const [timeEndObj, setTimeEndObj] = useState<Date>(() => {
    const d = new Date(); d.setHours(21, 0, 0, 0); return d;
  });
  const [showTimeEnd, setShowTimeEnd] = useState(false);

  const [guests, setGuests] = useState('1');
  const [roomType, setRoomType] = useState('');
  const [activitySlot, setActivitySlot] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
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
  });

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) setDateObj(selected);
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
    setLoading(true);
    setError(null);
    try {
      await api.createReservation({
        userId: currentUserId,
        placeId: place.id,
        reservationType,
        date: formatDateISO(dateObj),
        timeStart: formatTime(timeStartObj),
        timeEnd: formatTime(timeEndObj),
        guests: parseInt(guests, 10) || 1,
        roomType: reservationType === 'hotel' ? roomType || undefined : undefined,
        activitySlot: reservationType === 'activity' ? activitySlot || undefined : undefined,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réservation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.placeName}>📍 {place.name}</Text>
      {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}

      {/* Type de réservation */}
      <Text style={styles.label}>Type de réservation</Text>
      <View style={styles.typeRow}>
        {RESERVATION_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, reservationType === t.key && styles.typeChipActive]}
            onPress={() => setReservationType(t.key)}
            accessibilityRole="button"
            accessibilityLabel={`Type : ${t.label}`}
            accessibilityState={{ selected: reservationType === t.key }}
          >
            <Text style={styles.typeChipIcon}>{t.icon}</Text>
            <Text style={[styles.typeChipText, reservationType === t.key && styles.typeChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date */}
      <Text style={styles.label}>Date *</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} accessibilityRole="button" accessibilityLabel="Choisir la date">
        <Text style={styles.dateText}>📅 {formatDateDisplay(dateObj)}</Text>
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

      {/* Horaires */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Heure début</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimeStart(true)} accessibilityRole="button" accessibilityLabel="Choisir l'heure de début">
            <Text style={styles.dateText}>🕐 {formatTime(timeStartObj)}</Text>
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
            <Text style={styles.dateText}>🕐 {formatTime(timeEndObj)}</Text>
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

      {/* Nombre de convives */}
      <Text style={styles.label}>Nombre de convives / participants</Text>
      <TextInput
        style={styles.input}
        value={guests}
        onChangeText={setGuests}
        placeholder="1"
        keyboardType="numeric"
        maxLength={3}
      />

      {/* Type de chambre (si hôtel) */}
      {reservationType === 'hotel' && (
        <>
          <Text style={styles.label}>Type de chambre</Text>
          <View style={styles.typeRow}>
            {ROOM_TYPES.map((rt) => (
              <TouchableOpacity
                key={rt}
                style={[styles.typeChip, roomType === rt && styles.typeChipActive]}
                onPress={() => setRoomType(rt)}
                accessibilityRole="button"
                accessibilityLabel={`Chambre : ${rt}`}
                accessibilityState={{ selected: roomType === rt }}
              >
                <Text style={[styles.typeChipText, roomType === rt && styles.typeChipTextActive]}>{rt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Créneau d'activité */}
      {reservationType === 'activity' && (
        <>
          <Text style={styles.label}>Créneau</Text>
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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onDone} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  placeName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 2 },
  placeAddress: { color: '#6b7280', fontSize: 14, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  dateText: { fontSize: 15, color: '#111827' },
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
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#6b7280', fontWeight: '600' },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700' },
});
