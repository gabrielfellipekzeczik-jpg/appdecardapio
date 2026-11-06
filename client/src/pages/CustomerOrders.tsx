import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, LogOut, MailCheck, PackageSearch } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderTrackingView } from "@/components/OrderTrackingView";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/lib/usePageTitle";

const STATUS_LABEL: Record<string, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Aguardando entrega",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** "Meus pedidos": o cliente digita o e-mail, recebe um código de 6 dígitos e vê/rastreia os pedidos. */
export default function CustomerOrders() {
  const { slug = "" } = useParams<{ slug: string }>();
  usePageTitle("Meus pedidos");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSessionEmail(session?.user.email ?? null));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const orders = trpc.tracking.myOrders.useQuery({ companySlug: slug }, { enabled: Boolean(sessionEmail), refetchInterval: 15000, retry: false });
  const detail = trpc.tracking.mine.useQuery({ companySlug: slug, orderId: selected ?? 0 }, { enabled: Boolean(sessionEmail && selected), refetchInterval: 10000, retry: false });

  useEffect(() => {
    if (selected === null && orders.data?.length === 1) setSelected(orders.data[0].orderId);
  }, [orders.data, selected]);

  const sendCode = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Digite um e-mail válido.");
    setBusy(true); setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } });
      if (err) throw err;
      setCodeSent(true);
      toast.success("Enviamos um código para o seu e-mail.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido ou expirado.");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f4f5f1] px-4 py-6 text-[#252a26] sm:py-10">
      <div className="mx-auto max-w-xl space-y-3">
        <header className="flex items-center justify-between">
          <Link href={`/${slug}`}>
            <Button variant="ghost" className="h-9 rounded-xl px-2 text-[#526d58]"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar à loja</Button>
          </Link>
          {sessionEmail && (
            <Button variant="ghost" className="h-9 rounded-xl px-2 text-xs text-[#737a73]" onClick={() => { void supabase.auth.signOut(); setSelected(null); setCodeSent(false); setCode(""); }}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
            </Button>
          )}
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><PackageSearch className="h-6 w-6 text-[#2f5d50]" /> Meus pedidos</h1>
          {checking ? (
            <p className="mt-3 text-sm text-[#737a73]">Carregando…</p>
          ) : !sessionEmail ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[#737a73]">Digite o e-mail usado na compra. Enviaremos um código de 6 dígitos para você ver e rastrear seus pedidos.</p>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoComplete="email" disabled={codeSent} className="h-11 rounded-xl" />
              {!codeSent ? (
                <Button onClick={sendCode} disabled={busy || !email.trim()} className="h-11 w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]">
                  <MailCheck className="mr-2 h-4 w-4" /> {busy ? "Enviando…" : "Enviar código"}
                </Button>
              ) : (
                <>
                  <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código recebido por e-mail" className="h-11 rounded-xl" />
                  <Button onClick={verify} disabled={busy || code.length < 6} className="h-11 w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]">{busy ? "Entrando…" : "Ver meus pedidos"}</Button>
                  <button type="button" onClick={() => { setCodeSent(false); setCode(""); }} className="w-full text-center text-xs font-semibold text-[#526d58] underline">Usar outro e-mail / reenviar código</button>
                </>
              )}
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            </div>
          ) : orders.isLoading ? (
            <p className="mt-3 text-sm text-[#737a73]">Buscando seus pedidos…</p>
          ) : orders.isError ? (
            <p className="mt-3 text-sm text-red-600">{orders.error.message}</p>
          ) : !orders.data?.length ? (
            <p className="mt-3 text-sm text-[#737a73]">Nenhum pedido encontrado para {sessionEmail} nesta loja. Se você comprou com outro e-mail, saia e entre com ele.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#eef0eb]">
              {orders.data.map(order => (
                <li key={order.orderId}>
                  <button type="button" onClick={() => setSelected(order.orderId)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left ${selected === order.orderId ? "bg-[#f1f6f1]" : ""}`}>
                    <span>
                      <span className="block text-sm font-semibold">Pedido #{order.orderId}</span>
                      <span className="block text-xs text-[#737a73]">{order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""} · {STATUS_LABEL[order.status] ?? order.status}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#9aa39a]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sessionEmail && selected && detail.data && <OrderTrackingView tracking={detail.data} />}
      </div>
    </main>
  );
}
