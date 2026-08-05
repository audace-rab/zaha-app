import { GoogleGenAI, Type } from "@google/genai";
import { Place, Coordinates, ChatMessage } from '../types';
import { cacheGet, cacheSet, CACHE_KEYS } from './cacheService';

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyBto80UipAhB-v62uSMtPR4kuX30yFVcQA',
});

const MODEL_NAME = "gemini-3.6-flash";

const CITY_COORDINATES: Record<string, Coordinates> = {
  'antananarivo': { latitude: -18.8792, longitude: 47.5079 },
  'tana': { latitude: -18.8792, longitude: 47.5079 },
  'nosy be': { latitude: -13.3183, longitude: 48.2673 },
  'toamasina': { latitude: -18.1492, longitude: 49.4023 },
  'tamatave': { latitude: -18.1492, longitude: 49.4023 },
  'majunga': { latitude: -15.7167, longitude: 46.3167 },
  'mahajanga': { latitude: -15.7167, longitude: 46.3167 },
  'antsiranana': { latitude: -12.2787, longitude: 49.2917 },
  'diego suarez': { latitude: -12.2787, longitude: 49.2917 },
  'diego': { latitude: -12.2787, longitude: 49.2917 },
  'fianarantsoa': { latitude: -21.4527, longitude: 47.0857 },
  'toliara': { latitude: -23.3540, longitude: 43.6696 },
  'tuléar': { latitude: -23.3540, longitude: 43.6696 },
  'tulear': { latitude: -23.3540, longitude: 43.6696 },
  'morondava': { latitude: -20.2833, longitude: 44.2833 },
  'sainte marie': { latitude: -16.9044, longitude: 49.9002 },
  'paris': { latitude: 48.8566, longitude: 2.3522 }
};

