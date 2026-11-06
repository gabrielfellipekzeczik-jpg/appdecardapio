import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BotConfig } from "./config.ts";
import type { CompanyContext } from "./prompt.ts";

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

  async loadContext(companyId: number): Promise<CompanyContext | null> {
    const [company, items, categories, bot] = await Promise.all([
      this.db.from("companies").select("name, slug, pickupAddress, status").eq("id", companyId).limit(1),
      this.db.from("menu_items").select("name, price, description, categoryId").eq("companyId", companyId).eq("active", true).order("name"),
      this.db.from("menu_categories").select("id, name").eq("companyId", companyId),
      this.db.from("whatsapp_bots").select("aiEnabled, instructions").eq("companyId", companyId).limit(1),
    ]);
    const row = (company.data ?? [])[0] as { name: string; slug: string; pickupAddress: string | null; status: string } | undefined;
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
      items: ((items.data ?? []) as Array<{ name: string; price: string; description: string | null; categoryId: number }>).map((item) => ({
        name: item.name,
        price: Number(item.price),
        description: item.description,
        category: categoryNames.get(item.categoryId) ?? null,
      })),
    };
  }
}
