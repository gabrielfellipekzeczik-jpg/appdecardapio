import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("[Supabase] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de iniciar o frontend.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