const FALLBACK_PLACES: Record<string, Place[]> = {
  restaurant: [
    {
      id: 'fb-rest-1',
      name: 'La Varangue',
      address: 'Rue Printsy Ratsimamanga, Isoraka, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=La+Varangue+Antananarivo',
      snippet: 'Restaurant gastronomique renommé proposant des saveurs malgaches et françaises dans un cadre élégant.',
      photoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
      rating: 4.8,
      openingHours: '12:00 - 22:00',
      isPro: true
    },
    {
      id: 'fb-rest-2',
      name: 'Le Marais',
      address: 'Ankorondrano, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Le+Marais+Antananarivo',
      snippet: 'Cuisine raffinée et vue panoramique sur la ville avec une carte de cocktails créatifs.',
      photoUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
      rating: 4.7,
      openingHours: '11:30 - 23:00',
      isPro: true
    },
    {
      id: 'fb-rest-3',
      name: 'Café de la Gare',
      address: 'Gare Soarano, Analakely, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Cafe+de+la+Gare+Antananarivo',
      snippet: 'Brasserie historique au cœur de la gare rénovée, réputée pour ses steaks de zébu et son ambiance.',
      photoUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
      rating: 4.6,
      openingHours: '07:00 - 22:30',
      isPro: false
    },
    {
      id: 'fb-rest-4',
      name: 'Sakamanga Restaurant',
      address: 'Rue Ratianarivo, Isoraka, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Sakamanga+Antananarivo',
      snippet: 'Institution incontournable offrant des plats traditionnels et internationaux au milieu de pièces de musée.',
      photoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
      rating: 4.5,
      openingHours: '06:30 - 22:00',
      isPro: true
    }
  ],
  hotel: [
    {
      id: 'fb-hotel-1',
      name: 'Hôtel Carlton Madagascar',
      address: 'Anosy, Antananarivo 101',
      googleMapsUri: 'https://maps.google.com/?q=Carlton+Hotel+Antananarivo',
      snippet: 'Hôtel 5 étoiles emblématique surplombant le lac Anosy avec piscine extérieure et spa.',
      photoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      rating: 4.7,
      openingHours: 'Ouvert 24h/24',
      isPro: true
    },
    {
      id: 'fb-hotel-2',
      name: 'Radisson Blu Hotel Waterfront',
      address: 'Zone Tana Waterfront, Ambodivona, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Radisson+Blu+Antananarivo',
      snippet: 'Design moderne au bord de l\'eau, chambres spacieuses et centre de remise en forme.',
      photoUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
      rating: 4.8,
      openingHours: 'Ouvert 24h/24',
      isPro: true
    },
    {
      id: 'fb-hotel-3',
      name: 'Hôtel Sakamanga',
      address: 'Isoraka, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Hotel+Sakamanga+Antananarivo',
      snippet: 'Hôtel de charme chaleureux et artistique avec terrasse verdoyante et piscine.',
      photoUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      rating: 4.6,
      openingHours: 'Ouvert 24h/24',
      isPro: false
    }
  ],
  'activités': [
    {
      id: 'fb-act-1',
      name: 'Rova de Manjakamiadana (Palais de la Reine)',
      address: 'Haute Ville, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Rova+de+Manjakamiadana',
      snippet: 'Monument historique majeur offrant une vue panoramique à 360 degrés sur toute la capitale.',
      photoUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80',
      rating: 4.8,
      openingHours: '08:30 - 17:00',
      isPro: true
    },
    {
      id: 'fb-act-2',
      name: 'Parc Zoologique et Botanique de Tsimbazaza',
      address: 'Rue Kasanga Fernand, Tsimbazaza, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Parc+Tsimbazaza+Antananarivo',
      snippet: 'Découverte de la faune et de la flore uniques de Madagascar, y compris de nombreuses espèces de lémuriens.',
      photoUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
      rating: 4.4,
      openingHours: '09:00 - 17:00',
      isPro: false
    },
    {
      id: 'fb-act-3',
      name: 'Lemurs\' Park',
      address: 'Katsaoka, RN1 (à 22km d\'Antananarivo)',
      googleMapsUri: 'https://maps.google.com/?q=Lemurs+Park+Madagascar',
      snippet: 'Réserve naturelle privée abritant 9 espèces de lémuriens en liberté au bord de la rivière Katsaoka.',
      photoUrl: 'https://images.unsplash.com/photo-1574063413132-355dbfd83e0c?w=800&q=80',
      rating: 4.7,
      openingHours: '08:30 - 16:00',
      isPro: true
    }
  ],
  pharmacie: [
    {
      id: 'fb-pharma-1',
      name: 'Pharmacie d\'Isoraka',
      address: 'Rue Rainitovo, Isoraka, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Pharmacie+Isoraka+Antananarivo',
      snippet: 'Pharmacie centrale proposant un grand choix de médicaments et produits de parapharmacie.',
      photoUrl: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=800&q=80',
      rating: 4.6,
      openingHours: '07:30 - 20:00',
      isPro: false
    },
    {
      id: 'fb-pharma-2',
      name: 'Pharmacie Métropole',
      address: 'Avenue d\'Indépendance, Analakely, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Pharmacie+Metropole+Antananarivo',
      snippet: 'Pharmacie de référence au centre-ville avec service de garde régulier.',
      photoUrl: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80',
      rating: 4.5,
      openingHours: 'Ouvert 24h/24',
      isPro: false
    },
    {
      id: 'fb-pharma-3',
      name: 'Pharmacie Ankorondrano',
      address: 'Boulevard de Tokyo, Ankorondrano, Antananarivo',
      googleMapsUri: 'https://maps.google.com/?q=Pharmacie+Ankorondrano',
      snippet: 'Pharmacie moderne ouverte 7j/7 proche des grands centres commerciaux.',
      photoUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80',
      rating: 4.7,
      openingHours: '08:00 - 21:00',
      isPro: false
    }
  ]
};

