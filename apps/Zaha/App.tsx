import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import ChatScreen from './screens/ChatScreen';
import FeedScreen from './screens/FeedScreen';
import PlaceDetailScreen from './screens/PlaceDetailScreen';
import PlacesScreen from './screens/PlacesScreen';
import ProfileScreen from './screens/ProfileScreen';

type Tab = 'feed' | 'places' | 'chat' | 'profile';

type SelectedPlace = {
  id: string;
  name: string;
  rating?: number;
  address?: string;
  snippet?: string;
  phoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  openingHours?: string;
  isPro?: boolean;
  location?: { latitude: number; longitude: number };
};

export default function App() {
  return <AppInner />;
}

function AppInner() {
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Recherche du feed : état unique dans App pour survivre aux changements d'onglet.
  // feedSearchInput = saisie en cours ; feedQuery = filtre validé (loupe / OK clavier).
  const [feedSearchInput, setFeedSearchInput] = useState('');
  const [feedQuery, setFeedQuery] = useState('');

  // Déclenché uniquement par la loupe ou la touche « Rechercher » du clavier.
  // Champ vide → '' → tout afficher.
  const commitFeedSearch = () => {
    setFeedQuery(feedSearchInput.trim());
  };

  useEffect(() => {
    // Initialize session asynchronously
    const initSession = async () => {
      try {
        if (!supabase) {
          console.error('Supabase not configured');
          setSession(null);
          setLoading(false);
          return;
        }

        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      } catch (err) {
        console.error('Error fetching session:', err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listen for auth changes
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, authSession: any) => {
        setSession(authSession ?? null);
      });

      return () => authListener?.subscription?.unsubscribe();
    }
  }, []);

  // Bouton retour physique : fermer le détail lieu s'il est ouvert (consommer
  // l'événement), sinon laisser le comportement par défaut (quitter l'app
  // depuis un onglet racine).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedPlace) {
        setSelectedPlace(null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [selectedPlace]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        onAuthSuccess={async () => {
          const { data } = await supabase.auth.getSession();
          setSession(data?.session ?? null);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Zaha</Text>
        {tab === 'feed' && (
          <View style={styles.headerSearchField}>
            <TextInput
              style={styles.headerSearchInput}
              value={feedSearchInput}
              onChangeText={setFeedSearchInput}
              placeholder="Rechercher dans le feed…"
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={commitFeedSearch}
            />
            <TouchableOpacity
              style={styles.headerSearchButton}
              onPress={commitFeedSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Rechercher dans le feed"
            >
              <Text style={styles.headerSearchIcon}>🔍</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {tab === 'feed' && (
          <FeedScreen
            query={feedQuery || undefined}
            onClearSearch={() => {
              setFeedSearchInput('');
              setFeedQuery('');
            }}
          />
        )}
        {tab === 'places' && (
          <View style={styles.placesStack}>
            <PlacesScreen onSelectPlace={setSelectedPlace} />
            {selectedPlace && (
              <View style={styles.detailOverlay}>
                <PlaceDetailScreen place={selectedPlace} onBack={() => setSelectedPlace(null)} />
              </View>
            )}
          </View>
        )}
        {tab === 'chat' && <ChatScreen />}
        {tab === 'profile' && (
          <ProfileScreen onOpenFavorites={() => setTab('places')} />
        )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSearchField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingLeft: 12,
  },
  headerSearchInput: { flex: 1, paddingVertical: 8, fontSize: 14 },
  headerSearchButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerSearchIcon: { fontSize: 15 },
  content: { flex: 1 },
  placesStack: { flex: 1 },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f9fafb',
  },
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
