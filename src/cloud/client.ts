import { createClient } from "@supabase/supabase-js";
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
export const redirectURL = () => window.location.origin + "/";
export function checked<
  R extends { data: unknown; error: { message: string } | null },
>(result: R): NonNullable<R["data"]> {
  if (result.error) throw Error(result.error.message);
  return result.data as NonNullable<R["data"]>;
}
