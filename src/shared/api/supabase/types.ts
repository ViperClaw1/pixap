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
          address: string | null
          booking_price: number
          category_id: string | null
          city: string | null
          contact_whatsapp: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          latitude: number | null
          location: unknown | null
          longitude: number | null
          name: string
          phone: string
          rating: number
          tags: string[] | null
          type: Database["public"]["Enums"]["business_card_type"]
        }
        Insert: {
          address?: string | null
          booking_price?: number
          category_id?: string | null
          city?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string
          rating?: number
          tags?: string[] | null
          type?: Database["public"]["Enums"]["business_card_type"]
        }
        Update: {
          address?: string | null
          booking_price?: number
          category_id?: string | null
          city?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string
          rating?: number
          tags?: string[] | null
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      user_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
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
      get_bookings_datetimes_for_availability: {
        Args: {
          p_business_id: string
          p_end: string
          p_start: string
        }
        Returns: string[]
      },
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      },
      search_business_cards_nearby: {
        Args: {
          p_category_id?: string | null
          p_city?: string | null
          p_is_restaurant_table?: boolean
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_miles?: number
        }
        Returns: {
          address: string | null
          booking_price: number
          category_id: string | null
          city: string | null
          distance_miles: number
          id: string
          name: string
          rating: number
          tags: string[] | null
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
