// Ensure React Native's URL implementation allows assigning to `protocol`.
// Supabase JS mutates URL.protocol when building realtime URLs; on some RN
// environments `protocol` is a getter-only property which causes a crash.
// We patch global URL to a subclass with a writable `protocol` setter if needed.
import 'react-native-url-polyfill/auto';


(() => {
  try {
    const testUrl = new URL('http://example.invalid');
    try {
      // try assigning to protocol to detect readonly behavior
      (testUrl as any).protocol = 'https:';
    } catch (err) {
      const OrigURL = URL;
      class WritableURL extends (OrigURL as any) {
        set protocol(p: string) {
          if (!p.endsWith(':')) p = p + ':';
          const href = super.href;
          // preserve the rest of href after the original protocol
          const rest = href.substring(href.indexOf(':') + 1);
          super.href = p + rest;
        }
        get protocol() {
          return super.protocol;
        }
      }
      (globalThis as any).URL = WritableURL as any;
    }
  } catch (e) {
    // ignore
  }
})();

import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';
// require instead of static import so our URL patch runs first
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = config.supabase.url;
const supabaseAnonKey = config.supabase.anonKey;

export const supabase: any =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase);
}
