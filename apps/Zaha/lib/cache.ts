import AsyncStorage from '@react-native-async-storage/async-storage';

/** Lit une entrée de cache JSON (null si absente ou corrompue). */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Écrit une entrée de cache JSON (silencieux en cas d'échec). */
export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache best-effort : ne jamais faire échouer l'UI pour ça.
  }
}
