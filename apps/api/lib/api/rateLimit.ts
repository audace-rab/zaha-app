/**
 * Rate limiting simple en mémoire (sliding window fixe).
 * Best-effort : en serverless, chaque instance a son propre compteur.
 * Suffisant pour protéger les endpoints coûteux (Gemini, uploads) en démo/beta.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Nettoyage périodique pour éviter une croissance mémoire non bornée
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Retourne true si la requête est autorisée, false si la limite est atteinte.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * Construit une clé de rate limit : userId si authentifié, sinon IP.
 */
export function rateLimitKey(request: Request, userId: string | undefined, scope: string): string {
  const identity = userId
    ? `u:${userId}`
    : `ip:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;
  return `${scope}:${identity}`;
}
