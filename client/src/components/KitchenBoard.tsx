import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Bike,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock,
  Package,
  RefreshCw,
  Store,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ManualOrderDialog } from "@/components/ManualOrderDialog";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import { findNewOrderIds } from "@shared/order-alerts";
import { isPickupOrder } from "@shared/store-rules";

type BoardStatus =
  | "received"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

type BoardOrder = {
  id: number;
  customer: string;
  total: string;
  status: BoardStatus;
  createdAt: Date;
  notes: string | null;
  pickup: boolean;
  paymentLabel: string;
  awaitingCash: boolean;
};

const COLUMNS: {
  key: BoardStatus;
  label: string;
  icon: typeof Package;
  tone: string;
  dot: string;
}[] = [
  { key: "received", label: "Novos", icon: Package, tone: "bg-[#fff6ea] text-[#a05c32] border-[#f5ddb8]", dot: "bg-[#a05c32]" },
  { key: "preparing", label: "Em preparo", icon: ChefHat, tone: "bg-[#f0f5ff] text-[#2c5f9e] border-[#bdd0f5]", dot: "bg-[#2c5f9e]" },
  { key: "ready", label: "Pronto", icon: CheckCircle2, tone: "bg-[#f0faf4] text-[#347052] border-[#b2dfc5]", dot: "bg-[#347052]" },
  { key: "out_for_delivery", label: "Saiu para entrega", icon: Truck, tone: "bg-[#f6f0ff] text-[#6b4fa0] border-[#d0b8f5]", dot: "bg-[#6b4fa0]" },
  { key: "delivered", label: "Entregue", icon: Bike, tone: "bg-[#f1efea] text-[#776e63] border-[#e0dbd1]", dot: "bg-[#776e63]" },
];

const SHORT_LABEL: Record<BoardStatus, string> = {
  received: "Novos",
  preparing: "Preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu",
  delivered: "Entregue",
};

const NEXT_LABEL: Partial<Record<BoardStatus, string>> = {
  received: "Iniciar preparo",
  preparing: "Marcar pronto",
  ready: "Saiu para entrega",
  out_for_delivery: "Entregue",
};

const nextStatus = (order: BoardOrder): BoardStatus | null => {
  if (order.pickup && order.status === "ready") return "delivered";
  const flow = COLUMNS.map(column => column.key);
  return flow[flow.indexOf(order.status) + 1] ?? null;
};

const DELIVERED_VISIBLE_MS = 12 * 60 * 60_000;
const MAX_DELIVERED_CARDS = 8;

function paymentLabel(method: string | null, status: string, pickup: boolean) {
  if (status === "approved") return "Pago";
  if (method === "cash_on_delivery")
    return pickup ? "Pagar na retirada" : "Pagar na entrega";
  if (method === "mercadopago_link") return "Aguardando link de pagamento";
  return "Aguardando pagamento";
}

function useElapsed(since: Date) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor((Date.now() - since.getTime()) / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function CardBody({
  order,
  actions,
}: {
  order: BoardOrder;
  actions?: React.ReactNode;
}) {
  const elapsed = useElapsed(order.createdAt);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#29251f]">
            <span className="font-bold">#{order.id}</span> {order.customer}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#29251f]">
            {order.total}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-[#8a8177]">
          <Clock className="h-3 w-3" /> {elapsed}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-semibold">
        <span className="rounded-full bg-[#f1ece3] px-2 py-0.5 text-[#6d6459]">
          {order.paymentLabel}
        </span>
        {order.pickup && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0d7] px-2 py-0.5 text-[#a05c32]">
            <Store className="h-3 w-3" /> Retirada
          </span>
        )}
      </div>
      {order.notes && (
        <p className="mt-2 rounded-lg bg-[#fff8f0] px-2.5 py-1.5 text-xs leading-relaxed text-[#8a4e2b]">
          {order.notes}
        </p>
      )}
      {actions}
    </>
  );
}

