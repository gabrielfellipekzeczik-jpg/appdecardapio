import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, Eye, EyeOff, KeyRound, Link2, LockKeyhole, Save, Send, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function SuperAdmin() {
  const { user, loading, isAuthenticated } = useAuth();
  const statusQuery = trpc.integrations.status.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10_000 });
  const connectUrlQuery = trpc.integrations.mercadoPagoConnectUrl.useQuery(undefined, { enabled: false });
  const saveMessagingMutation = trpc.integrations.saveMessagingCredentials.useMutation({
    onSuccess: () => { toast.success("Credenciais de mensageria salvas."); statusQuery.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const [messagingToken, setMessagingToken] = useState("");
  const [messagingSender, setMessagingSender] = useState("");
  const [showMessagingToken, setShowMessagingToken] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mercadopago") === "connected") { toast.success("Mercado Pago conectado com sucesso."); statusQuery.refetch(); }
    if (params.get("mercadopago") === "error") toast.error("Não foi possível conectar o Mercado Pago. Tente novamente.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectMercadoPago = async () => {
    const { data } = await connectUrlQuery.refetch();
    if (data?.url) window.location.href = data.url;
    else toast.error("Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro.");
  };

  if (loading) return <div className="min-h-screen bg-[#f7f6f2] p-8"><div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-white p-12"><div className="h-8 w-72 rounded bg-[#eeeae3]"/><div className="mt-5 h-4 w-full rounded bg-[#f1ece3]"/></div></div>;
  if (!isAuthenticated || !user?.isSuperAdmin) return <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6"><Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8"><ShieldCheck className="mx-auto h-10 w-10 text-[#a05c32]"/><h1 className="mt-4 font-display text-2xl font-bold">Acesso restrito</h1><p className="mt-2 text-sm leading-6 text-[#776e63]">Esta área exige a conta do proprietário.</p><div className="mt-5 flex flex-col items-center gap-2"><Link href="/admin-login"><Button className="rounded-xl bg-[#2f5d50] text-white">Entrar</Button></Link><Link href="/admin"><Button variant="outline" className="rounded-xl border-[#e5e0d7]">Voltar ao painel</Button></Link></div></CardContent></Card></div>;

  const status = statusQuery.data;
  const mpConnected = status?.mercadopago.connected ?? false;
  const mpConfigured = status?.mercadopago.configured ?? false;
  const uberConfigured = status?.uberDirect.configured ?? false;

  return <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
    <header className="border-b border-[#e5e0d7] bg-[#fbfaf7]"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3"><div className="brand-mark"><ShieldCheck className="h-5 w-5"/></div><div><p className="font-display text-xl font-bold">Super Admin</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a05c32]">configurações protegidas</p></div></div><Link href="/admin"><Button variant="outline" className="rounded-xl border-[#e5e0d7] bg-white"><ArrowLeft className="mr-2 h-4 w-4"/> Voltar ao painel</Button></Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <div className="mb-8"><p className="section-kicker">Centro de integrações</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Tudo conectado, no seu controle.</h1><p className="mt-3 max-w-2xl leading-7 text-[#776e63]">Conecte o Mercado Pago para receber pagamentos direto no app. A entrega automática via Uber Direct e o envio de rastreio ficam ativos assim que as credenciais forem cadastradas no servidor.</p></div>

      <div className="space-y-5">
        {/* Mercado Pago */}
        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "#61a87d20", color: "#61a87d" }}><WalletCards className="h-5 w-5"/></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">Mercado Pago</CardTitle><Badge className={mpConnected ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fff0d7] text-[#a05c32]"}>{mpConnected ? "Conectado" : "Não conectado"}</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Conecte sua conta para receber Pix, crédito e débito direto pelo checkout do app.</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5"/>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-[#a79b8d]"><LockKeyhole className="h-3.5 w-3.5"/> O app nunca vê nem guarda sua senha — a conexão é feita direto no site do Mercado Pago.</p>
              <Button onClick={connectMercadoPago} disabled={!mpConfigured || connectUrlQuery.isFetching} className="rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]"><Link2 className="mr-2 h-4 w-4"/> {mpConnected ? "Reconectar com Mercado Pago" : "Conectar com Mercado Pago"}</Button>
            </div>
            {!mpConfigured && <p className="mt-3 text-xs text-[#a05c32]">Servidor sem MP_CLIENT_ID/MP_CLIENT_SECRET/MP_REDIRECT_URI configurados.</p>}
          </CardContent>
        </Card>

        {/* Uber Direct */}
        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "#e5a55020", color: "#e5a550" }}><Truck className="h-5 w-5"/></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">Uber Direct</CardTitle><Badge className={uberConfigured ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fff0d7] text-[#a05c32]"}>{uberConfigured ? "Ativo" : "Aguardando configuração"}</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Quando o pedido é marcado como pronto, a corrida é acionada automaticamente e o link de rastreio aparece pro cliente.</p></div>
            </div>
          </CardHeader>
          <CardContent><Separator className="mb-5"/><p className="text-xs text-[#a79b8d]">Credenciais de negócio (client ID, client secret, customer ID e endereço de retirada) são configuradas nas variáveis de ambiente do servidor, não aqui — evita expor a chave de despacho no navegador.</p></CardContent>
        </Card>

        {/* 99Entrega */}
        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)] opacity-80">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5e0d7] text-[#776e63]"><Truck className="h-5 w-5"/></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">99Entrega</CardTitle><Badge className="border-0 bg-[#efede8] text-[#776e63]">Aguardando parceria</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">{status?.ninetyNineDelivery.reason ?? "Sem API self-service pública — depende de acesso de parceiro comercial com a 99."}</p></div>
            </div>
          </CardHeader>
        </Card>

        {/* Messaging */}
        <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "#7b8fc820", color: "#7b8fc8" }}><Send className="h-5 w-5"/></div>
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle className="font-display text-xl">WhatsApp / SMS</CardTitle><Badge className={status?.messaging.connected ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fff0d7] text-[#a05c32]"}>{status?.messaging.connected ? "Configurado" : "Aguardando chaves"}</Badge></div><p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Envie o link de rastreio automaticamente ao cliente quando a entrega for despachada.</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5"/>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="field-label">Provider Token</label><div className="relative"><Input type={showMessagingToken ? "text" : "password"} value={messagingToken} onChange={(e) => setMessagingToken(e.target.value)} placeholder="Cole a chave aqui" className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] pr-10"/><button onClick={() => setShowMessagingToken((v) => !v)} className="absolute right-3 top-2.5 text-[#a79b8d]" aria-label="Mostrar ou ocultar chave">{showMessagingToken ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>
              <div><label className="field-label">Sender / Phone</label><Input value={messagingSender} onChange={(e) => setMessagingSender(e.target.value)} placeholder="Informe o identificador" className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7]"/></div>
            </div>
            <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-[#a79b8d]"><KeyRound className="h-3.5 w-3.5"/> As chaves são armazenadas criptografadas.</p>
              <Button onClick={() => saveMessagingMutation.mutate({ providerToken: messagingToken, sender: messagingSender })} disabled={!messagingToken || !messagingSender || saveMessagingMutation.isPending} className="rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]"><Save className="mr-2 h-4 w-4"/> Salvar</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 border-0 shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-[#fff0d7] p-2 text-[#a05c32]"><CircleAlert className="h-4 w-4"/></div><div><p className="font-semibold">Antes de publicar</p><p className="mt-1 text-sm leading-6 text-[#776e63]">Teste primeiro em ambiente sandbox de cada provedor. Os webhooks já estão registrados em <code>/api/webhooks/mercadopago</code> e <code>/api/webhooks/uber-direct</code>.</p></div></div></CardContent></Card>
    </main>
  </div>;
}
