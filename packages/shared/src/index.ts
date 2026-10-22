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

/**
 * Statut d'un lieu : VIP ou Premium (badge + boutons Réserver / Appeler),
 * ou normal (aucun bouton). Premium se comporte exactement comme VIP.
 */
export type PlaceStatus = 'normal' | 'vip' | 'premium';

/** Un lieu VIP ou Premium affiche les boutons Réserver et Appeler. */
export function isReservableStatus(status?: PlaceStatus | string | null): boolean {
  return status === 'vip' || status === 'premium';
}

/** Type de chambre d'un hôtel (prix par nuit géré au back-office). */
export interface RoomType {
  id: string;
  placeId: string;
  name: string;
  description?: string;
  capacity: number;
  pricePerNight: number;
  currency: string;
}

/**
 * Statut d'une réservation.
 * 'unavailable' = créneau refusé, à reprogrammer ;
 * 'proposed' = nouveau créneau proposé par l'établissement, que le client doit confirmer.
 */
export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'unavailable'
  | 'proposed';

export interface Place {
  id: string;
  name: string;
  category?: string;
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
  status?: PlaceStatus;
}

/** Lieu rattaché à un post (informations minimales pour le feed). */
export interface FeedPlace {
  id: string;
  name: string;
  category?: string;
  address?: string;
  phoneNumber?: string;
  status: PlaceStatus;
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
  authorId: string;
  author: string;
  authorAvatar: string;
  authorCountryFlag?: string;
  media: MediaItem[];
  content: string;
  likes: number;
  commentsList: Comment[];
  commentsCount?: number;
  isBusiness: boolean;
  location: string;
  /** Lieu rattaché au post (optionnel). Un lieu VIP affiche badge + bouton réservation. */
  place?: FeedPlace;
  timestamp: string;
  hasLiked?: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
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
