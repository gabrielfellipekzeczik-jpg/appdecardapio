import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getCheckoutState } from "@shared/checkout";
import { calculateDeliveryFee } from "@shared/checkout";
import {
  appendLocalHistory,
  readLocalHistory,
  type LocalOrderHistoryEntry,
} from "@shared/order-history";
import {
  paymentFailureMessage,
  paymentRejectionMessage,
} from "@shared/payment-messages";
import { getStoreStatus, PICKUP_ADDRESS } from "@shared/store-rules";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

/** Used behind the cover/hero when a company hasn't uploaded their own photo yet — a moody restaurant interior reads much more "this is a real place" than a flat color gradient. */
export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

export type CartLine = { id: number; qty: number; observation: string };
export type Fulfillment = "delivery" | "pickup";
type OrderPaymentMethod = "mercadopago" | "cash_on_delivery";
export type SavedOrder = LocalOrderHistoryEntry;

const EMPTY_CUSTOMER = {
  name: "",
  phone: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  addressReference: "",
  email: "",
  postalCode: "",
};

/** Pagamento iniciado e ainda sem resposta. Fica salvo para sobreviver à ida ao app do banco. */
export type PendingPayment = {
  kind: "pix" | "review";
  orderId: number;
  paymentId: string;
  trackingToken: string | null;
  total: number;
  qrCode: string | null;
  copyPaste: string | null;
  ticketUrl: string | null;
  expiresAt: number | null;
  fingerprint: string;
  customer: typeof EMPTY_CUSTOMER;
  savedAt: number;
};

const draftKey = (slug: string) => `marmitaria-checkout-draft-${slug}`;

/** Dados do cliente ficam no aparelho: quem volta só confere e paga. */
function readDraft(slug: string): {
  customer: typeof EMPTY_CUSTOMER;
  fulfillment: Fulfillment;
} {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(slug)) ?? "{}");
    return {
      customer: { ...EMPTY_CUSTOMER, ...saved.customer },
      fulfillment: saved.fulfillment === "pickup" ? "pickup" : "delivery",
    };
  } catch {
    return { customer: EMPTY_CUSTOMER, fulfillment: "delivery" };
  }
}

/** Tempo que a tela dá para pagar o Pix antes de oferecer um novo. */
const PIX_WINDOW_MS = 30 * 60_000;
const PENDING_PAYMENT_MAX_AGE = 6 * 60 * 60_000;
const pendingPaymentKey = (slug: string) =>
  `marmitaria-pending-payment-${slug}`;

function readPendingPayment(slug: string): PendingPayment | null {
  try {
    const saved = JSON.parse(
      localStorage.getItem(pendingPaymentKey(slug)) ?? "null"
    ) as PendingPayment | null;
    if (saved?.orderId && Date.now() - saved.savedAt < PENDING_PAYMENT_MAX_AGE)
      return saved;
  } catch {
    // Dado corrompido: segue sem pagamento pendente.
  }
  localStorage.removeItem(pendingPaymentKey(slug));
  return null;
}

/**
 * All storefront data/state/behavior (menu, cart, checkout, payment) shared
 * by every visual template. Templates only differ in how this is laid out —
 * see client/src/storefront-templates/*.
 */
