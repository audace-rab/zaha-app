import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { FeedItem } from '@zaha/shared';
import { api } from '../lib/api';

export default function FeedScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFeed()
      .then(({ feed: items }) => setFeed(items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
        <Text style={styles.hint}>Vérifiez que l'API tourne (npm run dev:api)</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.header}>
            <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
            <View>
              <Text style={styles.author}>
                {item.authorCountryFlag ? `${item.authorCountryFlag} ` : ''}
                {item.author}
              </Text>
              <Text style={styles.location}>{item.location}</Text>
            </View>
          </View>
          {item.media[0] && (
            <Image source={{ uri: item.media[0].url }} style={styles.media} />
          )}
          <Text style={styles.content}>{item.content}</Text>
          <Text style={styles.meta}>{item.likes} j'aime</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  author: { fontWeight: '600', fontSize: 15 },
  location: { color: '#6b7280', fontSize: 13 },
  media: { width: '100%', height: 220 },
  content: { padding: 12, fontSize: 15, lineHeight: 22 },
  meta: { paddingHorizontal: 12, paddingBottom: 12, color: '#6b7280' },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 8 },
  hint: { color: '#6b7280', textAlign: 'center' },
});
