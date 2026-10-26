import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { AdBannerData } from '../lib/api';
import { colors, radius } from '../theme';

/** Largeur horizontale totale réservée autour de la bannière (padding de l'écran Lieux). */
const SIDE_PADDING = 32;
/** Format des images : 12:5 (ex. 1200 × 500 px). */
const ASPECT_RATIO = 2.4;
/** Délai entre deux bannières quand le défilement est automatique. */
const AUTO_SCROLL_MS = 4000;

/**
 * Bannière publicitaire (image) affichée avant les résultats de recherche.
 * Plusieurs bannières défilent automatiquement (et restent balayables à la main) ;
 * les points de position sont superposés à l'image. Un appui ouvre le lien s'il existe.
 */
export default function AdBanner({ banners }: { banners: AdBannerData[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<AdBannerData>>(null);
  const indexRef = useRef(0);
  const draggingRef = useRef(false);
  const width = screenWidth - SIDE_PADDING;
  const count = banners.length;

  // Défilement automatique : passe à la bannière suivante, puis revient à la première.
  // Suspendu pendant que l'utilisateur fait glisser l'image.
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      if (draggingRef.current) return;
      const next = (indexRef.current + 1) % count;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      indexRef.current = next;
      setActiveIndex(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [count, width]);

  // La liste de bannières a changé : on repart de la première.
  useEffect(() => {
    indexRef.current = 0;
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [count]);

  if (count === 0) return null;

  const open = async (banner: AdBannerData) => {
    if (!banner.linkUrl) return;
    try {
      await Linking.openURL(banner.linkUrl);
    } catch {
      Alert.alert('Impossible', 'Aucune application ne peut ouvrir ce lien.');
    }
  };

  return (
    <View style={styles.wrap}>
      <View>
        <FlatList
          ref={listRef}
          data={banners}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(b) => b.id}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onScrollBeginDrag={() => {
            draggingRef.current = true;
          }}
          onMomentumScrollEnd={(event) => {
            draggingRef.current = false;
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            const bounded = Math.min(Math.max(index, 0), count - 1);
            indexRef.current = bounded;
            setActiveIndex(bounded);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={item.linkUrl ? 0.85 : 1}
              onPress={() => open(item)}
              disabled={!item.linkUrl}
              accessibilityRole={item.linkUrl ? 'link' : 'image'}
              accessibilityLabel={item.title}
              style={{ width }}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </TouchableOpacity>
          )}
        />
        {count > 1 ? (
          <View style={styles.dotsOverlay} pointerEvents="none">
            <View style={styles.dots}>
              {banners.map((b, i) => (
                <View key={b.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <Text style={styles.adLabel}>Publicité</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  image: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  dotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 16, backgroundColor: colors.surface },
  adLabel: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
