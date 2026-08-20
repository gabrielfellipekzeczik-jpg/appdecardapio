import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured — admin login is disabled until they are set.");
}

// Falls back to a syntactically valid placeholder so `createClient` doesn't
// throw and crash the whole app (the public menu/checkout must keep working
// even before Supabase is configured). Auth calls will simply fail at request time.
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-anon-key");
