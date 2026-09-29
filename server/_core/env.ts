export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  // Getter (not a frozen value) so tests can set OWNER_EMAIL per-case without module reload tricks.
  get ownerEmail() { return (process.env.OWNER_EMAIL ?? "").toLowerCase(); },

  integrationsEncryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "",

  // Platform-level Mercado Pago OAuth application (one app registered by the
  // platform owner). Each company connects *their own* seller account through
  // it; the platform fee is retained automatically via `application_fee`.
  mpClientId: process.env.MP_CLIENT_ID ?? "",
  mpClientSecret: process.env.MP_CLIENT_SECRET ?? "",
  mpRedirectUri: process.env.MP_REDIRECT_URI ?? "",
  get platformFeePercent() { return Number(process.env.PLATFORM_FEE_PERCENT ?? "5"); },

  // Delivery provider credentials (Uber Direct, Lalamove) are per-company —
  // see `server/db.ts` `getIntegrationCredentials`, not env vars.
};

export function assertRuntimeEnv(): void {
  if (process.env.NODE_ENV === "test") return;
  const missing: string[] = [];
  if (!(ENV.supabaseUrl || process.env.VITE_SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!ENV.supabaseJwtSecret) missing.push("SUPABASE_JWT_SECRET");
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.VITE_SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Configuração incompleta. Defina no ambiente: ${missing.join(", ")}. Consulte SETUP.md.`);
  }
}
