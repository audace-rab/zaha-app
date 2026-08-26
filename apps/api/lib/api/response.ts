import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders });
}

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
