// server/companies.ts — usando Supabase SDK em vez de Drizzle
import { getDb, type Company } from "./db";

const RESERVED_SLUGS = new Set(["admin-login", "super-admin", "cadastrar", "api", "404", "admin", "cozinha"]);

export function isSlugAvailableFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const db = getDb();
  const { data } = await db.from("companies").select("*").eq("slug", slug).limit(1).single();
  return (data as Company) ?? undefined;
}

export async function getCompanyById(id: number): Promise<Company | undefined> {
  const db = getDb();
  const { data } = await db.from("companies").select("*").eq("id", id).limit(1).single();
  return (data as Company) ?? undefined;
}

export async function createCompany(input: { slug: string; name: string; tagline?: string }): Promise<Company> {
  const db = getDb();
  const { data } = await db.from("companies").insert(input as Record<string, unknown>).select("*").single();
  if (!data) throw new Error("Failed to create company");
  return data as Company;
}

export async function listCompanies() {
  const db = getDb();
  const { data: companies } = await db.from("companies").select("*").order("createdAt");
  if (!companies) return [];

  const results = await Promise.all((companies as Company[]).map(async (company) => {
    const { data: orders } = await db.from("orders")
      .select("total, platformFeeAmount")
      .eq("companyId", company.id)
      .eq("paymentStatus", "approved");
    const rows = (orders ?? []) as Array<{ total: string; platformFeeAmount: string | null }>;
    const revenue = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    const platformFee = rows.reduce((sum, r) => sum + Number(r.platformFeeAmount ?? 0), 0);
    return { company, revenue, platformFee, orderCount: rows.length };
  }));
  return results;
}

export async function setCompanyStatus(companyId: number, status: "active" | "suspended") {
  const db = getDb();
  await db.from("companies").update({ status } as Record<string, unknown>).eq("id", companyId);
}

export async function updateCompanyBranding(companyId: number, input: {
  name?: string; tagline?: string; logoUrl?: string; heroImageUrl?: string;
  primaryColor?: string; templateId?: "classic" | "modern" | "cover" | "premium"; pickupAddress?: string;
}) {
  const db = getDb();
  await db.from("companies").update(input as Record<string, unknown>).eq("id", companyId);
}
