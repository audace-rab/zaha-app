/** Normalise un lien optionnel : vide -> null, URL http(s) valide -> elle-même, sinon undefined. */
export function parseLink(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export const MAX_BANNER_TITLE = 120;
