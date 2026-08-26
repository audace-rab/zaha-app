import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

// Traduit les erreurs brutes de Supabase en messages courts et compréhensibles.
const translateAuthError = (raw: string): string => {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Identifiants incorrects.';
  if (msg.includes('email not confirmed')) return 'Veuillez confirmer votre adresse email.';
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (msg.includes('invalid email') || msg.includes('email is invalid')) {
    return 'Adresse email invalide.';
  }
  if (
    msg.includes('password') &&
    (msg.includes('short') || msg.includes('least') || msg.includes('characters'))
  ) {
    return 'Mot de passe trop court (6 caractères minimum).';
  }
  if (msg.includes('rate limit')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return 'Une erreur est survenue. Veuillez réessayer.';
};

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage('Email et mot de passe sont requis.');
      return;
    }

    if (!supabase) {
      setMessage('Supabase n’est pas configuré. Vérifie les variables d’environnement.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage(translateAuthError(error.message));
          return;
        }

        if (data.session) {
          onAuthSuccess();
          return;
        }

        setMessage('Compte créé. Vérifiez votre email ou désactivez la confirmation pour le mode dev.');
        return;
      }

      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(translateAuthError(error.message));
        return;
      }

      if (data.session) {
        onAuthSuccess();
      } else {
        setMessage('Connexion impossible. Vérifiez votre email et votre mot de passe.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? translateAuthError(error.message) : 'Erreur de connexion'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue sur Zaha</Text>
          <Text style={styles.subtitle}>Connectez-vous pour accéder au feed, aux lieux et au chat.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Mot de passe"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signUp' ? 'Créer un compte' : 'Se connecter'}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{mode === 'signUp' ? 'Créer un compte' : 'Se connecter'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'signUp' ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}
            </Text>
            <TouchableOpacity
              onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signUp' ? 'Passer à la connexion' : "Passer à l'inscription"}
            >
              <Text style={styles.switchAction}>{mode === 'signUp' ? 'Se connecter' : 'S’inscrire'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 16 },
  keyboardAvoiding: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { color: '#6b7280', marginBottom: 24, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#f8fafc' },
  passwordWrapper: { width: '100%' },
  passwordInput: { marginBottom: 0, paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  eyeIcon: { fontSize: 18 },
  button: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  switchText: { color: '#6b7280' },
  switchAction: { color: '#2563eb', fontWeight: '700' },
  message: { color: '#dc2626', marginBottom: 12 },
});
