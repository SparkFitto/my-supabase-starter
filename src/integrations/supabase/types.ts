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
      card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_deck_likes: {
        Row: {
          created_at: string
          deck_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_deck_likes_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "card_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      card_decks: {
        Row: {
          card_ids: string[]
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          is_trade_deck: boolean
          likes: number
          name: string
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          card_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_trade_deck?: boolean
          likes?: number
          name: string
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          card_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_trade_deck?: boolean
          likes?: number
          name?: string
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: []
      }
      card_image_suggestions: {
        Row: {
          card_id: string
          created_at: string
          id: string
          image_url: string
          reason: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          image_url: string
          reason?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          image_url?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_image_suggestions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_lots: {
        Row: {
          card_id: string
          created_at: string
          id: string
          price_amount: number
          price_rank: string
          seller_id: string
          status: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          price_amount: number
          price_rank: string
          seller_id: string
          status?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          price_amount?: number
          price_rank?: string
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_lots_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_operations: {
        Row: {
          created_at: string
          id: string
          ink_spent: number
          input_card_ids: string[]
          output_card_id: string | null
          result: string | null
          shards_spent: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ink_spent?: number
          input_card_ids?: string[]
          output_card_id?: string | null
          result?: string | null
          shards_spent?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ink_spent?: number
          input_card_ids?: string[]
          output_card_id?: string | null
          result?: string | null
          shards_spent?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_operations_output_card_id_fkey"
            columns: ["output_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_requests: {
        Row: {
          buyer_id: string
          card_id: string
          created_at: string
          id: string
          offer_amount: number
          offer_rank: string
          status: string
        }
        Insert: {
          buyer_id: string
          card_id: string
          created_at?: string
          id?: string
          offer_amount: number
          offer_rank: string
          status?: string
        }
        Update: {
          buyer_id?: string
          card_id?: string
          created_at?: string
          id?: string
          offer_amount?: number
          offer_rank?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_trades: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_cards: Json
          receiver_id: string
          seen_at: string | null
          sender_cards: Json
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_cards?: Json
          receiver_id: string
          seen_at?: string | null
          sender_cards?: Json
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_cards?: Json
          receiver_id?: string
          seen_at?: string | null
          sender_cards?: Json
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_wishlist: {
        Row: {
          added_at: string
          card_id: string
          type: string
          user_id: string
        }
        Insert: {
          added_at?: string
          card_id: string
          type?: string
          user_id: string
        }
        Update: {
          added_at?: string
          card_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_wishlist_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          character_name: string
          created_at: string
          event_type: string | null
          id: string
          image_url: string
          is_animated: boolean
          is_approved: boolean
          is_limited: boolean
          name: string
          rank: string
          series_id: string | null
          submitted_by: string | null
          tags: string[]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          character_name: string
          created_at?: string
          event_type?: string | null
          id?: string
          image_url: string
          is_animated?: boolean
          is_approved?: boolean
          is_limited?: boolean
          name: string
          rank: string
          series_id?: string | null
          submitted_by?: string | null
          tags?: string[]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          character_name?: string
          created_at?: string
          event_type?: string | null
          id?: string
          image_url?: string
          is_animated?: boolean
          is_approved?: boolean
          is_limited?: boolean
          name?: string
          rank?: string
          series_id?: string | null
          submitted_by?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cards_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_number: string
          content: string | null
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
          content?: string | null
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
          content?: string | null
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
      daily_ink_log: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          id?: string
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          source?: string
          user_id?: string
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
      pack_openings: {
        Row: {
          card_chosen: string | null
          cards_shown: string[]
          id: string
          ink_spent: number
          opened_at: string
          user_id: string
        }
        Insert: {
          card_chosen?: string | null
          cards_shown?: string[]
          id?: string
          ink_spent?: number
          opened_at?: string
          user_id: string
        }
        Update: {
          card_chosen?: string | null
          cards_shown?: string[]
          id?: string
          ink_spent?: number
          opened_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_openings_card_chosen_fkey"
            columns: ["card_chosen"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
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
      reading_card_drops: {
        Row: {
          card_id: string
          dropped_at: string
          id: string
          series_id: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          dropped_at?: string
          id?: string
          series_id?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          dropped_at?: string
          id?: string
          series_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_card_drops_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_card_drops_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
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
      showcase_cards: {
        Row: {
          position: number
          user_card_id: string | null
          user_id: string
        }
        Insert: {
          position: number
          user_card_id?: string | null
          user_id: string
        }
        Update: {
          position?: number
          user_card_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_cards_user_card_id_fkey"
            columns: ["user_card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
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
      user_cards: {
        Row: {
          acquired_at: string
          card_id: string
          frame_level: number
          id: string
          is_blocked: boolean
          is_trade_ready: boolean
          quantity: number
          user_id: string
        }
        Insert: {
          acquired_at?: string
          card_id: string
          frame_level?: number
          id?: string
          is_blocked?: boolean
          is_trade_ready?: boolean
          quantity?: number
          user_id: string
        }
        Update: {
          acquired_at?: string
          card_id?: string
          frame_level?: number
          id?: string
          is_blocked?: boolean
          is_trade_ready?: boolean
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
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
          daily_ink_claimed_at: string | null
          downvotes_reset_at: string
          friends_are_private: boolean
          history_is_private: boolean
          id: string
          ink_balance: number
          last_login_date: string | null
          last_seen: string | null
          login_streak: number
          notify_on_release: boolean
          pack_counter: number
          paddle_customer_id: string | null
          pages_balance: number
          plan: string
          preferred_reading_mode: string | null
          preferred_target_language: string | null
          reading_is_private: boolean
          s_pity_counter: number
          shard_balance: Json
          username: string | null
          weekly_chapters_used: number
          weekly_reset_at: string
          x_pity_counter: number
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
          daily_ink_claimed_at?: string | null
          downvotes_reset_at?: string
          friends_are_private?: boolean
          history_is_private?: boolean
          id: string
          ink_balance?: number
          last_login_date?: string | null
          last_seen?: string | null
          login_streak?: number
          notify_on_release?: boolean
          pack_counter?: number
          paddle_customer_id?: string | null
          pages_balance?: number
          plan?: string
          preferred_reading_mode?: string | null
          preferred_target_language?: string | null
          reading_is_private?: boolean
          s_pity_counter?: number
          shard_balance?: Json
          username?: string | null
          weekly_chapters_used?: number
          weekly_reset_at?: string
          x_pity_counter?: number
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
          daily_ink_claimed_at?: string | null
          downvotes_reset_at?: string
          friends_are_private?: boolean
          history_is_private?: boolean
          id?: string
          ink_balance?: number
          last_login_date?: string | null
          last_seen?: string | null
          login_streak?: number
          notify_on_release?: boolean
          pack_counter?: number
          paddle_customer_id?: string | null
          pages_balance?: number
          plan?: string
          preferred_reading_mode?: string | null
          preferred_target_language?: string | null
          reading_is_private?: boolean
          s_pity_counter?: number
          shard_balance?: Json
          username?: string | null
          weekly_chapters_used?: number
          weekly_reset_at?: string
          x_pity_counter?: number
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
      accept_trade: { Args: { _trade_id: string }; Returns: undefined }
      award_ink: { Args: { _amount: number; _source: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      open_pack: {
        Args: never
        Returns: {
          card_ids: string[]
          opening_id: string
        }[]
      }
      open_pack_10: {
        Args: never
        Returns: {
          columns: Json
          opening_ids: string[]
        }[]
      }
      pack_select_card: {
        Args: { _card_id: string; _opening_id: string }
        Returns: undefined
      }
      recent_pack_picks: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          card_id: string
          character_name: string
          image_url: string
          opened_at: string
          opening_id: string
          rank: string
          username: string
        }[]
      }
      smelt_cards: {
        Args: { _user_card_ids: string[] }
        Returns: {
          output_card_id: string
          output_rank: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "pro"
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
      app_role: ["admin", "moderator", "user", "pro"],
    },
  },
} as const
