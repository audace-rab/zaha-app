import { GoogleGenAI, Type } from '@google/genai';
import type { ChatMessage, Coordinates, Place } from '@zaha/shared';
import { cacheGet, cacheSet, CACHE_KEYS } from '@/lib/cache/cacheService';

const MODEL_NAME = 'gemini-2.0-flash';

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

const CITY_COORDINATES: Record<string, Coordinates> = {
  antananarivo: { latitude: -18.8792, longitude: 47.5079 },
  tana: { latitude: -18.8792, longitude: 47.5079 },
  'nosy be': { latitude: -13.3183, longitude: 48.2673 },
  toamasina: { latitude: -18.1492, longitude: 49.4023 },
  tamatave: { latitude: -18.1492, longitude: 49.4023 },
  majunga: { latitude: -15.7167, longitude: 46.3167 },
  mahajanga: { latitude: -15.7167, longitude: 46.3167 },
  antsiranana: { latitude: -12.2787, longitude: 49.2917 },
  'diego suarez': { latitude: -12.2787, longitude: 49.2917 },
  diego: { latitude: -12.2787, longitude: 49.2917 },
  fianarantsoa: { latitude: -21.4527, longitude: 47.0857 },
  toliara: { latitude: -23.354, longitude: 43.6696 },
  tuléar: { latitude: -23.354, longitude: 43.6696 },
  tulear: { latitude: -23.354, longitude: 43.6696 },
  morondava: { latitude: -20.2833, longitude: 44.2833 },
  'sainte marie': { latitude: -16.9044, longitude: 49.9002 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
};

const FALLBACK_PLACES: Record<string, Place[]> = {
  restaurant: [
    {
      id: 'fb-rest-1',
      name: 'La Varangue',
      address: 'Rue Printsy Ratsimamanga, Isoraka, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=La+Varangue+Antananarivo',
      snippet: 'Restaurant gastronomique renommé proposant des saveurs malgaches et françaises.',
      photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
      rating: 4.8,
      openingHours: '12:00 - 22:00',
      isPro: true,
    },
  ],
  hotel: [
    {
      id: 'fb-hotel-1',
      name: 'Hôtel Carlton Madagascar',
      address: 'Anosy, Antananarivo 101',
      googleMapsUri: 'https://maps.google.com/?q=Carlton+Hotel+Antananarivo',
      snippet: 'Hôtel 5 étoiles emblématique surplombant le lac Anosy.',
      photoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      rating: 4.7,
      openingHours: 'Ouvert 24h/24',
      isPro: true,
    },
  ],
};

export async function chatWithAgent(
  messages: ChatMessage[],
  userLocation: Coordinates | null
): Promise<{ text: string; sources?: { uri: string; title: string }[] }> {
  try {
    const ai = getAI();
    const conversationContext = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: conversationContext as never,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Tu es Zaha, l'assistant expert de Zaha App.
Localisation : ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : 'Non spécifiée'}.
Réponds en 4 lignes max, en français.`,
      },
    });

    const text = response.text || "Désolé, je n'ai pas pu générer de réponse.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk) => chunk.web)
      .map((chunk) => ({
        uri: chunk.web!.uri,
        title: chunk.web!.title || 'Source web',
      }));

    return { text, sources };
  } catch (error) {
    console.error('Agent Chat Error:', error);
    return { text: 'Problème technique temporaire. Peux-tu reformuler ta question ?' };
  }
}

export async function searchNearbyPlaces(
  category: string,
  coords: Coordinates,
  filter?: string,
  searchQuery?: string,
  locationName?: string
): Promise<{ places: Place[]; summary: string }> {
  const latKey = coords.latitude.toFixed(3);
  const lngKey = coords.longitude.toFixed(3);
  const cacheKey = `${CACHE_KEYS.PLACES}${category}_${latKey}_${lngKey}_${filter || 'none'}_${searchQuery || 'none'}_${locationName?.replace(/\s/g, '') || 'na'}`;

  const cached = await cacheGet<{ places: Place[]; summary: string }>(cacheKey);
  if (cached?.places?.length) return cached;

  const locationContext =
    locationName && locationName !== 'Ma position' && locationName !== 'Autour de moi'
      ? `à ${locationName}`
      : `à la position (latitude: ${coords.latitude}, longitude: ${coords.longitude})`;

  const prompt = `Trouve des lieux réels dans la catégorie "${category}" ${locationContext}. ${searchQuery ? `Recherche: "${searchQuery}".` : ''} ${filter ? `Filtre: ${filter}.` : ''}
Retourne un JSON array avec: name, address, snippet, openingHours, rating.`;

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
      const places: Place[] = parsedPlaces.map((item: Record<string, unknown>, index: number) => ({
        id: `place-${index}-${Date.now()}`,
        name: String(item.name || 'Lieu sans nom'),
        address: String(item.address || locationName || 'Antananarivo'),
        googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(String(item.name) + ' ' + String(item.address))}`,
        snippet: String(item.snippet || 'Un lieu recommandé par nos experts.'),
        photoUrl: `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80&random=${index + 10}`,
        rating: Number(item.rating) || 4.5,
        location: {
          latitude: coords.latitude + (Math.random() - 0.5) * 0.03,
          longitude: coords.longitude + (Math.random() - 0.5) * 0.03,
        },
        openingHours: String(item.openingHours || '08:30 - 20:00'),
        isPro: category !== 'pharmacie' && index % 2 === 0,
      }));

      const result = { places, summary: `Lieux trouvés pour ${category} ${locationContext}.` };
      await cacheSet(cacheKey, result, 60);
      return result;
    }
  } catch (error) {
    console.warn('Search Nearby Places error:', error);
  }

  const catKey = category in FALLBACK_PLACES ? category : 'restaurant';
  const fallbackList = FALLBACK_PLACES[catKey] || FALLBACK_PLACES.restaurant;
  const placesWithCoords: Place[] = fallbackList.map((p, idx) => ({
    ...p,
    location: {
      latitude: coords.latitude + (idx * 0.005 - 0.005),
      longitude: coords.longitude + (idx * 0.005 - 0.005),
    },
  }));

  const result = {
    places: placesWithCoords,
    summary: `Recommandations pour ${category}${locationName ? ` à ${locationName}` : ''}.`,
  };
  await cacheSet(cacheKey, result, 60);
  return result;
}

export async function identifyLocation(
  query: string
): Promise<{ city: string; country: string; flag: string } | null> {
  if (!query || query.length < 3) return null;

  const cacheKey = `loc_id_${query.toLowerCase().trim().replace(/\s+/g, '_')}`;
  const cached = await cacheGet<{ city: string; country: string; flag: string }>(cacheKey);
  if (cached) return cached;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Identify city and country for "${query}". JSON: city, country (French), flag emoji.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            country: { type: Type.STRING },
            flag: { type: Type.STRING },
          },
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
    console.warn('Identify location error', error);
  }

  const lower = query.toLowerCase();
  if (lower.includes('tana') || lower.includes('antananarivo')) {
    return { city: 'Antananarivo', country: 'Madagascar', flag: '🇲🇬' };
  }
  return null;
}

export async function getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
  if (!address?.trim()) return null;
  const normalized = address.toLowerCase().trim();

  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(cityName)) return coords;
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Find latitude and longitude for: "${address}". Return JSON.`,
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
    console.warn('Geocoding error:', error);
  }

  return { latitude: -18.8792, longitude: 47.5079 };
}
