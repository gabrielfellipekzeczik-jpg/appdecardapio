import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCheckoutState } from "@shared/checkout";
import { appendLocalHistory, readLocalHistory, type LocalOrderHistoryEntry } from "@shared/order-history";
import { trpc } from "@/lib/trpc";

export const fallbackMenu = [
  { id: 1, category: "Mais pedidos", name: "Caseira da semana", description: "Arroz soltinho, feijão cremoso, frango grelhado, purê de batata e salada fresca.", price: 24.9, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", tag: "Queridinha" },
  { id: 2, category: "Mais pedidos", name: "Bife acebolado", description: "Bife macio na chapa, arroz, feijão, farofa crocante e vinagrete da casa.", price: 28.9, image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85", tag: "Artesanal" },
  { id: 3, category: "Leves & fit", name: "Frango tropical", description: "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.", price: 26.9, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", tag: "Leve" },
  { id: 4, category: "Leves & fit", name: "Bowl da horta", description: "Quinoa, grão-de-bico, abóbora assada, avocado e molho de ervas.", price: 25.9, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", tag: "Vegetariana" },
  { id: 5, category: "Especiais", name: "Parmegiana de domingo", description: "Frango empanado, molho de tomate assado, queijo gratinado e batatas rústicas.", price: 32.9, image: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85", tag: "Especial" },
  { id: 6, category: "Especiais", name: "Lasanha de vó", description: "Massa artesanal, ragu de panela, bechamel e parmesão gratinado.", price: 30.9, image: "https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=900&q=85", tag: "Conforto" },
];

export type CartLine = { id: number; qty: number; observation: string };
export type PaymentMethod = "pix" | "credit_card" | "debit_card";
export type SavedOrder = LocalOrderHistoryEntry;

/**
 * All storefront data/state/behavior (menu, cart, checkout, payment) shared
 * by every visual template. Templates only differ in how this is laid out —
 * see client/src/storefront-templates/*.
 */
export function useStorefront(slug: string) {
  const companyQuery = trpc.company.bySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const company = companyQuery.data;

  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(() => JSON.parse(localStorage.getItem(`marmitaria-cart-${slug}`) || "[]"));
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", email: "" });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [clientRef] = useState(() => {
    const existing = localStorage.getItem("marmitaria-client-ref");
    if (existing) return existing;
    const created = `cliente-${crypto.randomUUID()}`;
    localStorage.setItem("marmitaria-client-ref", created);
    return created;
  });
  const [orderHistory, setOrderHistory] = useState<SavedOrder[]>(() => {
    return readLocalHistory(localStorage.getItem(`marmitaria-order-history-${slug}`) || "[]", clientRef);
  });
  const lastOrder = orderHistory[0] || null;
  const checkoutConfigQuery = trpc.payments.checkoutConfig.useQuery({ companySlug: slug }, { enabled: Boolean(slug), staleTime: 30_000 });
  const checkoutState = getCheckoutState(checkoutConfigQuery.data?.connected ?? false);
  const menuQuery = trpc.menu.list.useQuery({ companySlug: slug }, { enabled: Boolean(slug), staleTime: 60_000 });
  const historyInput = useMemo(() => ({ companySlug: slug, phone: customer.phone }), [slug, customer.phone]);
  const historyQuery = trpc.orders.history.useQuery(historyInput, { enabled: Boolean(slug) && customer.phone.length >= 8, staleTime: 30_000 });
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const orderDetailsQuery = trpc.orders.byId.useQuery({ companySlug: slug, id: selectedHistoryId || 0 }, { enabled: Boolean(slug && selectedHistoryId) });
  const paymentOrderQuery = trpc.orders.byId.useQuery({ companySlug: slug, id: orderId || 0 }, { enabled: Boolean(slug && orderId && pixQrCode), refetchInterval: 4000 });
  const createOrderMutation = trpc.orders.create.useMutation();
  const createPaymentMutation = trpc.payments.create.useMutation();

  useEffect(() => { if (company?.name) document.title = company.name; }, [company?.name]);
  useEffect(() => {
    if (orderDetailsQuery.data?.items?.length) {
      persistCart(orderDetailsQuery.data.items.map((item) => ({ id: item.menuItemId, qty: item.quantity, observation: item.observation || "" })));
      setCartOpen(true);
      toast.success("Pedido anterior restaurado no carrinho");
      setSelectedHistoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDetailsQuery.data]);
  useEffect(() => {
    if (pixQrCode && paymentOrderQuery.data?.order.paymentStatus === "approved") {
      toast.success("Pagamento confirmado! Seu pedido está na cozinha.");
      setPixQrCode(null);
      setCheckoutOpen(false);
    }
  }, [paymentOrderQuery.data, pixQrCode]);

  const menu = menuQuery.data?.length
    ? menuQuery.data.map(({ item, category }) => ({ id: item.id, category: category?.name || "Cardápio", name: item.name, description: item.description || "Preparado hoje na cozinha.", price: Number(item.price), image: item.imageUrl || fallbackMenu[0].image, tag: item.featured ? "Destaque" : "Da casa" }))
    : fallbackMenu;

  const categories = ["Todos", ...Array.from(new Set(menu.map((item) => item.category)))];
  const visibleMenu = activeCategory === "Todos" ? menu : menu.filter((item) => item.category === activeCategory);
  const cartDetails = cart.map((line) => ({ ...line, item: menu.find((item) => item.id === line.id)! })).filter((line) => line.item);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cartDetails.reduce((sum, line) => sum + line.item.price * line.qty, 0);
  const delivery = subtotal > 0 ? 5.9 : 0;
  const total = subtotal + delivery;

  function persistCart(next: CartLine[]) {
    setCart(next);
    localStorage.setItem(`marmitaria-cart-${slug}`, JSON.stringify(next));
    // Cart changed after an order was already created for the previous total — start fresh.
    if (orderId) { setOrderId(null); setPixQrCode(null); }
  }
  const add = (id: number) => {
    const existing = cart.find((line) => line.id === id);
    persistCart(existing ? cart.map((line) => line.id === id ? { ...line, qty: line.qty + 1 } : line) : [...cart, { id, qty: 1, observation: "" }]);
    toast.success("Adicionado ao seu pedido");
  };
  const changeQty = (id: number, delta: number) => persistCart(cart.map((line) => line.id === id ? { ...line, qty: Math.max(0, line.qty + delta) } : line).filter((line) => line.qty > 0));
  const updateObservation = (id: number, observation: string) => persistCart(cart.map((line) => line.id === id ? { ...line, observation } : line));

  const ensureOrderCreated = async (): Promise<number | null> => {
    if (orderId) return orderId;
    if (!customer.name || !customer.phone || !customer.address) { toast.error("Preencha seus dados para continuar"); return null; }
    if (checkoutState.paymentEnabled && !customer.email) { toast.error("Informe seu email para o pagamento"); return null; }
    const saved = { cart, customer, clientRef, createdAt: Date.now() } satisfies SavedOrder;
    localStorage.setItem(`marmitaria-last-order-${slug}`, JSON.stringify(saved));
    const nextHistory = appendLocalHistory(orderHistory, saved);
    localStorage.setItem(`marmitaria-order-history-${slug}`, JSON.stringify(nextHistory));
    setOrderHistory(nextHistory);
    const result = await createOrderMutation.mutateAsync({ companySlug: slug, name: customer.name, phone: customer.phone, address: customer.address, subtotal, deliveryFee: delivery, total, paymentMethod: checkoutState.paymentEnabled ? "mercadopago" : paymentMethod, notes: cartDetails.map(({ item, observation }) => `${item.name}: ${observation}`).filter(Boolean).join(" | "), items: cartDetails.map(({ item, qty, observation }) => ({ menuItemId: item.id, itemName: item.name, quantity: qty, unitPrice: item.price, observation })) });
    if (result.orderId) setOrderId(result.orderId);
    else toast.error("Não foi possível registrar o pedido agora.");
    return result.orderId;
  };
  const submitDemoOrder = async () => {
    const id = await ensureOrderCreated();
    if (id) toast.info("Pedido salvo. O pagamento será ativado após o cadastro do Mercado Pago.");
  };
  const handleBrickSubmit = async (formData: { payment_method_id: string; token?: string; installments?: number; issuer_id?: string; payer: { email: string } }) => {
    const id = await ensureOrderCreated();
    if (!id) throw new Error("Não foi possível criar o pedido");
    const payment = await createPaymentMutation.mutateAsync({ companySlug: slug, orderId: id, payerEmail: formData.payer.email, paymentMethodId: formData.payment_method_id, token: formData.token, installments: formData.installments, issuerId: formData.issuer_id });
    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code_base64;
    if (payment.status === "approved") { toast.success("Pagamento aprovado! Seu pedido está na cozinha."); setCheckoutOpen(false); }
    else if (qrCode) { setPixQrCode(qrCode); toast.info("Escaneie o QR code para concluir o pagamento via Pix."); }
    else toast.info(`Pagamento em análise (${payment.status_detail || payment.status}).`);
  };
  const repeatSavedOrder = (saved: SavedOrder) => {
    persistCart(saved.cart);
    setCustomer((current) => ({ ...saved.customer, email: current.email }));
    setCartOpen(true);
    toast.success("Pedido anterior restaurado no carrinho");
  };
  const repeatLastOrder = () => { if (lastOrder) repeatSavedOrder(lastOrder); };

  return {
    slug, company, companyQuery,
    activeCategory, setActiveCategory, categories, menu, visibleMenu, menuQuery,
    cartOpen, setCartOpen, cart, cartDetails, totalItems, subtotal, delivery, total,
    add, changeQty, updateObservation,
    checkoutOpen, setCheckoutOpen, customer, setCustomer, paymentMethod, setPaymentMethod,
    checkoutState, checkoutConfigQuery, historyQuery, setSelectedHistoryId,
    orderId, pixQrCode, createOrderMutation, createPaymentMutation,
    ensureOrderCreated, submitDemoOrder, handleBrickSubmit,
    orderHistory, lastOrder, repeatSavedOrder, repeatLastOrder,
  };
}

export type Storefront = ReturnType<typeof useStorefront>;
