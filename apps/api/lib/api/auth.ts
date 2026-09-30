import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export interface AuthContext {
  userId: string;
  accessToken: string;
  /** Client Supabase scopé à l'utilisateur (RLS appliqué). */
  supabase: SupabaseClient<Database>;
}

/**
 * Extrait le token Bearer du header Authorization.
 */
export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Résout l'utilisateur depuis le JWT Supabase.
 * Retourne null si absent ou invalide — pour les routes de lecture publique.
 */
export async function getOptionalUser(request: Request): Promise<AuthContext | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  try {
    const supabase = createServerClient(token);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) return null;
    return { userId: data.user.id, accessToken: token, supabase };
  } catch {
    return null;
  }
}

/**
 * Comme getOptionalUser, mais l'appelant DOIT renvoyer 401 si null.
 * Usage :
 *   const auth = await requireUser(request);
 *   if (!auth) return errorResponse('Authentication required', 401);
 */
export async function requireUser(request: Request): Promise<AuthContext | null> {
  return getOptionalUser(request);
}
