export function formatDateDisplay(d: Date | string): string {
  if (typeof d === 'string') {
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Nombre de nuits entre deux dates (Date ou "YYYY-MM-DD"), 0 si invalide. */
export function countNights(start: Date | string, end: Date | string): number {
  const toUtc = (v: Date | string) => {
    if (typeof v === 'string') {
      const [y, m, d] = v.split('T')[0].split('-').map(Number);
      return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
    }
    return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  };
  const nights = Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

/** "3 nuits" / "1 nuit". */
export function formatNights(nights: number): string {
  return `${nights} nuit${nights > 1 ? 's' : ''}`;
}

/** "150 000 MGA" (séparateur de milliers français). */
export function formatMoney(amount: number, currency = 'MGA'): string {
  const rounded = Math.round(amount);
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${grouped} ${currency}`;
}
