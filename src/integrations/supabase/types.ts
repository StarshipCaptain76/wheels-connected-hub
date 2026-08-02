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
            referencedRelation: "featured_garage_vehicles_public"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "featured_member_public"
            referencedColumns: ["id"]
          },
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
      merch_items: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
      featured_garage_photos_public: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string | null
          sort: number | null
          storage_path: string | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "featured_garage_vehicles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_garage_vehicles_public: {
        Row: {
          acceleration: string | null
          brakes_front: string | null
          brakes_rear: string | null
          built_by: string | null
          car_size: string | null
          car_weight: string | null
          created_at: string | null
          diff_ratio: string | null
          engine: string | null
          extra_notes: string | null
          fuel_economy: string | null
          id: string | null
          is_primary: boolean | null
          make: string | null
          model: string | null
          nickname: string | null
          power: string | null
          quarter_mile: string | null
          sort: number | null
          story: string | null
          story_af: string | null
          suspension_front: string | null
          suspension_rear: string | null
          top_speed: string | null
          torque: string | null
          transmission: string | null
          updated_at: string | null
          user_id: string | null
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
          created_at?: string | null
          diff_ratio?: string | null
          engine?: string | null
          extra_notes?: string | null
          fuel_economy?: string | null
          id?: string | null
          is_primary?: boolean | null
          make?: string | null
          model?: string | null
          nickname?: string | null
          power?: string | null
          quarter_mile?: string | null
          sort?: number | null
          story?: string | null
          story_af?: string | null
          suspension_front?: string | null
          suspension_rear?: string | null
          top_speed?: string | null
          torque?: string | null
          transmission?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          created_at?: string | null
          diff_ratio?: string | null
          engine?: string | null
          extra_notes?: string | null
          fuel_economy?: string | null
          id?: string | null
          is_primary?: boolean | null
          make?: string | null
          model?: string | null
          nickname?: string | null
          power?: string | null
          quarter_mile?: string | null
          sort?: number | null
          story?: string | null
          story_af?: string | null
          suspension_front?: string | null
          suspension_rear?: string | null
          top_speed?: string | null
          torque?: string | null
          transmission?: string | null
          updated_at?: string | null
          user_id?: string | null
          wheels_tyres?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "featured_member_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_member_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          featured_bio: string | null
          id: string | null
          member_number: number | null
          town: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          featured_bio?: string | null
          id?: string | null
          member_number?: number | null
          town?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          featured_bio?: string | null
          id?: string | null
          member_number?: number | null
          town?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      daily_featured_id: { Args: never; Returns: string }
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
      is_featured_user: { Args: { _id: string }; Returns: boolean }
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
