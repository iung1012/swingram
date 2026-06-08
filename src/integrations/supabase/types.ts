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
      age_consent_records: {
        Row: {
          attestation_text: string
          attestation_version: string
          created_at: string
          id: string
          ip: string | null
          post_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attestation_text: string
          attestation_version?: string
          created_at?: string
          id?: string
          ip?: string | null
          post_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attestation_text?: string
          attestation_version?: string
          created_at?: string
          id?: string
          ip?: string | null
          post_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_consent_records_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      album_access: {
        Row: {
          album_id: string
          granted_at: string
          viewer_id: string
        }
        Insert: {
          album_id: string
          granted_at?: string
          viewer_id: string
        }
        Update: {
          album_id?: string
          granted_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_access_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "private_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          ip: string | null
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link: string | null
          order: number
          position: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          link?: string | null
          order?: number
          position?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string | null
          order?: number
          position?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_hashes: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          hash: string
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          hash: string
          reason: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          hash?: string
          reason?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          unlocked: boolean
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          unlocked?: boolean
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          unlocked?: boolean
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      couple_links: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["couple_status"]
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["couple_status"]
          user_a_id: string
          user_b_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["couple_status"]
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      interests_sent: {
        Row: {
          created_at: string
          from_user: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["interest_status"]
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          to_user?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["message_status"]
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
      moderation_queue: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["mod_item_type"]
          priority: number
          status: Database["public"]["Enums"]["moderation_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["mod_item_type"]
          priority?: number
          status?: Database["public"]["Enums"]["moderation_status"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["mod_item_type"]
          priority?: number
          status?: Database["public"]["Enums"]["moderation_status"]
        }
        Relationships: []
      }
      post_media: {
        Row: {
          ai_labels: Json | null
          created_at: string
          height: number | null
          id: string
          kind: string
          order: number
          post_id: string
          url: string
          width: number | null
        }
        Insert: {
          ai_labels?: Json | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          order?: number
          post_id: string
          url: string
          width?: number | null
        }
        Update: {
          ai_labels?: Json | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          order?: number
          post_id?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          deleted_at: string | null
          hashtags: string[]
          id: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          nsfw: boolean
          rejection_reason: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          hashtags?: string[]
          id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          nsfw?: boolean
          rejection_reason?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          hashtags?: string[]
          id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          nsfw?: boolean
          rejection_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      private_albums: {
        Row: {
          id: string
          name: string
          owner_id: string
          unlock_mode: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          unlock_mode?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          unlock_mode?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          banner_url: string | null
          bio: string | null
          birth_date: string
          city: string | null
          created_at: string
          display_name: string
          gender_seeking: string[]
          handle: string
          interests: string[]
          invisible_mode: boolean
          last_seen_at: string
          lat_snap: number | null
          lng_snap: number | null
          nsfw_blur_default: boolean
          onboarding_complete: boolean
          profile_type: Database["public"]["Enums"]["profile_type"]
          shadow_banned: boolean
          share_location: boolean
          terms_accepted_at: string | null
          terms_version: string | null
          trust_score: number
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          banner_url?: string | null
          bio?: string | null
          birth_date: string
          city?: string | null
          created_at?: string
          display_name: string
          gender_seeking?: string[]
          handle: string
          interests?: string[]
          invisible_mode?: boolean
          last_seen_at?: string
          lat_snap?: number | null
          lng_snap?: number | null
          nsfw_blur_default?: boolean
          onboarding_complete?: boolean
          profile_type?: Database["public"]["Enums"]["profile_type"]
          shadow_banned?: boolean
          share_location?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          trust_score?: number
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          banner_url?: string | null
          bio?: string | null
          birth_date?: string
          city?: string | null
          created_at?: string
          display_name?: string
          gender_seeking?: string[]
          handle?: string
          interests?: string[]
          invisible_mode?: boolean
          last_seen_at?: string
          lat_snap?: number | null
          lng_snap?: number | null
          nsfw_blur_default?: boolean
          onboarding_complete?: boolean
          profile_type?: Database["public"]["Enums"]["profile_type"]
          shadow_banned?: boolean
          share_location?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      proximity_pings: {
        Row: {
          created_at: string
          id: string
          other_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          other_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          other_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          priority: number
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: number
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: number
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: []
      }
      safety_checkins: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          location: string | null
          meeting_with_id: string | null
          trusted_contact: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          location?: string | null
          meeting_with_id?: string | null
          trusted_contact?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          location?: string | null
          meeting_with_id?: string | null
          trusted_contact?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          media_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          id: string
          plan: string
          processor_ref: string | null
          renews_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          plan: string
          processor_ref?: string | null
          renews_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          plan?: string
          processor_ref?: string | null
          renews_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          processor: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          processor?: string | null
          status: string
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          processor?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_2fa: {
        Row: {
          backup_codes: string[]
          enabled: boolean
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[]
          enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[]
          enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      verification_requests: {
        Row: {
          created_at: string
          doc_back_path: string | null
          doc_front_path: string
          id: string
          notes: string | null
          retention_expires_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["verification_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_back_path?: string | null
          doc_front_path: string
          id?: string
          notes?: string | null
          retention_expires_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path: string
          status?: Database["public"]["Enums"]["verification_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          doc_back_path?: string | null
          doc_front_path?: string
          id?: string
          notes?: string | null
          retention_expires_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string
          status?: Database["public"]["Enums"]["verification_status"]
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "support" | "user"
      couple_status: "pending" | "active" | "dissolved"
      interest_status: "pending" | "accepted" | "rejected"
      message_status: "sent" | "moderated" | "removed"
      mod_item_type: "post" | "comment" | "message" | "verification"
      moderation_status: "pending" | "approved" | "rejected"
      profile_type:
        | "single_m"
        | "single_f"
        | "single_nb"
        | "couple_mm"
        | "couple_ff"
        | "couple_mf"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target: "user" | "post" | "comment" | "message" | "chat"
      verification_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "moderator", "support", "user"],
      couple_status: ["pending", "active", "dissolved"],
      interest_status: ["pending", "accepted", "rejected"],
      message_status: ["sent", "moderated", "removed"],
      mod_item_type: ["post", "comment", "message", "verification"],
      moderation_status: ["pending", "approved", "rejected"],
      profile_type: [
        "single_m",
        "single_f",
        "single_nb",
        "couple_mm",
        "couple_ff",
        "couple_mf",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target: ["user", "post", "comment", "message", "chat"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
