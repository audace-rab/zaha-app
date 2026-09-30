// Configuration mobile — chargée depuis .env via react-native-dotenv.
// Ne JAMAIS mettre de clé privée ici : tout est embarqué en clair dans l'APK.
// IMPORTANT : sur Android, localhost = le téléphone lui-même.
// LOCAL_API_HOST doit pointer vers l'IP du PC qui héberge l'API Next.js.
import { LOCAL_API_HOST, PROD_API_HOST, SUPABASE_ANON_KEY, SUPABASE_URL } from '@env';

export const config = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },
  api: {
    // Dev (__DEV__ = true) : API Next.js locale sur le PC (port 3000).
    // Release : API déployée sur Vercel (HTTPS).
    baseUrl: __DEV__
      ? `http://${LOCAL_API_HOST}:3000`
      : `https://${PROD_API_HOST}`,
  },
};
