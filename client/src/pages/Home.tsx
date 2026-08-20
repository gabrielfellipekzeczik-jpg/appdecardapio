import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Clock3, MapPin, Minus, Plus, ShoppingBag, Sparkles, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getCheckoutState } from "@shared/checkout";
import { appendLocalHistory, readLocalHistory, type LocalOrderHistoryEntry } from "@shared/order-history";
import { trpc } from "@/lib/trpc";
import { MercadoPagoBrick } from "@/components/MercadoPagoBrick";

const fallbackMenu = [
  { id: 1, category: "Mais pedidos", name: "Caseira da semana", description: "Arroz soltinho, feijão cremoso, frango grelhado, purê de batata e salada fresca.", price: 24.9, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", tag: "Queridinha" },
  { id: 2, category: "Mais pedidos", name: "Bife acebolado", description: "Bife macio na chapa, arroz, feijão, farofa crocante e vinagrete da casa.", price: 28.9, image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85", tag: "Artesanal" },
  { id: 3, category: "Leves & fit", name: "Frango tropical", description: "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.", price: 26.9, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", tag: "Leve" },
  { id: 4, category: "Leves & fit", name: "Bowl da horta", description: "Quinoa, grão-de-bico, abóbora assada, avocado e molho de ervas.", price: 25.9, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", tag: "Vegetariana" },
  { id: 5, category: "Especiais", name: "Parmegiana de domingo", description: "Frango empanado, molho de tomate assado, queijo gratinado e batatas rústicas.", price: 32.9, image: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85", tag: "Especial" },
  { id: 6, category: "Especiais", name: "Lasanha de vó", description: "Massa artesanal, ragu de panela, bechamel e parmesão gratinado.", price: 30.9, image: "https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=900&q=85", tag: "Conforto" },
];

type CartLine = { id: number; qty: number; observation: string };
type PaymentMethod = "pix" | "credit_card" | "debit_card";
type SavedOrder = LocalOrderHistoryEntry;

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(() => JSON.parse(localStorage.getItem("marmitaria-cart") || "[]"));
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
    return readLocalHistory(localStorage.getItem("marmitaria-order-history") || "[]", clientRef);
  });
  const lastOrder = orderHistory[0] || null;
  const checkoutConfigQuery = trpc.payments.checkoutConfig.useQuery(undefined, { staleTime: 30_000 });
  const checkoutState = getCheckoutState(checkoutConfigQuery.data?.connected ?? false);
  const menuQuery = trpc.menu.list.useQuery(undefined, { staleTime: 60_000 });
  const historyInput = useMemo(() => ({ phone: customer.phone }), [customer.phone]);
  const historyQuery = trpc.orders.history.useQuery(historyInput, { enabled: customer.phone.length >= 8, staleTime: 30_000 });
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const orderDetailsQuery = trpc.orders.byId.useQuery({ id: selectedHistoryId || 0 }, { enabled: Boolean(selectedHistoryId) });
  const paymentOrderQuery = trpc.orders.byId.useQuery({ id: orderId || 0 }, { enabled: Boolean(orderId && pixQrCode), refetchInterval: 4000 });
  const createOrderMutation = trpc.orders.create.useMutation();
  const createPaymentMutation = trpc.payments.create.useMutation();
  useEffect(() => {
    if (orderDetailsQuery.data?.items?.length) {
      persistCart(orderDetailsQuery.data.items.map((item) => ({ id: item.menuItemId, qty: item.quantity, observation: item.observation || "" })));
      setCartOpen(true);
      toast.success("Pedido anterior restaurado no carrinho");
      setSelectedHistoryId(null);
    }
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

  const persistCart = (next: CartLine[]) => {
    setCart(next);
    localStorage.setItem("marmitaria-cart", JSON.stringify(next));
    // Cart changed after an order was already created for the previous total — start fresh.
    if (orderId) { setOrderId(null); setPixQrCode(null); }
  };
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
    localStorage.setItem("marmitaria-last-order", JSON.stringify(saved));
    const nextHistory = appendLocalHistory(orderHistory, saved);
    localStorage.setItem("marmitaria-order-history", JSON.stringify(nextHistory));
    setOrderHistory(nextHistory);
    const result = await createOrderMutation.mutateAsync({ name: customer.name, phone: customer.phone, address: customer.address, subtotal, deliveryFee: delivery, total, paymentMethod: checkoutState.paymentEnabled ? "mercadopago" : paymentMethod, notes: cartDetails.map(({ item, observation }) => `${item.name}: ${observation}`).filter(Boolean).join(" | "), items: cartDetails.map(({ item, qty, observation }) => ({ menuItemId: item.id, itemName: item.name, quantity: qty, unitPrice: item.price, observation })) });
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
    const payment = await createPaymentMutation.mutateAsync({ orderId: id, payerEmail: formData.payer.email, paymentMethodId: formData.payment_method_id, token: formData.token, installments: formData.installments, issuerId: formData.issuer_id });
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

  return <div className="min-h-screen bg-[#fbfaf7] text-[#29251f]">
    <header className="sticky top-0 z-30 border-b border-[#e9e3d9]/80 bg-[#fbfaf7]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3"><div className="brand-mark"><Utensils className="h-5 w-5" /></div><div><p className="font-display text-xl font-bold leading-none tracking-tight">Casa na Marmita</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a06b3b]">comida de verdade</p></div></div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[#776e63] md:flex"><a href="#cardapio" className="hover:text-[#a05c32]">Cardápio</a><a href="#como-funciona" className="hover:text-[#a05c32]">Como funciona</a><a href="#historia" className="hover:text-[#a05c32]">Nossa cozinha</a></nav>
        <div className="flex items-center gap-3"><Link href="/admin"><Button variant="ghost" className="hidden text-[#776e63] hover:bg-[#f1ece3] sm:flex">Área da cozinha</Button></Link><Button aria-label={`Abrir pedido${totalItems > 0 ? ` com ${totalItems} itens` : ""}`} onClick={() => setCartOpen(true)} className="relative rounded-full bg-[#2f5d50] px-4 text-white shadow-lg shadow-[#2f5d50]/15 hover:bg-[#254a40]"><ShoppingBag className="mr-2 h-4 w-4" /> Pedido {totalItems > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8bd72] px-1 text-xs font-bold text-[#382718]">{totalItems}</span>}</Button></div>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-18 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-24 lg:pt-22"><div className="relative z-10"><div className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> Feita hoje, do nosso fogão para você</div><h1 className="mt-6 max-w-xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-[#29251f] sm:text-6xl lg:text-[78px]">Almoço com gosto de <em className="text-[#a05c32]">casa.</em></h1><p className="mt-7 max-w-md text-[17px] leading-8 text-[#776e63]">Marmitas generosas, ingredientes frescos e aquele cuidado que transforma uma refeição comum no melhor momento do dia.</p><div className="mt-9 flex flex-wrap items-center gap-4"><a href="#cardapio"><Button size="lg" className="h-13 rounded-full bg-[#a05c32] px-7 text-white shadow-lg shadow-[#a05c32]/20 hover:bg-[#8a4e2b]">Ver o cardápio <ArrowRight className="ml-2 h-4 w-4" /></Button></a><span className="text-sm text-[#776e63]">Feita em pequenos lotes, todos os dias.</span></div><div className="mt-12 flex items-center gap-7 border-t border-[#e9e3d9] pt-6 text-sm text-[#776e63]"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#a05c32]" /> 11h às 14h30</span><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#a05c32]" /> Entrega em até 45 min</span></div></div><div className="hero-photo-wrap"><div className="hero-photo"/><div className="hero-note"><span className="note-icon"><Check className="h-4 w-4" /></span><div><p className="font-semibold text-[#29251f]">Cardápio do dia</p><p className="text-xs text-[#776e63]">preparado com carinho</p></div></div><div className="hero-sun"/></div></div></section>

      <section id="cardapio" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 lg:px-8"><div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="section-kicker">Escolha seu momento</p><h2 className="mt-2 font-display text-4xl font-bold tracking-tight">O cardápio de hoje</h2><p className="mt-2 text-[#776e63]">Tudo feito em pequenos lotes para chegar fresco até você.</p></div><div className="flex items-center gap-2 text-sm text-[#776e63]"><span className="h-2 w-2 rounded-full bg-[#4f8b68]" /> Pedidos abertos até 14h30</div></div>{menuQuery.isLoading && <p role="status" className="mb-4 text-sm text-[#776e63]">Atualizando o cardápio...</p>}{menuQuery.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fff0d7] px-4 py-3 text-sm text-[#8a4e2b]">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}{visibleMenu.length === 0 && !menuQuery.isLoading && <p className="mb-4 rounded-xl bg-white px-4 py-5 text-sm text-[#776e63]">Nenhum item está disponível neste momento.</p>}<div className="category-scroll mb-8 flex gap-2 overflow-x-auto pb-2">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition ${activeCategory === category ? "bg-[#2f5d50] text-white shadow-md shadow-[#2f5d50]/15" : "bg-white text-[#776e63] ring-1 ring-[#e9e3d9] hover:bg-[#f4efe7]"}`}>{category}</button>)}</div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleMenu.map((item) => <Card key={item.id} className="menu-card overflow-hidden border-0 bg-white shadow-[0_10px_40px_rgba(67,48,32,0.06)]"><div className="relative h-56 overflow-hidden"><img src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-500 hover:scale-105"/><div className="absolute left-4 top-4"><Badge className="border-0 bg-[#fbfaf7]/90 text-[#8a4e2b] shadow-sm backdrop-blur">{item.tag}</Badge></div></div><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-xl font-bold">{item.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#776e63]">{item.description}</p></div><span className="whitespace-nowrap font-display text-xl font-bold text-[#a05c32]">R$ {item.price.toFixed(2).replace(".", ",")}</span></div><Button onClick={() => add(item.id)} className="mt-5 h-11 w-full rounded-xl bg-[#f1ece3] font-semibold text-[#2f5d50] shadow-none hover:bg-[#e6ded1]">Adicionar ao pedido <Plus className="ml-2 h-4 w-4" /></Button></CardContent></Card>)}</div></section>

      <section id="como-funciona" className="bg-[#2f5d50] px-5 py-16 text-white lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="section-kicker light">Sem complicação</p><h2 className="mt-3 max-w-md font-display text-4xl font-bold leading-tight">Do nosso fogão até a sua mesa.</h2><p className="mt-4 max-w-md leading-7 text-white/70">Você escolhe, a gente prepara na hora e entrega com o mesmo cuidado de quando serviríamos na nossa própria mesa.</p></div><div className="grid gap-4 sm:grid-cols-3">{[["01", "Escolha", "Monte sua marmita no cardápio do dia."], ["02", "Pague", "Pix ou cartão, após ativar o Mercado Pago."], ["03", "Receba", "Acompanhe seu pedido após ativar a entrega."]].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-white/10 bg-white/5 p-5"><span className="font-display text-3xl font-bold text-[#e8bd72]">{number}</span><h3 className="mt-7 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div></div></div></section>
      <section id="historia" className="mx-auto max-w-7xl px-5 py-18 lg:px-8"><div className="grid gap-10 rounded-[28px] bg-[#f1ece3] p-8 sm:p-12 lg:grid-cols-[1fr_1fr] lg:items-center"><div><p className="section-kicker">Nossa cozinha</p><h2 className="mt-3 max-w-md font-display text-4xl font-bold leading-tight">Comida honesta, bonita e sem pressa.</h2><p className="mt-5 max-w-lg leading-7 text-[#776e63]">A Casa na Marmita nasceu para resgatar o almoço que tem textura, aroma e história. Ingredientes simples, técnica cuidadosa e um cardápio que muda com o que está mais bonito na feira.</p><Button variant="outline" className="mt-7 rounded-full border-[#cdbfae] bg-transparent text-[#2f5d50] hover:bg-white">Conheça nosso jeito <ArrowRight className="ml-2 h-4 w-4" /></Button></div><div className="story-photo"/></div></section>
    </main>
    <footer className="border-t border-[#e9e3d9] px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-[#776e63] sm:flex-row"><p>© 2026 Casa na Marmita. Feita para alimentar bem.</p><p>Seg a sex · 11h às 14h30 · <span className="text-[#a05c32]">(11) 98888-0000</span></p></div></footer>

    <Sheet open={cartOpen} onOpenChange={setCartOpen}><SheetContent className="w-full overflow-y-auto bg-[#fbfaf7] sm:max-w-md"><SheetHeader><SheetTitle className="font-display text-2xl">Seu pedido <span className="text-sm font-normal text-[#776e63]">({totalItems} itens)</span></SheetTitle></SheetHeader>{orderHistory.length > 0 && <div className="mt-4 rounded-xl border border-[#e9e3d9] bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#a05c32]">Seu histórico neste aparelho</p><div className="mt-2 space-y-2">{orderHistory.slice(0, 3).map((saved, index) => <button key={`${saved.createdAt}-${index}`} onClick={() => repeatSavedOrder(saved)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-[#fbfaf7]"><span>Pedido salvo · {new Date(saved.createdAt).toLocaleDateString("pt-BR")}</span><span className="text-[#2f5d50]">Repetir</span></button>)}</div></div>}<div className="mt-7 space-y-5">{cartDetails.length === 0 ? <div className="rounded-2xl bg-white p-8 text-center"><ShoppingBag className="mx-auto h-8 w-8 text-[#cdbfae]"/><p className="mt-3 font-semibold">Seu pedido está vazio</p><p className="mt-1 text-sm text-[#776e63]">Escolha uma delícia do cardápio para começar.</p></div> : <>{cartDetails.map(({ item, qty, observation }) => <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex gap-3"><img src={item.image} className="h-16 w-16 rounded-xl object-cover"/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-semibold">{item.name}</p><button onClick={() => changeQty(item.id, -qty)} aria-label="Remover item"><X className="h-4 w-4 text-[#a79b8d]"/></button></div><p className="mt-1 text-sm text-[#a05c32]">R$ {(item.price * qty).toFixed(2).replace(".", ",")}</p><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2 rounded-full bg-[#f1ece3] p-1"><button onClick={() => changeQty(item.id, -1)} className="rounded-full p-1 hover:bg-white"><Minus className="h-3 w-3"/></button><span className="w-4 text-center text-sm font-semibold">{qty}</span><button onClick={() => add(item.id)} className="rounded-full p-1 hover:bg-white"><Plus className="h-3 w-3"/></button></div><span className="text-xs text-[#776e63]">Observação abaixo</span></div></div></div><Textarea value={observation} onChange={(e) => updateObservation(item.id, e.target.value)} placeholder="Ex.: sem cebola, molho à parte..." className="mt-3 min-h-16 resize-none border-[#e9e3d9] bg-[#fbfaf7] text-xs"/></div>)}</>}
        {cartDetails.length > 0 && <><Separator/><div className="space-y-3 text-sm"><div className="flex justify-between text-[#776e63]"><span>Subtotal</span><span>R$ {subtotal.toFixed(2).replace(".", ",")}</span></div><div className="flex justify-between text-[#776e63]"><span>Entrega</span><span>R$ {delivery.toFixed(2).replace(".", ",")}</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#a05c32]">R$ {total.toFixed(2).replace(".", ",")}</span></div></div><Button onClick={() => setCheckoutOpen(true)} className="h-12 w-full rounded-xl bg-[#a05c32] text-white hover:bg-[#8a4e2b]">Continuar para pagamento <ArrowRight className="ml-2 h-4 w-4"/></Button></>}
      </div></SheetContent></Sheet>

    <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}><SheetContent className="w-full overflow-y-auto bg-[#fbfaf7] sm:max-w-md"><SheetHeader><SheetTitle className="font-display text-2xl">Quase na mesa</SheetTitle></SheetHeader><div className="mt-4 rounded-2xl bg-[#f1ece3] p-4 text-sm text-[#776e63]">Você não precisa criar uma conta. Salvaremos seus dados apenas para acompanhar este pedido.</div><div className="mt-6 space-y-4"><div><label className="field-label">Seu nome</label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Como podemos chamar você?" /></div><div><label className="field-label">WhatsApp</label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="(11) 99999-9999" />{historyQuery.data && historyQuery.data.length > 0 && <div className="mt-3 rounded-xl border border-[#e9e3d9] bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#a05c32]">Pedidos anteriores</p><div className="mt-2 space-y-2">{historyQuery.data.slice(0, 3).map(({ order }) => <div key={order.id} className="rounded-lg px-2 py-2 text-sm hover:bg-[#fbfaf7]"><button onClick={() => setSelectedHistoryId(order.id)} className="flex w-full items-center justify-between text-left"><span>Pedido #{order.id}</span><span className="text-[#a05c32]">R$ {Number(order.total).toFixed(2).replace(".", ",")}</span></button>{order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-semibold text-[#2f5d50] underline">Acompanhar entrega</a>}</div>)}</div></div>}</div><div><label className="field-label">Endereço de entrega</label><Textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Rua, número, complemento e bairro" /></div>
      {checkoutState.paymentEnabled && <div><label className="field-label">Email</label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="voce@exemplo.com" /></div>}
      {!checkoutState.paymentEnabled && <div><p className="field-label">Forma de pagamento</p><div className="grid grid-cols-3 gap-2">{([["pix", "PIX"], ["credit_card", "Crédito"], ["debit_card", "Débito"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPaymentMethod(value)} aria-pressed={paymentMethod === value} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${paymentMethod === value ? "border-[#2f5d50] bg-[#e2f1e7] text-[#2f5d50]" : "border-[#e9e3d9] bg-white text-[#776e63]"}`}>{label}</button>)}</div></div>}
      <div className="rounded-2xl border border-[#e9e3d9] bg-white p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff0d7] text-[#a05c32]"><Check className="h-4 w-4"/></div><div><p className="font-semibold">{checkoutState.title}</p><p className="text-xs text-[#776e63]">{checkoutState.notice}</p></div></div></div>

      {pixQrCode ? <div className="rounded-2xl border border-[#e9e3d9] bg-white p-4 text-center"><img src={`data:image/png;base64,${pixQrCode}`} alt="QR code Pix" className="mx-auto h-48 w-48" /><p className="mt-3 text-sm text-[#776e63]">Escaneie com o app do seu banco. Confirmamos automaticamente assim que o Pix cair.</p></div>
      : checkoutState.paymentEnabled && orderId && checkoutConfigQuery.data?.publicKey ? <MercadoPagoBrick publicKey={checkoutConfigQuery.data.publicKey} amount={total} payerEmail={customer.email} onSubmit={handleBrickSubmit} onError={(message) => toast.error(message)} />
      : checkoutState.paymentEnabled ? <Button onClick={ensureOrderCreated} disabled={createOrderMutation.isPending} className="h-12 w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#244b40]">{createOrderMutation.isPending ? "Preparando pagamento..." : "Ir para pagamento"} <ArrowRight className="ml-2 h-4 w-4"/></Button>
      : <><Button onClick={submitDemoOrder} disabled={createOrderMutation.isPending} className="h-12 w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#244b40]">{createOrderMutation.isPending ? "Registrando pedido..." : "Registrar pedido (modo demonstração)"} <ArrowRight className="ml-2 h-4 w-4"/></Button><p className="text-center text-xs text-[#a79b8d]">Seu pedido será registrado para a cozinha, mas nenhuma cobrança será criada enquanto o Mercado Pago estiver em modo demonstração.</p></>}
    </div></SheetContent></Sheet>
  </div>;
}
