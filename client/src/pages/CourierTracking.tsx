import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { MapPin, Navigation, Bike, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

function osmEmbed(latitude: number, longitude: number) {
  const d = 0.009;
  const bbox = `${longitude - d}%2C${latitude - d}%2C${longitude + d}%2C${latitude + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export default function CourierTracking() {
  const { token = "" } = useParams<{ token: string }>();
  const [watching, setWatching] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [completed, setCompleted] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const info = trpc.tracking.driver.useQuery({ token }, { enabled: Boolean(token), refetchInterval: 15000, retry: false });
  const locationMutation = trpc.tracking.updateDriverLocation.useMutation({ onError: (e) => setError(e.message) });
  const finishMutation = trpc.tracking.confirmDelivery.useMutation({ onSuccess: () => { setCompleted(true); setWatching(false); if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, onError: (e) => setError(e.message) });

  const stop = () => { if (watchId.current !== null && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId.current); watchId.current = null; setWatching(false); };
  const start = () => {
    setError("");
    if (!("geolocation" in navigator)) { setError("Este aparelho não oferece localização. Abra o link em um navegador com GPS e permissão de localização."); return; }
    watchId.current = navigator.geolocation.watchPosition((result) => {
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      setPosition(next);
      if (Date.now() - lastSentAt.current >= 5000) {
        lastSentAt.current = Date.now();
        locationMutation.mutate({ token, ...next });
      }
    }, (geoError) => setError(geoError.code === 1 ? "Permita o acesso à localização para compartilhar o trajeto." : "Não foi possível obter a localização. Verifique o GPS e tente novamente."), { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    setWatching(true);
  };
  useEffect(() => () => { if (watchId.current !== null && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId.current); }, []);

  if (info.isLoading) return <main className="grid min-h-screen place-items-center bg-[#f4f5f1] p-6"><p>Carregando entrega…</p></main>;
  if (!info.data) return <main className="grid min-h-screen place-items-center bg-[#f4f5f1] p-6"><div className="max-w-md rounded-3xl bg-white p-7 text-center shadow"><h1 className="text-xl font-bold">Link inválido ou expirado</h1><p className="mt-2 text-sm text-[#737a73]">Peça ao restaurante um novo link de rastreamento.</p></div></main>;
  const order = info.data;
  const map = position ? osmEmbed(position.latitude, position.longitude) : null;

  return <main className="min-h-screen bg-[#f4f5f1] px-4 py-6 text-[#252a26] sm:py-10">
    <div className="mx-auto max-w-xl space-y-4">
      <header className="rounded-3xl bg-[#2f5d50] p-6 text-white shadow-lg"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Bike className="h-6 w-6"/></div><div><p className="text-xs uppercase tracking-[0.18em] text-white/70">Rota do motoboy</p><h1 className="font-display text-2xl font-bold">{order.companyName}</h1></div></div><p className="mt-4 text-sm text-white/85">Pedido #{order.orderId} · {order.customerName}</p></header>
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h2 className="font-semibold">Destino</h2><p className="mt-2 text-sm leading-6 text-[#647064]">{order.address || "Endereço não informado"}</p><p className="mt-1 text-sm text-[#647064]">Contato: {order.customerPhone}</p><a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50] underline" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4"/>Abrir rota no Google Maps</a></section>
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Localização ao vivo</h2><p className="mt-1 text-xs text-[#7c867d]">O cliente verá sua posição enquanto esta página estiver aberta.</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${watching ? "bg-[#e2f1e7] text-[#347052]" : "bg-[#f1f2ee] text-[#737a73]"}`}>{watching ? "Compartilhando" : "Parado"}</span></div>{map && <iframe title="Sua localização" src={map} className="mt-4 h-64 w-full rounded-2xl border-0" loading="lazy"/>}<div className="mt-4 flex gap-2">{watching ? <Button type="button" variant="outline" onClick={stop} className="h-12 flex-1 rounded-xl">Pausar rastreamento</Button> : <Button type="button" onClick={start} disabled={order.status === "delivered" || completed} className="h-12 flex-1 rounded-xl bg-[#2f5d50] text-white"><MapPin className="mr-2 h-4 w-4"/>Iniciar rastreamento</Button>}</div><p className="mt-3 text-xs leading-5 text-[#8a928a]">A localização só é enviada enquanto você mantiver o rastreamento ligado. O navegador pode pedir permissão de GPS.</p></section>
      {!completed && <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#3f7653]"/><div><h2 className="font-semibold">Confirmar entrega</h2><p className="mt-1 text-sm leading-5 text-[#737a73]">Peça ao cliente o código de quatro dígitos e digite aqui. O código não aparece nesta tela.</p></div></div><div className="mt-4 flex gap-2"><Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••" className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.35em]"/><Button type="button" onClick={() => { setError(""); finishMutation.mutate({ token, code }); }} disabled={code.length !== 4 || finishMutation.isPending} className="h-12 rounded-xl bg-[#2f5d50] px-5 text-white">{finishMutation.isPending ? "Validando…" : "Concluir"}</Button></div></section>}
      {completed && <div className="rounded-3xl bg-[#e2f1e7] p-5 text-center text-[#347052]"><CheckCircle2 className="mx-auto h-8 w-8"/><p className="mt-2 font-semibold">Entrega confirmada. Obrigado!</p></div>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <p className="pb-4 text-center text-xs text-[#8a928a]">Não compartilhe este link: ele autoriza atualizar o rastreamento.</p>
    </div>
  </main>;
}
