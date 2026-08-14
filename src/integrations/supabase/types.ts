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
      concours_questions: {
        Row: {
          active: boolean
          category: string
          category_af: string | null
          created_at: string
          id: string
          scoring_type: string
          sort_order: number
          text_af: string
          text_en: string
        }
        Insert: {
          active?: boolean
          category: string
          category_af?: string | null
          created_at?: string
          id?: string
          scoring_type: string
          sort_order?: number
          text_af: string
          text_en: string
        }
        Update: {
          active?: boolean
          category?: string
          category_af?: string | null
          created_at?: string
          id?: string
          scoring_type?: string
          sort_order?: number
          text_af?: string
          text_en?: string
        }
        Relationships: []
      }
      event_checkins: {
        Row: {
          checked_in_at: string
          distance_m: number
          event_id: string
          id: string
          is_spectator: boolean
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          distance_m: number
          event_id: string
          id?: string
          is_spectator?: boolean
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          checked_in_at?: string
          distance_m?: number
          event_id?: string
          id?: string
          is_spectator?: boolean
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_concours: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          leaderboard_revealed: boolean
          prize_af: string | null
          prize_en: string | null
          question_count: number
          results_on_home: boolean
          results_published_at: string | null
          selected_question_ids: string[]
          sponsor_logo_url: string | null
          sponsor_name: string | null
          updated_at: string
          winner_average_score: number | null
          winner_headline_af: string | null
          winner_headline_en: string | null
          winner_photo_url: string | null
          winner_submission_count: number | null
          winner_vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          leaderboard_revealed?: boolean
          prize_af?: string | null
          prize_en?: string | null
          question_count?: number
          results_on_home?: boolean
          results_published_at?: string | null
          selected_question_ids?: string[]
          sponsor_logo_url?: string | null
          sponsor_name?: string | null
          updated_at?: string
          winner_average_score?: number | null
          winner_headline_af?: string | null
          winner_headline_en?: string | null
          winner_photo_url?: string | null
          winner_submission_count?: number | null
          winner_vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          leaderboard_revealed?: boolean
          prize_af?: string | null
          prize_en?: string | null
          question_count?: number
          results_on_home?: boolean
          results_published_at?: string | null
          selected_question_ids?: string[]
          sponsor_logo_url?: string | null
          sponsor_name?: string | null
          updated_at?: string
          winner_average_score?: number | null
          winner_headline_af?: string | null
          winner_headline_en?: string | null
          winner_photo_url?: string | null
          winner_submission_count?: number | null
          winner_vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_concours_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_concours_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_concours_winner_vehicle_id_fkey"
            columns: ["winner_vehicle_id"]
            isOneToOne: false
            referencedRelation: "event_concours_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_concours_scores: {
        Row: {
          answers: Json
          event_id: string
          id: string
          is_member: boolean
          submitted_at: string
          total_score: number | null
          user_id: string | null
          vehicle_id: string
          voter_fingerprint: string | null
          weight: number
        }
        Insert: {
          answers?: Json
          event_id: string
          id?: string
          is_member?: boolean
          submitted_at?: string
          total_score?: number | null
          user_id?: string | null
          vehicle_id: string
          voter_fingerprint?: string | null
          weight?: number
        }
        Update: {
          answers?: Json
          event_id?: string
          id?: string
          is_member?: boolean
          submitted_at?: string
          total_score?: number | null
          user_id?: string | null
          vehicle_id?: string
          voter_fingerprint?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_concours_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_concours_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_concours_scores_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "event_concours_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_concours_vehicles: {
        Row: {
          added_by: string | null
          created_at: string
          event_id: string
          garage_vehicle_id: string | null
          id: string
          label: string | null
          label_af: string | null
          photo_url: string
          sort_order: number
          tagged_display_name: string | null
          tagged_member_number: number | null
          tagged_user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          event_id: string
          garage_vehicle_id?: string | null
          id?: string
          label?: string | null
          label_af?: string | null
          photo_url: string
          sort_order?: number
          tagged_display_name?: string | null
          tagged_member_number?: number | null
          tagged_user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          event_id?: string
          garage_vehicle_id?: string | null
          id?: string
          label?: string | null
          label_af?: string | null
          photo_url?: string
          sort_order?: number
          tagged_display_name?: string | null
          tagged_member_number?: number | null
          tagged_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_concours_vehicles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_concours_vehicles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_concours_vehicles_garage_vehicle_id_fkey"
            columns: ["garage_vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          responded_at: string | null
          response: string | null
          sent_at: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          responded_at?: string | null
          response?: string | null
          sent_at?: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          response?: string | null
          sent_at?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          party_size: number
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          party_size?: number
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          party_size?: number
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waypoints: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
          id: string
          label: string
          label_af: string | null
          lat: number | null
          lng: number | null
          meet_time: string | null
          place_id: string | null
          sort: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          id?: string
          label: string
          label_af?: string | null
          lat?: number | null
          lng?: number | null
          meet_time?: string | null
          place_id?: string | null
          sort?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          label_af?: string | null
          lat?: number | null
          lng?: number | null
          meet_time?: string | null
          place_id?: string | null
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waypoints_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_waypoints_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          description_af: string | null
          destination_address: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_place_id: string | null
          details_af_md: string | null
          details_md: string | null
          ends_at: string | null
          hero_image_url: string | null
          id: string
          invites_sent_at: string | null
          invites_sent_count: number
          is_published: boolean
          location: string | null
          starts_at: string
          title: string
          title_af: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_af?: string | null
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_place_id?: string | null
          details_af_md?: string | null
          details_md?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          invites_sent_at?: string | null
          invites_sent_count?: number
          is_published?: boolean
          location?: string | null
          starts_at: string
          title: string
          title_af?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_af?: string | null
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_place_id?: string | null
          details_af_md?: string | null
          details_md?: string | null
          ends_at?: string | null
          hero_image_url?: string | null
          id?: string
          invites_sent_at?: string | null
          invites_sent_count?: number
          is_published?: boolean
          location?: string | null
          starts_at?: string
          title?: string
          title_af?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          event_id: string | null
          id: string
          image_url: string
          is_published: boolean
          taken_at: string | null
          thumb_url: string | null
          title: string | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          image_url: string
          is_published?: boolean
          taken_at?: string | null
          thumb_url?: string | null
          title?: string | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          image_url?: string
          is_published?: boolean
          taken_at?: string | null
          thumb_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_counts"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "gallery_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_tag_invites: {
        Row: {
          created_at: string
          email: string
          gallery_item_id: string | null
          id: string
          invited_by: string
          note: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          gallery_item_id?: string | null
          id?: string
          invited_by: string
          note?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          gallery_item_id?: string | null
          id?: string
          invited_by?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_tag_invites_gallery_item_id_fkey"
            columns: ["gallery_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_items"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_tags: {
        Row: {
          created_at: string
          gallery_item_id: string
          id: string
          tagged_by: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          gallery_item_id: string
          id?: string
          tagged_by: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          gallery_item_id?: string
          id?: string
          tagged_by?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_tags_gallery_item_id_fkey"
            columns: ["gallery_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_items"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_vehicle_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort: number
          storage_path: string
          vehicle_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort?: number
          storage_path: string
          vehicle_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort?: number
          storage_path?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_vehicles: {
        Row: {
          acceleration: string | null
          brakes_front: string | null
          brakes_rear: string | null
          built_by: string | null
          car_size: string | null
          car_weight: string | null
          created_at: string
          diff_ratio: string | null
          engine: string | null
          extra_notes: string | null
          fuel_economy: string | null
          id: string
          is_primary: boolean
          make: string | null
          model: string | null
          nickname: string | null
          power: string | null
          quarter_mile: string | null
          sort: number
          story: string | null
          story_af: string | null
          suspension_front: string | null
          suspension_rear: string | null
          top_speed: string | null
          torque: string | null
          transmission: string | null
          updated_at: string
          user_id: string
          wheels_tyres: string | null
          year: number | null
        }
        Insert: {
          acceleration?: string | null
          brakes_front?: string | null
          brakes_rear?: string | null
          built_by?: string | null
          car_size?: string | null
          car_weight?: string | null
          created_at?: string
          diff_ratio?: string | null
          engine?: string | null
          extra_notes?: string | null
          fuel_economy?: string | null
          id?: string
          is_primary?: boolean
          make?: string | null
          model?: string | null
          nickname?: string | null
          power?: string | null
          quarter_mile?: string | null
          sort?: number
          story?: string | null
          story_af?: string | null
          suspension_front?: string | null
          suspension_rear?: string | null
          top_speed?: string | null
          torque?: string | null
          transmission?: string | null
          updated_at?: string
          user_id: string
          wheels_tyres?: string | null
          year?: number | null
        }
        Update: {
          acceleration?: string | null
          brakes_front?: string | null
          brakes_rear?: string | null
          built_by?: string | null
          car_size?: string | null
          car_weight?: string | null
          created_at?: string
          diff_ratio?: string | null
          engine?: string | null
          extra_notes?: string | null
          fuel_economy?: string | null
          id?: string
          is_primary?: boolean
          make?: string | null
          model?: string | null
          nickname?: string | null
          power?: string | null
          quarter_mile?: string | null
          sort?: number
          story?: string | null
          story_af?: string | null
          suspension_front?: string | null
          suspension_rear?: string | null
          top_speed?: string | null
          torque?: string | null
          transmission?: string | null
          updated_at?: string
          user_id?: string
          wheels_tyres?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_contacts: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          listing_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          listing_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          listing_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          condition: Database["public"]["Enums"]["listing_condition"]
          created_at: string
          description: string
          description_af: string | null
          id: string
          location: string | null
          price_zar: number | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          title_af: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["listing_category"]
          condition?: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description: string
          description_af?: string | null
          id?: string
          location?: string | null
          price_zar?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          title_af?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["listing_category"]
          condition?: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description?: string
          description_af?: string | null
          id?: string
          location?: string | null
          price_zar?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          title_af?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_emails: {
        Row: {
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merch_items: {
        Row: {
          available_from: string | null
          created_at: string
          description: string | null
          description_af: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_af: string | null
          price_zar: number | null
          sizes: string[]
          sort: number
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          available_from?: string | null
          created_at?: string
          description?: string | null
          description_af?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_af?: string | null
          price_zar?: number | null
          sizes?: string[]
          sort?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          available_from?: string | null
          created_at?: string
          description?: string | null
          description_af?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_af?: string | null
          price_zar?: number | null
          sizes?: string[]
          sort?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      newsletter_editions: {
        Row: {
          admin_notes: string | null
          body_af: string
          body_en: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          month: number
          pdf_path: string | null
          pdf_path_af: string | null
          published_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          title_af: string
          title_en: string
          updated_at: string
          year: number
        }
        Insert: {
          admin_notes?: string | null
          body_af?: string
          body_en?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          month: number
          pdf_path?: string | null
          pdf_path_af?: string | null
          published_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title_af?: string
          title_en?: string
          updated_at?: string
          year: number
        }
        Update: {
          admin_notes?: string | null
          body_af?: string
          body_en?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          month?: number
          pdf_path?: string | null
          pdf_path_af?: string | null
          published_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title_af?: string
          title_en?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          lang: string
          source: string | null
          subscribed_at: string
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          lang?: string
          source?: string | null
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          lang?: string
          source?: string | null
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          admin_listing_review: boolean
          admin_new_member: boolean
          admin_new_sponsor: boolean
          created_at: string
          new_event: boolean
          new_listing: boolean
          new_newsletter: boolean
          photo_tag: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_listing_review?: boolean
          admin_new_member?: boolean
          admin_new_sponsor?: boolean
          created_at?: string
          new_event?: boolean
          new_listing?: boolean
          new_newsletter?: boolean
          photo_tag?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_listing_review?: boolean
          admin_new_member?: boolean
          admin_new_sponsor?: boolean
          created_at?: string
          new_event?: boolean
          new_listing?: boolean
          new_newsletter?: boolean
          photo_tag?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body_af: string | null
          body_en: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          related_id: string | null
          title_af: string
          title_en: string
          type: string
          user_id: string
        }
        Insert: {
          body_af?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title_af: string
          title_en: string
          type: string
          user_id: string
        }
        Update: {
          body_af?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          title_af?: string
          title_en?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          directory_visible: boolean
          display_name: string | null
          favourite_ride: string | null
          featured_bio: string | null
          featured_photo_url: string | null
          featured_since: string | null
          id: string
          is_featured: boolean
          joined_at: string
          member_number: number
          membership_status: string
          phone: string | null
          preferred_lang: string | null
          town: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          directory_visible?: boolean
          display_name?: string | null
          favourite_ride?: string | null
          featured_bio?: string | null
          featured_photo_url?: string | null
          featured_since?: string | null
          id: string
          is_featured?: boolean
          joined_at?: string
          member_number?: number
          membership_status?: string
          phone?: string | null
          preferred_lang?: string | null
          town?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          directory_visible?: boolean
          display_name?: string | null
          favourite_ride?: string | null
          featured_bio?: string | null
          featured_photo_url?: string | null
          featured_since?: string | null
          id?: string
          is_featured?: boolean
          joined_at?: string
          member_number?: number
          membership_status?: string
          phone?: string | null
          preferred_lang?: string | null
          town?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      route_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          payload?: Json
        }
        Relationships: []
      }
      sponsor_applications: {
        Row: {
          business: string
          contact_name: string
          created_at: string
          created_sponsor_id: string | null
          email: string
          id: string
          message: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          business: string
          contact_name: string
          created_at?: string
          created_sponsor_id?: string | null
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          business?: string
          contact_name?: string
          created_at?: string
          created_sponsor_id?: string | null
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_applications_created_sponsor_id_fkey"
            columns: ["created_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          billing_ends_at: string | null
          billing_starts_at: string | null
          created_at: string
          expiry_notified_at: string | null
          id: string
          is_active: boolean
          logo_path: string
          name: string
          owner_user_id: string | null
          sort: number
          tagline: string | null
          tagline_af: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          billing_ends_at?: string | null
          billing_starts_at?: string | null
          created_at?: string
          expiry_notified_at?: string | null
          id?: string
          is_active?: boolean
          logo_path: string
          name: string
          owner_user_id?: string | null
          sort?: number
          tagline?: string | null
          tagline_af?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          billing_ends_at?: string | null
          billing_starts_at?: string | null
          created_at?: string
          expiry_notified_at?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string
          name?: string
          owner_user_id?: string | null
          sort?: number
          tagline?: string | null
          tagline_af?: string | null
          updated_at?: string
          website_url?: string | null
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
    }
    Views: {
      event_rsvp_counts: {
        Row: {
          event_id: string | null
          going_count: number | null
          going_party_total: number | null
          maybe_count: number | null
          not_going_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      daily_featured_id: { Args: never; Returns: string }
      event_attendees: {
        Args: { _event_id: string }
        Returns: {
          party_size: number
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }[]
      }
      member_upcoming_events: {
        Args: { _user_id: string }
        Returns: {
          event_id: string
          starts_at: string
          status: Database["public"]["Enums"]["rsvp_status"]
          title: string
        }[]
      }
      fanout_notification: {
        Args: {
          _body_af?: string
          _body_en?: string
          _exclude?: string
          _link?: string
          _related_id?: string
          _title_af: string
          _title_en: string
          _type: string
        }
        Returns: number
      }
      featured_member_card: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          favourite_ride: string
          featured_bio: string
          featured_photo_url: string
          featured_since: string
          id: string
          member_number: number
          town: string
        }[]
      }
      grant_admin_if_allowlisted: {
        Args: { _confirmed_at: string; _email: string; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hidden_directory_ids: { Args: never; Returns: string[] }
      is_featured_user: { Args: { _id: string }; Returns: boolean }
      newsletter_subscribe: {
        Args: { _email: string; _lang?: string; _source?: string }
        Returns: string
      }
      newsletter_unsubscribe: { Args: { _token: string }; Returns: string }
      notify_user: {
        Args: {
          _body_af?: string
          _body_en?: string
          _link?: string
          _related_id?: string
          _title_af: string
          _title_en: string
          _type: string
          _user_id: string
        }
        Returns: number
      }
      route_cache_put: {
        Args: { _key: string; _payload: Json }
        Returns: undefined
      }
      rsvp_via_invite: {
        Args: { _response: string; _token: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "member"
      listing_category: "parts" | "cars" | "memorabilia" | "other"
      listing_condition: "new" | "used" | "project"
      listing_status: "pending" | "approved" | "rejected" | "sold"
      rsvp_status: "going" | "maybe" | "not_going"
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
      app_role: ["admin", "member"],
      listing_category: ["parts", "cars", "memorabilia", "other"],
      listing_condition: ["new", "used", "project"],
      listing_status: ["pending", "approved", "rejected", "sold"],
      rsvp_status: ["going", "maybe", "not_going"],
    },
  },
} as const
