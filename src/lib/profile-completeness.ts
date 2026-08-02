import type { MemberProfile } from "./profile.functions";

export type ProfileFieldKey =
  | "display_name"
  | "phone"
  | "town"
  | "avatar_url"
  | "favourite_ride"
  | "featured_bio";

export const PROFILE_REQUIRED_FIELDS: ProfileFieldKey[] = [
  "display_name",
  "phone",
  "town",
  "avatar_url",
  "favourite_ride",
  "featured_bio",
];

export const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, { en: string; af: string }> = {
  display_name: { en: "your name", af: "jou naam" },
  phone: { en: "your phone number", af: "jou foonnommer" },
  town: { en: "your town", af: "jou dorp" },
  avatar_url: { en: "a profile photo", af: "'n profielfoto" },
  favourite_ride: { en: "your favourite ride", af: "jou gunsteling ryding" },
  featured_bio: { en: "a short bio", af: "'n kort storie oor jou" },
};

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function missingProfileFields(
  profile: Pick<
    MemberProfile,
    "display_name" | "phone" | "town" | "avatar_url" | "favourite_ride" | "featured_bio"
  > | null
    | undefined,
): ProfileFieldKey[] {
  if (!profile) return [];
  return PROFILE_REQUIRED_FIELDS.filter((key) => !filled(profile[key]));
}

export function profileCompletion(missing: ProfileFieldKey[]): number {
  const total = PROFILE_REQUIRED_FIELDS.length;
  return Math.round(((total - missing.length) / total) * 100);
}
