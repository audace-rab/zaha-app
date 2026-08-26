import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api, type Profile } from '../lib/api';
import { supabase } from '../lib/supabase';

type ProfileScreenProps = {
  onOpenFavorites?: () => void;
};

export default function ProfileScreen({ onOpenFavorites }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Édition inline
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

        const result = await api.fetchProfile(userData.user.id);
        setProfile(result.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Message de succès temporaire (auto-effacé).
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name ?? '');
    setEditBio(profile.bio ?? '');
    setEditWebsite(profile.website ?? '');
    setPendingAvatarUri(null);
    setError(null);
    setSuccessMessage(null);
    setEditing(true);
  };

  const pickAvatar = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.5,
        maxWidth: 800,
        maxHeight: 800,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError('Aucune image sélectionnée.');
        return;
      }
      setPendingAvatarUri(asset.uri);
    } catch {
      setError('Impossible d’ouvrir la galerie. Vérifie les permissions.');
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!editName.trim()) {
      setError('Le nom est requis.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;

      if (pendingAvatarUri) {
        const upload = await api.uploadAvatar(profile.id, pendingAvatarUri);
        avatarUrl = upload.url;
      }

      const updated = await api.updateProfile(profile.id, {
        name: editName.trim(),
        bio: editBio.trim() || undefined,
        website: editWebsite.trim() || undefined,
      });

      setProfile({
        ...updated.profile,
        avatar_url: avatarUrl ?? profile.avatar_url,
      });
      setPendingAvatarUri(null);
      setEditing(false);
      setSuccessMessage('Profil enregistré ✓');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

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

  if (error && !profile) {
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

  const avatarSource = pendingAvatarUri ?? profile.avatar_url;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>🗿</Text>
            </View>
          )}

          {!editing ? (
            <>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.handle}>{profile.country_flag ?? '🌍'} {profile.country ?? 'Madagascar'}</Text>

              {profile.bio || profile.description ? (
                <Text style={styles.description}>{profile.bio ?? profile.description}</Text>
              ) : null}

              {profile.website ? <Text style={styles.website}>{profile.website}</Text> : null}

              {typeof profile.bookmarks_count === 'number' ? (
                <View style={styles.statsRow}>
                  <Text style={styles.statsValue}>{profile.bookmarks_count}</Text>
                  <Text style={styles.statsLabel}>lieux favoris</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={startEditing}
                accessibilityRole="button"
                accessibilityLabel="Modifier le profil"
              >
                <Text style={styles.editButtonText}>Modifier le profil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.favoritesButton]}
                onPress={() => onOpenFavorites?.()}
                accessibilityRole="button"
                accessibilityLabel="Voir mes lieux favoris"
              >
                <Text style={styles.favoritesButtonText}>⭐ Mes favoris</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.editTitle}>Modifier le profil</Text>

              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nom"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Bio"
                placeholderTextColor="#9ca3af"
                multiline
              />
              <TextInput
                style={styles.input}
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="Site web"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="url"
              />

              <TouchableOpacity
                style={[styles.actionButton, styles.photoButton]}
                onPress={pickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Changer la photo de profil"
              >
                <Text style={styles.photoButtonText}>
                  {pendingAvatarUri ? '📷 Photo choisie — changer' : '📷 Changer la photo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={saveProfile}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer le profil"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEditing(false);
                  setPendingAvatarUri(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Annuler les modifications"
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}

          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Langue</Text>
              <Text style={styles.infoValue}>FR</Text>
            </View>
            {profile.location ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Localisation</Text>
                <Text style={styles.infoValue}>{profile.location}</Text>
              </View>
            ) : null}
            {profile.country_flag ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pays</Text>
                <Text style={styles.infoValue}>{profile.country ?? 'Madagascar'} {profile.country_flag}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  scroll: { paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, alignSelf: 'center' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  avatarPlaceholderText: { fontSize: 40 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  handle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  description: { color: '#374151', lineHeight: 22, marginTop: 12, textAlign: 'center' },
  website: { color: '#2563eb', marginTop: 8, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 16 },
  statsValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statsLabel: { color: '#6b7280', fontSize: 13 },
  editTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
    color: '#111827',
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  editButton: { backgroundColor: '#2563eb' },
  editButtonText: { color: '#fff', fontWeight: '600' },
  favoritesButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2563eb' },
  favoritesButtonText: { color: '#2563eb', fontWeight: '600' },
  photoButton: { backgroundColor: '#f3f4f6' },
  photoButtonText: { color: '#374151', fontWeight: '600' },
  saveButton: { backgroundColor: '#2563eb' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  cancelText: { color: '#6b7280', textAlign: 'center', marginTop: 14 },
  success: { color: '#16a34a', textAlign: 'center', marginTop: 14 },
  infoBlock: { marginTop: 18 },
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
