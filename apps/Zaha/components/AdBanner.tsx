import { useState } from 'react';
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

/**
 * Bannière publicitaire (image, format 3:1) affichée avant les résultats de recherche.
 * Plusieurs bannières défilent horizontalement ; un appui ouvre le lien s'il existe.
 */
export default function AdBanner({ banners }: { banners: AdBannerData[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const width = screenWidth - SIDE_PADDING;

  if (banners.length === 0) return null;

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
      <FlatList
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setActiveIndex(Math.min(Math.max(index, 0), banners.length - 1));
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
      <View style={styles.footer}>
        <Text style={styles.adLabel}>Publicité</Text>
        {banners.length > 1 ? (
          <View style={styles.dots}>
            {banners.map((b, i) => (
              <View key={b.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  image: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  adLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { backgroundColor: colors.primary },
});
