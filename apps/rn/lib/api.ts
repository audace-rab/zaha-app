import type {
  ChatMessage,
  ChatResponse,
  Coordinates,
  FeedItem,
  PlacesSearchRequest,
  PlacesSearchResponse,
} from '@zaha/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `API error ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),

  getFeed: () => apiFetch<{ feed: FeedItem[] }>('/api/feed'),

  searchPlaces: (body: PlacesSearchRequest) =>
    apiFetch<PlacesSearchResponse>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  geocode: (address: string) =>
    apiFetch<{ coords: Coordinates | null }>('/api/places/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  identifyLocation: (query: string) =>
    apiFetch<{ result: { city: string; country: string; flag: string } | null }>(
      '/api/places/geocode',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'identify', query }),
      }
    ),

  chat: (messages: ChatMessage[], userLocation: Coordinates | null) =>
    apiFetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, userLocation }),
    }),
};
