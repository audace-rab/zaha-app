import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import ChatScreen from './screens/ChatScreen';
import FeedScreen from './screens/FeedScreen';
import PlacesScreen from './screens/PlacesScreen';
import ProfileScreen from './screens/ProfileScreen';

type Tab = 'feed' | 'places' | 'chat' | 'profile';

export default function App() {
  const [tab, setTab] = useState<Tab>('feed');
  const [session, setSession] = useState(supabase?.auth.getSession()?.data.session ?? null);

  useEffect(() => {
    const { data: authListener } = supabase?.auth.onAuthStateChange((event, authSession) => {
      setSession(authSession?.session ?? null);
    }) ?? { data: null };

    return () => authListener?.subscription.unsubscribe();
  }, []);

  if (!session) {
    return <AuthScreen onAuthSuccess={() => setSession(supabase?.auth.getSession()?.data.session ?? null)} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Zaha</Text>
        <Text style={styles.badge}>{session ? 'Connecté ✓' : 'Déconnecté'}</Text>
      </View>

      <View style={styles.content}>
        {tab === 'feed' && <FeedScreen />}
        {tab === 'places' && <PlacesScreen />}
        {tab === 'chat' && <ChatScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'feed', label: 'Feed' },
            { id: 'places', label: 'Lieux' },
            { id: 'chat', label: 'Zaha AI' },
            { id: 'profile', label: 'Profil' },
          ] as const
        ).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.tab, tab === item.id && styles.tabActive]}
            onPress={() => setTab(item.id)}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  badge: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  content: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderTopWidth: 2, borderTopColor: '#2563eb' },
  tabText: { color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#2563eb', fontWeight: '700' },
});
