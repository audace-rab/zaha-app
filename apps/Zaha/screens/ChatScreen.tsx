import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
};

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
  const listRef = useRef<FlatList<ChatMessage>>(null);

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

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await api.chat(nextMessages, DEFAULT_COORDS);
      setMessages([
        ...nextMessages,
        {
          id: String(Date.now() + 1),
          role: 'model',
          text: response.text,
          timestamp: Date.now(),
          sources: response.sources,
        },
      ]);
    } catch (e) {
      setMessages([
        ...nextMessages,
        {
          id: String(Date.now() + 1),
          role: 'model',
          text: e instanceof Error ? e.message : 'Erreur de connexion à l\'API',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
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
                    <Text numberOfLines={1} style={styles.sourceText}>
                      🔗 {source.title || `Source ${index + 1}`}
                    </Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  modelBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  userText: { color: '#fff' },
  modelText: { color: '#111827' },
  sources: { marginTop: 8, gap: 4 },
  sourceLink: { paddingVertical: 2 },
  sourceText: { color: '#2563eb', fontSize: 13 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  typingText: { color: '#6b7280', fontStyle: 'italic' },
  inputRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '600' },
});
