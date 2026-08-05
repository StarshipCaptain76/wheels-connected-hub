/**
 * Server-only client picker.
 *
 * Lovable Cloud injects SUPABASE_SERVICE_ROLE_KEY, but self-hosted deploys
 * (e.g. Vercel) may not have it. Every privileged read/write therefore has a
 * fallback: the signed-in user's client (RLS admin policies) or the anon
 * publishable client, plus SECURITY DEFINER RPCs for the few operations RLS
 * cannot express.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export function hasServiceRole(): boolean {
  return Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY'] && process.env['SUPABASE_URL']);
}

/** Service-role client when configured, otherwise `fallback` (or the anon client). */
export async function elevated(fallback?: AnyClient): Promise<AnyClient> {
  if (hasServiceRole()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return supabaseAdmin as AnyClient;
    } catch (e) {
      console.warn("[elevated] service role unavailable, falling back", e);
    }
  }
  if (fallback) return fallback;
  const { createPublicSupabase } = await import("./public-supabase.server");
  return createPublicSupabase() as AnyClient;
}
