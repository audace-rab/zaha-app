import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Hook partagé : retourne l'id de l'utilisateur authentifié (ou null).
 * Résout la session au montage puis suit les changements d'auth.
 * Remplace les getSession() dupliqués dans chaque écran.
 */
export function useAuthUser(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }: any) => {
        if (mounted) setUserId(data?.session?.user?.id ?? null);
      })
      .catch(() => {
        if (mounted) setUserId(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return userId;
}