export function useStorefront(slug: string) {
  const companyQuery = trpc.company.bySlug.useQuery(
    { slug },
    { enabled: Boolean(slug) }
  );
  const company = companyQuery.data;

  const [activeCategory, setActiveCategory] = useState("Todos");
  const [pendingPayment, setPendingPaymentState] =
    useState<PendingPayment | null>(() => readPendingPayment(slug));
  const [cartOpen, setCartOpenState] = useState(Boolean(pendingPayment));
  const [cart, setCart] = useState<CartLine[]>(() =>
    JSON.parse(localStorage.getItem(`marmitaria-cart-${slug}`) || "[]")
  );
  const [draft] = useState(() => readDraft(slug));
  const [customer, setCustomer] = useState(
    pendingPayment?.customer ?? draft.customer
  );
  const [fulfillment, setFulfillmentState] = useState<Fulfillment>(
    draft.fulfillment
  );
  const [orderId, setOrderId] = useState<number | null>(
    pendingPayment?.orderId ?? null
  );
  const [customerTrackingToken, setCustomerTrackingToken] = useState<
    string | null
  >(pendingPayment?.trackingToken ?? null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    payOnDelivery: boolean;
    pickup: boolean;
    total: number;
  } | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [cardAttempt, setCardAttempt] = useState(0);
  const orderFingerprintRef = useRef(pendingPayment?.fingerprint ?? "");
  const [clientRef] = useState(() => {
    const existing = localStorage.getItem("marmitaria-client-ref");
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        existing
      )
    )
      return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("marmitaria-client-ref", created);
    return created;
  });
  const [orderHistory, setOrderHistory] = useState<SavedOrder[]>(() => {
    return readLocalHistory(
      localStorage.getItem(`marmitaria-order-history-${slug}`) || "[]",
      clientRef
    );
  });
  const lastOrder = orderHistory[0] || null;
  const checkoutConfigQuery = trpc.payments.checkoutConfig.useQuery(
    { companySlug: slug },
    { enabled: Boolean(slug), staleTime: 30_000 }
  );
  const checkoutState = getCheckoutState(
    checkoutConfigQuery.data?.connected ?? false
  );
  const menuQuery = trpc.menu.list.useQuery(
    { companySlug: slug },
    { enabled: Boolean(slug), staleTime: 60_000 }
  );
  const phoneDigits = customer.phone.replace(/\D/g, "");
  const historyInput = useMemo(
    () => ({ companySlug: slug, phone: phoneDigits }),
    [slug, phoneDigits, clientRef]
  );
  const historyQuery = trpc.orders.history.useQuery(historyInput, {
    enabled: Boolean(slug) && phoneDigits.length >= 10,
    staleTime: 30_000,
  });
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(
    null
  );
  const orderDetailsQuery = trpc.orders.byId.useQuery(
    { companySlug: slug, id: selectedHistoryId || 0 },
    { enabled: Boolean(slug && selectedHistoryId) }
  );
  const paymentOrderQuery = trpc.orders.byId.useQuery(
    { companySlug: slug, id: pendingPayment?.orderId || 0 },
    {
      enabled: Boolean(slug && pendingPayment),
      refetchInterval: 4000,
    }
  );
  const createOrderMutation = trpc.orders.create.useMutation();
  const createPaymentMutation = trpc.payments.create.useMutation();
  const cancelPendingMutation = trpc.payments.cancelPending.useMutation();
  const syncPendingMutation = trpc.payments.syncPending.useMutation();
  const deliveryQuoteMutation = trpc.payments.deliveryQuote.useMutation();
  const [deliveryQuote, setDeliveryQuote] = useState<{
    fee: number;
    quoteToken: string | null;
    distanceKm: number | null;
    expiresAt: number | null;
  } | null>(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState("");
  const quoteSequence = useRef(0);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const deliveryQuoteRef = useRef(deliveryQuote);
  deliveryQuoteRef.current = deliveryQuote;
  const quotedAddressRef = useRef("");

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const storeStatus = getStoreStatus(company?.openingHours, clock);
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey(slug),
        JSON.stringify({ customer, fulfillment })
      );
    } catch {
      // Sem armazenamento (aba privada): o checkout segue sem lembrar os dados.
    }
  }, [slug, customer, fulfillment]);

  function setPendingPayment(next: PendingPayment | null) {
    setPendingPaymentState(next);
    if (next)
      localStorage.setItem(pendingPaymentKey(slug), JSON.stringify(next));
    else localStorage.removeItem(pendingPaymentKey(slug));
  }
  function finishOrder(details: {
    payOnDelivery: boolean;
    pickup: boolean;
    total: number;
  }) {
    setCompletedOrder(details);
    setPendingPayment(null);
    setCart([]);
    localStorage.removeItem(`marmitaria-cart-${slug}`);
    orderFingerprintRef.current = "";
    setPaymentError("");
    setOrderComplete(true);
  }
  function reportPaymentFailure(message: string) {
    setPaymentError(message);
    setCardAttempt(value => value + 1);
    toast.error(message);
  }
  const setCartOpen = (open: boolean) => {
    if (open && orderComplete) {
      setOrderComplete(false);
      setOrderId(null);
      setCustomerTrackingToken(null);
    }
    setCartOpenState(open);
  };

  useEffect(() => {
    if (company?.name) document.title = company.name;
  }, [company?.name]);
  useEffect(() => {
    if (orderDetailsQuery.data?.items?.length) {
      persistCart(
        orderDetailsQuery.data.items.map(item => ({
          id: item.menuItemId,
          qty: item.quantity,
          observation: item.observation || "",
        }))
      );
      setCartOpen(true);
      toast.success("Pedido anterior restaurado no carrinho");
      setSelectedHistoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDetailsQuery.data]);
  const pendingOrderId = pendingPayment?.orderId;
  useEffect(() => {
    if (!pendingOrderId) return;
    const timer = window.setInterval(() => {
      syncPendingMutation.mutate(
        { companySlug: slug, orderId: pendingOrderId },
        { onError: () => undefined }
      );
    }, 15_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, pendingOrderId]);
  useEffect(() => {
    const order = paymentOrderQuery.data?.order;
    if (!pendingPayment || order?.id !== pendingPayment.orderId) return;
    if (order.paymentStatus === "approved") {
      toast.success("Pagamento confirmado! Seu pedido está na cozinha.");
      finishOrder({
        payOnDelivery: false,
        pickup: fulfillment === "pickup",
        total: pendingPayment.total,
      });
    } else if (
      order.paymentStatus === "rejected" &&
      order.externalPaymentId === pendingPayment.paymentId
    ) {
      setPendingPayment(null);
      reportPaymentFailure(
        pendingPayment.kind === "pix"
          ? "Este Pix não está mais disponível. Gere um novo pagamento."
          : paymentRejectionMessage()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOrderQuery.data, pendingPayment]);

  const menu = (menuQuery.data ?? []).map(({ item, category }) => ({
    id: item.id,
    category: category?.name || "Cardápio",
    name: item.name,
    description: item.description || "",
    price: Number(item.price),
    image: item.imageUrl || DEFAULT_HERO_IMAGE,
    tag: item.featured ? "Destaque" : "Da casa",
  }));

  const categories = [
    "Todos",
    ...Array.from(new Set(menu.map(item => item.category))),
  ];
  const visibleMenu =
    activeCategory === "Todos"
      ? menu
      : menu.filter(item => item.category === activeCategory);
  const cartDetails = cart
    .map(line => ({ ...line, item: menu.find(item => item.id === line.id)! }))
    .filter(line => line.item);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cartDetails.reduce(
    (sum, line) => sum + line.item.price * line.qty,
    0
  );
  const deliveryAddress = [
    customer.address,
    customer.addressComplement,
    customer.addressReference && `Referência: ${customer.addressReference}`,
  ]
    .filter(Boolean)
    .join(", ");
  const pickupAvailable = Boolean(
    company?.pickupEnabled && company.pickupAddress
  );
  const isPickup = pickupAvailable && fulfillment === "pickup";
  const deliveryProvider = isPickup
    ? null
    : checkoutConfigQuery.data?.deliveryProvider;
  const paymentInProgress = Boolean(pendingPayment);
  useEffect(() => {
    if (paymentInProgress || !deliveryProvider || !deliveryQuote?.expiresAt)
      return;
    const refreshIn = Math.max(
      0,
      deliveryQuote.expiresAt - Date.now() - 30_000
    );
    const timer = window.setTimeout(
      () => setQuoteRefreshKey(value => value + 1),
      refreshIn
    );
    return () => window.clearTimeout(timer);
  }, [paymentInProgress, deliveryProvider, deliveryQuote?.expiresAt]);
  useEffect(() => {
    const sequence = ++quoteSequence.current;
    if (paymentInProgress) {
      setDeliveryQuoteLoading(false);
      return;
    }
    if (
      !deliveryProvider ||
      !deliveryAddress.trim() ||
      !customer.addressNumber.trim() ||
      subtotal <= 0
    ) {
      setDeliveryQuote(null);
      setDeliveryQuoteLoading(false);
      setDeliveryQuoteError("");
      return;
    }
    // Renovar a cotação do mesmo endereço não pode mexer na tela: trocar o bloco
    // de pagamento desmontaria o formulário de cartão que o cliente está digitando.
    const addressKey = `${deliveryAddress}|${customer.addressNumber}`;
    const currentQuote = deliveryQuoteRef.current;
    const renewing =
      quotedAddressRef.current === addressKey &&
      Boolean(currentQuote?.expiresAt && currentQuote.expiresAt > Date.now());
    quotedAddressRef.current = addressKey;
    if (!renewing) {
      setDeliveryQuote(null);
      setDeliveryQuoteError("");
      setDeliveryQuoteLoading(true);
    }
    const timer = window.setTimeout(async () => {
      try {
        const quote = await deliveryQuoteMutation.mutateAsync({
          companySlug: slug,
          address: deliveryAddress,
          addressNumber: customer.addressNumber,
        });
        if (sequence === quoteSequence.current) {
          setDeliveryQuote({
            fee: quote.fee,
            quoteToken: quote.quoteToken,
            distanceKm: quote.distanceKm,
            expiresAt: quote.expiresAt,
          });
          setDeliveryQuoteError("");
        }
      } catch (error) {
        const stillValid =
          (deliveryQuoteRef.current?.expiresAt ?? 0) > Date.now() + 10_000;
        if (sequence === quoteSequence.current && renewing && stillValid) {
          window.setTimeout(
            () => setQuoteRefreshKey(value => value + 1),
            10_000
          );
        } else if (sequence === quoteSequence.current) {
          setDeliveryQuote(null);
          setDeliveryQuoteError(
            error instanceof Error
              ? error.message
              : "Não foi possível calcular a entrega."
          );
        }
      } finally {
        if (sequence === quoteSequence.current) setDeliveryQuoteLoading(false);
      }
    }, 1200);
    return () => {
      window.clearTimeout(timer);
      quoteSequence.current += 1;
    };
  }, [
    slug,
    paymentInProgress,
    deliveryProvider,
    deliveryAddress,
    customer.addressNumber,
    subtotal,
    quoteRefreshKey,
  ]);
  const delivery = calculateDeliveryFee(
    subtotal,
    customer.address,
    Boolean(deliveryProvider),
    customer.addressNumber,
    deliveryQuote?.fee ?? 0
  );
  const total = subtotal + delivery;
  const fingerprintFor = (method: OrderPaymentMethod) =>
    JSON.stringify([
      cartDetails.map(({ id, qty, observation }) => [id, qty, observation]),
      customer.name,
      phoneDigits,
      isPickup || deliveryAddress,
      customer.addressNumber,
      total,
      method,
    ]);

  /** Retorna false quando há pagamento em aberto: mudar o carrinho agora deixaria o Pix valendo outro pedido. */
  function persistCart(next: CartLine[]) {
    if (pendingPayment) {
      setCartOpen(true);
      toast.info(
        "Conclua o pagamento em aberto ou troque a forma de pagamento antes de alterar o pedido."
      );
      return false;
    }
    setCart(next);
    localStorage.setItem(`marmitaria-cart-${slug}`, JSON.stringify(next));
    setPaymentError("");
    // Cart changed after an order was already created for the previous total — start fresh.
    if (orderId) {
      setOrderId(null);
      setCustomerTrackingToken(null);
      setOrderComplete(false);
    }
    return true;
  }
  const add = (id: number) => {
    const existing = cart.find(line => line.id === id);
    const saved = persistCart(
      existing
        ? cart.map(line =>
            line.id === id ? { ...line, qty: line.qty + 1 } : line
          )
        : [...cart, { id, qty: 1, observation: "" }]
    );
    if (saved) toast.success("Adicionado ao seu pedido");
  };
  const changeQty = (id: number, delta: number) =>
    persistCart(
      cart
        .map(line =>
          line.id === id
            ? { ...line, qty: Math.max(0, line.qty + delta) }
            : line
        )
        .filter(line => line.qty > 0)
    );
  const updateObservation = (id: number, observation: string) =>
    persistCart(
      cart.map(line => (line.id === id ? { ...line, observation } : line))
    );

  const trackingTokenRef = useRef(customerTrackingToken);
  const ensureOrderCreated = async (
    method: OrderPaymentMethod,
    orderNote = ""
  ): Promise<number | null> => {
    // Depois de uma recusa o cliente pode corrigir o endereço: só reaproveita o pedido se nada mudou.
    const fingerprint = fingerprintFor(method);
    if (orderId && orderFingerprintRef.current === fingerprint) return orderId;
    if (
      !customer.name.trim() ||
      phoneDigits.length < 10 ||
      (!isPickup && (!customer.address || !customer.addressNumber.trim()))
    ) {
      toast.error(
        isPickup
          ? "Preencha nome e WhatsApp."
          : "Preencha nome, WhatsApp, endereço e número."
      );
      return null;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (
      !authData.user?.email_confirmed_at ||
      authData.user.email?.toLowerCase() !== customer.email.trim().toLowerCase()
    ) {
      toast.error("Confirme seu e-mail antes de pagar.");
      return null;
    }
    if (
      deliveryProvider &&
      (!deliveryQuote?.quoteToken ||
        !deliveryQuote.expiresAt ||
        deliveryQuote.expiresAt <= Date.now())
    ) {
      toast.error("Aguarde uma cotação válida da entrega antes de pagar.");
      return null;
    }
    const result = await createOrderMutation.mutateAsync({
      companySlug: slug,
      email: customer.email.trim().toLowerCase(),
      name: customer.name.trim(),
      phone: phoneDigits,
      address: isPickup ? PICKUP_ADDRESS : deliveryAddress,
      addressNumber: isPickup ? "s/n" : customer.addressNumber.trim(),
      deliveryQuoteToken: deliveryQuote?.quoteToken ?? undefined,
      paymentMethod: method,
      fulfillment: isPickup ? "pickup" : "delivery",
      notes: [
        ...cartDetails
          .filter(({ observation }) => observation.trim())
          .map(({ item, observation }) => `${item.name}: ${observation.trim()}`),
        orderNote,
      ]
        .filter(Boolean)
        .join(" | "),
      items: cartDetails.map(({ item, qty, observation }) => ({
        menuItemId: item.id,
        quantity: qty,
        observation,
      })),
    });
    if (!result.orderId) {
      toast.error("Não foi possível registrar o pedido agora.");
      return null;
    }
    const saved = {
      cart,
      customer,
      clientRef,
      createdAt: Date.now(),
    } satisfies SavedOrder;
    localStorage.setItem(
      `marmitaria-last-order-${slug}`,
      JSON.stringify(saved)
    );
    const nextHistory = appendLocalHistory(orderHistory, saved);
    localStorage.setItem(
      `marmitaria-order-history-${slug}`,
      JSON.stringify(nextHistory)
    );
    setOrderHistory(nextHistory);
    setOrderId(result.orderId);
    setCustomerTrackingToken(result.customerTrackingToken);
    orderFingerprintRef.current = fingerprint;
    trackingTokenRef.current = result.customerTrackingToken;
    return result.orderId;
  };
  /** Pedido pago na entrega ou retirada: não passa pelo Mercado Pago. */
  const placeCashOrder = async (changeFor: string) => {
    const id = await ensureOrderCreated(
      "cash_on_delivery",
      changeFor.trim() ? `Troco para ${changeFor.trim()}` : ""
    );
    if (!id) throw new Error("Não foi possível criar o pedido");
    finishOrder({ payOnDelivery: true, pickup: isPickup, total });
  };
  const handleBrickSubmit = async (formData: {
    payment_method_id: string;
    token?: string;
    installments?: number;
    issuer_id?: string;
    payer: { email: string };
  }) => {
    if (!checkoutState.paymentEnabled)
      throw new Error(
        "O Mercado Pago ainda não está conectado para esta loja."
      );
    const id = await ensureOrderCreated("mercadopago");
    if (!id) throw new Error("Não foi possível criar o pedido");
    const payment = await createPaymentMutation.mutateAsync({
      companySlug: slug,
      orderId: id,
      payerEmail: formData.payer.email,
      paymentMethodId: formData.payment_method_id,
      token: formData.token,
      installments: formData.installments,
      issuerId: formData.issuer_id,
    });
    const qrCode =
      payment.point_of_interaction?.transaction_data?.qr_code_base64;
    const qrCopyPaste = payment.point_of_interaction?.transaction_data?.qr_code;
    if (payment.status === "approved") {
      toast.success("Pagamento aprovado! Seu pedido está na cozinha.");
      finishOrder({ payOnDelivery: false, pickup: isPickup, total });
    } else if (payment.status === "rejected") {
      reportPaymentFailure(paymentRejectionMessage(payment.status_detail));
    } else {
      const isPix = Boolean(qrCode || qrCopyPaste);
      setPendingPayment({
        kind: isPix ? "pix" : "review",
        orderId: id,
        paymentId: String(payment.id),
        trackingToken: trackingTokenRef.current,
        total,
        qrCode: qrCode ?? null,
        copyPaste: qrCopyPaste ?? null,
        ticketUrl:
          payment.point_of_interaction?.transaction_data?.ticket_url ?? null,
        expiresAt: isPix ? Date.now() + PIX_WINDOW_MS : null,
        fingerprint: orderFingerprintRef.current,
        customer,
        savedAt: Date.now(),
      });
    }
  };
  /** Cancela o Pix em aberto antes de liberar outra forma, para o mesmo pedido nunca ser pago duas vezes. */
  const changePaymentMethod = async () => {
    if (!pendingPayment) return;
    try {
      const result = await cancelPendingMutation.mutateAsync({
        companySlug: slug,
        orderId: pendingPayment.orderId,
      });
      if (result.status === "approved") {
        toast.success("Seu Pix já foi pago! Pedido confirmado.");
        finishOrder({
          payOnDelivery: false,
          pickup: isPickup,
          total: pendingPayment.total,
        });
      } else setPendingPayment(null);
    } catch (error) {
      toast.error(paymentFailureMessage(error));
    }
  };
  const repeatSavedOrder = (saved: SavedOrder) => {
    if (!persistCart(saved.cart)) return;
    setCustomer(current => ({
      ...current,
      ...saved.customer,
      email: current.email,
    }));
    setCartOpen(true);
    toast.success("Pedido anterior restaurado no carrinho");
  };
  const repeatLastOrder = () => {
    if (lastOrder) repeatSavedOrder(lastOrder);
  };

  return {
    slug,
    company,
    companyQuery,
    activeCategory,
    setActiveCategory,
    categories,
    menu,
    visibleMenu,
    menuQuery,
    cartOpen,
    setCartOpen,
    cart,
    cartDetails,
    totalItems,
    subtotal,
    delivery,
    total,
    deliveryQuote,
    deliveryQuoteLoading,
    deliveryQuoteError,
    add,
    changeQty,
    updateObservation,
    customer,
    setCustomer,
    fulfillment: isPickup ? ("pickup" as const) : ("delivery" as const),
    setFulfillment: setFulfillmentState,
    pickupAvailable,
    needsDeliveryQuote: Boolean(deliveryProvider),
    cashAvailable: Boolean(company?.acceptsCashOnDelivery),
    storeStatus,
    completedOrder,
    placeCashOrder,
    checkoutState,
    checkoutConfigQuery,
    historyQuery,
    setSelectedHistoryId,
    orderId,
    customerTrackingToken,
    orderComplete,
    pendingPayment,
    paymentError,
    setPaymentError,
    reportPaymentFailure,
    cardAttempt,
    changePaymentMethod,
    changingPaymentMethod: cancelPendingMutation.isPending,
    createOrderMutation,
    createPaymentMutation,
    ensureOrderCreated,
    handleBrickSubmit,
    orderHistory,
    lastOrder,
    repeatSavedOrder,
    repeatLastOrder,
  };
}

export type Storefront = ReturnType<typeof useStorefront>;
