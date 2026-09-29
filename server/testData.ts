import type { Company } from "../drizzle/schema";

/**
 * Test fixtures only. Development and production always require real Supabase
 * credentials and persisted data.
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === "test";
}

const TEMPLATE_IDS = ["classic", "modern", "cover", "premium"] as const;
type TemplateId = (typeof TEMPLATE_IDS)[number];

function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * Provides a deterministic company fixture for router unit tests.
 */
export function buildTestCompany(slug: string): Company {
  const templateId: TemplateId = isTemplateId(slug) ? slug : "premium";
  return {
    id: -1,
    slug,
    name: "Restaurante de Teste",
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
