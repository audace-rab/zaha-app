'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/** Client Supabase navigateur (login, logout, appels API avec session). */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  return createBrowserClient<Database>(url, anonKey);
}
