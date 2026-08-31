import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Bike, CircleAlert, Eye, EyeOff, KeyRound, Link2, LockKeyhole, MapPin, Save, Send, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type DeliveryOption = "uber_direct" | "lalamove" | "own_courier";

export default function CompanyIntegrations() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const companyQuery = trpc.company.mine.useQuery(undefined, { enabled: isAuthenticated });
  const statusQuery = trpc.integrations.status.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10_000 });
  const connectUrlQuery = trpc.integrations.mercadoPagoConnectUrl.useQuery(undefined, { enabled: false });
  const updateBrandingMutation = trpc.company.updateBranding.useMutation({ onSuccess: () => { toast.success("Endereço salvo."); companyQuery.refetch(); }, onError: (e) => toast.error(e.message) });
  const setDeliveryMutation = trpc.integrations.setDeliveryProvider.useMutation({ onSuccess: () => { toast.success("Entrega configurada."); statusQuery.refetch(); }, onError: (e) => toast.error(e.message) });
  const saveMessagingMutation = trpc.integrations.saveMessagingCredentials.useMutation({ onSuccess: () => { toast.success("Credenciais de mensageria salvas."); statusQuery.refetch(); }, onError: (e) => toast.error(e.message) });

  const [pickupAddress, setPickupAddress] = useState("");
  const [openDeliveryForm, setOpenDeliveryForm] = useState<DeliveryOption | null>(null);
  const [uberFields, setUberFields] = useState({ clientId: "", clientSecret: "", customerId: "" });
  const [lalamoveFields, setLalamoveFields] = useState({ apiKey: "", apiSecret: "" });
  const [courierFields, setCourierFields] = useState({ name: "", phone: "" });
  const [messagingToken, setMessagingToken] = useState("");
  const [messagingSender, setMessagingSender] = useState("");
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  useEffect(() => { if (companyQuery.data?.pickupAddress) setPickupAddress(companyQuery.data.pickupAddress); }, [companyQuery.data]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mercadopago") === "connected") { toast.success("Mercado Pago conectado com sucesso."); statusQuery.refetch(); }
    if (params.get("mercadopago") === "error") toast.error("Não foi possível conectar o Mercado Pago. Tente novamente.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectMercadoPago = async () => {
    const { data, error } = await connectUrlQuery.refetch();
    if (data?.url) window.location.href = data.url;
    else toast.error(error?.message ?? "Configure o Mercado Pago no servidor primeiro.");
  };

  if (loading) return <div className="min-h-screen bg-[#f7f6f2] p-8"><div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-white p-12"><div className="h-8 w-72 rounded bg-[#eeeae3]" /></div></div>;
  if (!isAuthenticated || user?.role !== "admin") return <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6"><Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8"><ShieldCheck className="mx-auto h-10 w-10 text-[#a05c32]" /><h1 className="mt-4 font-display text-2xl font-bold">Acesso restrito</h1><Link href="/admin-login"><Button className="mt-5 rounded-xl bg-[#2f5d50] text-white">Entrar</Button></Link></CardContent></Card></div>;

  const status = statusQuery.data;
  const mpConnected = status?.mercadopago.connected ?? false;
  const mpConfigured = status?.mercadopago.configured ?? false;
  const activeDelivery: DeliveryOption | null = status?.uberDirect.connected ? "uber_direct" : status?.lalamove.connected ? "lalamove" : status?.ownCourier.connected ? "own_courier" : null;

  const deliveryCards: Array<{ key: DeliveryOption; name: string; tag: string; icon: typeof Truck }> = [
    { key: "uber_direct", name: "Uber Direct", tag: "cobre todo o Brasil", icon: Truck },
    { key: "lalamove", name: "Lalamove", tag: "ideal para entregas pequenas", icon: Bike },
    { key: "own_courier", name: "Motoboy próprio", tag: "seu entregador fixo", icon: Bike },
  ];

  return <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
    <header className="border-b border-[#e5e0d7] bg-[#fbfaf7]"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3"><div className="brand-mark"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display text-xl font-bold">Integrações</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a05c32]">{companyQuery.data?.name}</p></div></div><Link href={`/${slug}/admin`}><Button variant="outline" className="rounded-xl border-[#e5e0d7] bg-white"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel</Button></Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <div className="mb-8"><h1 className="font-display text-4xl font-bold tracking-tight">Pagamento e entrega</h1><p className="mt-3 max-w-2xl leading-7 text-[#776e63]">Conecte o Mercado Pago pra receber pelo app e escolha como suas entregas são despachadas.</p></div>

      <div className="space-y-5">
        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "#61a87d20", color: "#61a87d" }}><WalletCards className="h-5 w-5" /></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">Mercado Pago</CardTitle><Badge className={mpConnected ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fff0d7] text-[#a05c32]"}>{mpConnected ? "Conectado" : "Não conectado"}</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Conecte sua conta pra receber Pix, crédito e débito direto pelo checkout.</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5" />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-[#a79b8d]"><LockKeyhole className="h-3.5 w-3.5" /> A conexão é feita direto no site do Mercado Pago — não vemos sua senha.</p>
              <Button onClick={connectMercadoPago} disabled={!mpConfigured || connectUrlQuery.isFetching} className="rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]"><Link2 className="mr-2 h-4 w-4" /> {mpConnected ? "Reconectar" : "Conectar com Mercado Pago"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader><CardTitle className="font-display text-xl">Endereço de retirada</CardTitle><p className="text-sm text-[#776e63]">Usado pelo entregador pra saber onde buscar o pedido.</p></CardHeader>
          <CardContent><div className="flex gap-2"><div className="relative flex-1"><MapPin className="absolute left-3 top-3 h-4 w-4 text-[#a79b8d]" /><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] pl-9" /></div><Button onClick={() => updateBrandingMutation.mutate({ pickupAddress })} disabled={pickupAddress.length < 5 || updateBrandingMutation.isPending} className="rounded-xl bg-[#2f5d50] text-white">Salvar</Button></div></CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader><CardTitle className="font-display text-xl">Entrega</CardTitle><p className="text-sm text-[#776e63]">Escolha um provedor. Ao marcar o pedido como "pronto", a corrida é acionada sozinha (exceto motoboy próprio).</p></CardHeader>
          <CardContent className="space-y-4">
            {deliveryCards.map(({ key, name, tag, icon: Icon }) => (
              <div key={key} className={`rounded-2xl border p-4 ${activeDelivery === key ? "border-[#2f5d50] bg-[#e2f1e7]/40" : "border-[#e5e0d7]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-[#a05c32]" /><div><p className="font-semibold">{name}</p><p className="text-xs text-[#776e63]">{tag}</p></div></div>
                  <div className="flex items-center gap-2">{activeDelivery === key && <Badge className="border-0 bg-[#347052] text-white">Ativo</Badge>}<Button variant="outline" size="sm" onClick={() => setOpenDeliveryForm(openDeliveryForm === key ? null : key)} className="rounded-lg">{activeDelivery === key ? "Editar" : "Configurar"}</Button></div>
                </div>
                {openDeliveryForm === key && (
                  <div className="mt-4 space-y-3 border-t border-[#e5e0d7] pt-4">
                    {key === "uber_direct" && <>
                      <Input placeholder="Client ID" value={uberFields.clientId} onChange={(e) => setUberFields({ ...uberFields, clientId: e.target.value })} />
                      <Input type={showSecret.uber ? "text" : "password"} placeholder="Client Secret" value={uberFields.clientSecret} onChange={(e) => setUberFields({ ...uberFields, clientSecret: e.target.value })} />
                      <Input placeholder="Customer ID" value={uberFields.customerId} onChange={(e) => setUberFields({ ...uberFields, customerId: e.target.value })} />
                      <Button onClick={() => setDeliveryMutation.mutate({ provider: "uber_direct", ...uberFields })} disabled={!uberFields.clientId || !uberFields.clientSecret || !uberFields.customerId} className="rounded-xl bg-[#2f5d50] text-white">Salvar</Button>
                    </>}
                    {key === "lalamove" && <>
                      <Input placeholder="API Key" value={lalamoveFields.apiKey} onChange={(e) => setLalamoveFields({ ...lalamoveFields, apiKey: e.target.value })} />
                      <Input type={showSecret.lalamove ? "text" : "password"} placeholder="API Secret" value={lalamoveFields.apiSecret} onChange={(e) => setLalamoveFields({ ...lalamoveFields, apiSecret: e.target.value })} />
                      <Button onClick={() => setDeliveryMutation.mutate({ provider: "lalamove", ...lalamoveFields })} disabled={!lalamoveFields.apiKey || !lalamoveFields.apiSecret} className="rounded-xl bg-[#2f5d50] text-white">Salvar</Button>
                    </>}
                    {key === "own_courier" && <>
                      <Input placeholder="Nome do motoboy" value={courierFields.name} onChange={(e) => setCourierFields({ ...courierFields, name: e.target.value })} />
                      <Input placeholder="Telefone" value={courierFields.phone} onChange={(e) => setCourierFields({ ...courierFields, phone: e.target.value })} />
                      <p className="text-xs text-[#a79b8d]">Sem rastreio automático — você avança o status manualmente até "entregue".</p>
                      <Button onClick={() => setDeliveryMutation.mutate({ provider: "own_courier", ...courierFields })} disabled={!courierFields.name || !courierFields.phone} className="rounded-xl bg-[#2f5d50] text-white">Salvar</Button>
                    </>}
                  </div>
                )}
              </div>
            ))}
            <div className="rounded-2xl border border-[#e5e0d7] bg-[#f7f6f2] p-4 opacity-70">
              <div className="flex items-center gap-3"><Truck className="h-5 w-5 text-[#776e63]" /><div><p className="font-semibold">99 (entregas grandes)</p><p className="text-xs text-[#776e63]">{status?.ninetyNineDelivery.reason}</p></div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "#7b8fc820", color: "#7b8fc8" }}><Send className="h-5 w-5" /></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">WhatsApp / SMS</CardTitle><Badge className={status?.messaging.connected ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fff0d7] text-[#a05c32]"}>{status?.messaging.connected ? "Configurado" : "Aguardando chaves"}</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Envie o link de rastreio automaticamente ao cliente.</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="field-label">Provider Token</label><div className="relative"><Input type={showSecret.messaging ? "text" : "password"} value={messagingToken} onChange={(e) => setMessagingToken(e.target.value)} placeholder="Cole a chave aqui" className="pr-10" /><button onClick={() => setShowSecret((v) => ({ ...v, messaging: !v.messaging }))} className="absolute right-3 top-2.5 text-[#a79b8d]" aria-label="Mostrar ou ocultar chave">{showSecret.messaging ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div><label className="field-label">Sender / Phone</label><Input value={messagingSender} onChange={(e) => setMessagingSender(e.target.value)} placeholder="Informe o identificador" /></div>
            </div>
            <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-[#a79b8d]"><KeyRound className="h-3.5 w-3.5" /> As chaves são armazenadas criptografadas.</p>
              <Button onClick={() => saveMessagingMutation.mutate({ providerToken: messagingToken, sender: messagingSender })} disabled={!messagingToken || !messagingSender} className="rounded-xl bg-[#2f5d50] text-white"><Save className="mr-2 h-4 w-4" /> Salvar</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 border-0 shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-[#fff0d7] p-2 text-[#a05c32]"><CircleAlert className="h-4 w-4" /></div><div><p className="font-semibold">Antes de publicar</p><p className="mt-1 text-sm leading-6 text-[#776e63]">Teste primeiro em ambiente sandbox de cada provedor.</p></div></div></CardContent></Card>
    </main>
  </div>;
}
