import { requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/api';

type Period = 'jour' | 'semaine' | 'mois';

/** Paramètres SQL de chaque période : jour = 24 h par heure, semaine = 7 j, mois = 30 j. */
const PERIODS: Record<Period, { unit: 'hour' | 'day'; count: number }> = {
  jour: { unit: 'hour', count: 24 },
  semaine: { unit: 'day', count: 7 },
  mois: { unit: 'day', count: 30 },
};

/** "2026-10-26T14:00:00" (heure de Madagascar) -> libellé d'axe. */
function labelFor(period: Period, bucketStart: string): string {
  // Le timestamp est déjà à l'heure locale : on le lit comme UTC pour ne rien décaler.
  const date = new Date(`${bucketStart.replace(' ', 'T')}Z`);
  if (period === 'jour') {
    return `${String(date.getUTCHours()).padStart(2, '0')}h`;
  }
  if (period === 'semaine') {
    const weekday = date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
    return `${weekday.replace('.', '')} ${date.getUTCDate()}`;
  }
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Clics « Réserver » / « Appeler » dans le temps. Query : ?period=jour|semaine|mois */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const requested = new URL(request.url).searchParams.get('period') ?? 'semaine';
    if (!(requested in PERIODS)) {
      return errorResponse('period must be one of: jour, semaine, mois', 400);
    }
    const period = requested as Period;
    const { unit, count } = PERIODS[period];

    const { data, error } = await admin.supabase.rpc('place_click_series', {
      p_unit: unit,
      p_count: count,
    });
    if (error) throw error;

    return jsonResponse({
      period,
      data: (data ?? []).map((row) => ({
        name: labelFor(period, row.bucket_start),
        reserve: Number(row.reserve_count),
        call: Number(row.call_count),
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/stats/clicks', error);
    return errorResponse('Failed to load click series');
  }
}
