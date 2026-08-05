
export const CACHE_KEYS = {
  PLACES: 'zaha_places_',
  FEED: 'zaha_feed',
  TRANSLATIONS: 'zaha_translations',
  LAST_LOCATION: 'zaha_last_location',
  LAST_LOCATION_NAME: 'zaha_last_location_name',
  USER_PROFILE: 'zaha_user_profile',
  CHAT_HISTORY: 'zaha_chat_history',
  AI_QUOTA: 'zaha_ai_quota'
};

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Enregistre une donnée dans le cache avec un temps de validité (TTL) en minutes.
 */
export const cacheSet = <T>(key: string, data: T, ttlMinutes: number = 60): void => {
  try {
    const entry: CacheEntry<T> = {
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.error("Cache save error:", e);
  }
};

/**
 * Récupère une donnée du cache si elle n'est pas expirée.
 */
export const cacheGet = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch (e) {
    console.error("Cache retrieval error:", e);
    return null;
  }
};

export const cacheRemove = (key: string): void => {
  localStorage.removeItem(key);
};

export const cacheClearByPrefix = (prefix: string): void => {
  Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .forEach(key => localStorage.removeItem(key));
};

/**
 * Calcule les statistiques d'utilisation du cache pour l'application.
 */
export const getCacheStats = () => {
  let totalBytes = 0;
  const stats: Record<string, { size: number; count: number; label: string; prefix: string }> = {
    places: { size: 0, count: 0, label: 'Lieux & Cartes', prefix: CACHE_KEYS.PLACES },
    feed: { size: 0, count: 0, label: 'Flux Social', prefix: CACHE_KEYS.FEED },
    translations: { size: 0, count: 0, label: 'Traductions', prefix: CACHE_KEYS.TRANSLATIONS },
    chat: { size: 0, count: 0, label: 'Aide AI', prefix: CACHE_KEYS.CHAT_HISTORY },
    other: { size: 0, count: 0, label: 'Système', prefix: 'zaha_' }
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('zaha_')) continue;

    const value = localStorage.getItem(key) || '';
    // Approximation : chaque caractère pèse 2 octets en UTF-16
    const size = (key.length + value.length) * 2;
    totalBytes += size;

    if (key.startsWith(CACHE_KEYS.PLACES)) {
      stats.places.size += size;
      stats.places.count++;
    } else if (key.startsWith(CACHE_KEYS.FEED)) {
      stats.feed.size += size;
      stats.feed.count++;
    } else if (key.startsWith(CACHE_KEYS.TRANSLATIONS)) {
      stats.translations.size += size;
      stats.translations.count++;
    } else if (key.startsWith(CACHE_KEYS.CHAT_HISTORY)) {
      stats.chat.size += size;
      stats.chat.count++;
    } else if (key !== CACHE_KEYS.USER_PROFILE) {
      stats.other.size += size;
      stats.other.count++;
    }
  }

  return { totalBytes, stats: Object.values(stats).filter(s => s.count > 0 || s.label === 'Système') };
};

export const clearEverything = () => {
  const profile = localStorage.getItem(CACHE_KEYS.USER_PROFILE);
  localStorage.clear();
  if (profile) {
    localStorage.setItem(CACHE_KEYS.USER_PROFILE, profile);
  }
};
