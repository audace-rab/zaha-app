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
import FontIcon from '../components/FontIcon';
import { colors, radius } from '../theme';

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
  const [feedback, setFeedback] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setFeedback({ text: 'Email et mot de passe sont requis.', kind: 'error' });
      return;
    }

    if (!supabase) {
      setFeedback({
        text: 'Supabase n’est pas configuré. Vérifie les variables d’environnement.',
        kind: 'error',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setFeedback({ text: translateAuthError(error.message), kind: 'error' });
          return;
        }

        if (data.session) {
          onAuthSuccess();
          return;
        }

        setFeedback({
          text: 'Compte créé. Vérifiez votre email ou désactivez la confirmation pour le mode dev.',
          kind: 'success',
        });
        return;
      }

      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setFeedback({ text: translateAuthError(error.message), kind: 'error' });
        return;
      }

      if (data.session) {
        onAuthSuccess();
      } else {
        setFeedback({
          text: 'Connexion impossible. Vérifiez votre email et votre mot de passe.',
          kind: 'error',
        });
      }
    } catch (error) {
      setFeedback({
        text: error instanceof Error ? translateAuthError(error.message) : 'Erreur de connexion',
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!supabase) {
      setFeedback({
        text: 'Supabase n’est pas configuré. Vérifie les variables d’environnement.',
        kind: 'error',
      });
      return;
    }
    if (!email.trim()) {
      setFeedback({ text: 'Renseignez votre email pour recevoir le lien de réinitialisation.', kind: 'error' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setFeedback({ text: translateAuthError(error.message), kind: 'error' });
        return;
      }
      setFeedback({
        text: 'Un lien de réinitialisation vous a été envoyé par email.',
        kind: 'success',
      });
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error
            ? translateAuthError(error.message)
            : 'Une erreur est survenue. Veuillez réessayer.',
        kind: 'error',
      });
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
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Mot de passe"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <FontIcon
                name={showPassword ? 'eye' : 'eye-slash'}
                width={18}
                height={18}
                fill="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {mode === 'signIn' ? (
            <TouchableOpacity
              onPress={handleForgotPassword}
              accessibilityRole="button"
              accessibilityLabel="Mot de passe oublié"
            >
              <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          ) : null}

          {feedback ? (
            <Text style={[styles.message, feedback.kind === 'success' && styles.messageSuccess]}>
              {feedback.text}
            </Text>
          ) : null}

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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 16 },
  keyboardAvoiding: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  subtitle: { color: colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: colors.inputBg },
passwordWrapper: { width: '100%' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: colors.surface, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  switchText: { color: colors.textSecondary },
  switchAction: { color: colors.primary, fontWeight: '700' },
  message: { color: colors.danger, marginBottom: 12 },
  messageSuccess: { color: colors.success },
  forgotLink: { color: colors.primary, fontWeight: '600', textAlign: 'right', marginBottom: 12 },
});
