import { eq, sql } from "drizzle-orm";
import { companies, orders, type InsertCompany } from "../drizzle/schema";
import { getDb } from "./db";

const RESERVED_SLUGS = new Set(["admin-login", "super-admin", "cadastrar", "api", "404", "admin", "cozinha"]);

export function isSlugAvailableFormat(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function getCompanyBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return company;
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return company;
}

export async function createCompany(input: Pick<InsertCompany, "slug" | "name" | "tagline">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [company] = await db.insert(companies).values(input).returning();
  return company;
}

export async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    company: companies,
    revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
    platformFee: sql<number>`coalesce(sum(${orders.platformFeeAmount}), 0)`,
    orderCount: sql<number>`count(${orders.id})`,
  }).from(companies)
    .leftJoin(orders, eq(orders.companyId, companies.id))
    .groupBy(companies.id)
    .orderBy(companies.createdAt);
}

export async function setCompanyStatus(companyId: number, status: "active" | "suspended") {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set({ status }).where(eq(companies.id, companyId));
}

export async function updateCompanyBranding(companyId: number, input: { name?: string; tagline?: string; logoUrl?: string; primaryColor?: string; pickupAddress?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(input).where(eq(companies.id, companyId));
}
