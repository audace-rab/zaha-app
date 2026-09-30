type Coordinates = {
  latitude: number;
  longitude: number;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
};

type FeedItem = {
  id: string;
  authorId: string;
  author: string;
  authorAvatar: string;
  authorCountryFlag?: string;
  media: { type: 'image' | 'video'; url: string }[];
  content: string;
  likes: number;
  commentsList: any[];
  commentsCount?: number;
  isBusiness: boolean;
  location: string;
  timestamp: string;
  hasLiked?: boolean;
  isFollowing?: boolean;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author_name?: string;
  author?: { name: string; avatar_url?: string };
};

type BookmarkResponse = {
  bookmarked: boolean;
};

type CategoryCount = {
  category: string;
  count: number;
};

type Place = {
  id: string;
  name: string;
  rating?: number;
  address?: string;
  snippet?: string;
  phoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  openingHours?: string;
  isPro?: boolean;
  location?: Coordinates;
};

type PlacesSearchRequest = {
  category: string;
  coords?: Coordinates;
  locationName?: string;
  searchQuery?: string;
};

type MapPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
  isPro?: boolean;
  address?: string;
};

type PlacesSearchResponse = {
  places: Place[];
  summary: string;
};

type Profile = {
  id: string;
  name: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  location?: string;
  country?: string;
  country_flag?: string;
  description?: string;
  bookmarks_count?: number;
};

type ReviewUser = {
  name: string;
  avatar_url?: string;
};

type Review = {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  user?: ReviewUser;
};

type ProfileUpdateData = {
  name?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
};

type ChatResponse = {
  text: string;
  sources?: { uri: string; title: string }[];
};

export type Reservation = {
  id: string;
  user_id: string;
  place_id: string;
  place_name?: string;
  reservation_type: 'table' | 'hotel' | 'activity' | 'general';
  date: string;
  time_start?: string;
  time_end?: string;
  guests: number;
  room_type?: string;
  activity_slot?: string;
  price?: number;
  currency?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_method?: string;
  payment_status?: string;
  note?: string;
  created_at: string;
  updated_at: string;
};

export type CreateReservationData = {
  placeId: string;
  reservationType?: string;
  date: string;
  timeStart?: string;
  timeEnd?: string;
  guests?: number;
  roomType?: string;
  activitySlot?: string;
  note?: string;
};

import { config } from '../config';
import { supabase } from './supabase';

const API_URL = config.api.baseUrl;
const NETWORK_ERROR_MESSAGE =
  'Erreur réseau — vérifie ta connexion ou réessaie plus tard.';
const REQUEST_TIMEOUT_MS = 15000;

/** Récupère le JWT Supabase courant (null si non connecté). */
async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** fetch avec timeout (AbortController) + message réseau uniforme. */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e: any) {
    if (
      e?.name === 'AbortError' ||
      e?.name === 'TypeError' ||
      e?.message?.includes('Network')
    ) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `API error ${response.status}`);
  }

  return response.json();
}

export type { MapPlace, Profile, Review };

