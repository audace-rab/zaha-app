import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  banner_url?: string;
  location?: string;
  phone?: string;
  language?: string;
  country?: string;
  country_flag?: string;
  description?: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          setError('Impossible de récupérer l’utilisateur.');
          return;
        }

        const userId = userData.user.id;
        const { data, error } = await supabase
          .from<Profile>('profiles')
          .select('id, name, avatar_url, banner_url, location, phone, language, country, country_flag, description')
          .eq('id', userId)
          .single();

        if (error) {
          setError(error.message);
          return;
        }

        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Profil introuvable.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>{profile.name?.charAt(0) ?? 'U'}</Text>
          </View>
        )}
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.handle}>{profile.country_flag ?? '🌍'} {profile.country ?? 'Madagascar'}</Text>

        {profile.description ? <Text style={styles.description}>{profile.description}</Text> : null}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Langue</Text>
          <Text style={styles.infoValue}>{profile.language ?? 'FR'}</Text>
        </View>
        {profile.location ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Localisation</Text>
            <Text style={styles.infoValue}>{profile.location}</Text>
          </View>
        ) : null}
        {profile.phone ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Téléphone</Text>
            <Text style={styles.infoValue}>{profile.phone}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, alignSelf: 'center' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  avatarPlaceholderText: { fontSize: 32, fontWeight: '700', color: '#374151' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  handle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  description: { color: '#374151', lineHeight: 22, marginTop: 12, marginBottom: 18, textAlign: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderColor: '#f3f4f6' },
  infoLabel: { color: '#6b7280' },
  infoValue: { color: '#111827', fontWeight: '600' },
  error: { color: '#dc2626', textAlign: 'center' },
  empty: { color: '#6b7280', textAlign: 'center' },
  signOutButton: {
    marginTop: 20,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontWeight: '700',
  },
});
