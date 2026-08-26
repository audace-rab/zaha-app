import { GoogleGenAI, Type } from '@google/genai';
import type { Coordinates, Place } from '@zaha/shared';
import { cacheGet, cacheSet, CACHE_KEYS } from '@/lib/cache/cacheService';
import { createAdminClient } from '@/lib/supabase/server';

const MODEL_NAME = 'gemini-3.6-flash';

const NON_LOCATION_TERMS = ['ma position', 'autour de moi'];

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Slug stable pour external_id (upsert des lieux enrichis par Gemini)
 */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * PostgREST or= : les virgules/parenthèses/guillemets cassent le parsing.
 */
function sanitizeFilterTerm(value: string): string {
  return value.replace(/[%_,()"']/g, ' ').trim();
}

function normalizePlaceType(category: string): string | null {
  const map: Record<string, string> = {
    restaurant: 'restaurant',
    hotel: 'hotel',
    pharmacie: 'pharmacie',
    activités: 'activité',
    activites: 'activité',
    attraction: 'attraction',
  };
  return map[category.toLowerCase()] ?? null;
}

/**
 * Retrouver les coordonnées d'une ville via Supabase (source unique)
 * Supporte les variantes linguistiques des noms de villes
 */
export async function getCityCoordinates(cityName: string): Promise<Coordinates | null> {
  if (!cityName?.trim()) return null;

  try {
    const supabase = createAdminClient();
    // Chercher dans les noms de villes (multilingues)
    const { data, error } = await supabase
      .from('city_names')
      .select('cities(latitude, longitude)')
      .ilike('name', `%${cityName.trim()}%`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const cityData = (data as { cities: { latitude: number; longitude: number } | null })?.cities;
      if (cityData && cityData.latitude !== null && cityData.longitude !== null) {
        return { latitude: Number(cityData.latitude), longitude: Number(cityData.longitude) };
      }
    }
  } catch (error) {
    console.warn('City lookup in Supabase failed:', error);
  }

  // Fallback : demander à Gemini
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Find latitude and longitude for city: "${cityName}". Return JSON only.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
          },
          required: ['latitude', 'longitude'],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { latitude: data.latitude, longitude: data.longitude };
      }
    }
  } catch (error) {
    console.warn('Gemini geocoding failed:', error);
  }

  return null;
}

/**
 * Identifier une ville à partir d'une requête utilisateur (multilingue)
 */
export async function identifyCity(
  query: string
): Promise<{ city: string; country: string; flag: string } | null> {
  if (!query || query.length < 2) return null;

  const cacheKey = `city_id_${query.toLowerCase().trim().replace(/\s+/g, '_')}`;
  const cached = await cacheGet<{ city: string; country: string; flag: string }>(cacheKey);
  if (cached) return cached;

  try {
    const supabase = createAdminClient();
    // Chercher le nom de la ville + données de la ville associée
    const { data, error } = await supabase
      .from('city_names')
      .select('name, is_primary, cities(country, country_flag)')
      .ilike('name', `%${query.trim()}%`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const cityData = (data as { name: string; cities: { country: string; country_flag: string } | null })?.cities;
      if (cityData) {
        const result = {
          city: (data as { name: string }).name || query,
          country: cityData.country || '🌍',
          flag: cityData.country_flag || '🌍',
        };
        await cacheSet(cacheKey, result, 60 * 24 * 30);
        return result;
      }
    }
  } catch (error) {
    console.warn('City identification in Supabase failed:', error);
  }

  // Fallback : demander à Gemini
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Identify city and country for: "${query}". Return JSON: city (string), country (string, French), flag (emoji).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            country: { type: Type.STRING },
            flag: { type: Type.STRING },
          },
          required: ['city', 'country'],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (data?.city && data?.country) {
        await cacheSet(cacheKey, data, 60 * 24 * 30);
        return data;
      }
    }
  } catch (error) {
    console.warn('Gemini city identification failed:', error);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recherche de lieux : source primaire = table Supabase `places`
// ---------------------------------------------------------------------------

interface DbSearchResult {
  places: Place[];
  summary: string;
}

async function resolveCityIds(cityName?: string): Promise<string[]> {
  const trimmed = cityName?.trim();
  if (!trimmed || NON_LOCATION_TERMS.includes(trimmed.toLowerCase())) return [];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('city_names')
      .select('city_id')
      .ilike('name', `%${trimmed}%`);
    return Array.from(new Set(((data ?? []) as { city_id: string }[]).map((r) => r.city_id)));
  } catch (error) {
    console.warn('City id resolution failed:', error);
    return [];
  }
}

function mapRowToPlace(row: Record<string, unknown>): Place {
  const latitude = row.latitude;
  const longitude = row.longitude;
  return {
    id: String(row.id),
    name: String(row.name ?? 'Lieu sans nom'),
    address: row.address != null ? String(row.address) : undefined,
    snippet: row.snippet != null ? String(row.snippet) : undefined,
    rating: row.rating != null ? Number(row.rating) : undefined,
    openingHours: row.opening_hours != null ? String(row.opening_hours) : undefined,
    photoUrl: row.photo_url != null ? String(row.photo_url) : undefined,
    googleMapsUri: row.google_maps_uri != null ? String(row.google_maps_uri) : undefined,
    isPro: Boolean(row.is_pro),
    location:
      latitude != null && longitude != null
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : undefined,
  };
}