// Upload en multipart : ne PAS forcer Content-Type JSON (boundary automatique).
async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `API error ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),

  getFeed: (options?: { location?: string; query?: string; cursor?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.location?.trim()) params.set('location', options.location.trim());
    if (options?.query?.trim()) params.set('query', options.query.trim());
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{ feed: FeedItem[]; nextCursor: string | null }>(
      `/api/feed${qs ? `?${qs}` : ''}`
    );
  },

  toggleLike: (postId: string) =>
    apiFetch<{ liked: boolean; likes: number }>(`/api/posts/${postId}/like`, {
      method: 'POST',
    }),

  getComments: (postId: string) =>
    apiFetch<{ comments: Comment[] }>(`/api/posts/${postId}/comments`),

  addComment: (postId: string, text: string) =>
    apiFetch<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  deleteComment: (postId: string, commentId: string) =>
    apiFetch<{ success: boolean }>(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  deletePost: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/posts/${id}`, {
      method: 'DELETE',
    }),

  searchPlaces: (body: PlacesSearchRequest) =>
    apiFetch<PlacesSearchResponse>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  fetchPlaces: (params?: { category?: string }) => {
    const search = new URLSearchParams();
    if (params?.category?.trim()) search.set('category', params.category.trim());
    const qs = search.toString();
    return apiFetch<{ places: MapPlace[] }>(`/api/places${qs ? `?${qs}` : ''}`);
  },

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

  toggleBookmark: (placeId: string) =>
    apiFetch<BookmarkResponse>(`/api/places/${placeId}/bookmark`, {
      method: 'POST',
    }),

  fetchBookmarkedPlaces: () =>
    apiFetch<{ places: Place[] }>('/api/places/bookmarked'),

  isBookmarked: (placeId: string) =>
    apiFetch<BookmarkResponse>(`/api/places/${placeId}/bookmarked`),

  fetchNearby: (lat: number, lng: number, radius = 5000) =>
    apiFetch<{ places: (Place & { distance_km?: number })[] }>(
      `/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    ),

  fetchProfile: (userId: string) =>
    apiFetch<{ profile: Profile }>(`/api/profile?userId=${encodeURIComponent(userId)}`),

  updateProfile: (data: ProfileUpdateData) =>
    apiFetch<{ profile: Profile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadAvatar: (base64Data: string) => {
    return apiFetch<{ url: string }>('/api/profile/avatar', {
      method: 'POST',
      body: JSON.stringify({ file: base64Data }),
    });
  },

  fetchCategories: () =>
    apiFetch<{ categories: CategoryCount[] }>('/api/places/categories'),

  followUser: (userId: string) =>
    apiFetch<{ following: boolean }>(`/api/users/${userId}/follow`, {
      method: 'POST',
    }),

  unfollowUser: (userId: string) =>
    apiFetch<{ following: boolean }>(`/api/users/${userId}/follow`, {
      method: 'DELETE',
    }),

  isFollowing: (userId: string) =>
    apiFetch<{ following: boolean }>(`/api/users/${userId}/is-following`),

  fetchFollowers: (userId: string) =>
    apiFetch<{ users: Profile[] }>(`/api/users/${userId}/followers`),

  fetchFollowing: (userId: string) =>
    apiFetch<{ users: Profile[] }>(`/api/users/${userId}/following`),

  createPost: (content: string, location?: string, media?: { url: string; type: string }[]) =>
    apiFetch<{ post: FeedItem }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content, location, media }),
    }),

  uploadPostMedia: (fileUri: string) => {
    const ext = fileUri.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
    };
    const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
    const mime = mimeMap[ext] ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    const fileName = isVideo ? `video.${ext || 'mp4'}` : `photo.${ext || 'jpg'}`;
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mime,
    } as unknown as Blob);
    return apiUpload<{ url: string }>('/api/posts/media', formData);
  },

  fetchReviews: (placeId: string) =>
    apiFetch<{ reviews: Review[]; averageRating: number; reviewCount: number }>(
      `/api/places/${placeId}/reviews`,
    ),

  submitReview: (placeId: string, rating: number, comment?: string) =>
    apiFetch<{ review: Review }>(`/api/places/${placeId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment: comment?.trim() || undefined }),
    }),

  createReservation: (data: CreateReservationData) =>
    apiFetch<{ reservation: Reservation }>('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({
        placeId: data.placeId,
        reservationType: data.reservationType ?? 'general',
        date: data.date,
        timeStart: data.timeStart,
        timeEnd: data.timeEnd,
        guests: data.guests ?? 1,
        roomType: data.roomType,
        activitySlot: data.activitySlot,
        note: data.note,
      }),
    }),

  getReservations: (status?: string) => {
    const params = new URLSearchParams();
    if (status?.trim()) params.set('status', status.trim());
    const qs = params.toString();
    return apiFetch<{ reservations: Reservation[] }>(
      `/api/reservations${qs ? `?${qs}` : ''}`
    );
  },

  getReservation: (id: string) =>
    apiFetch<{ reservation: Reservation }>(`/api/reservations/${id}`),

  cancelReservation: (id: string) =>
    apiFetch<{ reservation: Reservation }>(`/api/reservations/${id}`, {
      method: 'DELETE',
    }),

  updateReservation: (id: string, data: Partial<CreateReservationData>) =>
    apiFetch<{ reservation: Reservation }>(`/api/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getAvailability: (placeId: string, date: string) =>
    apiFetch<{ available: boolean; slots: string[] }>(
      `/api/places/${placeId}/reservations?date=${date}`
    ),
};