function OrderCard({
  order,
  busy,
  mobile = false,
  onMove,
  onCashReceived,
  onDelete,
}: {
  order: BoardOrder;
  busy: boolean;
  mobile?: boolean;
  onMove: (order: BoardOrder, status: BoardStatus) => void;
  onCashReceived: (order: BoardOrder) => void;
  onDelete: (order: BoardOrder) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    disabled: mobile,
  });
  const next = nextStatus(order);
  const nextLabel =
    order.pickup && order.status === "ready"
      ? "Retirado"
      : NEXT_LABEL[order.status];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={
        mobile
          ? `Pedido ${order.id}`
          : `Pedido ${order.id}, arraste para mudar de coluna`
      }
      className={`rounded-xl border border-[#e8e3da] bg-white shadow-sm ${mobile ? "p-4" : "cursor-grab p-3 active:cursor-grabbing"} ${isDragging ? "opacity-30" : ""}`}
    >
      <CardBody
        order={order}
        actions={
          <div
            className="mt-2 flex items-center gap-1.5"
            onPointerDown={event => event.stopPropagation()}
            onMouseDown={event => event.stopPropagation()}
            onTouchStart={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
          >
            {next && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onMove(order, next)}
                className={`min-w-0 flex-1 rounded-lg bg-[#2f5d50] px-2 font-semibold text-white hover:bg-[#254a40] ${mobile ? "h-11 text-sm" : "h-9 text-xs"}`}
              >
                <span className="truncate">{nextLabel}</span>
                <ChevronRight className="ml-0.5 h-3.5 w-3.5 shrink-0" />
              </Button>
            )}
            {order.awaitingCash && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`Marcar pedido ${order.id} como pago`}
                title="Recebi o pagamento"
                onClick={() => onCashReceived(order)}
                className={`shrink-0 rounded-lg p-0 text-[#347052] ${mobile ? "h-11 w-11" : "h-9 w-9"}`}
              >
                <Wallet className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Excluir pedido ${order.id}`}
              title="Excluir pedido"
              onClick={() => onDelete(order)}
              className={`shrink-0 rounded-lg p-0 text-[#a79b8d] hover:bg-red-50 hover:text-red-600 ${mobile ? "h-11 w-11" : "h-9 w-9"}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />
    </div>
  );
}

