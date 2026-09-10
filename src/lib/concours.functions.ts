import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConcoursWindowOpen } from "@/lib/concours-window";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConcoursQuestion = {
  id: string;
  category: string;
  category_af: string | null;
  text_en: string;
  text_af: string;
  scoring_type: "scale_1_10" | "yes_no" | "yes_no_na" | "count";
  sort_order: number;
  active?: boolean;
};

export type EventConcours = {
  event_id: string;
  enabled: boolean;
  question_count: number;
  selected_question_ids: string[];
  prize_en: string | null;
  prize_af: string | null;
  sponsor_name: string | null;
  sponsor_logo_url: string | null;
  leaderboard_revealed: boolean;
  winner_vehicle_id?: string | null;
  winner_photo_url?: string | null;
  winner_headline_en?: string | null;
  winner_headline_af?: string | null;
  winner_blurb_en?: string | null;
  winner_blurb_af?: string | null;

  winner_average_score?: number | null;
  winner_submission_count?: number | null;
  results_on_home?: boolean;
  results_published_at?: string | null;
  idle_test_enabled?: boolean;
  idle_test_revealed?: boolean;
  idle_rr_standard_smooth01?: number | null;
  idle_rr_standard_vehicle_id?: string | null;
  idle_prize_en?: string | null;
  idle_prize_af?: string | null;
};

export type ConcoursVehicle = {
  id: string;
  event_id: string;
  label: string | null;
  label_af: string | null;
  photo_url: string;
  sort_order: number;
  tagged_user_id?: string | null;
  tagged_member_number?: number | null;
  tagged_display_name?: string | null;
  garage_vehicle_id?: string | null;
  garage_label?: string | null;
  average_score?: number | null;
  submission_count?: number;
  vehicle_year?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  powertrain?: string | null;
};
