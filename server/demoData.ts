import type { Company } from "../drizzle/schema";
import { ENV } from "./_core/env";

/**
 * No DATABASE_URL configured (e.g. testing locally before setting up
 * Supabase) — instead of every public page dead-ending on "empresa não
 * encontrada", serve an in-memory demo company for any slug so the
 * storefront templates are fully clickable with zero setup.
 */
export function isDemoMode(): boolean {
  return !ENV.databaseUrl;
}

const TEMPLATE_IDS = ["classic", "modern", "cover", "premium"] as const;
type TemplateId = (typeof TEMPLATE_IDS)[number];

function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * The slug itself picks which template to preview — visit /premium,
 * /classic, /modern or /cover locally to see each one; anything else
 * defaults to the current flagship (premium/"Bistrô").
 */
export function buildDemoCompany(slug: string): Company {
  const templateId: TemplateId = isTemplateId(slug) ? slug : "premium";
  return {
    id: -1,
    slug,
    name: "Restaurante Demonstração",
    tagline: "sabores que contam histórias",
    logoUrl: null,
    heroImageUrl: null,
    primaryColor: "#c9a15a",
    templateId,
    pickupAddress: "Rua Exemplo, 123 — Centro",
    status: "active",
    createdAt: new Date(),
  };
}
