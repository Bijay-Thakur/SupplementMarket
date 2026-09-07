export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_featured: boolean
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      catalog_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          default_discount_percent: number | null
          file_sha256: string
          filename: string
          force_reprocess: boolean
          id: string
          inserted_rows: number
          invalid_rows: number
          skipped_rows: number
          source_brand_id: string | null
          started_at: string | null
          status: string
          total_rows: number
          unchanged_rows: number
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          default_discount_percent?: number | null
          file_sha256: string
          filename: string
          force_reprocess?: boolean
          id?: string
          inserted_rows?: number
          invalid_rows?: number
          skipped_rows?: number
          source_brand_id?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number
          unchanged_rows?: number
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          default_discount_percent?: number | null
          file_sha256?: string
          filename?: string
          force_reprocess?: boolean
          id?: string
          inserted_rows?: number
          invalid_rows?: number
          skipped_rows?: number
          source_brand_id?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number
          unchanged_rows?: number
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_batches_source_brand_id_fkey"
            columns: ["source_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_import_rows: {
        Row: {
          batch_id: string
          committed_product_id: string | null
          committed_variant_id: string | null
          created_at: string
          detected_action: string
          id: string
          normalized_data: Json
          raw_data: Json
          source_row_number: number
          validation_errors: Json
          validation_warnings: Json
        }
        Insert: {
          batch_id: string
          committed_product_id?: string | null
          committed_variant_id?: string | null
          created_at?: string
          detected_action: string
          id?: string
          normalized_data?: Json
          raw_data?: Json
          source_row_number: number
          validation_errors?: Json
          validation_warnings?: Json
        }
        Update: {
          batch_id?: string
          committed_product_id?: string | null
          committed_variant_id?: string | null
          created_at?: string
          detected_action?: string
          id?: string
          normalized_data?: Json
          raw_data?: Json
          source_row_number?: number
          validation_errors?: Json
          validation_warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_committed_product_id_fkey"
            columns: ["committed_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_committed_variant_id_fkey"
            columns: ["committed_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          product_id: string
          source_url: string | null
          storage_path: string
          usage_verified: boolean
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id: string
          source_url?: string | null
          storage_path: string
          usage_verified?: boolean
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id?: string
          source_url?: string | null
          storage_path?: string
          usage_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag: string
          tag_type: string
        }
        Insert: {
          product_id: string
          tag: string
          tag_type: string
        }
        Update: {
          product_id?: string
          tag?: string
          tag_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          availability: string
          cost_price_cents: number | null
          created_at: string
          display_order: number
          flavor: string | null
          form: string | null
          id: string
          is_active: boolean
          is_default: boolean
          label: string | null
          product_id: string
          regular_price_cents: number
          sale_ends_at: string | null
          sale_price_cents: number | null
          sale_starts_at: string | null
          size_unit: string | null
          size_value: number | null
          sku: string | null
          source_name: string | null
          source_row_hash: string | null
          strength_unit: string | null
          strength_value: number | null
          supplier_sku: string | null
          unit_count: number | null
          upc: string | null
          updated_at: string
        }
        Insert: {
          availability?: string
          cost_price_cents?: number | null
          created_at?: string
          display_order?: number
          flavor?: string | null
          form?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string | null
          product_id: string
          regular_price_cents: number
          sale_ends_at?: string | null
          sale_price_cents?: number | null
          sale_starts_at?: string | null
          size_unit?: string | null
          size_value?: number | null
          sku?: string | null
          source_name?: string | null
          source_row_hash?: string | null
          strength_unit?: string | null
          strength_value?: number | null
          supplier_sku?: string | null
          unit_count?: number | null
          upc?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string
          cost_price_cents?: number | null
          created_at?: string
          display_order?: number
          flavor?: string | null
          form?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string | null
          product_id?: string
          regular_price_cents?: number
          sale_ends_at?: string | null
          sale_price_cents?: number | null
          sale_starts_at?: string | null
          size_unit?: string | null
          size_value?: number | null
          sku?: string | null
          source_name?: string | null
          source_row_hash?: string | null
          strength_unit?: string | null
          strength_value?: number | null
          supplier_sku?: string | null
          unit_count?: number | null
          upc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category_id: string | null
          created_at: string
          data_source: string | null
          description: string | null
          id: string
          is_best_seller: boolean
          is_featured: boolean
          is_new: boolean
          last_verified_at: string | null
          name: string
          product_line: string | null
          search_aliases: string[]
          short_description: string | null
          slug: string
          source_url: string | null
          status: string
          suggested_use: string | null
          supplement_facts: Json | null
          updated_at: string
          warnings: string | null
        }
        Insert: {
          brand_id: string
          category_id?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          id?: string
          is_best_seller?: boolean
          is_featured?: boolean
          is_new?: boolean
          last_verified_at?: string | null
          name: string
          product_line?: string | null
          search_aliases?: string[]
          short_description?: string | null
          slug: string
          source_url?: string | null
          status?: string
          suggested_use?: string | null
          supplement_facts?: Json | null
          updated_at?: string
          warnings?: string | null
        }
        Update: {
          brand_id?: string
          category_id?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          id?: string
          is_best_seller?: boolean
          is_featured?: boolean
          is_new?: boolean
          last_verified_at?: string | null
          name?: string
          product_line?: string | null
          search_aliases?: string[]
          short_description?: string | null
          slug?: string
          source_url?: string | null
          status?: string
          suggested_use?: string | null
          supplement_facts?: Json | null
          updated_at?: string
          warnings?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "customer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["customer", "admin"],
    },
  },
} as const
