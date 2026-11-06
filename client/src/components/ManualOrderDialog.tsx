import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Link2, MessageCircle, Minus, PackageCheck, Plus, ShoppingCart, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
type PaymentMode = "cash_on_delivery" | "mercadopago_link";
type CreatedOrder = { orderId: number; paymentMode: PaymentMode; paymentLink?: string; trackingLink?: string; paymentLinkError?: string };

export function ManualOrderDialog({ slug, onCreated }: { slug: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash_on_delivery");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const menu = trpc.adminMenu.list.useQuery(undefined, { enabled: open && !createdOrder });
  const create = trpc.orders.createManual.useMutation();
  const createPaymentLink = trpc.orders.createManualPaymentLink.useMutation();
  const activeItems = (menu.data ?? []).filter((item) => item.active);
  const chosen = useMemo(() => activeItems.filter((item) => (quantities[item.id] ?? 0) > 0), [activeItems, quantities]);
  const subtotal = chosen.reduce((sum, item) => sum + Number(item.price) * quantities[item.id], 0);
  const updateQty = (id: number, delta: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(50, (current[id] ?? 0) + delta)) }));
  const reset = () => { setName(""); setPhone(""); setAddress(""); setAddressNumber(""); setEmail(""); setQuantities({}); setPaymentMode("cash_on_delivery"); setCreatedOrder(null); };

  const submit = async () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 8 || address.trim().length < 5 || !addressNumber.trim() || chosen.length === 0) {
      toast.error("Informe nome, WhatsApp, endereço e pelo menos um item."); return;
    }
    if (paymentMode === "mercadopago_link" && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error("Confira o e-mail do cliente ou deixe o campo vazio."); return; }
    try {
      const result = await create.mutateAsync({
        name: name.trim(), phone, address: address.trim(), addressNumber: addressNumber.trim(),
        items: chosen.map((item) => ({ menuItemId: item.id, quantity: quantities[item.id] })),
        paymentMode, ...(email.trim() ? { payerEmail: email.trim() } : {}),
      });
      if (!result.orderId) { toast.error("O servidor não confirmou a criação do pedido. Tente novamente."); return; }
      const trackingLink = result.customerTrackingToken ? `${window.location.origin}/rastrear/${encodeURIComponent(slug)}/${result.customerTrackingToken}` : undefined;
      setCreatedOrder({ orderId: result.orderId, paymentMode, paymentLink: result.paymentLink ?? undefined, paymentLinkError: "paymentLinkError" in result ? result.paymentLinkError : undefined, trackingLink });
      toast.success(`Pedido #${result.orderId} criado.`);
      onCreated();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o pedido."); }
  };

  const retryLink = async () => {
    if (!createdOrder) return;
    try {
      const result = await createPaymentLink.mutateAsync({ orderId: createdOrder.orderId });
      setCreatedOrder({ ...createdOrder, paymentLink: result.paymentLink, paymentLinkError: undefined });
      toast.success("Link de pagamento gerado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link."); }
  };
  const copy = async (label: string, text?: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado.`); }
    catch { window.prompt(`Copie ${label.toLowerCase()}:`, text); }
  };
  const phoneDigits = phone.replace(/\D/g, "");
  const greeting = name.trim() ? `, ${name.trim()}` : "";
  const paymentWhatsappUrl = createdOrder?.paymentLink ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Olá${greeting}! Segue o link seguro para pagamento do pedido #${createdOrder.orderId}: ${createdOrder.paymentLink}`)}` : undefined;
  const trackingWhatsappUrl = createdOrder?.trackingLink ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Olá${greeting}! Acompanhe seu pedido #${createdOrder.orderId} aqui: ${createdOrder.trackingLink}`)}` : undefined;

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
    <DialogTrigger asChild><Button className="rounded-xl bg-[#a05c32] text-white hover:bg-[#8e4f2c]"><Plus className="mr-2 h-4 w-4"/>Novo pedido</Button></DialogTrigger>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-3xl p-0">
      <DialogHeader className="border-b border-[#ebe9e2] px-6 py-5"><DialogTitle className="flex items-center gap-2 text-xl"><ShoppingCart className="h-5 w-5 text-[#a05c32]"/>{createdOrder ? `Pedido #${createdOrder.orderId}` : "Cadastrar pedido"}</DialogTitle><DialogDescription>{createdOrder ? "Pedido salvo. Compartilhe o link de pagamento ou o acompanhamento com o cliente." : "Registre pedidos de telefone, balcão ou WhatsApp. O app valida os preços e o estoque não é alterado automaticamente."}</DialogDescription></DialogHeader>
      {createdOrder ? <div className="space-y-5 px-6 py-6">
        <div className="flex items-start gap-3 rounded-2xl border border-[#dce9dd] bg-[#f3f8f3] p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#347052]"/><div><p className="font-semibold text-[#2f5d50]">Pedido registrado</p><p className="mt-1 text-sm text-[#637267]">Cliente: {name} · {phone}</p><p className="mt-1 text-xs text-[#788278]">Endereço e dados do cliente foram salvos no pedido.</p></div></div>
        {createdOrder.paymentMode === "mercadopago_link" ? <div className="space-y-3 rounded-2xl border border-[#e4e9e2] p-4"><div className="flex items-center gap-2 font-semibold text-[#3e4a40]"><WalletCards className="h-4 w-4 text-[#a05c32]"/>Pagamento via Mercado Pago</div>{createdOrder.paymentLink ? <><p className="break-all rounded-xl bg-[#f7f8f5] p-3 text-sm text-[#516052]">{createdOrder.paymentLink}</p><div className="flex flex-wrap gap-2"><Button onClick={() => void copy("Link de pagamento", createdOrder.paymentLink)} variant="outline" className="rounded-xl"><Copy className="mr-2 h-4 w-4"/>Copiar link</Button>{paymentWhatsappUrl && <a href={paymentWhatsappUrl} target="_blank" rel="noreferrer"><Button className="rounded-xl bg-[#2f5d50] text-white"><MessageCircle className="mr-2 h-4 w-4"/>Enviar pelo WhatsApp</Button></a>}</div><p className="text-xs text-[#7c867d]">O cliente paga na página segura do Mercado Pago. O pedido será marcado como pago quando o provedor confirmar.</p></> : <><p className="text-sm text-[#8b633e]">{createdOrder.paymentLinkError ?? "O pedido está salvo, mas o link ainda não foi gerado. Verifique se o Mercado Pago está conectado."}</p><Button onClick={retryLink} disabled={createPaymentLink.isPending} className="rounded-xl bg-[#a05c32] text-white">{createPaymentLink.isPending ? "Gerando link…" : "Gerar link de pagamento"}</Button></>}</div> : <div className="rounded-2xl border border-[#e4e9e2] p-4"><div className="flex items-center gap-2 font-semibold text-[#3e4a40]"><WalletCards className="h-4 w-4 text-[#a05c32]"/>Pagamento em dinheiro na entrega</div><p className="mt-1 text-sm text-[#7c867d]">Quando receber o valor, use “Marcar pagamento recebido” na fila de pedidos.</p></div>}
        {createdOrder.trackingLink && <div className="space-y-3 rounded-2xl border border-[#e4e9e2] p-4"><div className="flex items-center gap-2 font-semibold text-[#3e4a40]"><Link2 className="h-4 w-4 text-[#a05c32]"/>Acompanhamento do cliente</div><p className="break-all rounded-xl bg-[#f7f8f5] p-3 text-sm text-[#516052]">{createdOrder.trackingLink}</p><div className="flex flex-wrap gap-2"><Button onClick={() => void copy("Link de acompanhamento", createdOrder.trackingLink)} variant="outline" className="rounded-xl"><Copy className="mr-2 h-4 w-4"/>Copiar rastreamento</Button>{trackingWhatsappUrl && <a href={trackingWhatsappUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="rounded-xl border-[#d9e5db] text-[#38654b]"><MessageCircle className="mr-2 h-4 w-4"/>Enviar rastreamento</Button></a>}</div></div>}
        <div className="flex justify-end"><Button onClick={() => { setOpen(false); reset(); }} className="rounded-xl bg-[#2f5d50] text-white">Concluir</Button></div>
      </div> : <div className="space-y-5 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome do cliente<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" className="mt-1.5 rounded-xl" maxLength={160}/></label><label className="text-sm font-medium">WhatsApp<Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" className="mt-1.5 rounded-xl" maxLength={30}/></label></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"><label className="block text-sm font-medium">Rua, bairro e cidade<Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua e bairro" className="mt-1.5 rounded-xl" maxLength={460}/></label><label className="block text-sm font-medium">Número<Input value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} placeholder="Ex.: 120" className="mt-1.5 rounded-xl" maxLength={32}/></label></div>
        <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Itens do cardápio</h3><span className="text-xs text-[#7d857d]">{chosen.length} selecionado(s)</span></div><div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[#eceee9] bg-[#fafbf9] p-3">{menu.isLoading ? <p className="p-3 text-sm text-[#737a73]">Carregando cardápio…</p> : activeItems.length === 0 ? <p className="p-3 text-sm text-[#737a73]">Não há itens ativos no cardápio.</p> : activeItems.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-[#778078]">{money(Number(item.price))}</p></div><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => updateQty(item.id, -1)} className="grid h-8 w-8 place-items-center rounded-full border border-[#e2e7df]"><Minus className="h-3.5 w-3.5"/></button><span className="w-5 text-center text-sm font-semibold">{quantities[item.id] ?? 0}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => updateQty(item.id, 1)} className="grid h-8 w-8 place-items-center rounded-full border border-[#e2e7df]"><Plus className="h-3.5 w-3.5"/></button></div>)}</div></div>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">Como o cliente vai pagar?</legend><div className="grid gap-3 sm:grid-cols-2"><button type="button" aria-pressed={paymentMode === "cash_on_delivery"} onClick={() => setPaymentMode("cash_on_delivery")} className={`rounded-2xl border p-4 text-left transition ${paymentMode === "cash_on_delivery" ? "border-[#2f5d50] bg-[#f3f8f3] ring-1 ring-[#2f5d50]" : "border-[#e5e9e3] bg-white hover:bg-[#f8faf7]"}`}><span className="font-semibold text-[#39443b]">Dinheiro na entrega</span><span className="mt-1 block text-xs text-[#788278]">Receba e depois marque o pagamento no painel.</span></button><button type="button" aria-pressed={paymentMode === "mercadopago_link"} onClick={() => setPaymentMode("mercadopago_link")} className={`rounded-2xl border p-4 text-left transition ${paymentMode === "mercadopago_link" ? "border-[#2f5d50] bg-[#f3f8f3] ring-1 ring-[#2f5d50]" : "border-[#e5e9e3] bg-white hover:bg-[#f8faf7]"}`}><span className="font-semibold text-[#39443b]">Enviar link Mercado Pago</span><span className="mt-1 block text-xs text-[#788278]">Cliente paga online; confirme a integração na loja.</span></button></div></fieldset>
        {paymentMode === "mercadopago_link" && <label className="block text-sm font-medium">E-mail do cliente <span className="font-normal text-[#929991]">(opcional, para preencher no checkout)</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@email.com" className="mt-1.5 rounded-xl" maxLength={254}/></label>}
        <div className="flex items-center justify-between rounded-2xl bg-[#f3f5f1] px-4 py-3"><div><span className="block text-sm text-[#657066]">Subtotal dos itens</span><span className="text-[11px] text-[#899188]">Taxa de entrega calculada pelo servidor</span></div><strong className="text-lg text-[#2f5d50]">{money(subtotal)}</strong></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button><Button type="button" onClick={submit} disabled={create.isPending || menu.isLoading} className="rounded-xl bg-[#2f5d50] text-white">{create.isPending ? "Salvando…" : paymentMode === "mercadopago_link" ? "Criar pedido e gerar link" : "Criar pedido"}</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
