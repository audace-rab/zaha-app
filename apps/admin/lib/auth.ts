import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { createSessionClient } from '@/lib/supabase/session';
import type { Database } from '@/lib/supabase/database.types';

export interface AdminContext {
  userId: string;
  email: string | null;
  /** Client service-role — à utiliser pour toutes les requêtes back-office. */
  supabase: SupabaseClient<Database>;
}

/**
 * Vérifie que la session courante appartient à un administrateur.
 * Retourne null si non connecté ou non admin — l'appelant renvoie 401/403.
 *
 * Usage :
 *   const admin = await requireAdmin();
 *   if (!admin) return errorResponse('Forbidden', 403);
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  try {
    const sessionClient = await createSessionClient();
    const { data, error } = await sessionClient.auth.getUser();
    if (error || !data?.user?.id) return null;

    const supabase = createAdminClient();
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!adminRow) return null;

    return { userId: data.user.id, email: data.user.email ?? null, supabase };
  } catch {
    return null;
  }
}

/** Vérifie l'appartenance admin pour un userId donné (usage layout/login). */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
