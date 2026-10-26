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
      admin_users: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
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
          photos: string[];
          phone: string | null;
          status: string;
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
          photos?: string[];
          phone?: string | null;
          status?: string;
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
          photos?: string[];
          phone?: string | null;
          status?: string;
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
          is_sponsored: boolean;
          place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          location?: string | null;
          is_business?: boolean;
          is_sponsored?: boolean;
          place_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          location?: string | null;
          is_business?: boolean;
          is_sponsored?: boolean;
          place_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
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
      place_room_types: {
        Row: {
          id: string;
          place_id: string;
          name: string;
          description: string | null;
          capacity: number;
          price_per_night: number;
          currency: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          place_id: string;
          name: string;
          description?: string | null;
          capacity?: number;
          price_per_night?: number;
          currency?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          place_id?: string;
          name?: string;
          description?: string | null;
          capacity?: number;
          price_per_night?: number;
          currency?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_room_types_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          }
        ];
      };
      place_click_events: {
        Row: {
          id: string;
          place_id: string;
          user_id: string | null;
          action: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          place_id: string;
          user_id?: string | null;
          action: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          place_id?: string;
          user_id?: string | null;
          action?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'place_click_events_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          }
        ];
      };
      ad_banners: {
        Row: {
          id: string;
          title: string;
          image_url: string;
          link_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          image_url: string;
          link_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          image_url?: string;
          link_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          user_id: string;
          place_id: string;
          reservation_type: string;
          date: string;
          date_end: string | null;
          time_start: string | null;
          time_end: string | null;
          guests: number;
          room_type_id: string | null;
          room_type: string | null;
          activity_slot: string | null;
          price: number;
          currency: string;
          status: string;
          payment_method: string | null;
          payment_status: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          place_id: string;
          reservation_type?: string;
          date: string;
          date_end?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          guests?: number;
          room_type_id?: string | null;
          room_type?: string | null;
          activity_slot?: string | null;
          price?: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          payment_status?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          place_id?: string;
          reservation_type?: string;
          date?: string;
          date_end?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          guests?: number;
          room_type_id?: string | null;
          room_type?: string | null;
          activity_slot?: string | null;
          price?: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          payment_status?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_room_type_id_fkey';
            columns: ['room_type_id'];
            isOneToOne: false;
            referencedRelation: 'place_room_types';
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
    Views: {
      place_click_stats: {
        Row: {
          place_id: string | null;
          reserve_total: number | null;
          call_total: number | null;
          reserve_30d: number | null;
          call_30d: number | null;
          last_click_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      place_click_series: {
        Args: { p_unit: string; p_count: number };
        Returns: Array<{
          bucket_start: string;
          reserve_count: number;
          call_count: number;
        }>;
      };
    };
  };
}
