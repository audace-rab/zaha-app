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
import { supabase } from '../lib/supabase';
import { api, type Reservation } from '../lib/api';

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

export default function ReservationScreen({ place, onDone }: ReservationScreenProps) {
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USER_ID);
  const [reservationType, setReservationType] = useState<string>('general');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [guests, setGuests] = useState('1');
  const [roomType, setRoomType] = useState('');
  const [activitySlot, setActivitySlot] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Résoudre userId au montage
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

  const handleSubmit = async () => {
    if (!date.trim()) {
      setError('La date est requise.');
      return;
    }
    // Validation basique du format date (AAAA-MM-JJ)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Format de date invalide. Utilisez AAAA-MM-JJ (ex: 2026-03-15).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.createReservation({
        userId: currentUserId,
        placeId: place.id,
        reservationType,
        date: date.trim(),
        timeStart: timeStart.trim() || undefined,
        timeEnd: timeEnd.trim() || undefined,
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
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="AAAA-MM-JJ (ex: 2026-03-15)"
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        maxLength={10}
      />

      {/* Horaires */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Heure début</Text>
          <TextInput
            style={styles.input}
            value={timeStart}
            onChangeText={setTimeStart}
            placeholder="HH:MM (ex: 19:00)"
            maxLength={5}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Heure fin</Text>
          <TextInput
            style={styles.input}
            value={timeEnd}
            onChangeText={setTimeEnd}
            placeholder="HH:MM (ex: 21:00)"
            maxLength={5}
          />
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
