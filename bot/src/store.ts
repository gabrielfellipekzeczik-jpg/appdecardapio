import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BotConfig } from "./config.ts";
import type { CompanyContext, StoreInfo } from "./prompt.ts";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DELIVERY_DEFAULTS = { baseFee: 7.5, includedKm: 3, pricePerKm: 1.5, maxKm: 15 };

type CompanyRow = {
  name: string;
  slug: string;
  pickupAddress: string | null;
  status: string;
  openingHours?: { enabled: boolean; open: string; close: string }[] | null;
  acceptsCashOnDelivery?: boolean;
  pickupEnabled?: boolean;
  deliveryBaseFee?: string | number | null;
  deliveryIncludedKm?: string | number | null;
  deliveryPricePerKm?: string | number | null;
  deliveryMaxKm?: string | number | null;
  deliveryFeeMode?: string | null;
  deliveryFixedFee?: string | number | null;
  deliveryFreeKm?: string | number | null;
};

/** Mesmas regras que o checkout usa, em texto, para o assistente responder dúvidas básicas. */
export function storeInfoFrom(row: CompanyRow, providers: string[]): StoreInfo {
  const hours = Array.isArray(row.openingHours) && row.openingHours.length === 7
    ? [1, 2, 3, 4, 5, 6, 0].map((day) => {
      const entry = row.openingHours![day];
      return `${WEEKDAYS[day]}: ${entry.enabled ? `${entry.open} às ${entry.close}` : "fechado"}`;
    })
    : [];
  const payments = [
    ...(providers.includes("mercadopago") ? ["Pix", "cartão de crédito ou débito pelo link"] : []),
    ...(row.acceptsCashOnDelivery ? ["dinheiro ou maquininha na entrega"] : []),
  ];
  const value = (raw: unknown, fallback: number) => {
    const parsed = Number(raw);
    return raw === null || raw === undefined || !Number.isFinite(parsed) ? fallback : parsed;
  };
  const estimated = row.pickupAddress && !providers.some((p) => p === "uber_direct" || p === "own_courier");
  return {
    hours,
    payments,
    pickup: Boolean(row.pickupEnabled && row.pickupAddress),
    delivery: estimated
      ? {
        baseFee: value(row.deliveryBaseFee, DELIVERY_DEFAULTS.baseFee),
        includedKm: value(row.deliveryIncludedKm, DELIVERY_DEFAULTS.includedKm),
        pricePerKm: value(row.deliveryPricePerKm, DELIVERY_DEFAULTS.pricePerKm),
        maxKm: value(row.deliveryMaxKm, DELIVERY_DEFAULTS.maxKm),
        mode: row.deliveryFeeMode === "fixed" ? "fixed" : "calculated",
        fixedFee: value(row.deliveryFixedFee, DELIVERY_DEFAULTS.baseFee),
        freeUpToKm: value(row.deliveryFreeKm, 0),
      }
      : null,
  };
}

export type BotRow = {
  companyId: number;
  desired: "connected" | "disconnected";
  status: string;
  aiEnabled: boolean;
  instructions: string | null;
};

