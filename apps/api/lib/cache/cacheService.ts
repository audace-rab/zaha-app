import { createAdminClient } from '@/lib/supabase/server';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('ai_cache')
      .select('payload, expires_at')
      .eq('cache_key', key)
      .maybeSingle();

    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) {
      await supabase.from('ai_cache').delete().eq('cache_key', key);
      return null;
    }

    return data.payload as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlMinutes = 60): Promise<void> {
  try {
    const supabase = createAdminClient();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    await supabase.from('ai_cache').upsert({
      cache_key: key,
      payload: data as object,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

export const CACHE_KEYS = {
  PLACES: 'zaha_places_',
  TRANSLATIONS: 'zaha_translations',
} as const;
