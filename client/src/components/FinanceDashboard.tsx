import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  BarList,
  EXPENSE_COLOR,
  REVENUE_COLOR,
  TrendChart,
  money,
} from "@/components/FinanceCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const offsetKey = (days: number) => {
  const date = new Date(`${todayKey()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const categories = [
  "Ingredientes",
  "Embalagens",
  "Entrega",
  "Aluguel",
  "Energia e água",
  "Equipe",
  "Marketing",
  "Impostos",
  "Manutenção",
  "Outros",
];
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

type Draft = {
  description: string;
  category: string;
  amount: string;
  date: string;
  notes: string;
};
const newDraft = (): Draft => ({
  description: "",
  category: "Ingredientes",
  amount: "",
  date: todayKey(),
  notes: "",
});

export function FinanceDashboard() {
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState(offsetKey(-29));
  const [to, setTo] = useState(todayKey());
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const report = trpc.finance.report.useQuery(
    { from, to },
    { refetchInterval: 60_000 }
  );
  const createExpense = trpc.finance.createExpense.useMutation();
  const data = report.data;

  const setPreset = (value: string) => {
    setPeriod(value);
    if (value === "custom") return;
    const days = Number(value);
    const nextFrom = offsetKey(-(days - 1));
    const nextTo = todayKey();
    setFrom(nextFrom);
    setTo(nextTo);
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
  };
  const exportCsv = () => {
    if (!data) return;
    const rows: unknown[][] = [
      ["Relatório financeiro", `${data.from} a ${data.to}`],
      [],
      ["Resumo", "Valor"],
      ["Receita aprovada", data.summary.revenue],
      ["Despesas lançadas", data.summary.expenses],
      ["Saldo operacional registrado", data.summary.operatingBalance],
      ["Pedidos pagos", data.summary.approvedOrders],
      ["Ticket médio", data.summary.averageTicket],
      ["A receber (pedidos pendentes)", data.summary.pendingRevenue],
      [],
      ["Período", "Receita", "Despesas", "Saldo", "Pedidos pagos"],
      ...data.timeline.map(row => [
        row.date,
        row.revenue,
        row.expenses,
        row.balance,
        row.orders,
      ]),
      [],
      ["Despesas", "Categoria", "Valor", "Data", "Observação"],
      ...data.recentExpenses.map(item => [
        item.description,
        item.category,
        item.amount,
        item.incurredAt,
        item.notes,
      ]),
    ];
    const content = `\ufeff${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const submitExpense = async () => {
    const value = Number(draft.amount.replace(",", "."));
    if (
      !draft.description.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !draft.date
    ) {
      toast.error("Informe descrição, valor positivo e data.");
      return;
    }
    try {
      await createExpense.mutateAsync({
        description: draft.description.trim(),
        category: draft.category,
        amount: value,
        date: draft.date,
        notes: draft.notes.trim() || undefined,
      });
      toast.success("Despesa registrada.");
      setExpenseOpen(false);
      setDraft(newDraft());
      await report.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a despesa."
      );
    }
  };
  const periodLabel = useMemo(() => `${from} — ${to}`, [from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-end gap-4 xl:flex-row xl:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Período do relatório"
            value={period}
            onChange={event => setPreset(event.target.value)}
            className="h-10 rounded-xl border border-[#e1e7e0] bg-white px-3 text-sm text-[#39463c] outline-none focus:border-[#7d9a82]"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                aria-label="Data inicial"
                type="date"
                value={draftFrom}
                onChange={event => setDraftFrom(event.target.value)}
                className="h-10 w-[145px] rounded-xl"
              />
              <span className="text-xs text-[#829083]">até</span>
              <Input
                aria-label="Data final"
                type="date"
                value={draftTo}
                onChange={event => setDraftTo(event.target.value)}
                className="h-10 w-[145px] rounded-xl"
              />
              <Button
                onClick={() => {
                  if (draftFrom > draftTo) {
                    toast.error("A data inicial deve ser anterior à final.");
                    return;
                  }
                  setFrom(draftFrom);
                  setTo(draftTo);
                }}
                className="h-10 rounded-xl bg-[#2f5d50]"
              >
                Aplicar
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => void report.refetch()}
            disabled={report.isFetching}
            className="h-10 rounded-xl border-[#e1e7e0]"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${report.isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!data}
            className="h-10 rounded-xl border-[#e1e7e0]"
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => {
              setDraft(newDraft());
              setExpenseOpen(true);
            }}
            className="h-10 rounded-xl bg-[#a05c32] text-white hover:bg-[#8e4f2c]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Lançar despesa
          </Button>
        </div>
      </div>

      {report.isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">
            Não foi possível carregar os dados financeiros.{" "}
            {report.error.message}
          </CardContent>
        </Card>
      )}
      {report.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className="h-32 animate-pulse rounded-2xl bg-[#e8ece7]"
            />
          ))}
        </div>
      )}
      {data && (
        <>
          <div className="flex items-center gap-2 text-xs text-[#7d877d]">
            <CalendarDays className="h-4 w-4" />
            Período: {periodLabel}
            <span className="ml-auto">
              Atualiza automaticamente a cada minuto
            </span>
          </div>
          {data.financeDateBasis === "createdAt" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm leading-6 text-amber-900">
                Relatório carregado em modo de compatibilidade: os pedidos são
                agrupados pela data de criação. Aplique a migração financeira
                pendente para usar a data real de aprovação do pagamento.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Entrou"
              value={money(data.summary.revenue)}
              detail={`${data.summary.approvedOrders} pedidos pagos`}
            />
            <Metric
              title="Saiu"
              value={money(data.summary.expenses)}
              detail="Despesas lançadas"
            />
            <Metric
              title="Sobrou"
              value={money(data.summary.operatingBalance)}
              detail={`${data.summary.marginPercent.toFixed(1).replace(".", ",")}% do que entrou`}
            />
            <Metric
              title="Ticket médio"
              value={money(data.summary.averageTicket)}
              detail="Valor médio por pedido pago"
            />
          </div>
          <p className="-mt-3 text-xs text-[#6f786f]">
            "Sobrou" é o que entrou menos as despesas lançadas. Não é lucro
            contábil: impostos, taxas e custos não lançados ficam de fora.
          </p>

          <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">
                Receita e despesas {data.monthly ? "por mês" : "por dia"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={data.timeline} />
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <ChartCard title="O que mais vende">
              <BarList
                items={data.topProducts.map(item => ({
                  name: item.name,
                  value: item.revenue,
                }))}
                color={REVENUE_COLOR}
                emptyMessage="Nenhum produto pago no período."
              />
            </ChartCard>
            <ChartCard title="Como os clientes pagam">
              <BarList
                items={data.paymentMethods.map(item => ({
                  name: item.name,
                  value: item.revenue,
                }))}
                color={REVENUE_COLOR}
                emptyMessage="Ainda não há pagamentos aprovados no período."
              />
            </ChartCard>
            <ChartCard title="Para onde vai o dinheiro">
              <BarList
                items={data.expenseCategories.map(item => ({
                  name: item.name,
                  value: item.value,
                }))}
                color={EXPENSE_COLOR}
                emptyMessage="Nenhuma despesa lançada no período."
              />
            </ChartCard>
          </div>

          <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display text-lg">
                  Despesas recentes
                </CardTitle>
                <p className="mt-1 text-xs text-[#879087]">
                  Registros do período selecionado
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(newDraft());
                  setExpenseOpen(true);
                }}
                className="rounded-xl border-[#e1e7e0]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova despesa
              </Button>
            </CardHeader>
            <CardContent>
              {data.recentExpenses.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#edf0eb] text-xs uppercase tracking-wide text-[#899188]">
                        <th className="pb-3 pr-4 font-semibold">Descrição</th>
                        <th className="pb-3 pr-4 font-semibold">Categoria</th>
                        <th className="pb-3 pr-4 font-semibold">Data</th>
                        <th className="pb-3 text-right font-semibold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentExpenses.map(expense => (
                        <tr
                          key={expense.id}
                          className="border-b border-[#f1f3ef] last:border-0"
                        >
                          <td className="py-3 pr-4 font-medium text-[#384139]">
                            {expense.description}
                            <p className="mt-0.5 text-xs font-normal text-[#929991]">
                              {expense.notes || "—"}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-[#657066]">
                            {expense.category}
                          </td>
                          <td className="py-3 pr-4 text-[#657066]">
                            {new Date(expense.incurredAt).toLocaleDateString(
                              "pt-BR",
                              { timeZone: "America/Sao_Paulo" }
                            )}
                          </td>
                          <td className="py-3 text-right font-semibold text-[#a05c32]">
                            {money(Number(expense.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#dfe5dd] p-8 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-[#9aa69a]" />
                  <p className="mt-3 font-semibold text-[#4d594e]">
                    Sem despesas nesse período
                  </p>
                  <p className="mt-1 text-sm text-[#818a81]">
                    Use “Lançar despesa” para começar seus relatórios.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Lançar despesa
            </DialogTitle>
            <DialogDescription>
              O lançamento será salvo na empresa e refletido nos relatórios
              financeiros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <label className="block text-sm font-semibold text-[#465147]">
              Descrição
              <Input
                value={draft.description}
                onChange={event =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="Ex.: compra de embalagens"
                className="mt-1.5 rounded-xl"
                maxLength={160}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#465147]">
                Categoria
                <select
                  value={draft.category}
                  onChange={event =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#e1e7e0] bg-white px-3 text-sm"
                >
                  {categories.map(category => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[#465147]">
                Valor (R$)
                <Input
                  value={draft.amount}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      amount: event.target.value.replace(/[^\d.,]/g, ""),
                    })
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="mt-1.5 rounded-xl"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-[#465147]">
              Data
              <Input
                type="date"
                value={draft.date}
                onChange={event =>
                  setDraft({ ...draft, date: event.target.value })
                }
                className="mt-1.5 rounded-xl"
              />
            </label>
            <label className="block text-sm font-semibold text-[#465147]">
              Observação{" "}
              <span className="font-normal text-[#929991]">(opcional)</span>
              <Input
                value={draft.notes}
                onChange={event =>
                  setDraft({ ...draft, notes: event.target.value })
                }
                placeholder="Fornecedor, comprovante, detalhes…"
                className="mt-1.5 rounded-xl"
                maxLength={500}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setExpenseOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitExpense}
                disabled={createExpense.isPending}
                className="rounded-xl bg-[#a05c32] text-white"
              >
                {createExpense.isPending ? "Salvando…" : "Salvar despesa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-[#6f786f]">{title}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-[#2c352d]">
          {value}
        </p>
        <p className="mt-1 text-xs text-[#6f786f]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
