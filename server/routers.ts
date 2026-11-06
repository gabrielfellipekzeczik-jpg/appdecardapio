import { TRPCError } from "@trpc/server";
import { eventForStatus, isForwardMove, notifyOrderEvent } from "./notifications";
import { clientIp, createRateLimiter } from "./_core/rateLimit";
import { isReadyForKitchen } from "@shared/payment-messages";
import { getStoreStatus, isPickupOrder } from "@shared/store-rules";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { isOwnerEmail, isSupabaseEmailConfirmed } from "./_core/supabaseAuth";
import {
  companyAdminProcedure,
  publicProcedure,
  protectedProcedure,
  router,
  superAdminProcedure,
} from "./_core/trpc";
import {
  createCompany,
  getCompanyById,
  getCompanyBySlug,
  isSlugAvailableFormat,
  listCompanies,
  setCompanyStatus,
  updateCompanyBranding,
  updateCompanyOrdering,
} from "./companies";
import { buildTestCompany, isTestMode } from "./testData";
import { unavailableDeliveryResponse } from "@shared/delivery";
import {
  BOT_HEARTBEAT_MAX_AGE_MS,
  getWhatsappBot,
  requestWhatsappConnect,
  requestWhatsappDisconnect,
  updateWhatsappSettings,
  advanceOrderStatus,
  createCustomerOrder,
  createInventoryItem,
  recordInventoryMovement,
  listInventoryMovements,
  createExpense,
  getFinanceReport,
  createMenuCategory,
  createMenuItem,
  deleteMenuItem,
  listMenuCategories,
  updateMenuItem,
  getActiveDeliveryProvider,
  getDashboardSummary,
  getOrderById,
  getCustomerOrderById,
  getIntegrationsStatus,
  listActiveMenu,
  listAdminMenu,
  listCustomerOrders,
  listInventory,
  listRecentExpenses,
  listRecentOrders,
  ORDER_STATUS_FLOW,
  countRecentUnpaidOrders,
  findOrderByDriverToken,
  getTrackingForEmail,
  listOrdersForEmail,
  saveIntegrationCredentials,
  setOrderDelivery,
  setOrderPayment,
  upsertUser,
  issueDriverTrackingToken,
  updateDriverLocation,
  getCustomerTracking,
  getDriverTrackingInfo,
  confirmDriverDelivery,
  getIntegrationCredentials,
} from "./db";
import {
  buildAuthorizeUrl,
  cancelPayment,
  createPayment,
  createPaymentLink,
  getPayment,
  getPaymentLink,
  getConnectedCredentials,
  isBoletoPaymentMethod,
  isMercadoPagoConfigured,
} from "./integrations/mercadoPago";
import {
  createDelivery as createUberDelivery,
  quoteDelivery as quoteUberDelivery,
} from "./integrations/uberDirect";
import { createDelivery as createLalamoveDelivery } from "./integrations/lalamove";
import { quoteOwnCourier } from "./integrations/deliveryPricing";
import { decryptJson, encryptJson } from "./_core/crypto";

type DeliveryQuotePayload = {
  companyId: number;
  provider: string;
  fee: number;
  quoteId: string | null;
  addressHash: string;
  expiresAt: number;
  distanceKm?: number;
};
function deliveryAddressHash(
  companyId: number,
  provider: string,
  address: string,
  addressNumber: string,
  pickupAddress: string
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        companyId,
        provider,
        address.trim(),
        addressNumber.trim(),
        pickupAddress.trim(),
      ])
    )
    .digest("hex");
}

type AddressSuggestion = {
  name: string;
  street: string;
  housenumber: string;
  city: string;
  state: string;
  postcode: string;
  countrycode: string;
  type: string;
  district?: string;
};
const addressSearchCache = new Map<
  string,
  { expiresAt: number; value: AddressSuggestion[] }
>();

function requireCustomerAccessToken(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = req.headers["x-customer-access-token"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (
    !token ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token
    )
  ) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Acesso a este pedido não autorizado.",
    });
  }
  return token;
}

async function requireCompanyBySlug(slug: string) {
  if (isTestMode()) return buildTestCompany(slug);
  const company = await getCompanyBySlug(slug);
  if (!company)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Empresa não encontrada.",
    });
  return company;
}

async function createManualPaymentLink(
  companyId: number,
  orderId: number,
  payerEmail?: string
) {
  const found = await getOrderById(companyId, orderId);
  if (!found)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Pedido não encontrado.",
    });
  if (found.order.paymentMethod !== "mercadopago_link")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Este pedido não foi configurado para pagamento por link.",
    });
  if (found.order.paymentStatus === "approved")
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este pedido já está pago.",
    });
  if (found.order.externalPaymentId?.startsWith("pref:")) {
    return {
      orderId,
      paymentLink: await getPaymentLink(
        companyId,
        found.order.externalPaymentId.slice(5)
      ),
    };
  }
  if (found.order.externalPaymentId)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este pedido já tem um pagamento em andamento.",
    });
  const company = await getCompanyById(companyId);
  const link = await createPaymentLink({
    companyId,
    orderId,
    transactionAmount: Number(found.order.total),
    description: `Pedido #${orderId} — ${company?.name ?? "Sua loja"}`,
    payerEmail,
  });
  await setOrderPayment(orderId, {
    paymentStatus: "pending",
    externalPaymentId: `pref:${link.id}`,
    platformFeeAmount: link.applicationFee.toFixed(2),
  });
  return { orderId, paymentLink: link.url };
}

