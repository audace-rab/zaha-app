import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Client = SupabaseClient<Database>;

/**
 * Récupère un profil par userId (lecture publique).
 */
export async function getProfile(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Get profile error:', error);
    throw new Error('Failed to fetch profile');
  }

  return data ?? null;
}

export interface UpdateProfileInput {
  userId: string;
  name?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
}

/**
 * Met à jour le profil (champs fournis uniquement).
 * Retourne null si le profil n'existe pas.
 * Le client passé doit être scopé à l'utilisateur (RLS appliqué).
 */
export async function updateProfile(supabase: Client, input: UpdateProfileInput) {
  const patch: {
    updated_at: string;
    name?: string;
    bio?: string;
    website?: string;
    avatar_url?: string;
  } = { updated_at: new Date().toISOString() };
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.bio !== undefined) patch.bio = input.bio.trim();
  if (input.website !== undefined) patch.website = input.website.trim();
  if (input.avatar_url?.trim()) patch.avatar_url = input.avatar_url.trim();

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', input.userId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Update profile error:', error);
    throw new Error('Failed to update profile');
  }

  return data ?? null;
}
