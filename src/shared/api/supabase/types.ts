export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      subscription_entitlements: {
        Row: {
          id: string
          user_id: string
          platform: "ios" | "android"
          product_id: string
          status: "active" | "trialing" | "grace_period" | "expired" | "revoked" | "billing_retry"
          expires_at: string | null
          is_trial: boolean
          will_renew: boolean
          original_transaction_id: string | null
          purchase_token: string | null
          latest_transaction_id: string | null
          store_environment: "production" | "sandbox" | null
          last_verified_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: "ios" | "android"
          product_id: string
          status: "active" | "trialing" | "grace_period" | "expired" | "revoked" | "billing_retry"
          expires_at?: string | null
          is_trial?: boolean
          will_renew?: boolean
          original_transaction_id?: string | null
          purchase_token?: string | null
          latest_transaction_id?: string | null
          store_environment?: "production" | "sandbox" | null
          last_verified_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: "ios" | "android"
          product_id?: string
          status?: "active" | "trialing" | "grace_period" | "expired" | "revoked" | "billing_retry"
          expires_at?: string | null
          is_trial?: boolean
          will_renew?: boolean
          original_transaction_id?: string | null
          purchase_token?: string | null
          latest_transaction_id?: string | null
          store_environment?: "production" | "sandbox" | null
          last_verified_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          business_card_id: string
          comment: string | null
          cost: number
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          date_time: string
          id: string
          payment_status: Database["public"]["Enums"]["booking_payment_status"]
          persons: number | null
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        Insert: {
          business_card_id: string
          comment?: string | null
          cost?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time: string
          id?: string
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          persons?: number | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }
        Update: {
          business_card_id?: string
          comment?: string | null
          cost?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time?: string
          id?: string
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          persons?: number | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cards: {
        Row: {
          blurhashes: string[]
          address: string | null
          booking_price: number
          category_id: string | null
          city: string | null
          contact_whatsapp: string | null
          created_at: string
          cuisine_types: string[] | null
          description: string | null
          description_de: string | null
          description_es: string | null
          description_fr: string | null
          description_pt: string | null
          description_ru: string | null
          id: string
          google_place_id: string | null
          images: string[] | null
          latitude: number | null
          location: unknown | null
          longitude: number | null
          menu_items: string[] | null
          name: string
          name_de: string | null
          name_es: string | null
          name_fr: string | null
          name_pt: string | null
          name_ru: string | null
          phone: string
          price_tier: number | null
          rating: number
          tags: string[] | null
          tags_de: string[] | null
          tags_es: string[] | null
          tags_fr: string[] | null
          tags_pt: string[] | null
          tags_ru: string[] | null
          type: Database["public"]["Enums"]["business_card_type"]
        }
        Insert: {
          blurhashes?: string[]
          address?: string | null
          booking_price?: number
          category_id?: string | null
          city?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          cuisine_types?: string[] | null
          description?: string | null
          description_de?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_pt?: string | null
          description_ru?: string | null
          id?: string
          google_place_id?: string | null
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          menu_items?: string[] | null
          name: string
          name_de?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_pt?: string | null
          name_ru?: string | null
          phone?: string
          price_tier?: number | null
          rating?: number
          tags?: string[] | null
          tags_de?: string[] | null
          tags_es?: string[] | null
          tags_fr?: string[] | null
          tags_pt?: string[] | null
          tags_ru?: string[] | null
          type?: Database["public"]["Enums"]["business_card_type"]
        }
        Update: {
          address?: string | null
          booking_price?: number
          category_id?: string | null
          city?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          cuisine_types?: string[] | null
          description?: string | null
          description_de?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_pt?: string | null
          description_ru?: string | null
          id?: string
          google_place_id?: string | null
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          menu_items?: string[] | null
          name?: string
          name_de?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_pt?: string | null
          name_ru?: string | null
          phone?: string
          price_tier?: number | null
          rating?: number
          tags?: string[] | null
          tags_de?: string[] | null
          tags_es?: string[] | null
          tags_fr?: string[] | null
          tags_pt?: string[] | null
          tags_ru?: string[] | null
          type?: Database["public"]["Enums"]["business_card_type"]
        }
        Relationships: [
          {
            foreignKeyName: "business_cards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          business_card_id: string
          comment: string | null
          cost: number
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          date_time: string
          id: string
          is_restaurant_table: boolean
          paid_at: string | null
          persons: number | null
          status: Database["public"]["Enums"]["cart_item_status"]
          user_id: string
          wa_confirmable: boolean
          wa_confirmed_price: string | null
          wa_confirmed_slot: string | null
          wa_payment_link: string | null
          wa_n8n_callback_token: string | null
          wa_n8n_started_at: string | null
          wa_status_lines: Json
        }
        Insert: {
          business_card_id: string
          comment?: string | null
          cost?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time: string
          id?: string
          is_restaurant_table?: boolean
          paid_at?: string | null
          persons?: number | null
          status?: Database["public"]["Enums"]["cart_item_status"]
          user_id: string
          wa_confirmable?: boolean
          wa_confirmed_price?: string | null
          wa_confirmed_slot?: string | null
          wa_payment_link?: string | null
          wa_n8n_callback_token?: string | null
          wa_n8n_started_at?: string | null
          wa_status_lines?: Json
        }
        Update: {
          business_card_id?: string
          comment?: string | null
          cost?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time?: string
          id?: string
          is_restaurant_table?: boolean
          paid_at?: string | null
          persons?: number | null
          status?: Database["public"]["Enums"]["cart_item_status"]
          user_id?: string
          wa_confirmable?: boolean
          wa_confirmed_price?: string | null
          wa_confirmed_slot?: string | null
          wa_payment_link?: string | null
          wa_n8n_callback_token?: string | null
          wa_n8n_started_at?: string | null
          wa_status_lines?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          business_cards_count: number
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_cards_count?: number
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_cards_count?: number
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          business_card_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          business_card_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          business_card_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_crowd_snapshots: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          signal_type: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          signal_type: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          signal_type?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_crowd_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          progress: number
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          progress?: number
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          progress?: number
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          business_card_id: string | null
          created_at: string
          id: string
          is_read: boolean
          text: string
          user_id: string
        }
        Insert: {
          business_card_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          text: string
          user_id: string
        }
        Update: {
          business_card_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_verified: boolean
          last_name: string
          phone: string | null
          promo_codes: string[] | null
          timezone: string | null
          updated_at: string
          vibe_preferences: Json
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id: string
          is_verified?: boolean
          last_name?: string
          phone?: string | null
          promo_codes?: string[] | null
          timezone?: string | null
          updated_at?: string
          vibe_preferences?: Json
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_verified?: boolean
          last_name?: string
          phone?: string | null
          promo_codes?: string[] | null
          timezone?: string | null
          updated_at?: string
          vibe_preferences?: Json
        }
        Relationships: []
      }
      reviews: {
        Row: {
          business_card_id: string
          created_at: string
          description: string | null
          id: string
          user_id: string
          value: number
        }
        Insert: {
          business_card_id: string
          created_at?: string
          description?: string | null
          id?: string
          user_id: string
          value: number
        }
        Update: {
          business_card_id?: string
          created_at?: string
          description?: string | null
          id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_cart_items: {
        Row: {
          business_card_id: string
          created_at: string
          id: string
          paid_at: string | null
          parent_id: string | null
          quantity: number
          shopping_item_id: string
          status: string
          user_id: string
        }
        Insert: {
          business_card_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          parent_id?: string | null
          quantity?: number
          shopping_item_id: string
          status?: string
          user_id: string
        }
        Update: {
          business_card_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          parent_id?: string | null
          quantity?: number
          shopping_item_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_cart_items_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_cart_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "shopping_cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_cart_items_shopping_item_id_fkey"
            columns: ["shopping_item_id"]
            isOneToOne: false
            referencedRelation: "shopping_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          business_card_id: string
          created_at: string
          description: string | null
          id: string
          image: string | null
          item_type: Database["public"]["Enums"]["shopping_item_type"]
          name: string
          price: number
        }
        Insert: {
          business_card_id: string
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          item_type?: Database["public"]["Enums"]["shopping_item_type"]
          name: string
          price?: number
        }
        Update: {
          business_card_id?: string
          created_at?: string
          description?: string
          id?: string
          image?: string | null
          item_type?: Database["public"]["Enums"]["shopping_item_type"]
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string
          updated_at: string
          expo_push_token: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: string
          updated_at?: string
          expo_push_token?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string
          updated_at?: string
          expo_push_token?: string | null
        }
        Relationships: []
      }
      daily_recommendations: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          recommendation_score: number
          recommendation_reasons: string[]
          generated_for_date: string
          generated_rank: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          recommendation_score: number
          recommendation_reasons?: string[]
          generated_for_date?: string
          generated_rank: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          recommendation_score?: number
          recommendation_reasons?: string[]
          generated_for_date?: string
          generated_rank?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_recommendations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_delivery_logs: {
        Row: {
          id: string
          user_id: string
          generated_for_date: string
          delivery_slot: string
          notification_sent: boolean
          sent_at: string | null
          delivery_provider: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generated_for_date?: string
          delivery_slot?: string
          notification_sent?: boolean
          sent_at?: string | null
          delivery_provider?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generated_for_date?: string
          delivery_slot?: string
          notification_sent?: boolean
          sent_at?: string | null
          delivery_provider?: string
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recommendation_events: {
        Row: {
          id: string
          user_id: string
          event_name: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_name: string
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_name?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      recommendation_generation_runs: {
        Row: {
          id: string
          generated_for_date: string
          started_at: string
          completed_at: string | null
          users_processed: number
          status: string
          error_log: string | null
        }
        Insert: {
          id?: string
          generated_for_date?: string
          started_at?: string
          completed_at?: string | null
          users_processed?: number
          status?: string
          error_log?: string | null
        }
        Update: {
          id?: string
          generated_for_date?: string
          started_at?: string
          completed_at?: string | null
          users_processed?: number
          status?: string
          error_log?: string | null
        }
        Relationships: []
      }
      recommendation_interactions: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          interaction_type: string
          source: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          interaction_type: string
          source?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          interaction_type?: string
          source?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_interactions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_reviews: {
        Row: {
          business_card_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          value: number | null
        }
        Insert: {
          business_card_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          value?: number | null
        }
        Update: {
          business_card_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_card_id_fkey"
            columns: ["business_card_id"]
            isOneToOne: false
            referencedRelation: "business_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_business_card_image: {
        Args: {
          p_image_url: string
          p_venue_id: string
        }
        Returns: string[]
      },
      remove_business_card_image: {
        Args: {
          p_image_url: string
          p_venue_id: string
        }
        Returns: string[]
      },
      get_business_cards_localized: {
        Args: {
          p_type?: string | null
          p_city?: string | null
          p_lang?: string
          p_limit?: number
        }
        Returns: {
          id: string
          name: string
          description: string | null
          tags: string[] | null
          images: string[] | null
          image: string | null
          category_id: string | null
          city: string | null
          address: string | null
          rating: number
          booking_price: number
          phone: string
          contact_whatsapp: string | null
          type: Database["public"]["Enums"]["business_card_type"]
          created_at: string
          latitude: number | null
          longitude: number | null
          blurhashes: string[]
          category: Json | null
        }[]
      },
      get_bookings_datetimes_for_availability: {
        Args: {
          p_business_id: string
          p_end: string
          p_start: string
        }
        Returns: string[]
      },
      bootstrap_my_daily_recommendations: {
        Args: {
          p_date?: string
          p_force?: boolean
        }
        Returns: Json
      },
      enqueue_daily_recommendation_push: {
        Args: {
          p_user_id: string
          p_date?: string
          p_delivery_slot?: string
        }
        Returns: boolean
      },
      generate_daily_recommendations: {
        Args: {
          p_user_id?: string
          p_date?: string
          p_limit?: number
          p_force?: boolean
        }
        Returns: number
      },
      generate_recommendation_reasons: {
        Args: {
          p_affinity_score: number
          p_crowd_score: number
          p_story_signal: number
          p_novelty_score: number
          p_popularity_score: number
        }
        Returns: string[]
      },
      get_daily_recommendations: {
        Args: {
          p_date?: string
        }
        Returns: {
          venue_id: string
          generated_rank: number
          recommendation_score: number
          recommendation_reasons: string[]
          name: string
          description: string | null
          tags: string[] | null
          images: string[] | null
          city: string | null
          rating: number | null
        }[]
      },
      get_stories_feed_page: {
        Args: {
          p_limit?: number
          p_cursor_score?: number | null
          p_cursor_created_at?: string | null
          p_cursor_id?: string | null
        }
        Returns: Json
      },
      get_venue_live_crowd: {
        Args: {
          p_venue_id: string
        }
        Returns: Json
      },
      record_venue_crowd_checkin: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_venue_id: string
        }
        Returns: Json
      },
      profile_local_date: {
        Args: {
          p_user_id: string
          p_at?: string
        }
        Returns: string
      },
      run_daily_recommendation_batch: {
        Args: {
          p_run_id: string
          p_date?: string
          p_batch_size?: number
          p_after_user_id?: string | null
        }
        Returns: {
          user_id: string
          inserted_count: number
          push_enqueued: boolean
        }[]
      },
      sync_profile_timezone: {
        Args: {
          p_timezone: string
        }
        Returns: undefined
      },
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      },
      search_business_cards_in_city: {
        Args: {
          p_category_id?: string | null
          p_category_name?: string | null
          p_city: string
          p_is_restaurant_table?: boolean
          p_limit?: number
          p_query?: string | null
        }
        Returns: {
          address: string | null
          blurhashes: string[] | null
          booking_price: number
          category_id: string | null
          city: string | null
          cuisine_types: string[] | null
          fts_matched: boolean
          id: string
          image: string | null
          images: string[] | null
          menu_items: string[] | null
          name: string
          price_tier: number | null
          rank: number
          rating: number
          tags: string[] | null
        }[]
      }
      search_business_cards_nearby: {
        Args: {
          p_category_id?: string | null
          p_category_name?: string | null
          p_city?: string | null
          p_is_restaurant_table?: boolean
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_query?: string | null
          p_radius_miles?: number
        }
        Returns: {
          address: string | null
          blurhashes: string[] | null
          booking_price: number
          category_id: string | null
          city: string | null
          cuisine_types: string[] | null
          distance_miles: number
          fts_matched: boolean
          id: string
          image: string | null
          images: string[] | null
          menu_items: string[] | null
          name: string
          price_tier: number | null
          rank: number
          rating: number
          tags: string[] | null
        }[]
      }
      search_by_vibe: {
        Args: {
          p_city: string
          p_limit?: number
          p_mood: string
          p_timeline: string
        }
        Returns: {
          booking_price: number
          description: string
          is_restaurant_table: boolean
          name: string
          venue_id: string
          vibe_score: number
        }[]
      }
      track_recommendation_event: {
        Args: {
          p_event: Json
        }
        Returns: undefined
      }
      admin_analytics_summary: {
        Args: {
          p_period_days?: number
        }
        Returns: Json
      }
      admin_whatsapp_bookings_list: {
        Args: {
          p_period_days?: number
          p_limit?: number
        }
        Returns: {
          id: string
          venue_name: string
          venue_address: string | null
          date_time: string
          persons: number | null
          customer_name: string | null
          customer_phone: string | null
          status: string
          wa_status_lines: Json
          wa_confirmable: boolean
          wa_confirmed_price: string | null
          wa_payment_link: string | null
          response_deadline_at: string | null
          response_timed_out_at: string | null
          created_at: string
        }[]
      }
    }
    Enums: {
      app_role: "buyer" | "partner" | "admin"
      booking_payment_status: "pending" | "paid"
      booking_status: "upcoming" | "completed" | "expired"
      business_card_type: "featured" | "recommended"
      cart_item_status: "created" | "paid" | "expired"
      shopping_item_type: "main" | "sauce" | "beverage"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["buyer", "partner", "admin"],
      booking_payment_status: ["pending", "paid"],
      booking_status: ["upcoming", "completed", "expired"],
      business_card_type: ["featured", "recommended"],
      cart_item_status: ["created", "paid", "expired"],
      shopping_item_type: ["main", "sauce", "beverage"],
    },
  },
} as const
