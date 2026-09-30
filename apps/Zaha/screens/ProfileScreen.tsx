import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import FontIcon from '../components/FontIcon';
import { colors, radius } from '../theme';

type ProfileScreenProps = {
  onOpenFavorites?: () => void;
  onOpenReservations?: () => void;
};

export default function ProfileScreen({ onOpenFavorites, onOpenReservations }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Édition inline
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [pendingAvatarBase64, setPendingAvatarBase64] = useState<string | null>(null);
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
    setPendingAvatarBase64(null);
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
        includeBase64: true,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setError('Impossible de lire l\'image.');
        return;
      }
      setPendingAvatarUri(asset.uri ?? null);
      setPendingAvatarBase64(asset.base64 ?? null);
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

      if (pendingAvatarUri && pendingAvatarBase64) {
        const upload = await api.uploadAvatar(pendingAvatarBase64);
        avatarUrl = upload.url;
      }

      const updated = await api.updateProfile({
        name: editName.trim(),
        bio: editBio.trim() || undefined,
        website: editWebsite.trim() || undefined,
        avatar_url: avatarUrl ?? undefined,
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

  const openWebsite = async (url: string) => {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert('Impossible d’ouvrir le site', 'Vérifiez que l’adresse est correcte puis réessayez.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez vous reconnecter pour accéder à vos données.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => {
            supabase.auth.signOut();
          },
        },
      ]
    );
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
              <FontIcon name="user" width={40} height={40} fill="#9ca3af" />
            </View>
          )}

          {!editing ? (
            <>
              <Text style={styles.name}>{profile.name}</Text>
              <View style={styles.handleRow}>
                <FontIcon name="globe" width={14} height={14} fill="#6b7280" />
                <Text style={styles.handle}>
                  {profile.country_flag ? `${profile.country_flag} ` : ''}
                  {profile.country ?? 'Madagascar'}
                </Text>
              </View>

              {profile.bio || profile.description ? (
                <Text style={styles.description}>{profile.bio ?? profile.description}</Text>
              ) : null}

              {profile.website ? (
                <TouchableOpacity
                  onPress={() => openWebsite(profile.website!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Ouvrir ${profile.website}`}
                >
                  <Text style={styles.website}>{profile.website}</Text>
                </TouchableOpacity>
              ) : null}

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
                <View style={styles.actionButtonInner}>
                  <FontIcon name="star" width={16} height={16} fill="#eab308" />
                  <Text style={styles.favoritesButtonText}>Mes favoris</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.reservationsButton]}
                onPress={() => onOpenReservations?.()}
                accessibilityRole="button"
                accessibilityLabel="Voir mes réservations"
              >
                <View style={styles.actionButtonInner}>
                  <FontIcon name="calendar" width={16} height={16} fill="#2563eb" />
                  <Text style={styles.reservationsButtonText}>Mes réservations</Text>
                </View>
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
                <View style={styles.actionButtonInner}>
                  <FontIcon name="camera" width={16} height={16} fill="#2563eb" />
                  <Text style={styles.photoButtonText}>
                    {pendingAvatarUri ? 'Photo choisie — changer' : 'Changer la photo'}
                  </Text>
                </View>
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

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                onPress={() => {
                  setEditing(false);
      setPendingAvatarUri(null);
      setPendingAvatarBase64(null);
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

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} accessibilityRole="button" accessibilityLabel="Se déconnecter">
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  scroll: { paddingBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, borderWidth: 1, borderColor: colors.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, alignSelf: 'center' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  handle: { fontSize: 14, color: colors.textSecondary },
  handleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  description: { color: colors.textStrong, fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: 'center' },
  website: { color: colors.primary, fontSize: 15, marginTop: 8, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 16 },
  statsValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statsLabel: { color: colors.textSecondary, fontSize: 13 },
  editTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.inputBg,
    marginBottom: 12,
    color: colors.textPrimary,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  actionButton: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editButton: { backgroundColor: colors.primary },
  editButtonText: { color: colors.surface, fontWeight: '600' },
  favoritesButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  favoritesButtonText: { color: colors.primary, fontWeight: '600' },
  reservationsButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  reservationsButtonText: { color: colors.primary, fontWeight: '600' },
  photoButton: { backgroundColor: colors.chipBg },
  photoButtonText: { color: colors.textStrong, fontWeight: '600' },
  saveButton: { backgroundColor: colors.primary },
  saveButtonText: { color: colors.surface, fontWeight: '700' },
  cancelText: { color: colors.textSecondary, textAlign: 'center', marginTop: 14, paddingVertical: 8 },
  success: { color: colors.success, textAlign: 'center', marginTop: 14 },
  infoBlock: { marginTop: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderColor: colors.chipBg },
  infoLabel: { color: colors.textSecondary },
  infoValue: { color: colors.textPrimary, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { color: colors.textSecondary, textAlign: 'center' },
  signOutButton: {
    marginTop: 20,
    backgroundColor: colors.like,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
