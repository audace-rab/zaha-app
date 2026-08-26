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
          bio: string | null;
          website: string | null;
          profile_views: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          avatar_url?: string | null;
          banner_url?: string | null;
          location?: string | null;
          phone?: string | null;
          language?: string;
          country?: string;
          country_flag?: string | null;
          description?: string | null;
          bio?: string | null;
          website?: string | null;
          profile_views?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string | null;
          banner_url?: string | null;
          location?: string | null;
          phone?: string | null;
          language?: string;
          country?: string;
          country_flag?: string | null;
          description?: string | null;
          bio?: string | null;
          website?: string | null;
          profile_views?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: string;
          country: string;
          country_flag: string | null;
          latitude: number;
          longitude: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          country: string;
          country_flag?: string | null;
          latitude: number;
          longitude: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          country?: string;
          country_flag?: string | null;
          latitude?: number;
          longitude?: number;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      city_names: {
        Row: {
          id: string;
          city_id: string;
          name: string;
          language: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          name: string;
          language?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          city_id?: string;
          name?: string;
          language?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'city_names_city_id_fkey';
            columns: ['city_id'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['id'];
          }
        ];
      };
      places: {
        Row: {
          id: string;
          external_id: string | null;
          name: string;
          category: string;
          place_type: string | null;
          address: string | null;
          snippet: string | null;
          opening_hours: string | null;
          rating: number | null;
          latitude: number | null;
          longitude: number | null;
          google_maps_uri: string | null;
          photo_url: string | null;
          is_pro: boolean;
          city_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          name: string;
          category: string;
          place_type?: string | null;
          address?: string | null;
          snippet?: string | null;
          opening_hours?: string | null;
          rating?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          google_maps_uri?: string | null;
          photo_url?: string | null;
          is_pro?: boolean;
          city_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          name?: string;
          category?: string;
          place_type?: string | null;
          address?: string | null;
          snippet?: string | null;
          opening_hours?: string | null;
          rating?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          google_maps_uri?: string | null;
          photo_url?: string | null;
          is_pro?: boolean;
          city_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'places_city_id_fkey';
            columns: ['city_id'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['id'];
          }
        ];
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
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          location?: string | null;
          is_business?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          location?: string | null;
          is_business?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          type: string;
          url: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          post_id: string;
          type: string;
          url: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          post_id?: string;
          type?: string;
          url?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'post_media_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'likes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          place_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          place_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          place_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookmarks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookmarks_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          }
        ];
      };
      place_reviews: {
        Row: {
          id: string;
          user_id: string;
          place_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          place_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          place_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'place_reviews_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          }
        ];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_following_id_fkey';
            columns: ['following_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      ai_cache: {
        Row: {
          cache_key: string;
          payload: Json;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          cache_key: string;
          payload: Json;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          cache_key?: string;
          payload?: Json;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
