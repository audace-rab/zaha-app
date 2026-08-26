import { createAdminClient } from '@/lib/supabase/server';

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
 */
export async function updateProfile(input: UpdateProfileInput) {
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

  const supabase = createAdminClient();
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
