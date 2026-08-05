export enum AppView {
  FEED = 'FEED',
  RESTAURANTS = 'RESTAURANTS',
  HOTELS = 'HOTELS',
  PLACE_DETAIL = 'PLACE_DETAIL',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  phoneNumber?: string;
  openingHours?: string;
  types?: string[];
  websiteUri?: string;
  googleMapsUri?: string;
  snippet?: string;
  photoUrl?: string;
  photos?: string[];
  isOpen?: boolean;
  location?: Coordinates;
  isPro?: boolean;
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

export interface Comment {
  id: string;
  author: string;
  authorAvatar: string;
  text: string;
  timestamp: number;
  mentions: string[];
}

export interface FeedItem {
  id: string;
  author: string;
  authorAvatar: string;
  authorCountryFlag?: string;
  media: MediaItem[];
  content: string;
  likes: number;
  commentsList: Comment[];
  isBusiness: boolean;
  location: string;
  timestamp: string;
  hasLiked?: boolean;
}

export interface UserProfile {
  id?: string;
  name: string;
  avatar: string;
  banner?: string;
  location: string;
  phone?: string;
  language: 'FR' | 'EN';
  country: string;
  countryFlag: string;
  description: string;
  postCount?: number;
  profileViews?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  content: string;
  date: string;
  helpfulCount: number;
  timestamp: number;
}

export interface PlacesSearchRequest {
  category: string;
  coords: Coordinates;
  filter?: string;
  searchQuery?: string;
  locationName?: string;
}

export interface PlacesSearchResponse {
  places: Place[];
  summary: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  userLocation: Coordinates | null;
}

export interface ChatResponse {
  text: string;
  sources?: { uri: string; title: string }[];
}
