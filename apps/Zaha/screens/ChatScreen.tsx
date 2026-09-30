import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { api } from '../lib/api';
import FontIcon from '../components/FontIcon';
import { colors, radius } from '../theme';

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  failed?: boolean;
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Fallback si le GPS est indisponible ou la permission refusée (Antananarivo).
const DEFAULT_COORDS = { latitude: -18.8792, longitude: 47.5079 };
const INPUT_HEIGHT = 70;

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'model',
      text: 'Salut ! Je suis Zaha, ton guide voyage. Où veux-tu aller ?',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Position réelle de l'utilisateur (silencieux : fallback Antananarivo si
  // permission refusée ou GPS indisponible — la demande de permission est
  // déjà gérée par le PermissionModal au premier lancement).
  useEffect(() => {
    let cancelled = false;
    const resolvePosition = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (!granted) return;
        }
        Geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            setUserCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => {
            // Fallback silencieux sur DEFAULT_COORDS.
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      } catch {
        // Fallback silencieux sur DEFAULT_COORDS.
      }
    };
    resolvePosition();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height - 35); // Bug android
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const performChat = async (history: ChatMessage[]) => {
    setLoading(true);
    try {
      const response = await api.chat(history, userCoords);
      setMessages([
        ...history,
        {
          id: String(Date.now() + 1),
          role: 'model',
          text: response.text,
          timestamp: Date.now(),
          sources: response.sources,
        },
      ]);
    } catch (e) {
      console.warn('Erreur chat :', e);
      setMessages([
        ...history,
        {
          id: String(Date.now() + 1),
          role: 'model',
          text: 'Je n’ai pas pu répondre. Vérifiez votre connexion puis réessayez.',
          timestamp: Date.now(),
          failed: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [
      ...messages,
      {
        id: String(Date.now()),
        role: 'user' as const,
        text,
        timestamp: Date.now(),
      },
    ];
    setMessages(nextMessages);
    setInput('');
    performChat(nextMessages);
  };

  const retry = (failedMsg: ChatMessage) => {
    if (loading) return;
    const nextMessages = messages.filter((m) => m.id !== failedMsg.id);
    setMessages(nextMessages);
    performChat(nextMessages);
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: INPUT_HEIGHT + 16 }]}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.modelBubble,
            ]}
          >
            <Text style={item.role === 'user' ? styles.userText : styles.modelText}>
              {item.text}
            </Text>
            <View style={styles.bubbleFooter}>
              <Text style={item.role === 'user' ? styles.userTime : styles.modelTime}>
                {formatTime(item.timestamp)}
              </Text>
              {item.failed ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => retry(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer la réponse"
                >
                  <Text style={styles.retryText}>↻ Réessayer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {item.role === 'model' && item.sources && item.sources.length > 0 && (
              <View style={styles.sources}>
                {item.sources.map((source, index) => (
                  <TouchableOpacity
                    key={`${item.id}-source-${index}`}
                    style={styles.sourceLink}
                    activeOpacity={0.6}
                    onPress={() => {
                      Linking.openURL(source.uri).catch(() => {});
                    }}
                  >
                    <View style={styles.sourceRow}>
                      <FontIcon name="link" width={12} height={12} fill="#2563eb" />
                      <Text numberOfLines={1} style={styles.sourceText}>
                        {source.title || `Source ${index + 1}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubble, styles.modelBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.typingText}>Zaha écrit…</Text>
            </View>
          ) : undefined
        }
      />

      <View style={[styles.inputRow, { bottom: keyboardHeight }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Pose ta question..."
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: radius.lg, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  modelBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  userText: { color: colors.surface },
  modelText: { color: colors.textPrimary },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  userTime: { color: 'rgba(255,255,255,0.75)', fontSize: 11, alignSelf: 'flex-end' },
  modelTime: { color: colors.textMuted, fontSize: 11, alignSelf: 'flex-end' },
  retryBtn: { paddingVertical: 2 },
  retryText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  sources: { marginTop: 8, gap: 4 },
  sourceLink: { paddingVertical: 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sourceText: { color: colors.primary, fontSize: 13 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  typingText: { color: colors.textSecondary, fontStyle: 'italic' },
  inputRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.surface, fontSize: 20, fontWeight: '600' },
});