function Column({
  column,
  orders,
  children,
}: {
  column: (typeof COLUMNS)[number];
  orders: BoardOrder[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const Icon = column.icon;
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      className={`flex w-[272px] shrink-0 snap-start flex-col rounded-2xl bg-[#f4f1ea] p-2 transition xl:w-auto xl:min-w-0 ${isOver ? "ring-2 ring-[#2f5d50]" : ""}`}
    >
      <div
        className={`mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${column.tone}`}
      >
        <Icon className="h-4 w-4" />
        <span className="truncate">{column.label}</span>
        <span
          className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] text-white ${orders.length ? column.dot : "bg-[#ccc6be]"}`}
        >
          {orders.length}
        </span>
      </div>
      <div className="min-h-24 flex-1 space-y-2">
        {orders.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#dcd6cb] px-3 py-6 text-center text-xs text-[#8a8177]">
            Arraste um pedido para cá
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/** Quadro de pedidos da loja: acompanha, move, cria e exclui pedidos. */
export function KitchenBoard({ slug }: { slug: string }) {
  const ordersQuery = trpc.orders.recent.useQuery(
    { limit: 80 },
    { staleTime: 10_000, refetchInterval: 10_000 }
  );
  const advance = trpc.orders.advanceStatus.useMutation();
  const markCash = trpc.orders.markCashReceived.useMutation();
  const removeOrder = trpc.orders.remove.useMutation();
  const [moved, setMoved] = useState<Record<number, BoardStatus>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<BoardOrder | null>(null);
  const seenIds = useRef<number[]>([]);
  const mobile = useIsMobile();
  const [mobileStatus, setMobileStatus] = useState<BoardStatus>("received");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (!ordersQuery.data) return;
    const ids = ordersQuery.data.map(({ order }) => order.id);
    const fresh = findNewOrderIds(seenIds.current, ids);
    if (seenIds.current.length > 0 && fresh.length > 0) {
      toast.info(
        fresh.length === 1 ? "Novo pedido!" : `${fresh.length} novos pedidos!`,
        { duration: 6000 }
      );
      try {
        const audio = new AudioContext();
        [0, 150, 300].forEach(delay =>
          setTimeout(() => {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 880;
            gain.gain.value = 0.06;
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.08);
          }, delay)
        );
      } catch {
        // O navegador bloqueia som até a primeira interação na página.
      }
    }
    seenIds.current = ids;
  }, [ordersQuery.data]);

  const orders: BoardOrder[] = (ordersQuery.data ?? [])
    .filter(({ order }) => order.status !== "cancelled")
    .map(({ order, customer }) => {
      const pickup = isPickupOrder(order);
      return {
        id: order.id,
        customer: customer?.name ?? "Cliente",
        total: `R$ ${Number(order.total).toFixed(2).replace(".", ",")}`,
        status: moved[order.id] ?? (order.status as BoardStatus),
        createdAt: new Date(order.createdAt),
        notes: order.notes ?? null,
        pickup,
        paymentLabel: paymentLabel(
          order.paymentMethod,
          order.paymentStatus,
          pickup
        ),
        awaitingCash:
          order.paymentMethod === "cash_on_delivery" &&
          order.paymentStatus !== "approved",
      };
    });

  const inColumn = (status: BoardStatus) => {
    const list = orders.filter(order => order.status === status);
    if (status !== "delivered") return list;
    return list
      .filter(
        order => Date.now() - order.createdAt.getTime() < DELIVERED_VISIBLE_MS
      )
      .slice(0, MAX_DELIVERED_CARDS);
  };

  const shareDriverLink = (driverToken: string) => {
    const link = `${window.location.origin}/entregador/${driverToken}`;
    navigator.clipboard
      ?.writeText(link)
      .then(() =>
        toast.success("Link do motoboy copiado", {
          description: "Envie ao entregador para iniciar o GPS.",
        })
      )
      .catch(() => window.prompt("Copie o link do motoboy:", link));
  };

  const moveOrder = async (order: BoardOrder, status: BoardStatus) => {
    if (order.status === status) return;
    if (order.pickup && status === "out_for_delivery") {
      toast.info("Pedido de retirada não sai para entrega.");
      return;
    }
    setMoved(current => ({ ...current, [order.id]: status }));
    setBusyId(order.id);
    try {
      const result = await advance.mutateAsync({ id: order.id, status });
      if (
        result.delivery &&
        "driverToken" in result.delivery &&
        result.delivery.driverToken
      )
        shareDriverLink(result.delivery.driverToken);
      await ordersQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível mover."
      );
    } finally {
      setMoved(current => {
        const { [order.id]: _done, ...rest } = current;
        return rest;
      });
      setBusyId(null);
    }
  };

  const confirmCash = async (order: BoardOrder) => {
    setBusyId(order.id);
    try {
      await markCash.mutateAsync({ orderId: order.id });
      toast.success("Pagamento registrado.");
      await ordersQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar."
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const order = deleting;
    setDeleting(null);
    setBusyId(order.id);
    try {
      await removeOrder.mutateAsync({ id: order.id });
      toast.success(`Pedido #${order.id} excluído.`);
      await ordersQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível excluir."
      );
    } finally {
      setBusyId(null);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const order = orders.find(entry => entry.id === event.active.id);
    const target = event.over?.id as BoardStatus | undefined;
    if (order && target) void moveOrder(order, target);
  };

  const dragged = orders.find(order => order.id === draggingId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:flex md:flex-wrap">
        <ManualOrderDialog
          slug={slug}
          onCreated={() => void ordersQuery.refetch()}
        />
        <Button
          variant="outline"
          onClick={() => void ordersQuery.refetch()}
          className="rounded-xl border-[#e5e0d7] bg-white text-[#29251f]"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>
      {mobile ? (
        <div>
          <div
            role="tablist"
            aria-label="Etapas dos pedidos"
            className="sticky top-[60px] z-20 -mx-4 grid grid-cols-5 gap-1 bg-[#f7f6f2] px-3 py-2"
          >
            {COLUMNS.map(column => {
              const count = inColumn(column.key).length;
              const active = mobileStatus === column.key;
              const Icon = column.icon;
              return (
                <button
                  key={column.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${column.label}: ${count}`}
                  onClick={() => setMobileStatus(column.key)}
                  className={`relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[11px] font-semibold leading-tight transition ${
                    active
                      ? "border-[#2f5d50] bg-[#2f5d50] text-white"
                      : "border-[#e5e0d7] bg-white text-[#5d554b]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {SHORT_LABEL[column.key]}
                  {count > 0 && (
                    <span
                      className={`absolute -right-1 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] text-white ring-2 ring-[#f7f6f2] ${column.dot}`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 space-y-3">
            {inColumn(mobileStatus).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#dcd6cb] px-4 py-10 text-center text-sm text-[#8a8177]">
                Nenhum pedido em “{COLUMNS.find(c => c.key === mobileStatus)?.label}”.
              </p>
            ) : (
              <DndContext sensors={[]}>
                {inColumn(mobileStatus).map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    mobile
                    busy={busyId === order.id}
                    onMove={moveOrder}
                    onCashReceived={confirmCash}
                    onDelete={setDeleting}
                  />
                ))}
              </DndContext>
            )}
          </div>
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        onDragStart={event => setDraggingId(Number(event.active.id))}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
          {COLUMNS.map(column => {
            const list = inColumn(column.key);
            return (
              <Column key={column.key} column={column} orders={list}>
                {list.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    busy={busyId === order.id}
                    onMove={moveOrder}
                    onCashReceived={confirmCash}
                    onDelete={setDeleting}
                  />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {dragged && (
            <div className="w-[256px] rotate-2 rounded-xl border border-[#d9d3c8] bg-white p-3 shadow-xl">
              <CardBody order={dragged} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido #{deleting?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido sai da cozinha e do financeiro, e o cliente vê que foi
              cancelado.
              {deleting?.paymentLabel === "Pago" &&
                " Este pedido já foi pago: o dinheiro não é devolvido automaticamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter pedido</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
