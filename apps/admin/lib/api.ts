/** Helpers de réponse JSON pour les Route Handlers /api/admin/*. */

export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

/** Vérifie un UUID v4 simple. */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Parse les paramètres de pagination (?page=1&limit=20). */
export function getPagination(url: string, defaultLimit = 20, maxLimit = 100) {
  const { searchParams } = new URL(url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit), 10) || defaultLimit)
  );
  return { page, limit, from: (page - 1) * limit, to: (page - 1) * limit + limit - 1 };
}
