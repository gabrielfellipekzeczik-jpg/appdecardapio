// api/_lib/supabaseAdmin.js — helper compartilhado entre funções serverless
// Cria um cliente Supabase com service_role (acesso admin total, sem RLS).
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "marmitaria" },
  });
}
