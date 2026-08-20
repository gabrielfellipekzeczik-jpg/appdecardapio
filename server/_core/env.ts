export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  // Getter (not a frozen value) so tests can set OWNER_EMAIL per-case without module reload tricks.
  get ownerEmail() { return (process.env.OWNER_EMAIL ?? "").toLowerCase(); },

  integrationsEncryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "",

  mpClientId: process.env.MP_CLIENT_ID ?? "",
  mpClientSecret: process.env.MP_CLIENT_SECRET ?? "",
  mpRedirectUri: process.env.MP_REDIRECT_URI ?? "",

  uberDirectClientId: process.env.UBER_DIRECT_CLIENT_ID ?? "",
  uberDirectClientSecret: process.env.UBER_DIRECT_CLIENT_SECRET ?? "",
  uberDirectCustomerId: process.env.UBER_DIRECT_CUSTOMER_ID ?? "",
  pickupAddress: process.env.PICKUP_ADDRESS ?? "",
};