export class Store {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: SupabaseClient<any, any, any>;
  constructor(private config: BotConfig) {
    this.db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "marmitaria" },
    });
  }

  async listBots(): Promise<BotRow[]> {
    const { data, error } = await this.db.from("whatsapp_bots").select("companyId, desired, status, aiEnabled, instructions");
    if (error) throw new Error(`listBots: ${error.message}`);
    return (data ?? []) as BotRow[];
  }

  async patchBot(companyId: number, patch: Record<string, unknown>) {
    const { error } = await this.db.from("whatsapp_bots").update({ ...patch, updatedAt: new Date().toISOString() }).eq("companyId", companyId);
    if (error) console.error(`[store] patchBot(${companyId}) falhou: ${error.message}`);
  }

  /** Um único UPDATE sem filtro: marca que o serviço do bot está vivo para todas as linhas. */
  async heartbeat() {
    const { error } = await this.db.from("whatsapp_bots").update({ heartbeatAt: new Date().toISOString() }).gte("companyId", 0);
    if (error) console.error(`[store] heartbeat falhou: ${error.message}`);
  }

  /** Avisos de pedido (tabela order_notifications) aguardando envio por WhatsApp. */
  async pendingNotifications(companyId: number, limit = 5) {
    const { data, error } = await this.db
      .from("order_notifications")
      .select("id, recipient, message, attempts")
      .eq("companyId", companyId)
      .eq("channel", "whatsapp")
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(limit);
    if (error) { console.error(`[store] pendingNotifications(${companyId}): ${error.message}`); return []; }
    return (data ?? []) as Array<{ id: number; recipient: string; message: string; attempts: number }>;
  }

  async finishNotification(id: number, attempts: number, status: "sent" | "failed" | "pending", error?: string) {
    const { error: dbError } = await this.db.from("order_notifications").update({
      status, attempts, error: error ?? null, sentAt: status === "sent" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (dbError) console.error(`[store] finishNotification(${id}): ${dbError.message}`);
  }

  /** Últimos pedidos deste telefone na loja, para responder "como está meu pedido?". */
  async ordersForPhone(companyId: number, phone: string) {
    const variants = Array.from(new Set([phone, phone.startsWith("55") ? phone.slice(2) : `55${phone}`]));
    const { data: customers } = await this.db.from("customers").select("id").eq("companyId", companyId).in("phone", variants);
    const ids = ((customers ?? []) as Array<{ id: number }>).map((row) => row.id);
    if (!ids.length) return [];
    const { data, error } = await this.db
      .from("orders")
      .select("id, status, paymentStatus, paymentMethod")
      .eq("companyId", companyId)
      .in("customerId", ids)
      .neq("status", "cancelled")
      .order("createdAt", { ascending: false })
      .limit(3);
    if (error) { console.error(`[store] ordersForPhone(${companyId}): ${error.message}`); return []; }
    return (data ?? []) as Array<{ id: number; status: string; paymentStatus: string; paymentMethod: string | null }>;
  }

  async loadContext(companyId: number): Promise<CompanyContext | null> {
    const [company, items, categories, bot, integrations] = await Promise.all([
      this.db.from("companies").select("*").eq("id", companyId).limit(1),
      this.db.from("menu_items").select("id, name, price, description, categoryId").eq("companyId", companyId).eq("active", true).order("name"),
      this.db.from("menu_categories").select("id, name").eq("companyId", companyId),
      this.db.from("whatsapp_bots").select("aiEnabled, instructions").eq("companyId", companyId).limit(1),
      this.db.from("integration_settings").select("provider").eq("companyId", companyId),
    ]);
    const row = (company.data ?? [])[0] as CompanyRow | undefined;
    if (company.error || items.error || categories.error || bot.error || !row) {
      console.error(`[store] loadContext(${companyId}) falhou`, company.error ?? items.error ?? categories.error ?? bot.error ?? "empresa não encontrada");
      return null;
    }
    const categoryNames = new Map(((categories.data ?? []) as Array<{ id: number; name: string }>).map((category) => [category.id, category.name]));
    const settings = (bot.data ?? [])[0] as { aiEnabled: boolean; instructions: string | null } | undefined;
    return {
      name: row.name,
      slug: row.slug,
      pickupAddress: row.pickupAddress,
      storefrontUrl: `${this.config.appUrl}/${row.slug}`,
      active: row.status === "active",
      aiEnabled: settings?.aiEnabled ?? true,
      instructions: settings?.instructions ?? null,
      store: storeInfoFrom(row, ((integrations.data ?? []) as Array<{ provider: string }>).map((entry) => entry.provider)),
      catalogIds: ((items.data ?? []) as Array<{ id: number; name: string; price: string }>).map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
      })),
      items: ((items.data ?? []) as Array<{ name: string; price: string; description: string | null; categoryId: number }>).map((item) => ({
        name: item.name,
        price: Number(item.price),
        description: item.description,
        category: categoryNames.get(item.categoryId) ?? null,
      })),
    };
  }
}