const menuItemInput = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullish(),
  price: z.number().positive().max(100000),
  imageUrl: z.string().url().nullish(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
});

const orderRateLimiter = createRateLimiter(8, 10 * 60_000);
const MAX_UNPAID_ORDERS_PER_HOUR = 5;

/** ViaCEP cobre o Brasil todo por CEP, onde a busca por texto do OpenStreetMap costuma falhar. */
async function lookupCep(cep: string): Promise<AddressSuggestion[]> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      estado?: string;
      uf?: string;
      cep?: string;
    };
    if (data.erro || !data.localidade) return [];
    const street = data.logradouro || data.localidade;
    return [
      {
        name: street,
        street,
        housenumber: "",
        city: data.localidade,
        state: data.estado || data.uf || "",
        postcode: data.cep ?? cep,
        countrycode: "BR",
        type: "street",
        district: data.bairro ?? "",
      },
    ];
  } catch {
    return [];
  }
}

const openingHoursInput = z
  .array(
    z.object({
      enabled: z.boolean(),
      open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })
  )
  .length(7)
  .nullable();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user
        ? { ...opts.ctx.user, isSuperAdmin: isOwnerEmail(opts.ctx.user.email) }
        : null
    ),
  }),
  address: router({
    suggestions: publicProcedure
      .input(z.object({ q: z.string().trim().min(4).max(120) }))
      .query(async ({ input }) => {
        const normalizedQuery = input.q
          .toLocaleLowerCase("pt-BR")
          .replace(/\s+/g, " ");
        const cached = addressSearchCache.get(normalizedQuery);
        if (cached && cached.expiresAt > Date.now()) return cached.value;

        const cep = input.q.replace(/\D/g, "");
        if (/^\d{5}-?\d{3}$/.test(input.q)) {
          const value = await lookupCep(cep);
          addressSearchCache.set(normalizedQuery, {
            expiresAt: Date.now() + 15 * 60_000,
            value,
          });
          return value;
        }

        // Photon is designed for search-as-you-type; public Nominatim explicitly forbids autocomplete.
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", input.q);
        url.searchParams.set("limit", "8");
        let response: Response;
        try {
          response = await fetch(url, {
            headers: {
              accept: "application/geo+json",
              "user-agent": "MarmitariaApp/1.0",
            },
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message:
              "A busca de endereços está temporariamente indisponível. Você pode preencher o endereço manualmente.",
          });
        }
        if (!response.ok)
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message:
              "O serviço de endereços não respondeu. Você ainda pode preencher o endereço manualmente.",
          });
        const payload = (await response.json()) as {
          features?: Array<{ properties?: Record<string, string | undefined> }>;
        };
        const value = (payload.features ?? [])
          .map(
            ({ properties = {} }): AddressSuggestion => ({
              name: properties.name ?? properties.street ?? "",
              street: properties.street ?? properties.name ?? "",
              housenumber: properties.housenumber ?? "",
              city:
                properties.city ??
                properties.town ??
                properties.village ??
                properties.county ??
                "",
              state: properties.state ?? "",
              postcode: properties.postcode ?? "",
              countrycode: (properties.countrycode ?? "").toUpperCase(),
              type: properties.type ?? "",
              district:
                properties.district ??
                properties.suburb ??
                properties.locality ??
                "",
            })
          )
          .filter(
            item => item.countrycode === "BR" && (item.street || item.name)
          );
        addressSearchCache.set(normalizedQuery, {
          expiresAt: Date.now() + 15 * 60_000,
          value,
        });
        if (addressSearchCache.size > 500) {
          const oldest = addressSearchCache.keys().next().value;
          if (oldest) addressSearchCache.delete(oldest);
        }
        return value;
      }),
  }),
  company: router({
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        if (isTestMode()) return buildTestCompany(input.slug);
        const company = await getCompanyBySlug(input.slug);
        return company ?? null;
      }),
    // The authenticated admin's own company (for the Admin/Integrações panels).
    mine: companyAdminProcedure.query(({ ctx }) =>
      getCompanyById(ctx.companyId)
    ),
    updateBranding: companyAdminProcedure
      .input(
        z.object({
          name: z.string().min(2).optional(),
          tagline: z.string().optional(),
          logoUrl: z.string().url().optional(),
          heroImageUrl: z.string().url().optional(),
          primaryColor: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          templateId: z
            .enum(["classic", "modern", "cover", "premium"])
            .optional(),
          pickupAddress: z.string().min(5).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        updateCompanyBranding(ctx.companyId, input)
      ),
    updateOrdering: companyAdminProcedure
      .input(
        z.object({
          openingHours: openingHoursInput,
          acceptsCashOnDelivery: z.boolean(),
          pickupEnabled: z.boolean(),
          pickupAddress: z.string().trim().min(5).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        updateCompanyOrdering(ctx.companyId, input)
      ),
    // Completes signup for an already-authenticated Supabase user (see client/src/pages/CompanySignUp.tsx
    // for why this is a second step rather than done at supabase.auth.signUp time).
    signUp: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),
          slug: z.string().min(3).max(60),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.companyId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta conta já está vinculada a uma empresa.",
          });
        if (!isSlugAvailableFormat(input.slug))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esse endereço não é válido ou está reservado.",
          });
        if (await getCompanyBySlug(input.slug))
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esse endereço já está em uso.",
          });
        const company = await createCompany({
          slug: input.slug,
          name: input.name,
        });
        await upsertUser({
          supabaseUserId: ctx.user.supabaseUserId,
          companyId: company.id,
          role: "admin",
        });
        return { slug: company.slug };
      }),
    checkSlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        if (!isSlugAvailableFormat(input.slug))
          return { available: false as const };
        return { available: !(await getCompanyBySlug(input.slug)) };
      }),
    // Platform owner's view of every tenant.
    list: superAdminProcedure.query(() => listCompanies()),
    setStatus: superAdminProcedure
      .input(
        z.object({
          companyId: z.number().int().positive(),
          status: z.enum(["active", "suspended"]),
        })
      )
      .mutation(({ input }) => setCompanyStatus(input.companyId, input.status)),
  }),
  menu: router({
    list: publicProcedure
      .input(z.object({ companySlug: z.string() }))
      .query(async ({ input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        return listActiveMenu(company.id);
      }),
  }),
  orders: router({
    recent: companyAdminProcedure
      .input(
        z.object({ limit: z.number().min(1).max(100).default(20) }).optional()
      )
      .query(({ ctx, input }) =>
        listRecentOrders(ctx.companyId, input?.limit ?? 20)
      ),
    byId: publicProcedure
      .input(
        z.object({ companySlug: z.string(), id: z.number().int().positive() })
      )
      .query(async ({ ctx, input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        return getCustomerOrderById(
          company.id,
          input.id,
          requireCustomerAccessToken(ctx.req)
        );
      }),
    create: publicProcedure
      .input(
        z.object({
          companySlug: z.string(),
          email: z.string().email(),
          name: z.string().trim().min(2).max(160),
          phone: z.string().min(8).max(30),
          address: z.string().trim().min(5).max(500),
          addressNumber: z.string().trim().min(1).max(32),
          notes: z.string().max(2000).optional(),
          paymentMethod: z
            .enum(["mercadopago", "cash_on_delivery"])
            .default("mercadopago"),
          fulfillment: z.enum(["delivery", "pickup"]).default("delivery"),
          deliveryQuoteToken: z.string().max(5000).optional(),
          items: z
            .array(
              z.object({
                menuItemId: z.number().int().positive(),
                quantity: z.number().int().positive().max(50),
                observation: z.string().max(300).optional(),
              })
            )
            .min(1)
            .max(30),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isTestMode() && !orderRateLimiter(clientIp(ctx.req)))
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Muitos pedidos em pouco tempo. Aguarde alguns minutos.",
          });
        const company = await requireCompanyBySlug(input.companySlug);
        if (company.status !== "active")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Esta loja não está disponível no momento.",
          });
        const storeStatus = getStoreStatus(company.openingHours);
        if (!storeStatus.open)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: storeStatus.label ?? "A loja está fechada no momento.",
          });
        const pickup = input.fulfillment === "pickup";
        if (pickup && !(company.pickupEnabled && company.pickupAddress))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta loja não oferece retirada.",
          });
        if (
          input.paymentMethod === "cash_on_delivery" &&
          !company.acceptsCashOnDelivery
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta loja não aceita pagamento na entrega.",
          });
        const unpaidOrders = await countRecentUnpaidOrders(
          company.id,
          input.phone
        );
        if (unpaidOrders >= MAX_UNPAID_ORDERS_PER_HOUR)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Este telefone tem muitos pedidos sem pagamento. Tente de novo mais tarde.",
          });
        const provider = pickup
          ? undefined
          : await getActiveDeliveryProvider(company.id);
        let fee = 0;
        let quoteId: string | null = null;
        if (provider) {
          if (!input.deliveryQuoteToken)
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Atualize a cotação da entrega antes de pagar.",
            });
          try {
            const quote = decryptJson<DeliveryQuotePayload>(
              input.deliveryQuoteToken
            );
            if (
              quote.companyId !== company.id ||
              quote.provider !== provider ||
              quote.expiresAt <= Date.now() ||
              quote.addressHash !==
                deliveryAddressHash(
                  company.id,
                  provider,
                  input.address,
                  input.addressNumber,
                  company.pickupAddress ?? ""
                )
            ) {
              throw new Error("invalid quote");
            }
            fee = quote.fee;
            quoteId = quote.quoteId;
          } catch {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "A cotação da entrega expirou ou o endereço mudou. Aguarde a nova cotação.",
            });
          }
        }
        const {
          companySlug,
          deliveryQuoteToken: _token,
          fulfillment: _fulfillment,
          ...orderInput
        } = input;
        const created = await createCustomerOrder(company.id, {
          ...orderInput,
          pickup,
          deliveryFee: fee,
          deliveryQuoteId: quoteId,
          accessToken: requireCustomerAccessToken(ctx.req),
          customerTrackingToken: randomUUID(),
          customerEmail: input.email,
        });
        if (created.orderId && input.paymentMethod === "cash_on_delivery")
          await notifyOrderEvent(created.orderId, "paid");
        return created;
      }),
    createManual: companyAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(160),
          phone: z.string().min(8).max(30),
          address: z.string().trim().min(5).max(500),
          addressNumber: z.string().trim().min(1).max(32),
          items: z
            .array(
              z.object({
                menuItemId: z.number().int().positive(),
                quantity: z.number().int().positive().max(50),
                observation: z.string().max(300).optional(),
              })
            )
            .min(1)
            .max(30),
          notes: z.string().max(2000).optional(),
          paymentMode: z
            .enum(["cash_on_delivery", "mercadopago_link"])
            .default("cash_on_delivery"),
          payerEmail: z.string().email().max(254).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { paymentMode, payerEmail, ...orderInput } = input;
        const provider = await getActiveDeliveryProvider(ctx.companyId);
        let deliveryFee = 0;
        let deliveryQuoteId: string | null = null;
        if (provider) {
          const company = await getCompanyById(ctx.companyId);
          if (!company?.pickupAddress)
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Cadastre o endereço de retirada da loja antes de lançar o pedido.",
            });
          const dropoffAddress = `${input.address}, nº ${input.addressNumber}`;
          if (provider === "uber_direct") {
            const quote = await quoteUberDelivery({
              companyId: ctx.companyId,
              pickupAddress: company.pickupAddress,
              dropoffAddress,
            });
            deliveryFee = quote.fee;
            deliveryQuoteId = quote.quoteId;
          } else if (provider === "own_courier") {
            const config = await getIntegrationCredentials<{
              pricePerKm: number;
              pickupLatitude: number;
              pickupLongitude: number;
            }>(ctx.companyId, "own_courier");
            if (!config)
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message:
                  "Configure tarifa/km e coordenadas do motoboy próprio.",
              });
            const quote = await quoteOwnCourier({
              pickupAddress: company.pickupAddress,
              pickupLatitude: config.pickupLatitude,
              pickupLongitude: config.pickupLongitude,
              dropoffAddress,
              pricePerKm: config.pricePerKm,
            });
            deliveryFee = quote.fee;
          } else {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Este provedor não disponibiliza cotação dinâmica para pedido manual.",
            });
          }
        }
        const created = await createCustomerOrder(ctx.companyId, {
          ...orderInput,
          deliveryFee,
          deliveryQuoteId,
          accessToken: randomUUID(),
          customerTrackingToken: randomUUID(),
          paymentMethod: paymentMode,
        });
        if (
          paymentMode !== "mercadopago_link" ||
          !created.persisted ||
          !created.orderId
        )
          return { ...created, paymentLink: null };
        try {
          return {
            ...created,
            ...(await createManualPaymentLink(
              ctx.companyId,
              created.orderId,
              payerEmail
            )),
          };
        } catch {
          return {
            ...created,
            paymentLink: null,
            paymentLinkError:
              "O pedido foi criado, mas não foi possível gerar o link. Use ‘Gerar link’ para tentar novamente.",
          };
        }
      }),
    createManualPaymentLink: companyAdminProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        createManualPaymentLink(ctx.companyId, input.orderId)
      ),
    markCashReceived: companyAdminProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const found = await getOrderById(ctx.companyId, input.orderId);
        if (!found)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pedido não encontrado.",
          });
        if (found.order.paymentMethod !== "cash_on_delivery")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Só pedidos configurados para pagamento em dinheiro podem ser marcados como recebidos aqui.",
          });
        if (found.order.paymentStatus !== "approved")
          await setOrderPayment(input.orderId, {
            paymentStatus: "approved",
            platformFeeAmount: "0.00",
          });
        return { orderId: input.orderId, paymentStatus: "approved" as const };
      }),
    history: publicProcedure
      .input(z.object({ companySlug: z.string(), phone: z.string().min(8) }))
      .query(async ({ ctx, input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        return listCustomerOrders(
          company.id,
          input.phone,
          requireCustomerAccessToken(ctx.req)
        );
      }),
    advanceStatus: companyAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(ORDER_STATUS_FLOW),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const before = await getOrderById(ctx.companyId, input.id);
        if (input.status === "delivered") {
          const current = before;
          if (current?.order.driverTrackingTokenHash)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "O motoboy precisa confirmar a entrega com o código do cliente.",
            });
        }
        const result = await advanceOrderStatus(
          ctx.companyId,
          input.id,
          input.status
        );
        // Avisa o cliente só quando o pedido avança (voltar status não envia mensagem).
        const event = eventForStatus(input.status);
        if (
          result.persisted &&
          event &&
          before &&
          isReadyForKitchen(before.order) &&
          isForwardMove(before.order.status, input.status)
        )
          await notifyOrderEvent(input.id, event);
        if (
          input.status !== "ready" ||
          !result.persisted ||
          !isForwardMove(before?.order.status, "ready") ||
          (before && isPickupOrder(before.order))
        )
          return { ...result, delivery: null };

        const provider = await getActiveDeliveryProvider(ctx.companyId);
        if (!provider)
          return {
            ...result,
            delivery: unavailableDeliveryResponse(
              "uber_direct",
              "Nenhum provedor de entrega conectado. Configure em Integrações."
            ),
          };

        if (provider === "own_courier") {
          const driverToken = randomUUID();
          const issued = await issueDriverTrackingToken(
            ctx.companyId,
            input.id,
            driverToken
          );
          if (!issued)
            return {
              ...result,
              delivery: unavailableDeliveryResponse(
                "own_courier",
                "O link do motoboy só pode ser emitido quando o pedido estiver pronto."
              ),
            };
          return {
            ...result,
            delivery: {
              provider: "own_courier" as const,
              available: true as const,
              trackingUrl: null,
              driverToken,
            },
          };
        }

        try {
          const [company, order] = await Promise.all([
            getCompanyById(ctx.companyId),
            getOrderById(ctx.companyId, input.id),
          ]);
          if (!company?.pickupAddress)
            return {
              ...result,
              delivery: unavailableDeliveryResponse(
                provider,
                "Cadastre o endereço de retirada da empresa em Integrações."
              ),
            };
          if (!order?.customer)
            return {
              ...result,
              delivery: unavailableDeliveryResponse(
                provider,
                "Pedido sem endereço de entrega associado."
              ),
            };

          const deliveryInput = {
            companyId: ctx.companyId,
            pickupAddress: company.pickupAddress,
            orderId: input.id,
            dropoffAddress:
              order.order.deliveryAddress ?? order.customer.address ?? "",
            dropoffName: order.customer.name,
            dropoffPhone: order.customer.phone,
          };
          const delivery =
            provider === "uber_direct"
              ? await createUberDelivery({
                  ...deliveryInput,
                  companyName: company.name,
                  quoteId:
                    order.order.deliveryQuoteId ??
                    (
                      await quoteUberDelivery({
                        companyId: ctx.companyId,
                        pickupAddress: company.pickupAddress,
                        dropoffAddress: deliveryInput.dropoffAddress,
                      })
                    ).quoteId,
                  manifestItems: order.items.map(item => ({
                    name: item.itemName,
                    quantity: item.quantity,
                  })),
                })
              : await createLalamoveDelivery(deliveryInput);

          await setOrderDelivery(input.id, {
            trackingUrl: delivery.trackingUrl,
            externalDeliveryId: delivery.deliveryId,
          });
          return {
            ...result,
            delivery: {
              provider,
              available: true as const,
              trackingUrl: delivery.trackingUrl,
            },
          };
        } catch (error) {
          console.error(`[Delivery] ${provider} dispatch failed:`, error);
          return {
            ...result,
            delivery: unavailableDeliveryResponse(
              provider,
              "Falha ao acionar o despacho automático. Tente novamente ou acione manualmente."
            ),
          };
        }
      }),
  }),
  dashboard: router({
    summary: companyAdminProcedure.query(({ ctx }) =>
      getDashboardSummary(ctx.companyId)
    ),
  }),
  adminMenu: router({
    list: companyAdminProcedure.query(({ ctx }) =>
      listAdminMenu(ctx.companyId)
    ),
    categories: companyAdminProcedure.query(({ ctx }) =>
      listMenuCategories(ctx.companyId)
    ),
    createCategory: companyAdminProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120) }))
      .mutation(({ ctx, input }) => createMenuCategory(ctx.companyId, input)),
    create: companyAdminProcedure
      .input(menuItemInput)
      .mutation(async ({ ctx, input }) => {
        const item = await createMenuItem(ctx.companyId, input);
        if (!item)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Categoria inválida.",
          });
        return item;
      }),
    update: companyAdminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: menuItemInput.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await updateMenuItem(ctx.companyId, input.id, input.data);
        if (!item)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item não encontrado.",
          });
        return item;
      }),
    delete: companyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await deleteMenuItem(ctx.companyId, input.id)))
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item não encontrado.",
          });
        return { success: true };
      }),
  }),
  whatsapp: router({
    // Nunca devolve segredos: só o que a tela precisa (status, QR para escanear, preferências).
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const bot = await getWhatsappBot(ctx.companyId);
      const heartbeat = bot?.heartbeatAt
        ? new Date(
            bot.heartbeatAt.endsWith("Z")
              ? bot.heartbeatAt
              : `${bot.heartbeatAt}Z`
          ).getTime()
        : 0;
      return {
        desired: bot?.desired ?? "disconnected",
        status: bot?.status ?? "idle",
        qr: bot?.status === "qr" ? bot.qr : null,
        phone: bot?.phone ?? null,
        error: bot?.error ?? null,
        aiEnabled: bot?.aiEnabled ?? true,
        instructions: bot?.instructions ?? "",
        serviceOnline: Date.now() - heartbeat < BOT_HEARTBEAT_MAX_AGE_MS,
      };
    }),
    connect: companyAdminProcedure.mutation(async ({ ctx }) => {
      await requestWhatsappConnect(ctx.companyId);
      return { success: true };
    }),
    disconnect: companyAdminProcedure.mutation(async ({ ctx }) => {
      await requestWhatsappDisconnect(ctx.companyId);
      return { success: true };
    }),
    updateSettings: companyAdminProcedure
      .input(
        z.object({
          aiEnabled: z.boolean().optional(),
          instructions: z.string().trim().max(1500).nullish(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateWhatsappSettings(ctx.companyId, input);
        return { success: true };
      }),
  }),
  inventory: router({
    list: companyAdminProcedure.query(({ ctx }) =>
      listInventory(ctx.companyId)
    ),
    movements: companyAdminProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(100).default(100) })
          .optional()
      )
      .query(({ ctx, input }) =>
        listInventoryMovements(ctx.companyId, input?.limit ?? 100)
      ),
    createItem: companyAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(160),
          unit: z.enum(["un", "kg", "g", "L", "ml", "cx", "pct"]),
          minimumQuantity: z.number().min(0).max(1_000_000_000),
          costPerUnit: z.number().min(0).max(100_000_000),
        })
      )
      .mutation(({ ctx, input }) => createInventoryItem(ctx.companyId, input)),
    recordMovement: companyAdminProcedure
      .input(
        z.object({
          itemId: z.number().int().positive(),
          type: z.enum(["in", "out", "adjustment"]),
          quantity: z.number().min(0).max(1_000_000_000),
          reason: z.string().trim().min(1).max(160),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.type !== "adjustment" && input.quantity <= 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A quantidade precisa ser maior que zero.",
          });
        try {
          const item = await recordInventoryMovement(ctx.companyId, input);
          if (!item)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Item de estoque não encontrado.",
            });
          return item;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (
            error instanceof Error &&
            /insufficient inventory|Estoque insuficiente/i.test(error.message)
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Estoque insuficiente para essa saída.",
            });
          throw error;
        }
      }),
  }),
  finance: router({
    recentExpenses: companyAdminProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(100).default(50) })
          .optional()
      )
      .query(({ ctx, input }) =>
        listRecentExpenses(ctx.companyId, input?.limit ?? 50)
      ),
    createExpense: companyAdminProcedure
      .input(
        z.object({
          description: z.string().trim().min(2).max(200),
          category: z.string().trim().min(1).max(80),
          amount: z.number().positive().max(100_000_000),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine(
              value => Number.isFinite(Date.parse(`${value}T12:00:00Z`)),
              "Data inválida."
            ),
          notes: z.string().trim().max(500).optional(),
        })
      )
      .mutation(({ ctx, input }) => createExpense(ctx.companyId, input)),
    report: companyAdminProcedure
      .input(
        z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .refine(
            ({ from, to }) =>
              from <= to &&
              (Date.parse(`${to}T12:00:00Z`) -
                Date.parse(`${from}T12:00:00Z`)) /
                86_400_000 <=
                730,
            "Selecione um período de até dois anos."
          )
      )
      .query(({ ctx, input }) =>
        getFinanceReport(ctx.companyId, input.from, input.to)
      ),
  }),
  payments: router({
    // Public: the customer checkout needs to know whether to render the live
    // Payment Brick (Pix/crédito/débito) and the seller's
    // public key to initialize the Brick client-side. Never expose the access token.
    checkoutConfig: publicProcedure
      .input(z.object({ companySlug: z.string() }))
      .query(async ({ input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        const [credentials, deliveryProvider] = await Promise.all([
          getConnectedCredentials(company.id),
          getActiveDeliveryProvider(company.id),
        ]);
        return {
          connected: Boolean(credentials),
          publicKey: credentials?.publicKey ?? null,
          deliveryProvider: deliveryProvider ?? null,
        };
      }),
    deliveryQuote: publicProcedure
      .input(
        z.object({
          companySlug: z.string(),
          address: z.string().trim().min(5).max(500),
          addressNumber: z.string().trim().min(1).max(32),
        })
      )
      .mutation(async ({ input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        const provider = await getActiveDeliveryProvider(company.id);
        if (!provider)
          return {
            provider: null,
            fee: 0,
            currency: "BRL",
            quoteToken: null,
            distanceKm: null,
            expiresAt: null,
          };
        if (!company.pickupAddress)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A loja ainda não cadastrou o endereço de retirada.",
          });
        const dropoffAddress = `${input.address.trim()}, nº ${input.addressNumber.trim()}`;
        try {
          let fee: number;
          let quoteId: string | null = null;
          let expiresAt: number;
          let distanceKm: number | null = null;
          if (provider === "uber_direct") {
            const quote = await quoteUberDelivery({
              companyId: company.id,
              pickupAddress: company.pickupAddress,
              dropoffAddress,
            });
            fee = quote.fee;
            quoteId = quote.quoteId;
            expiresAt = quote.expiresAt;
          } else if (provider === "own_courier") {
            const config = await getIntegrationCredentials<{
              pricePerKm: number;
              pickupLatitude: number;
              pickupLongitude: number;
            }>(company.id, "own_courier");
            if (
              !config ||
              !Number.isFinite(config.pricePerKm) ||
              !Number.isFinite(config.pickupLatitude) ||
              !Number.isFinite(config.pickupLongitude)
            ) {
              throw new Error(
                "Configure a tarifa por km e as coordenadas da loja em Integrações."
              );
            }
            const quote = await quoteOwnCourier({
              pickupAddress: company.pickupAddress,
              pickupLatitude: config.pickupLatitude,
              pickupLongitude: config.pickupLongitude,
              dropoffAddress,
              pricePerKm: config.pricePerKm,
            });
            fee = quote.fee;
            distanceKm = quote.distanceKm;
            expiresAt = Date.now() + 5 * 60_000;
          } else {
            throw new Error(
              "Esse provedor ainda não oferece cotação dinâmica no checkout. Configure Uber Direct ou motoboy próprio."
            );
          }
          const payload: DeliveryQuotePayload = {
            companyId: company.id,
            provider,
            fee,
            quoteId,
            addressHash: deliveryAddressHash(
              company.id,
              provider,
              input.address,
              input.addressNumber,
              company.pickupAddress
            ),
            expiresAt,
            ...(distanceKm === null ? {} : { distanceKm }),
          };
          return {
            provider,
            fee,
            currency: "BRL",
            quoteToken: encryptJson(payload),
            distanceKm,
            expiresAt,
          };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Não foi possível calcular a entrega.";
          throw new TRPCError({ code: "BAD_GATEWAY", message });
        }
      }),
    // Amount/description are derived from the persisted order — never trust
    // the client for the charge amount.
    create: publicProcedure
      .input(
        z.object({
          companySlug: z.string(),
          orderId: z.number().int().positive(),
          payerEmail: z.string().email(),
          paymentMethodId: z.string().optional(),
          token: z.string().optional(),
          installments: z.number().int().positive().optional(),
          issuerId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        if (isBoletoPaymentMethod(input.paymentMethodId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Pagamento por boleto não está disponível. Escolha Pix ou cartão.",
          });
        }
        const order = await getCustomerOrderById(
          company.id,
          input.orderId,
          requireCustomerAccessToken(ctx.req)
        );
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pedido não encontrado",
          });
        if (
          order.order.paymentStatus === "approved" ||
          (order.order.externalPaymentId &&
            order.order.paymentStatus === "pending")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este pedido já tem um pagamento em andamento ou aprovado.",
          });
        }
        const payment = await createPayment({
          companyId: company.id,
          orderId: input.orderId,
          transactionAmount: Number(order.order.total),
          description: `Pedido #${input.orderId} — ${company.name}`,
          payer: {
            email: input.payerEmail,
            name: order.customer?.name,
            phone: order.customer?.phone,
          },
          items: order.items.map(item => ({
            id: item.menuItemId,
            title: item.itemName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
          paymentMethodId: input.paymentMethodId,
          token: input.token,
          installments: input.installments,
          issuerId: input.issuerId,
        });
        const paymentStatus =
          payment.status === "approved" || payment.status === "rejected"
            ? payment.status
            : "pending";
        await setOrderPayment(input.orderId, {
          paymentStatus,
          externalPaymentId: String(payment.id),
          platformFeeAmount: payment.applicationFee.toFixed(2),
        });
        if (paymentStatus === "approved")
          await notifyOrderEvent(input.orderId, "paid");
        return payment;
      }),
    // Libera o pedido para outra forma de pagamento. Consulta o Mercado Pago
    // antes e depois de cancelar para nunca descartar um Pix que acabou de ser pago.
    cancelPending: publicProcedure
      .input(
        z.object({
          companySlug: z.string(),
          orderId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const company = await requireCompanyBySlug(input.companySlug);
        const found = await getCustomerOrderById(
          company.id,
          input.orderId,
          requireCustomerAccessToken(ctx.req)
        );
        if (!found)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pedido não encontrado",
          });
        if (found.order.paymentStatus === "approved")
          return { status: "approved" as const };
        const paymentId = found.order.externalPaymentId;
        if (!paymentId || found.order.paymentStatus !== "pending")
          return { status: "cancelled" as const };
        const markApproved = async () => {
          await setOrderPayment(input.orderId, {
            paymentStatus: "approved",
            externalPaymentId: paymentId,
          });
          await notifyOrderEvent(input.orderId, "paid");
          return { status: "approved" as const };
        };
        const current = await getPayment(company.id, paymentId);
        if (current.status === "approved") return markApproved();
        if (current.payment_method_id !== "pix")
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este pagamento está em análise e não pode ser trocado.",
          });
        if (
          current.status === "pending" &&
          !(await cancelPayment(company.id, paymentId))
        ) {
          const latest = await getPayment(company.id, paymentId);
          if (latest.status === "approved") return markApproved();
          if (latest.status === "pending")
            throw new TRPCError({
              code: "CONFLICT",
              message: "Não foi possível cancelar este Pix. Tente de novo.",
            });
        }
        await setOrderPayment(input.orderId, {
          paymentStatus: "rejected",
          externalPaymentId: null,
        });
        return { status: "cancelled" as const };
      }),
  }),
  tracking: router({
    customer: publicProcedure
      .input(z.object({ token: z.string().uuid() }))
      .query(async ({ input }) => {
        const tracking = await getCustomerTracking(input.token);
        if (!tracking)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link de rastreamento inválido ou expirado.",
          });
        return tracking;
      }),
    /** Pedidos do comprador logado (e-mail confirmado por código) nesta loja. */
    myOrders: publicProcedure
      .input(z.object({ companySlug: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user?.email)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Confirme seu e-mail para ver seus pedidos.",
          });
        if (!(await isSupabaseEmailConfirmed(ctx.req, ctx.user.email)))
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Confirme seu e-mail para ver seus pedidos.",
          });
        const company = await requireCompanyBySlug(input.companySlug);
        return listOrdersForEmail(company.id, ctx.user.email);
      }),
    mine: publicProcedure
      .input(z.object({ companySlug: z.string(), orderId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user?.email)
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com seu e-mail." });
        const company = await requireCompanyBySlug(input.companySlug);
        const tracking = await getTrackingForEmail(company.id, input.orderId, ctx.user.email);
        if (!tracking)
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        return tracking;
      }),
    driver: publicProcedure
      .input(z.object({ token: z.string().uuid() }))
      .query(async ({ input }) => {
        const tracking = await getDriverTrackingInfo(input.token);
        if (!tracking)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link privado do motoboy inválido ou expirado.",
          });
        return tracking;
      }),
    updateDriverLocation: publicProcedure
      .input(
        z.object({
          token: z.string().uuid(),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .mutation(async ({ input }) => {
        const before = await findOrderByDriverToken(input.token);
        const updated = await updateDriverLocation(
          input.token,
          input.latitude,
          input.longitude
        );
        if (!updated)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Link inválido ou entrega não está em andamento.",
          });
        if (before && before.status === "ready")
          await notifyOrderEvent(before.id, "out_for_delivery");
        return { updated: true };
      }),
    confirmDelivery: publicProcedure
      .input(
        z.object({
          token: z.string().uuid(),
          code: z.string().regex(/^\d{4}$/),
        })
      )
      .mutation(async ({ input }) => {
        const deliveringOrder = await findOrderByDriverToken(input.token);
        const delivered = await confirmDriverDelivery(input.token, input.code);
        if (!delivered)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Código incorreto ou entrega não está em andamento.",
          });
        if (deliveringOrder) await notifyOrderEvent(deliveringOrder.id, "delivered");
        return { delivered: true };
      }),
  }),
  integrations: router({
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const persisted = await getIntegrationsStatus(ctx.companyId);
      return {
        mercadopago: {
          connected: persisted.mercadopago,
          configured: isMercadoPagoConfigured(),
        },
        uberDirect: { connected: persisted.uber_direct },
        lalamove: { connected: persisted.lalamove },
        ownCourier: { connected: persisted.own_courier },
        ninetyNineDelivery: {
          connected: false,
          reason:
            "Sem API self-service pública — depende de parceria comercial com a 99.",
        },
        messaging: { connected: persisted.messaging },
      };
    }),
    mercadoPagoConnectUrl: companyAdminProcedure.query(({ ctx }) => {
      if (!isMercadoPagoConfigured())
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro.",
        });
      return { url: buildAuthorizeUrl(ctx.companyId) };
    }),
    setDeliveryProvider: companyAdminProcedure
      .input(
        z.discriminatedUnion("provider", [
          z.object({
            provider: z.literal("uber_direct"),
            clientId: z.string().min(1),
            clientSecret: z.string().min(1),
            customerId: z.string().min(1),
          }),
          z.object({
            provider: z.literal("lalamove"),
            apiKey: z.string().min(1),
            apiSecret: z.string().min(1),
          }),
          z.object({
            provider: z.literal("own_courier"),
            name: z.string().trim().min(1).max(120),
            phone: z.string().min(8).max(30),
            pricePerKm: z.number().positive().max(10000),
            pickupLatitude: z.number().min(-90).max(90),
            pickupLongitude: z.number().min(-180).max(180),
          }),
        ])
      )
      .mutation(async ({ ctx, input }) => {
        const { provider, ...credentials } = input;
        await saveIntegrationCredentials(ctx.companyId, provider, credentials);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
