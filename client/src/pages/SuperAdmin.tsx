import { useState } from "react";
import { Ban, CheckCircle2, Percent, ShieldCheck, Store } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { MAX_PLATFORM_FEE_PERCENT, isValidFeePercent } from "@shared/platform-fee";

const money = (value: number) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
const percentText = (value: number) =>
  `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Campo para o dono da plataforma definir a taxa cobrada de um restaurante. */
function FeeEditor({
  companyId,
  feePercent,
  customFee,
  defaultFeePercent,
  onSaved,
}: {
  companyId: number;
  feePercent: number;
  customFee: boolean;
  defaultFeePercent: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(
    feePercent > 0 ? String(feePercent).replace(".", ",") : ""
  );
  const mutation = trpc.company.setFeePercent.useMutation({
    onSuccess: (_data, input) => {
      toast.success(
        input.percent === null
          ? `Taxa voltou para o padrão (${percentText(defaultFeePercent)}).`
          : `Taxa salva: ${percentText(input.percent)}.`
      );
      onSaved();
    },
    onError: e => toast.error(e.message),
  });

  const parsed = Number(value.replace(",", ".").trim());
  const valid =
    value.trim() !== "" &&
    isValidFeePercent(parsed);
  const changed = valid && Math.abs(parsed - feePercent) > 0.001;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        if (!valid) return;
        mutation.mutate({ companyId, percent: Math.round(parsed * 100) / 100 });
      }}
    >
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-[#776e63]">
          Taxa cobrada
        </span>
        <div className="relative w-24">
          <Input
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder="ex.: 5"
            inputMode="decimal"
            aria-label="Taxa cobrada em porcentagem"
            className="h-9 rounded-lg pr-7"
          />
          <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-[#a79b8d]" />
        </div>
      </label>
      <Button
        type="submit"
        size="sm"
        disabled={!changed || mutation.isPending}
        className="h-9 rounded-lg bg-[#2f5d50] text-white"
      >
        Salvar
      </Button>
      {customFee && isValidFeePercent(defaultFeePercent) && (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => {
            setValue(String(defaultFeePercent).replace(".", ","));
            mutation.mutate({ companyId, percent: null });
          }}
          className="h-9 text-xs font-semibold text-[#a05c32] underline"
        >
          Usar padrão
        </button>
      )}
      {!valid && value.trim() !== "" && (
        <p className="w-full text-xs text-red-600">
          Use um valor maior que 0 e até {MAX_PLATFORM_FEE_PERCENT}.
        </p>
      )}
    </form>
  );
}

export default function SuperAdmin() {
  const { user, loading, isAuthenticated } = useAuth();
  const companiesQuery = trpc.company.list.useQuery(undefined, {
    enabled: isAuthenticated && Boolean(user?.isSuperAdmin),
  });
  const setStatusMutation = trpc.company.setStatus.useMutation({
    onSuccess: () => companiesQuery.refetch(),
    onError: e => toast.error(e.message),
  });

  if (loading)
    return (
      <div className="min-h-screen bg-[#f7f6f2] p-8">
        <div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-white p-12">
          <div className="h-8 w-72 rounded bg-[#eeeae3]" />
        </div>
      </div>
    );
  if (!isAuthenticated || !user?.isSuperAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <Card className="max-w-md border-0 text-center shadow-xl">
          <CardContent className="p-8">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#a05c32]" />
            <h1 className="mt-4 font-display text-2xl font-bold">Acesso restrito</h1>
            <p className="mt-2 text-sm leading-6 text-[#776e63]">
              {isAuthenticated
                ? `Você entrou como ${user?.email ?? "outra conta"}, que não é a conta do proprietário da plataforma.`
                : "Esta área exige a conta do proprietário da plataforma."}
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <Link href="/admin-login">
                <Button className="rounded-xl bg-[#2f5d50] text-white">
                  {isAuthenticated ? "Entrar com outra conta" : "Entrar"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  const companies = companiesQuery.data?.companies ?? [];
  const defaultFeePercent = companiesQuery.data?.defaultFeePercent ?? 5;
  const totalFee = companies.reduce((sum, { platformFee }) => sum + Number(platformFee), 0);
  const totalOrders = companies.reduce((sum, { orderCount }) => sum + Number(orderCount), 0);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
      <header className="border-b border-[#e5e0d7] bg-[#fbfaf7]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">Super Admin</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a05c32]">
                plataforma
              </p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#a05c32]">Empresas</p>
              <p className="mt-2 font-display text-3xl font-bold">{companies.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#a05c32]">Pedidos pagos</p>
              <p className="mt-2 font-display text-3xl font-bold">{totalOrders}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-[#2f5d50] text-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-white/70">Receita de taxas</p>
              <p className="mt-2 font-display text-3xl font-bold">{money(totalFee)}</p>
            </CardContent>
          </Card>
        </div>

        <h1 className="font-display text-2xl font-bold">Empresas cadastradas</h1>
        <p className="mb-4 mt-1 text-sm text-[#776e63]">
          A taxa é retida automaticamente nos pagamentos online (Pix, cartão e links do Mercado Pago).
          Sem taxa válida a loja não aceita pagamento online, e um pagamento aprovado sem a taxa é estornado.
          {" "}
          {isValidFeePercent(defaultFeePercent)
            ? `Taxa padrão: ${percentText(defaultFeePercent)}.`
            : "Não há taxa padrão válida: defina a taxa de cada restaurante."}
          {" "}Pagamentos em dinheiro não têm taxa.
        </p>
        <div className="space-y-3">
          {companiesQuery.isLoading && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-sm text-[#776e63]">Carregando empresas…</CardContent>
            </Card>
          )}
          {companiesQuery.error && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-sm text-red-600">{companiesQuery.error.message}</CardContent>
            </Card>
          )}
          {!companiesQuery.isLoading && !companiesQuery.error && companies.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-sm text-[#776e63]">Nenhuma empresa cadastrada ainda.</CardContent>
            </Card>
          )}
          {companies.map(({ company, revenue, platformFee, orderCount, feePercent, customFee, mpConnected }) => (
            <Card key={company.id} className="border-0 shadow-sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1ece3] text-[#a05c32]">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{company.name}</p>
                      <Badge className={company.status === "active" ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fde2e1] text-[#a3312c]"}>
                        {company.status === "active" ? "Ativa" : "Suspensa"}
                      </Badge>
                      {!isValidFeePercent(feePercent) ? (
                        <Badge className="border-0 bg-[#fde2e1] text-[#a3312c]">Online bloqueado: defina a taxa</Badge>
                      ) : mpConnected ? (
                        <Badge className="border-0 bg-[#e2f1e7] text-[#347052]">Online ativo com taxa</Badge>
                      ) : (
                        <Badge className="border-0 bg-[#f1ece3] text-[#776e63]">Mercado Pago não conectado</Badge>
                      )}
                    </div>
                    <a href={`/${company.slug}`} target="_blank" rel="noreferrer" className="text-xs text-[#a05c32] underline">
                      /{company.slug}
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-[#776e63]">
                  <div>
                    <p className="text-xs uppercase tracking-wide">Pedidos pagos</p>
                    <p className="font-semibold text-[#29251f]">{orderCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide">Faturado</p>
                    <p className="font-semibold text-[#29251f]">{money(revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide">Taxas recebidas</p>
                    <p className="font-semibold text-[#29251f]">{money(platformFee)}</p>
                  </div>
                  <FeeEditor
                    key={`${company.id}-${feePercent}`}
                    companyId={company.id}
                    feePercent={feePercent}
                    customFee={customFee}
                    defaultFeePercent={defaultFeePercent}
                    onSaved={() => companiesQuery.refetch()}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusMutation.mutate({ companyId: company.id, status: company.status === "active" ? "suspended" : "active" })}
                  className="rounded-lg"
                >
                  {company.status === "active" ? <><Ban className="mr-1.5 h-3.5 w-3.5" /> Suspender</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Reativar</>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
