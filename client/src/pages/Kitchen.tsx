import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ChefHat, CheckCircle2, ChevronRight, Clock, Package, RefreshCw, Truck, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { findNewOrderIds } from "@shared/order-alerts";

// ─── Types ────────────────────────────────────────────────────────────────────

type KitchenStatus = "received" | "preparing" | "ready" | "out_for_delivery";

type KitchenOrder = {
  id: number;
  customer: string;
  items: string;
  total: string;
  method: string;
  status: KitchenStatus;
  createdAt: Date;
  notes: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { key: KitchenStatus; label: string; icon: typeof ChefHat; color: string; bg: string; border: string; glow: string }[] = [
  {
    key: "received",
    label: "Recebido",
    icon: Package,
    color: "text-[#a05c32]",
    bg: "bg-[#fff8f0]",
    border: "border-[#f5d9b8]",
    glow: "shadow-[0_0_0_3px_rgba(160,92,50,0.12)]",
  },
  {
    key: "preparing",
    label: "Em preparo",
    icon: ChefHat,
    color: "text-[#2c5f9e]",
    bg: "bg-[#f0f5ff]",
    border: "border-[#bdd0f5]",
    glow: "shadow-[0_0_0_3px_rgba(44,95,158,0.12)]",
  },
  {
    key: "ready",
    label: "Pronto",
    icon: CheckCircle2,
    color: "text-[#347052]",
    bg: "bg-[#f0faf4]",
    border: "border-[#b2dfc5]",
    glow: "shadow-[0_0_0_3px_rgba(52,112,82,0.18)]",
  },
  {
    key: "out_for_delivery",
    label: "Saiu para entrega",
    icon: Truck,
    color: "text-[#6b4fa0]",
    bg: "bg-[#f6f0ff]",
    border: "border-[#d0b8f5]",
    glow: "shadow-[0_0_0_3px_rgba(107,79,160,0.12)]",
  },
];

const NEXT_STATUS: Record<KitchenStatus, KitchenStatus | "delivered"> = {
  received: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

const NEXT_LABEL: Record<KitchenStatus, string> = {
  received: "Iniciar preparo",
  preparing: "Marcar pronto",
  ready: "Saiu para entrega",
  out_for_delivery: "Entregar",
};

// ─── Timer ────────────────────────────────────────────────────────────────────

function useElapsed(since: Date) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.now() - since.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function ElapsedBadge({ since, warn }: { since: Date; warn: number }) {
  const label = useElapsed(since);
  const mins = Math.floor((Date.now() - since.getTime()) / 60_000);
  const overdue = mins >= warn;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? "text-red-500" : "text-[#a79b8d]"}`}>
      <Clock className={`h-3 w-3 ${overdue ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  column,
  onAdvance,
  advancing,
}: {
  order: KitchenOrder;
  column: (typeof COLUMNS)[number];
  onAdvance: (id: number, next: KitchenStatus | "delivered") => void;
  advancing: boolean;
}) {
  const next = NEXT_STATUS[order.status];
  const warnAfter = order.status === "received" ? 3 : order.status === "preparing" ? 20 : 5;

  return (
    <div
      className={`group rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 ${column.border} ${column.glow}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${column.color}`}>#{order.id}</span>
            <span className="text-sm font-semibold text-[#29251f]">{order.customer}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#776e63]">{order.items}</p>
        </div>
        <ElapsedBadge since={order.createdAt} warn={warnAfter} />
      </div>

      {/* Notes */}
      {order.notes && (
        <p className="mt-2 rounded-lg bg-[#fff8f0] px-3 py-2 text-xs leading-relaxed text-[#a05c32]">
          📝 {order.notes}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#29251f]">{order.total}</span>
          <span className="text-xs text-[#a79b8d]">· {order.method}</span>
        </div>
        {next !== "delivered" ? (
          <Button
            size="sm"
            disabled={advancing}
            onClick={() => onAdvance(order.id, next)}
            className={`h-7 rounded-lg px-3 text-xs font-semibold text-white transition-all ${
              order.status === "preparing"
                ? "bg-[#347052] hover:bg-[#2a5c44]"
                : order.status === "ready"
                ? "bg-[#6b4fa0] hover:bg-[#5a3f8c]"
                : "bg-[#2f5d50] hover:bg-[#254a40]"
            }`}
          >
            {advancing ? "…" : NEXT_LABEL[order.status]}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={advancing}
            onClick={() => onAdvance(order.id, "delivered")}
            className="h-7 rounded-lg bg-[#a05c32] px-3 text-xs font-semibold text-white hover:bg-[#8a4e2b]"
          >
            {advancing ? "…" : "Entregar"}
            <CheckCircle2 className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  orders,
  onAdvance,
  advancingId,
}: {
  column: (typeof COLUMNS)[number];
  orders: KitchenOrder[];
  onAdvance: (id: number, next: KitchenStatus | "delivered") => void;
  advancingId: number | null;
}) {
  const Icon = column.icon;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Column header */}
      <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ${column.bg} ${column.border} border`}>
        <Icon className={`h-4 w-4 ${column.color}`} />
        <span className={`text-sm font-bold ${column.color}`}>{column.label}</span>
        <span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          orders.length > 0
            ? column.key === "received" ? "bg-[#a05c32]"
            : column.key === "preparing" ? "bg-[#2c5f9e]"
            : column.key === "ready" ? "bg-[#347052]"
            : "bg-[#6b4fa0]"
            : "bg-[#ccc6be]"
        }`}>
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {orders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#e5e0d7] px-4 py-8 text-center">
            <p className="text-xs text-[#ccc6be]">Nenhum pedido</p>
          </div>
        )}
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            column={column}
            onAdvance={onAdvance}
            advancing={advancingId === order.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Kitchen() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const companyQuery = trpc.company.mine.useQuery(undefined, { enabled: isAuthenticated });
  const ordersQuery = trpc.orders.recent.useQuery(
    { limit: 50 },
    { staleTime: 10_000, refetchInterval: 10_000, enabled: isAuthenticated }
  );
  const advanceStatusMutation = trpc.orders.advanceStatus.useMutation({
    onSuccess: () => ordersQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const [advancingId, setAdvancingId] = useState<number | null>(null);
  const seenOrderIds = useRef<number[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Alerta sonoro + toast em novo pedido
  useEffect(() => {
    const currentIds = ordersQuery.data?.map(({ order }) => order.id) ?? [];
    const newIds = findNewOrderIds(seenOrderIds.current, currentIds);
    if (seenOrderIds.current.length > 0 && newIds.length > 0) {
      toast.info(`${newIds.length === 1 ? "Novo pedido" : `${newIds.length} novos pedidos`}!`, {
        description: "A fila foi atualizada.",
        duration: 6000,
      });
      try {
        const ctx = new AudioContext();
        [0, 150, 300].forEach((delay) => {
          setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.value = 0.06;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
          }, delay);
        });
      } catch { /* bloqueado até interação do usuário */ }
    }
    seenOrderIds.current = currentIds;
    setLastRefresh(new Date());
  }, [ordersQuery.data]);

  const handleAdvance = async (id: number, next: KitchenStatus | "delivered") => {
    setAdvancingId(id);
    try {
      await advanceStatusMutation.mutateAsync({
        id,
        status: next as "received" | "preparing" | "ready" | "out_for_delivery" | "delivered",
      });
      toast.success(`Pedido #${id} avançado.`);
    } finally {
      setAdvancingId(null);
    }
  };

  // Converte os dados da query para KitchenOrder
  const activeStatuses = new Set<string>(["received", "preparing", "ready", "out_for_delivery"]);
  const kitchenOrders: KitchenOrder[] = (ordersQuery.data ?? [])
    .filter(({ order }) => activeStatuses.has(order.status))
    .map(({ order, customer }) => ({
      id: order.id,
      customer: customer?.name ?? "Cliente",
      items: "Pedido #" + order.id, // fallback — itens não vêm na lista resumida
      total: `R$ ${Number(order.total).toFixed(2).replace(".", ",")}`,
      method: order.paymentMethod ?? "—",
      status: order.status as KitchenStatus,
      createdAt: new Date(order.createdAt),
      notes: order.notes ?? null,
    }));

  const ordersByStatus = COLUMNS.reduce<Record<KitchenStatus, KitchenOrder[]>>(
    (acc, col) => {
      acc[col.key] = kitchenOrders.filter((o) => o.status === col.key);
      return acc;
    },
    { received: [], preparing: [], ready: [], out_for_delivery: [] }
  );

  const totalActive = kitchenOrders.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1208]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a05c32]/20">
            <ChefHat className="h-7 w-7 animate-pulse text-[#a05c32]" />
          </div>
          <p className="text-sm text-white/40">Carregando cozinha…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1208] px-6">
        <div className="rounded-3xl bg-[#231a0e] p-10 text-center shadow-2xl">
          <ChefHat className="mx-auto h-10 w-10 text-[#a05c32]" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Acesso restrito</h1>
          <p className="mt-2 text-sm text-white/50">Entre com uma conta autorizada.</p>
          <Link href="/admin-login">
            <Button className="mt-6 rounded-xl bg-[#a05c32] text-white">Entrar</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111008] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#111008]/90 backdrop-blur-xl">
        <div className="flex h-[68px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a05c32]/20">
              <ChefHat className="h-5 w-5 text-[#e8bd72]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                COZINHA
              </p>
              <p className="font-display text-lg font-bold leading-none">
                {companyQuery.data?.name ?? slug}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active orders badge */}
            {totalActive > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-[#a05c32]/20 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#e8bd72]" />
                <span className="text-sm font-semibold text-[#e8bd72]">
                  {totalActive} {totalActive === 1 ? "pedido ativo" : "pedidos ativos"}
                </span>
              </div>
            )}

            {/* Last refresh */}
            <button
              onClick={() => ordersQuery.refetch()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/40 transition hover:border-white/20 hover:text-white/70"
            >
              <RefreshCw className={`h-3 w-3 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
              {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </button>

            <Link href={`/${slug}/admin`}>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl border border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Painel
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Kanban ── */}
      <main className="px-5 py-6 lg:px-8">
        {/* Empty state */}
        {totalActive === 0 && !ordersQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
              <Utensils className="h-9 w-9 text-white/20" />
            </div>
            <p className="mt-6 font-display text-2xl font-bold text-white/30">Cozinha livre</p>
            <p className="mt-2 text-sm text-white/20">
              Nenhum pedido ativo no momento. Novos pedidos aparecem aqui automaticamente.
            </p>
          </div>
        )}

        {/* Kanban grid */}
        {totalActive > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                orders={ordersByStatus[col.key]}
                onAdvance={handleAdvance}
                advancingId={advancingId}
              />
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {ordersQuery.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.key} className="space-y-3">
                <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                {[1, 2].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
