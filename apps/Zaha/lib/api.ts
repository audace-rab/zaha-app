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
  isBusiness: boolean;
  location: string;
  timestamp: string;
  hasLiked?: boolean;
  isFollowing?: boolean;
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
};

type ChatResponse = {
  text: string;
  sources?: { uri: string; title: string }[];
};

import { config } from '../config';

const API_URL = config.api.baseUrl;

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

export type { MapPlace, Profile, Review };

// Upload en multipart : ne PAS forcer Content-Type JSON (boundary automatique).
async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `API error ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),

  getFeed: (location?: string, query?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (location?.trim()) params.set('location', location.trim());
    if (query?.trim()) params.set('query', query.trim());
    if (userId?.trim()) params.set('userId', userId.trim());
    const qs = params.toString();
    return apiFetch<{ feed: FeedItem[] }>(`/api/feed${qs ? `?${qs}` : ''}`);
  },

  toggleLike: (postId: string, userId: string) =>
    apiFetch<{ liked: boolean; likes: number }>(`/api/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  searchPlaces: (body: PlacesSearchRequest) =>
    apiFetch<PlacesSearchResponse>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  fetchPlaces: (params?: { category?: string; userId?: string }) => {
    const search = new URLSearchParams();
    if (params?.category?.trim()) search.set('category', params.category.trim());
    if (params?.userId?.trim()) search.set('userId', params.userId.trim());
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

  toggleBookmark: (userId: string, placeId: string) =>
    apiFetch<BookmarkResponse>(`/api/places/${placeId}/bookmark`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  fetchBookmarkedPlaces: (userId: string) =>
    apiFetch<{ places: Place[] }>(`/api/places/bookmarked?userId=${userId}`),

  isBookmarked: (userId: string, placeId: string) =>
    apiFetch<BookmarkResponse>(
      `/api/places/${placeId}/bookmarked?userId=${encodeURIComponent(userId)}`
    ),

  fetchNearby: (lat: number, lng: number, radius = 5000) =>
    apiFetch<{ places: (Place & { distance_km?: number })[] }>(
      `/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    ),

  fetchProfile: (userId: string) =>
    apiFetch<{ profile: Profile }>(`/api/profile?userId=${encodeURIComponent(userId)}`),

  updateProfile: (userId: string, data: ProfileUpdateData) =>
    apiFetch<{ profile: Profile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ userId, ...data }),
    }),

  uploadAvatar: (userId: string, imageUri: string) => {
    const formData = new FormData();
    formData.append('userId', userId);
    // Format RN : { uri, name, type } pour l'upload de fichier.
    formData.append('file', {
      uri: imageUri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    return apiUpload<{ url: string }>('/api/profile/avatar', formData);
  },

  fetchCategories: () =>
    apiFetch<{ categories: CategoryCount[] }>('/api/places/categories'),

  followUser: (followerId: string, userId: string) =>
    apiFetch<{ following: boolean }>(`/api/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({ followerId }),
    }),

  unfollowUser: (followerId: string, userId: string) =>
    apiFetch<{ following: boolean }>(`/api/users/${userId}/follow`, {
      method: 'DELETE',
      body: JSON.stringify({ followerId }),
    }),

  isFollowing: (followerId: string, userId: string) =>
    apiFetch<{ following: boolean }>(
      `/api/users/${userId}/is-following?followerId=${encodeURIComponent(followerId)}`
    ),

  fetchFollowers: (userId: string) =>
    apiFetch<{ users: Profile[] }>(`/api/users/${userId}/followers`),

  fetchFollowing: (userId: string) =>
    apiFetch<{ users: Profile[] }>(`/api/users/${userId}/following`),

  createPost: (authorId: string, content: string, location?: string, media?: { url: string; type: string }[]) =>
    apiFetch<{ post: FeedItem }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ authorId, content, location, media }),
    }),

  uploadPostMedia: (userId: string, fileUri: string) => {
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('file', {
      uri: fileUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    return apiUpload<{ url: string }>('/api/posts/media', formData);
  },

  fetchReviews: (placeId: string) =>
    apiFetch<{ reviews: Review[]; averageRating: number; reviewCount: number }>(
      `/api/places/${placeId}/reviews`,
    ),

  submitReview: (placeId: string, userId: string, rating: number, comment?: string) =>
    apiFetch<{ review: Review }>(`/api/places/${placeId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, rating, comment: comment?.trim() || undefined }),
    }),
};
