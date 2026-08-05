import { jsonResponse, optionsResponse } from '@/lib/api/response';

export async function GET() {
  return jsonResponse({
    status: 'ok',
    service: 'zaha-api',
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
