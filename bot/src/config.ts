import { DEFAULT_LIMITS, type Limits } from "./guards.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}
const num = (name: string, fallback: number) => {
  const raw = process.env[name];
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export function loadConfig() {
  const limits: Limits = {
    ...DEFAULT_LIMITS,
    contactCooldownMs: num("BOT_CONTACT_COOLDOWN_SEC", DEFAULT_LIMITS.contactCooldownMs / 1000) * 1000,
    contactPerHour: num("BOT_CONTACT_PER_HOUR", DEFAULT_LIMITS.contactPerHour),
    contactPerDay: num("BOT_CONTACT_PER_DAY", DEFAULT_LIMITS.contactPerDay),
    companyPerHour: num("BOT_COMPANY_PER_HOUR", DEFAULT_LIMITS.companyPerHour),
    companyPerDay: num("BOT_COMPANY_PER_DAY", DEFAULT_LIMITS.companyPerDay),
    humanTakeoverMs: num("BOT_HUMAN_TAKEOVER_HOURS", DEFAULT_LIMITS.humanTakeoverMs / 3_600_000) * 3_600_000,
  };
  return {
    supabaseUrl: process.env.SUPABASE_URL || required("VITE_SUPABASE_URL"),
    supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    geminiApiKey: required("GEMINI_API_KEY"),
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    /** Domínio público do app (Vercel), sem barra final. O link do cardápio é <appUrl>/<slug>. */
    appUrl: required("PUBLIC_APP_URL").replace(/\/+$/, ""),
    /** Mesma chave usada no app: é com ela que o robô pede ao app para criar pedidos. */
    botKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    dataDir: process.env.BOT_DATA_DIR || "./data",
    port: num("PORT", 8080),
    pollMs: num("BOT_POLL_SEC", 5) * 1000,
    limits,
  };
}
export type BotConfig = ReturnType<typeof loadConfig>;
