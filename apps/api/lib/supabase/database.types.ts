export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          banner_url: string | null;
          location: string | null;
          phone: string | null;
          language: string;
          country: string;
          country_flag: string | null;
          description: string | null;
          profile_views: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; name: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      places: {
        Row: {
          id: string;
          external_id: string | null;
          name: string;
          category: string;
          address: string | null;
          snippet: string | null;
          opening_hours: string | null;
          rating: number | null;
          latitude: number | null;
          longitude: number | null;
          google_maps_uri: string | null;
          photo_url: string | null;
          is_pro: boolean;
          created_at: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          location: string | null;
          is_business: boolean;
          created_at: string;
        };
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          type: string;
          url: string;
          sort_order: number;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          text: string;
          created_at: string;
        };
      };
      likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
      };
      ai_cache: {
        Row: {
          cache_key: string;
          payload: Json;
          expires_at: string;
          created_at: string;
        };
      };
    };
  };
}
