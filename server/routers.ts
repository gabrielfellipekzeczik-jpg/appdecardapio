import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { isOwnerEmail } from "./_core/supabaseAuth";
import { companyAdminProcedure, publicProcedure, protectedProcedure, router, superAdminProcedure } from "./_core/trpc";
import { createCompany, getCompanyById, getCompanyBySlug, isSlugAvailableFormat, listCompanies, setCompanyStatus, updateCompanyBranding } from "./companies";
import { unavailableDeliveryResponse } from "@shared/delivery";
import {
  advanceOrderStatus, createCustomerOrder, getActiveDeliveryProvider, getDashboardSummary, getOrderById, getIntegrationsStatus,
  listActiveMenu, listAdminMenu, listCustomerOrders, listInventory, listRecentExpenses, listRecentOrders,
  ORDER_STATUS_FLOW, saveIntegrationCredentials, setOrderDelivery, setOrderPayment, upsertUser,
} from "./db";
import { buildAuthorizeUrl, createPayment, getConnectedCredentials, isMercadoPagoConfigured } from "./integrations/mercadoPago";
import { createDelivery as createUberDelivery } from "./integrations/uberDirect";
import { createDelivery as createLalamoveDelivery } from "./integrations/lalamove";

async function requireCompanyBySlug(slug: string) {
  const company = await getCompanyBySlug(slug);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  return company;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? { ...opts.ctx.user, isSuperAdmin: isOwnerEmail(opts.ctx.user.email) } : null),
  }),
  company: router({
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const company = await getCompanyBySlug(input.slug);
      return company ?? null;
    }),
    // The authenticated admin's own company (for the Admin/Integrações panels).
    mine: companyAdminProcedure.query(({ ctx }) => getCompanyById(ctx.companyId)),
    updateBranding: companyAdminProcedure.input(z.object({
      name: z.string().min(2).optional(),
      tagline: z.string().optional(),
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      pickupAddress: z.string().min(5).optional(),
    })).mutation(({ ctx, input }) => updateCompanyBranding(ctx.companyId, input)),
    // Completes signup for an already-authenticated Supabase user (see client/src/pages/CompanySignUp.tsx
    // for why this is a second step rather than done at supabase.auth.signUp time).
    signUp: protectedProcedure.input(z.object({
      name: z.string().min(2),
      slug: z.string().min(3).max(60),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta já está vinculada a uma empresa." });
      if (!isSlugAvailableFormat(input.slug)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esse endereço não é válido ou está reservado." });
      if (await getCompanyBySlug(input.slug)) throw new TRPCError({ code: "CONFLICT", message: "Esse endereço já está em uso." });
      const company = await createCompany({ slug: input.slug, name: input.name });
      await upsertUser({ supabaseUserId: ctx.user.supabaseUserId, companyId: company.id, role: "admin" });
      return { slug: company.slug };
    }),
    checkSlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      if (!isSlugAvailableFormat(input.slug)) return { available: false as const };
      return { available: !(await getCompanyBySlug(input.slug)) };
    }),
    // Platform owner's view of every tenant.
    list: superAdminProcedure.query(() => listCompanies()),
    setStatus: superAdminProcedure.input(z.object({ companyId: z.number().int().positive(), status: z.enum(["active", "suspended"]) })).mutation(({ input }) => setCompanyStatus(input.companyId, input.status)),
  }),
  menu: router({
    list: publicProcedure.input(z.object({ companySlug: z.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listActiveMenu(company.id);
    }),
  }),
  orders: router({
    recent: companyAdminProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional()).query(({ ctx, input }) => listRecentOrders(ctx.companyId, input?.limit ?? 20)),
    byId: publicProcedure.input(z.object({ companySlug: z.string(), id: z.number().int().positive() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return getOrderById(company.id, input.id);
    }),
    create: publicProcedure.input(z.object({
      companySlug: z.string(), name: z.string().min(2), phone: z.string().min(8), address: z.string().min(5),
      subtotal: z.number().nonnegative(), deliveryFee: z.number().nonnegative(), total: z.number().positive(),
      notes: z.string().optional(), paymentMethod: z.string().optional(),
      items: z.array(z.object({ menuItemId: z.number().int().positive(), itemName: z.string().min(1), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative(), observation: z.string().optional() })).min(1),
    })).mutation(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      if (company.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Esta loja não está disponível no momento." });
      const { companySlug, ...orderInput } = input;
      return createCustomerOrder(company.id, orderInput);
    }),
    history: publicProcedure.input(z.object({ companySlug: z.string(), phone: z.string().min(8) })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listCustomerOrders(company.id, input.phone);
    }),
    advanceStatus: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(ORDER_STATUS_FLOW) })).mutation(async ({ ctx, input }) => {
      const result = await advanceOrderStatus(ctx.companyId, input.id, input.status);
      if (input.status !== "ready" || !result.persisted) return { ...result, delivery: null };

      const provider = await getActiveDeliveryProvider(ctx.companyId);
      if (!provider) return { ...result, delivery: unavailableDeliveryResponse("uber_direct", "Nenhum provedor de entrega conectado. Configure em Integrações.") };

      if (provider === "own_courier") {
        return { ...result, delivery: { provider: "own_courier" as const, available: true as const, trackingUrl: null } };
      }

      try {
        const [company, order] = await Promise.all([getCompanyById(ctx.companyId), getOrderById(ctx.companyId, input.id)]);
        if (!company?.pickupAddress) return { ...result, delivery: unavailableDeliveryResponse(provider, "Cadastre o endereço de retirada da empresa em Integrações.") };
        if (!order?.customer) return { ...result, delivery: unavailableDeliveryResponse(provider, "Pedido sem endereço de entrega associado.") };

        const deliveryInput = {
          companyId: ctx.companyId, pickupAddress: company.pickupAddress, orderId: input.id,
          dropoffAddress: order.customer.address ?? "", dropoffName: order.customer.name, dropoffPhone: order.customer.phone,
        };
        const delivery = provider === "uber_direct"
          ? await createUberDelivery({ ...deliveryInput, companyName: company.name, manifestItems: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity })) })
          : await createLalamoveDelivery(deliveryInput);

        await setOrderDelivery(input.id, { trackingUrl: delivery.trackingUrl, externalDeliveryId: delivery.deliveryId });
        return { ...result, delivery: { provider, available: true as const, trackingUrl: delivery.trackingUrl } };
      } catch (error) {
        console.error(`[Delivery] ${provider} dispatch failed:`, error);
        return { ...result, delivery: unavailableDeliveryResponse(provider, "Falha ao acionar o despacho automático. Tente novamente ou acione manualmente.") };
      }
    }),
  }),
  dashboard: router({
    summary: companyAdminProcedure.query(({ ctx }) => getDashboardSummary(ctx.companyId)),
  }),
  adminMenu: router({
    list: companyAdminProcedure.query(({ ctx }) => listAdminMenu(ctx.companyId)),
  }),
  inventory: router({
    list: companyAdminProcedure.query(({ ctx }) => listInventory(ctx.companyId)),
  }),
  finance: router({
    recentExpenses: companyAdminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(({ ctx, input }) => listRecentExpenses(ctx.companyId, input?.limit ?? 50)),
  }),
  payments: router({
    // Public: the customer checkout needs to know whether to render the live
    // Payment Brick (Pix/crédito/débito) or the demo notice, and the seller's
    // public key to initialize the Brick client-side. Never expose the access token.
    checkoutConfig: publicProcedure.input(z.object({ companySlug: z.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const credentials = await getConnectedCredentials(company.id);
      return { connected: Boolean(credentials), publicKey: credentials?.publicKey ?? null };
    }),
    // Amount/description are derived from the persisted order — never trust
    // the client for the charge amount.
    create: publicProcedure.input(z.object({
      companySlug: z.string(), orderId: z.number().int().positive(), payerEmail: z.string().email(), payerFirstName: z.string().optional(),
      paymentMethodId: z.string().optional(), token: z.string().optional(), installments: z.number().int().positive().optional(), issuerId: z.string().optional(),
    })).mutation(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const order = await getOrderById(company.id, input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
      const payment = await createPayment({
        companyId: company.id, orderId: input.orderId, transactionAmount: Number(order.order.total),
        description: `Pedido #${input.orderId} — ${company.name}`,
        payer: { email: input.payerEmail, firstName: input.payerFirstName },
        paymentMethodId: input.paymentMethodId, token: input.token, installments: input.installments, issuerId: input.issuerId,
      });
      const paymentStatus = payment.status === "approved" || payment.status === "rejected" ? payment.status : "pending";
      await setOrderPayment(input.orderId, { paymentStatus, externalPaymentId: String(payment.id), platformFeeAmount: payment.applicationFee.toFixed(2) });
      return payment;
    }),
  }),
  integrations: router({
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const persisted = await getIntegrationsStatus(ctx.companyId);
      return {
        mercadopago: { connected: persisted.mercadopago, configured: isMercadoPagoConfigured() },
        uberDirect: { connected: persisted.uber_direct },
        lalamove: { connected: persisted.lalamove },
        ownCourier: { connected: persisted.own_courier },
        ninetyNineDelivery: { connected: false, reason: "Sem API self-service pública — depende de parceria comercial com a 99." },
        messaging: { connected: persisted.messaging },
      };
    }),
    mercadoPagoConnectUrl: companyAdminProcedure.query(({ ctx }) => {
      if (!isMercadoPagoConfigured()) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro." });
      return { url: buildAuthorizeUrl(ctx.companyId) };
    }),
    setDeliveryProvider: companyAdminProcedure.input(z.discriminatedUnion("provider", [
      z.object({ provider: z.literal("uber_direct"), clientId: z.string().min(1), clientSecret: z.string().min(1), customerId: z.string().min(1) }),
      z.object({ provider: z.literal("lalamove"), apiKey: z.string().min(1), apiSecret: z.string().min(1) }),
      z.object({ provider: z.literal("own_courier"), name: z.string().min(1), phone: z.string().min(8) }),
    ])).mutation(async ({ ctx, input }) => {
      const { provider, ...credentials } = input;
      await saveIntegrationCredentials(ctx.companyId, provider, credentials);
      return { success: true };
    }),
    saveMessagingCredentials: companyAdminProcedure.input(z.object({ providerToken: z.string().min(1), sender: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      await saveIntegrationCredentials(ctx.companyId, "messaging", { providerToken: input.providerToken, sender: input.sender });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
