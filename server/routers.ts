import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { unavailableDeliveryResponse } from "@shared/delivery";
import { isOwnerEmail } from "./_core/supabaseAuth";
import { adminProcedure, publicProcedure, router, superAdminProcedure } from "./_core/trpc";
import {
  advanceOrderStatus, createCustomerOrder, getDashboardSummary, getOrderById, getIntegrationsStatus,
  listActiveMenu, listAdminMenu, listCustomerOrders, listInventory, listRecentExpenses, listRecentOrders,
  ORDER_STATUS_FLOW, saveIntegrationCredentials, setOrderDelivery, setOrderPayment,
} from "./db";
import { buildAuthorizeUrl, createPayment, getConnectedCredentials, isMercadoPagoConfigured } from "./integrations/mercadoPago";
import { createDelivery, isUberDirectConfigured } from "./integrations/uberDirect";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? { ...opts.ctx.user, isSuperAdmin: isOwnerEmail(opts.ctx.user.email) } : null),
  }),
  menu: router({
    list: publicProcedure.query(() => listActiveMenu()),
  }),
  orders: router({
    recent: adminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional()).query(({ input }) => listRecentOrders(input?.limit ?? 20)),
    byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getOrderById(input.id)),
    create: publicProcedure.input(z.object({ name: z.string().min(2), phone: z.string().min(8), address: z.string().min(5), subtotal: z.number().nonnegative(), deliveryFee: z.number().nonnegative(), total: z.number().positive(), notes: z.string().optional(), paymentMethod: z.string().optional(), items: z.array(z.object({ menuItemId: z.number().int().positive(), itemName: z.string().min(1), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative(), observation: z.string().optional() })).min(1) })).mutation(({ input }) => createCustomerOrder(input)),
    history: publicProcedure.input(z.object({ phone: z.string().min(8) })).query(({ input }) => listCustomerOrders(input.phone)),
    advanceStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(ORDER_STATUS_FLOW) })).mutation(async ({ input }) => {
      const result = await advanceOrderStatus(input.id, input.status);
      if (input.status !== "ready") return { ...result, delivery: null };

      if (!isUberDirectConfigured()) return { ...result, delivery: unavailableDeliveryResponse("uber_direct") };

      try {
        const order = await getOrderById(input.id);
        if (!order?.customer) return { ...result, delivery: unavailableDeliveryResponse("uber_direct", "Pedido sem endereço de entrega associado.") };
        const delivery = await createDelivery({
          orderId: input.id,
          dropoffAddress: order.customer.address ?? "",
          dropoffName: order.customer.name,
          dropoffPhone: order.customer.phone,
          manifestItems: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity })),
        });
        await setOrderDelivery(input.id, { trackingUrl: delivery.trackingUrl, externalDeliveryId: delivery.deliveryId });
        return { ...result, delivery: { provider: "uber_direct" as const, available: true as const, trackingUrl: delivery.trackingUrl } };
      } catch (error) {
        console.error("[Delivery] Uber Direct dispatch failed:", error);
        return { ...result, delivery: unavailableDeliveryResponse("uber_direct", "Falha ao acionar o despacho automático. Tente novamente ou acione manualmente.") };
      }
    }),
  }),
  dashboard: router({
    summary: adminProcedure.query(() => getDashboardSummary()),
  }),
  adminMenu: router({
    list: adminProcedure.query(() => listAdminMenu()),
  }),
  inventory: router({
    list: adminProcedure.query(() => listInventory()),
  }),
  finance: router({
    recentExpenses: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(({ input }) => listRecentExpenses(input?.limit ?? 50)),
  }),
  payments: router({
    // Public: the customer checkout needs to know whether to render the live
    // Payment Brick (Pix/crédito/débito) or the demo notice, and the seller's
    // public key to initialize the Brick client-side. Never expose the access token.
    checkoutConfig: publicProcedure.query(async () => {
      const credentials = await getConnectedCredentials();
      return { connected: Boolean(credentials), publicKey: credentials?.publicKey ?? null };
    }),
    // Amount/description are derived from the persisted order — never trust
    // the client for the charge amount.
    create: publicProcedure.input(z.object({
      orderId: z.number().int().positive(),
      payerEmail: z.string().email(),
      payerFirstName: z.string().optional(),
      paymentMethodId: z.string().optional(),
      token: z.string().optional(),
      installments: z.number().int().positive().optional(),
      issuerId: z.string().optional(),
    })).mutation(async ({ input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new Error("Pedido não encontrado");
      const payment = await createPayment({
        orderId: input.orderId,
        transactionAmount: Number(order.order.total),
        description: `Pedido #${input.orderId} — Casa na Marmita`,
        payer: { email: input.payerEmail, firstName: input.payerFirstName },
        paymentMethodId: input.paymentMethodId,
        token: input.token,
        installments: input.installments,
        issuerId: input.issuerId,
      });
      if (payment.status === "approved" || payment.status === "rejected") {
        await setOrderPayment(input.orderId, { paymentStatus: payment.status, externalPaymentId: String(payment.id) });
      } else {
        await setOrderPayment(input.orderId, { paymentStatus: "pending", externalPaymentId: String(payment.id) });
      }
      return payment;
    }),
  }),
  integrations: router({
    status: superAdminProcedure.query(async () => {
      const persisted = await getIntegrationsStatus();
      return {
        mercadopago: { connected: persisted.mercadopago, configured: isMercadoPagoConfigured() },
        uberDirect: { connected: isUberDirectConfigured(), configured: isUberDirectConfigured() },
        ninetyNineDelivery: { connected: false, reason: "Sem API self-service pública — depende de parceria comercial com a 99." },
        messaging: { connected: persisted.messaging },
      };
    }),
    mercadoPagoConnectUrl: superAdminProcedure.query(() => {
      if (!isMercadoPagoConfigured()) throw new Error("Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro.");
      const state = Math.random().toString(36).slice(2);
      return { url: buildAuthorizeUrl(state) };
    }),
    saveMessagingCredentials: superAdminProcedure.input(z.object({ providerToken: z.string().min(1), sender: z.string().min(1) })).mutation(async ({ input }) => {
      await saveIntegrationCredentials("messaging", { providerToken: input.providerToken, sender: input.sender });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