export const chatWithAgent = async (
  messages: ChatMessage[],
  userLocation: Coordinates | null
): Promise<{ text: string, sources?: { uri: string, title: string }[] }> => {
  try {
    const conversationContext = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: conversationContext as any,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Tu es Zaha, l'assistant expert de Zaha App. Tu es le pont entre les données techniques et l'expérience vécue par la communauté.

### SOURCE D'INTELLIGENCE :
1. PARTENAIRES : Priorise les établissements partenaires (bouton WhatsApp disponible).
2. PREUVE SOCIALE : Analyse les notes (étoiles) et les avis. Si un lieu est très bien noté, mentionne-le comme "Plébiscité par la communauté".
3. LE FEED : Utilise le Feed pour l'inspiration. Encourage l'utilisateur à y jeter un œil pour voir les photos réelles des autres voyageurs.

### RÈGLES DE RÉPONSE :
- CONCISION : 4 lignes max.
- LOGISTIQUE : Temps de trajet en heures, pas en km.
- SAISONNALITÉ : Alerte météo/cyclone si zone à risque.
- RECOMMANDATION : "Selon les derniers avis, le [Nom du lieu] est très apprécié pour son [Point fort]. Allez voir les photos sur le Feed !"

### CONTEXTE DYNAMIQUE (Injecté par l'app) :
- Localisation : ${userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : 'Non spécifiée'}.
- Mois actuel : ${new Date().getMonth() + 1}.`,
      },
    });

    const text = response.text || "Désolé, je n'ai pas pu générer de réponse.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources = groundingChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        uri: chunk.web!.uri,
        title: chunk.web!.title || "Source web"
      }));

    return { text, sources };
  } catch (error) {
    console.error("Agent Chat Error:", error);
    return { text: "Problème technique temporaire. Peux-tu reformuler ta question ?" };
  }
};

export const searchNearbyPlaces = async (
  category: string, 
  coords: Coordinates, 
  filter?: string,
  searchQuery?: string,
  locationName?: string
): Promise<{ places: Place[], summary: string }> => {
  const latKey = coords.latitude.toFixed(3);
  const lngKey = coords.longitude.toFixed(3);
  const cacheKey = `${CACHE_KEYS.PLACES}${category}_${latKey}_${lngKey}_${filter || 'none'}_${searchQuery || 'none'}_${locationName?.replace(/\s/g, '') || 'na'}`;

  const cached = cacheGet<{ places: Place[], summary: string }>(cacheKey);
  if (cached && cached.places && cached.places.length > 0) return cached;

  const locationContext = locationName && locationName !== "Ma position" && locationName !== "Autour de moi"
    ? `à ${locationName}`
    : `à la position (latitude: ${coords.latitude}, longitude: ${coords.longitude})`;

  const prompt = `Trouve des lieux réels dans la catégorie "${category}" ${locationContext}. ${searchQuery ? `Recherche spécifique: "${searchQuery}".` : ''} ${filter ? `Filtre: ${filter}.` : ''}
Formate la réponse sous forme d'un tableau JSON d'objets avec les champs suivants:
- name: Nom exact du lieu
- address: Rue/Quartier
- snippet: Description courte (max 80 caractères)
- openingHours: Horaires (ex: "08:00 - 20:00" ou "Ouvert 24h/24")
- rating: Note numérique sur 5 (ex: 4.5)`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              snippet: { type: Type.STRING },
              openingHours: { type: Type.STRING },
              rating: { type: Type.NUMBER }
            },
            required: ["name", "address"]
          }
        },
        systemInstruction: `Tu es un guide de voyage expert et précis. Fournis des informations réelles et vérifiées.`
      }
    });

    const responseText = response.text;
    let parsedPlaces: any[] = [];
    if (responseText) {
      try {
        parsedPlaces = JSON.parse(responseText);
      } catch (e) {
        console.warn("Could not parse JSON response for places", e);
      }
    }

    if (Array.isArray(parsedPlaces) && parsedPlaces.length > 0) {
      const places: Place[] = parsedPlaces.map((item, index) => ({
        id: `place-${index}-${Date.now()}`,
        name: item.name || "Lieu sans nom",
        address: item.address || (locationName ? `À ${locationName}` : "Antananarivo"),
        googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent((item.name || '') + ' ' + (item.address || ''))}`,
        snippet: item.snippet || "Un lieu recommandé par nos experts.",
        photoUrl: `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80&random=${index + 10}`,
        rating: item.rating || 4.5,
        location: {
          latitude: coords.latitude + (Math.random() - 0.5) * 0.03,
          longitude: coords.longitude + (Math.random() - 0.5) * 0.03
        },
        openingHours: item.openingHours || "08:30 - 20:00",
        isPro: category === 'pharmacie' ? false : index % 2 === 0
      }));

      const summary = `Voici les lieux trouvés pour ${category} ${locationContext}.`;
      const result = { places, summary };
      cacheSet(cacheKey, result, 60);
      return result;
    }
  } catch (error) {
    console.warn("Search Nearby Places Gemini API notice:", error);
  }

  // Robust Fallback when API returns empty or errors out
  const catKey = (category in FALLBACK_PLACES) ? category : 'restaurant';
  const fallbackList = FALLBACK_PLACES[catKey] || FALLBACK_PLACES.restaurant;

  const placesWithCoords: Place[] = fallbackList.map((p, idx) => ({
    ...p,
    address: locationName && locationName !== 'Ma position' ? `${p.address.split(',')[0]}, ${locationName}` : p.address,
    location: {
      latitude: coords.latitude + (idx * 0.005 - 0.005),
      longitude: coords.longitude + (idx * 0.005 - 0.005)
    }
  }));

  const result = {
    places: placesWithCoords,
    summary: `Recommandations pour ${category} ${locationName ? `à ${locationName}` : ''}.`
  };
  cacheSet(cacheKey, result, 60);
  return result;
};

