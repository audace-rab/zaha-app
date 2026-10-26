import { createAdminClient } from '@/lib/supabase/server';

export type ClickAction = 'reserve' | 'call';
export type ClickSource = 'detail' | 'feed';

/**
 * Enregistre un clic sur « Réserver » / « Appeler » d'un lieu.
 * La table n'a aucune policy RLS : l'écriture passe par le client admin
 * (l'identité de l'utilisateur est déjà vérifiée par la route via le JWT).
 * Retourne false si le lieu n'existe pas.
 */
export async function trackPlaceClick(input: {
  placeId: string;
  userId: string;
  action: ClickAction;
  source: ClickSource;
}): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: place } = await supabase
    .from('places')
    .select('id')
    .eq('id', input.placeId)
    .maybeSingle();
  if (!place) return false;

  const { error } = await supabase.from('place_click_events').insert({
    place_id: input.placeId,
    user_id: input.userId,
    action: input.action,
    source: input.source,
  });
  if (error) {
    console.error('Track place click error:', error);
    throw new Error('Failed to track click');
  }

  return true;
}
