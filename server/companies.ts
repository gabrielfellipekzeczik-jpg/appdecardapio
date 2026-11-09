// server/companies.ts — usando Supabase SDK em vez de Drizzle
import type { OpeningHours } from "@shared/store-rules";
import { effectiveFeePercent } from "@shared/platform-fee";
import { ENV } from "./_core/env";
import { getDb, getIntegrationSettings, type Company } from "./db";

const RESERVED_SLUGS = new Set(["admin-login", "super-admin", "cadastrar", "api", "404", "admin", "cozinha"]);

export function isSlugAvailableFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** "Casa da Marmita" -> "casa-da-marmita" (sem acentos, só letras, números e hífen). */
export function slugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, "");
  return base.length >= 3 ? base : `${base || "loja"}-cardapio`;
}

/** Primeiro endereço livre a partir do nome: nome, nome-2, nome-3… */
export async function uniqueSlugFor(name: string): Promise<string> {
  const base = slugFromName(name);
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (isSlugAvailableFormat(candidate) && !(await getCompanyBySlug(candidate)))
      return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function updateCompanySlug(companyId: number, slug: string) {
  const db = getDb();
  const { error } = await db.from("companies").update({ slug } as Record<string, unknown>).eq("id", companyId);
  if (error) throw new Error(`[DB] Falha ao trocar o endereço: ${error.message}`);
}

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const db = getDb();
  const { data, error } = await db.from("companies").select("*").eq("slug", slug).limit(1).maybeSingle();
  // Antes o erro era engolido e o slug aparecia como "disponível" mesmo com o banco mal configurado.
  if (error) throw new Error(`[DB] Falha ao consultar empresas: ${error.message}`);
  return (data as Company) ?? undefined;
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const db = getDb();
  const { data } = await db.from("companies").select("*").eq("id", id).limit(1).single();
  return (data as Company) ?? undefined;
}

export async function createCompany(input: { slug: string; name: string; tagline?: string }): Promise<Company> {
  const db = getDb();
  const { data, error } = await db.from("companies").insert(input as Record<string, unknown>).select("*").single();
  if (error || !data) throw new Error(`[DB] Falha ao criar empresa: ${error?.message ?? "sem retorno"}`);
  return data as Company;
}

export async function listCompanies() {
  const db = getDb();
  const { data: companies } = await db.from("companies").select("*").order("createdAt");
  if (!companies) return { companies: [], defaultFeePercent: ENV.platformFeePercent };

  const results = await Promise.all((companies as Company[]).map(async (company) => {
    const { data: orders } = await db.from("orders")
      .select("total, platformFeeAmount")
      .eq("companyId", company.id)
      .eq("paymentStatus", "approved");
    const rows = (orders ?? []) as Array<{ total: string; platformFeeAmount: string | null }>;
    const revenue = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    const platformFee = rows.reduce((sum, r) => sum + Number(r.platformFeeAmount ?? 0), 0);
    const mercadoPago = await getIntegrationSettings(company.id, "mercadopago").catch(() => undefined);
    return {
      company,
      revenue,
      platformFee,
      orderCount: rows.length,
      mpConnected: Boolean(mercadoPago?.connected),
      feePercent: effectiveFeePercent(company.mp_fee_percent, ENV.platformFeePercent),
      customFee: company.mp_fee_percent !== null && company.mp_fee_percent !== undefined,
    };
  }));
  return { companies: results, defaultFeePercent: ENV.platformFeePercent };
}

/** `null` volta o restaurante para a taxa padrão da plataforma. */
export async function setCompanyFeePercent(companyId: number, percent: number | null) {
  const db = getDb();
  const { error } = await db
    .from("companies")
    .update({ mp_fee_percent: percent } as Record<string, unknown>)
    .eq("id", companyId);
  if (error) throw new Error(`[DB] Falha ao salvar a taxa: ${error.message}`);
}

export async function setCompanyStatus(companyId: number, status: "active" | "suspended") {
  const db = getDb();
  await db.from("companies").update({ status } as Record<string, unknown>).eq("id", companyId);
}

export async function updateCompanyOrdering(companyId: number, input: {
  openingHours: OpeningHours | null;
  acceptsCashOnDelivery: boolean;
  pickupEnabled: boolean;
  pickupAddress?: string;
  deliveryBaseFee?: number;
  deliveryIncludedKm?: number;
  deliveryPricePerKm?: number;
  deliveryMaxKm?: number;
  deliveryFeeMode?: "calculated" | "fixed";
  deliveryFixedFee?: number;
  deliveryFreeKm?: number;
}) {
  const db = getDb();
  const { error } = await db.from("companies").update(input as Record<string, unknown>).eq("id", companyId);
  if (error) throw new Error(`[DB] Falha ao salvar as regras de pedido: ${error.message}`);
}

export async function updateCompanyBranding(companyId: number, input: {
  name?: string; tagline?: string; logoUrl?: string; heroImageUrl?: string;
  primaryColor?: string; templateId?: "classic" | "modern" | "cover" | "premium"; storefrontTheme?: "dark" | "light"; pickupAddress?: string;
}) {
  const db = getDb();
  await db.from("companies").update(input as Record<string, unknown>).eq("id", companyId);
}
