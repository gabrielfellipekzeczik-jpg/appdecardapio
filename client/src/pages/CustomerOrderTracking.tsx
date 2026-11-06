import { RefreshCw } from "lucide-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { OrderTrackingView } from "@/components/OrderTrackingView";
import { trpc } from "@/lib/trpc";

export default function CustomerOrderTracking() {
  const { slug = "", token = "" } = useParams<{ slug: string; token: string }>();
  const query = trpc.tracking.customer.useQuery({ token }, { enabled: Boolean(token), refetchInterval: 10000, retry: false });
  const tracking = query.data;
  return (
    <main className="min-h-screen bg-[#f4f5f1] px-4 py-6 text-[#252a26] sm:py-10">
      <div className="mx-auto max-w-xl space-y-3">
        {query.isLoading && <section className="rounded-3xl bg-white p-7 text-center text-sm text-[#737a73]">Carregando pedido…</section>}
        {query.isError && (
          <section className="rounded-3xl bg-white p-7 text-center">
            <h2 className="font-semibold">Não foi possível abrir este rastreamento</h2>
            <p className="mt-2 text-sm text-[#737a73]">Confira o link ou consulte pelo seu e-mail.</p>
            <Button variant="outline" onClick={() => query.refetch()} className="mt-4 rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </section>
        )}
        {tracking && <OrderTrackingView tracking={tracking} />}
        <div className="flex justify-center gap-2 pt-2">
          <Link href={`/${slug}/pedidos`}>
            <Button variant="ghost" className="rounded-xl text-[#526d58]">Meus pedidos</Button>
          </Link>
          <Link href={`/${slug}`}>
            <Button variant="ghost" className="rounded-xl text-[#526d58]">Voltar à loja</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
