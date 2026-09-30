import { NextResponse } from 'next/server';

/**
 * CORS restrictif : seules les origines listées dans ALLOWED_ORIGINS
 * (env, séparées par des virgules) reçoivent Access-Control-Allow-Origin.
 * L'app mobile React Native n'envoie pas d'en-tête Origin : elle n'est
 * pas soumise à CORS et fonctionne sans ACAO. Les navigateurs non
 * autorisés sont bloqués par la Same-Origin Policy.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeadersFor(request?: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const origin = request?.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export function jsonResponse<T>(data: T, status = 200, request?: Request) {
  return NextResponse.json(data, { status, headers: corsHeadersFor(request) });
}

export function errorResponse(message: string, status = 500, request?: Request) {
  return NextResponse.json({ error: message }, { status, headers: corsHeadersFor(request) });
}

export function optionsResponse(request?: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request) });
}