export const translateToEnglish = async (text: string): Promise<string> => {
  const cacheKey = `${CACHE_KEYS.TRANSLATIONS}${btoa(encodeURIComponent(text)).substring(0, 32)}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Translate the following text into English: "${text}"`,
    });
    const result = response.text || text;
    cacheSet(cacheKey, result, 60 * 24 * 7);
    return result;
  } catch (error) {
    return text;
  }
};

export const identifyLocation = async (query: string): Promise<{ city: string, country: string, flag: string } | null> => {
  if (!query || query.length < 3) return null;
  const cacheKey = `loc_id_${query.toLowerCase().trim().replace(/\s+/g, '_')}`;
  
  const cached = cacheGet<{ city: string, country: string, flag: string }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Identify the city and country for "${query}". Return a JSON object with city, country (in French), and flag emoji. If not found or not a city, return null.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            country: { type: Type.STRING },
            flag: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      const data = JSON.parse(text);
      if (data && data.city && data.country) {
        cacheSet(cacheKey, data, 60 * 24 * 30);
        return data;
      }
    }
  } catch (error) {
    console.warn("Identify location error", error);
  }

  const lower = query.toLowerCase();
  if (lower.includes('tana') || lower.includes('antananarivo')) {
    return { city: 'Antananarivo', country: 'Madagascar', flag: '🇲🇬' };
  }
  if (lower.includes('nosy') || lower.includes('nosy be')) {
    return { city: 'Nosy Be', country: 'Madagascar', flag: '🇲🇬' };
  }
  if (lower.includes('majunga') || lower.includes('mahajanga')) {
    return { city: 'Mahajanga', country: 'Madagascar', flag: '🇲🇬' };
  }
  if (lower.includes('diego') || lower.includes('antsiranana')) {
    return { city: 'Antsiranana', country: 'Madagascar', flag: '🇲🇬' };
  }
  if (lower.includes('tamatave') || lower.includes('toamasina')) {
    return { city: 'Toamasina', country: 'Madagascar', flag: '🇲🇬' };
  }

  return null;
};

export const getCoordinatesFromAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address || !address.trim()) return null;
  const normalized = address.toLowerCase().trim();

  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(cityName)) {
      return coords;
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Find latitude and longitude for: "${address}". Return JSON with latitude and longitude numbers.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER }
          },
          required: ["latitude", "longitude"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { latitude: data.latitude, longitude: data.longitude };
      }
    }
  } catch (error) {
    console.warn("Geocoding address error:", error);
  }

  return { latitude: -18.8792, longitude: 47.5079 };
};