function sortByProximity(places: Place[], coords?: Coordinates | null): Place[] {
  if (!coords) return places;
  const distanceSq = (p: Place) => {
    if (!p.location) return Number.MAX_VALUE;
    const dLat = p.location.latitude - coords.latitude;
    const dLng = p.location.longitude - coords.longitude;
    return dLat * dLat + dLng * dLng;
  };
  return [...places].sort((a, b) => distanceSq(a) - distanceSq(b));
}

async function queryPlaces(params: {
  category: string;
  cityIds: string[];
  filter?: string;
  searchQuery?: string;
}): Promise<Record<string, unknown>[]> {
  const supabase = createAdminClient();
  const safeCategory = sanitizeFilterTerm(params.category);

  let query = supabase
    .from('places')
    .select('*');

  if (safeCategory && safeCategory !== 'all') {
    query = query.or(`category.eq."${safeCategory}",place_type.eq."${safeCategory}"`);
  }

  query = query
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(50);

  if (params.cityIds.length > 0) {
    query = query.in('city_id', params.cityIds);
  }

  const searchTerms = [params.searchQuery, params.filter]
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t));

  for (const term of searchTerms) {
    const safe = sanitizeFilterTerm(term);
    if (!safe) continue;
    query = query.or(
      `name.ilike.%${safe}%,address.ilike.%${safe}%,snippet.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Places DB query failed:', error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

async function searchPlacesInDatabase(params: {
  category: string;
  cityName?: string;
  filter?: string;
  searchQuery?: string;
}): Promise<DbSearchResult> {
  const cityIds = await resolveCityIds(params.cityName);

  // 1. Avec le filtre ville résolu (si une ville a été trouvée)
  if (cityIds.length > 0) {
    const rows = await queryPlaces({ ...params, cityIds });
    if (rows.length > 0) {
      return {
        places: rows.map(mapRowToPlace),
        summary: `${rows.length} lieu(x) trouvé(s) pour « ${params.category} » à ${params.cityName}.`,
      };
    }
    // 2. La ville existe mais n'a aucun lieu : élargir à toutes les villes
    const widened = await queryPlaces({ ...params, cityIds: [] });
    if (widened.length > 0) {
      return {
        places: widened.map(mapRowToPlace),
        summary: `Aucun lieu à ${params.cityName} — voici tous les lieux « ${params.category} » disponibles.`,
      };
    }
    return { places: [], summary: '' };
  }

  // 3. Sans ville connue : TOUS les lieux correspondant aux critères
  const rows = await queryPlaces({ ...params, cityIds: [] });
  if (rows.length === 0) return { places: [], summary: '' };
  return {
    places: rows.map(mapRowToPlace),
    summary: `${rows.length} lieu(x) trouvé(s) pour « ${params.category} ».`,
  };
}

/**
 * Persister les lieux trouvés via Gemini pour les recherches suivantes.
 */
async function persistPlaces(
  places: Place[],
  category: string,
  cityName?: string
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const placeType = normalizePlaceType(category);
    const rows = places.map((p) => ({
      external_id: slugify(`${p.name}-${(p.address || cityName || category).split(',')[0]}`),
      name: p.name,
      category,
      place_type: placeType,
      address: p.address ?? null,
      snippet: p.snippet ?? null,
      opening_hours: p.openingHours ?? null,
      rating:
        p.rating != null
          ? Math.min(9.9, Math.max(0, Number(p.rating)))
          : null,
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
      google_maps_uri: p.googleMapsUri ?? null,
      photo_url: p.photoUrl ?? null,
      is_pro: Boolean(p.isPro),
    }));
    const { error } = await supabase
      .from('places')
      .upsert(rows, { onConflict: 'external_id' });
    if (error) console.warn('Places upsert failed:', error.message);
  } catch (error) {
    console.warn('Places persistence skipped:', error);
  }
}

// ---------------------------------------------------------------------------
// Liste complète des lieux (écran Carte) — points géolocalisés uniquement
// ---------------------------------------------------------------------------

export interface PlaceMapPoint {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
  isPro: boolean;
  address?: string;
}

export async function listAllPlaces(): Promise<PlaceMapPoint[]> {
  const cacheKey = 'zaha_places_all_v1';
  const cached = await cacheGet<PlaceMapPoint[]>(cacheKey);
  if (cached?.length) return cached;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('places')
    .select('id, name, category, address, latitude, longitude, photo_url, is_pro')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('name');

  if (error) {
    console.warn('List all places failed:', error.message);
    return [];
  }

  const places = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    category: String(row.category ?? ''),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    photoUrl: row.photo_url != null ? String(row.photo_url) : undefined,
    isPro: Boolean(row.is_pro),
    address: row.address != null ? String(row.address) : undefined,
  }));

  if (places.length > 0) {
    await cacheSet(cacheKey, places, 1); // cache court : 60s
  }

  return places;
}

// ---------------------------------------------------------------------------
// Lieux à proximité ("Autour de moi") — Haversine côté API, sans dépendance
// PostGIS : volume de lieux faible et liste déjà en cache 60s.
// ---------------------------------------------------------------------------

export interface PlaceNearbyPoint extends PlaceMapPoint {
  distance: number; // mètres
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function listNearbyPlaces(
  latitude: number,
  longitude: number,
  radius = 5000,
  limit = 50
): Promise<PlaceNearbyPoint[]> {
  const places = await listAllPlaces();
  return places
    .map((place) => ({
      ...place,
      distance: haversineMeters(latitude, longitude, place.latitude, place.longitude),
    }))
    .filter((point) => point.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export async function countPlacesByCategory(): Promise<
  { category: string; count: number }[]
> {
  const places = await listAllPlaces();
  const counts = new Map<string, number>();
  for (const place of places) {
    counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/**
 * Chercher des lieux à proximité (restaurants, hôtels, etc.).
 * Source primaire : table Supabase `places` (seed + enrichissements).
 * La ville et les coords sont optionnelles : sans elles, on renvoie tous
 * les lieux correspondant aux critères (aucun lieu figé).
 * Gemini ne sert que d'enrichissement optionnel si la base est vide.
 */
export async function searchNearbyPlaces(
  category: string,
  coords?: Coordinates | null,
  cityName?: string,
  filter?: string,
  searchQuery?: string
): Promise<{ places: Place[]; summary: string }> {
  const normalizedCategory = category?.trim();
  if (!normalizedCategory) {
    return { places: [], summary: 'Catégorie manquante.' };
  }

  const latKey = coords ? coords.latitude.toFixed(3) : 'na';
  const lngKey = coords ? coords.longitude.toFixed(3) : 'na';
  const cacheKey = `${CACHE_KEYS.PLACES}${normalizedCategory}_${latKey}_${lngKey}_${filter || 'none'}_${searchQuery || 'none'}_${cityName?.replace(/\s/g, '') || 'na'}`;

  const cached = await cacheGet<{ places: Place[]; summary: string }>(cacheKey);
  if (cached?.places?.length) return cached;

  // 1. Source primaire : base Supabase
  const dbResult = await searchPlacesInDatabase({
    category: normalizedCategory,
    cityName,
    filter,
    searchQuery,
  });

  if (dbResult.places.length > 0) {
    const result = {
      places: sortByProximity(dbResult.places, coords),
      summary: dbResult.summary,
    };
    await cacheSet(cacheKey, result, 60);
    return result;
  }

  // 2. Enrichissement Gemini optionnel (base vide + clé configurée)
  if (process.env.GEMINI_API_KEY) {
    const locationContext = cityName
      ? `à ${cityName}`
      : coords
        ? `aux coordonnées (latitude: ${coords.latitude}, longitude: ${coords.longitude})`
        : 'à Madagascar';

    const prompt = `Trouve des ${normalizedCategory}s réels ${locationContext}. ${searchQuery ? `Recherche: "${searchQuery}".` : ''} ${filter ? `Filtre: ${filter}.` : ''}
Retourne un JSON array avec les champs: name, address, snippet, openingHours, rating.`;

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                address: { type: Type.STRING },
                snippet: { type: Type.STRING },
                openingHours: { type: Type.STRING },
                rating: { type: Type.NUMBER },
              },
              required: ['name', 'address'],
            },
          },
        },
      });

      const parsedPlaces = response.text ? JSON.parse(response.text) : [];
      if (Array.isArray(parsedPlaces) && parsedPlaces.length > 0) {
        const places: Place[] = parsedPlaces.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `place-${index}-${Date.now()}`,
            name: String(item.name || 'Lieu sans nom'),
            address: String(item.address || cityName || 'Localisation inconnue'),
            googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(String(item.name) + ' ' + String(item.address))}`,
            snippet: String(item.snippet || 'Un lieu recommandé.'),
            photoUrl: `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80&random=${index + 10}`,
            rating: Number(item.rating) || 4.5,
            phoneNumber: undefined,
            websiteUri: undefined,
          })
        );

        // Upsert en base pour les prochaines recherches
        await persistPlaces(places, normalizedCategory, cityName);

        const result = {
          places,
          summary: `${places.length} ${normalizedCategory}(s) trouvé(s) ${locationContext}.`,
        };
        await cacheSet(cacheKey, result, 60);
        return result;
      }
    } catch (error) {
      console.warn('Search nearby places error:', error);
    }
  }

  // 3. Rien ni en base ni via Gemini
  const locationContext = cityName ? `à ${cityName}` : '';
  return {
    places: [],
    summary: `Aucun ${normalizedCategory} trouvé ${locationContext}.`.trim(),
  };
}
