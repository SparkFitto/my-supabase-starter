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
  public: {
    Tables: {
      chapters: {
        Row: {
          chapter_number: string
          created_at: string
          id: string
          mangadex_chapter_id: string | null
          raw_download_url: string | null
          release_date: string | null
          series_id: string
          volume_number: string | null
        }
        Insert: {
          chapter_number: string
          created_at?: string
          id?: string
          mangadex_chapter_id?: string | null
          raw_download_url?: string | null
          release_date?: string | null
          series_id: string
          volume_number?: string | null
        }
        Update: {
          chapter_number?: string
          created_at?: string
          id?: string
          mangadex_chapter_id?: string | null
          raw_download_url?: string | null
          release_date?: string | null
          series_id?: string
          volume_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_votes: {
        Row: {
          comment_id: string
          comment_type: string
          created_at: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          comment_id: string
          comment_type: string
          created_at?: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          comment_id?: string
          comment_type?: string
          created_at?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          added_at: string
          notify_on_release: boolean
          series_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          notify_on_release?: boolean
          series_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          notify_on_release?: boolean
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          is_highlighted: boolean
          requester_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          is_highlighted?: boolean
          requester_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          is_highlighted?: boolean
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          chapter_id: string | null
          created_at: string
          current_step: string
          device_id: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          progress: number
          raw_file_url: string | null
          result_translation_id: string | null
          source_language: string | null
          status: string
          target_language: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          current_step?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          progress?: number
          raw_file_url?: string | null
          result_translation_id?: string | null
          source_language?: string | null
          status?: string
          target_language: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          current_step?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          progress?: number
          raw_file_url?: string | null
          result_translation_id?: string | null
          source_language?: string | null
          status?: string
          target_language?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_result_translation_id_fkey"
            columns: ["result_translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_comments: {
        Row: {
          author_user_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          profile_user_id: string
        }
        Insert: {
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          profile_user_id: string
        }
        Update: {
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          profile_user_id?: string
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          chapter_number: string | null
          id: string
          read_at: string
          series_id: string
          translation_id: string | null
          user_id: string
        }
        Insert: {
          chapter_number?: string | null
          id?: string
          read_at?: string
          series_id: string
          translation_id?: string | null
          user_id: string
        }
        Update: {
          chapter_number?: string | null
          id?: string
          read_at?: string
          series_id?: string
          translation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_lists: {
        Row: {
          added_at: string
          current_chapter: string | null
          id: string
          is_private: boolean
          series_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          current_chapter?: string | null
          id?: string
          is_private?: boolean
          series_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          current_chapter?: string | null
          id?: string
          is_private?: boolean
          series_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_lists_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          comment_id: string
          comment_type: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          comment_id: string
          comment_type: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          comment_id?: string
          comment_type?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: []
      }
      series: {
        Row: {
          age_rating: string | null
          alt_titles: string[] | null
          cover_url: string | null
          created_at: string
          description: string | null
          dmca_struck: boolean
          follow_count: number
          genres: string[] | null
          id: string
          mangadex_id: string | null
          rating: number | null
          release_year: number | null
          slug: string
          source_language: string
          status: string
          tags: string[] | null
          title: string
          type: string
        }
        Insert: {
          age_rating?: string | null
          alt_titles?: string[] | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          dmca_struck?: boolean
          follow_count?: number
          genres?: string[] | null
          id?: string
          mangadex_id?: string | null
          rating?: number | null
          release_year?: number | null
          slug: string
          source_language: string
          status?: string
          tags?: string[] | null
          title: string
          type?: string
        }
        Update: {
          age_rating?: string | null
          alt_titles?: string[] | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          dmca_struck?: boolean
          follow_count?: number
          genres?: string[] | null
          id?: string
          mangadex_id?: string | null
          rating?: number | null
          release_year?: number | null
          slug?: string
          source_language?: string
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      series_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          parent_id: string | null
          series_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          parent_id?: string | null
          series_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          parent_id?: string | null
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "series_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_comments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_glossary: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          original_term: string
          series_id: string
          suggested_by: string | null
          target_language: string
          translated_term: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          original_term: string
          series_id: string
          suggested_by?: string | null
          target_language: string
          translated_term: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          original_term?: string
          series_id?: string
          suggested_by?: string | null
          target_language?: string
          translated_term?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_glossary_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      site_updates: {
        Row: {
          body: string
          created_by: string | null
          id: string
          published_at: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_by?: string | null
          id?: string
          published_at?: string
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          image_urls: string[] | null
          page_count: number
          published: boolean
          read_count: number
          status: string
          target_language: string
          translated_by: string | null
          translator_username: string | null
          upvotes: number
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          page_count?: number
          published?: boolean
          read_count?: number
          status?: string
          target_language: string
          translated_by?: string | null
          translator_username?: string | null
          upvotes?: number
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          page_count?: number
          published?: boolean
          read_count?: number
          status?: string
          target_language?: string
          translated_by?: string | null
          translator_username?: string | null
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "translations_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          banned_at: string | null
          banner_url: string | null
          bio: string | null
          chapters_translated_total: number
          country: string | null
          created_at: string
          daily_downvotes_used: number
          downvotes_reset_at: string
          friends_are_private: boolean
          history_is_private: boolean
          id: string
          last_login_date: string | null
          last_seen: string | null
          login_streak: number
          notify_on_release: boolean
          paddle_customer_id: string | null
          plan: string
          preferred_reading_mode: string | null
          preferred_target_language: string | null
          reading_is_private: boolean
          username: string | null
          weekly_chapters_used: number
          weekly_reset_at: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          chapters_translated_total?: number
          country?: string | null
          created_at?: string
          daily_downvotes_used?: number
          downvotes_reset_at?: string
          friends_are_private?: boolean
          history_is_private?: boolean
          id: string
          last_login_date?: string | null
          last_seen?: string | null
          login_streak?: number
          notify_on_release?: boolean
          paddle_customer_id?: string | null
          plan?: string
          preferred_reading_mode?: string | null
          preferred_target_language?: string | null
          reading_is_private?: boolean
          username?: string | null
          weekly_chapters_used?: number
          weekly_reset_at?: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          chapters_translated_total?: number
          country?: string | null
          created_at?: string
          daily_downvotes_used?: number
          downvotes_reset_at?: string
          friends_are_private?: boolean
          history_is_private?: boolean
          id?: string
          last_login_date?: string | null
          last_seen?: string | null
          login_streak?: number
          notify_on_release?: boolean
          paddle_customer_id?: string | null
          plan?: string
          preferred_reading_mode?: string | null
          preferred_target_language?: string | null
          reading_is_private?: boolean
          username?: string | null
          weekly_chapters_used?: number
          weekly_reset_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
