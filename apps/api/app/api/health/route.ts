import { jsonResponse, optionsResponse } from '@/lib/api/response';

export async function GET(request: Request) {
  return jsonResponse({
    status: 'ok',
    service: 'zaha-api',
    timestamp: new Date().toISOString(),
  }, 200, request);
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
