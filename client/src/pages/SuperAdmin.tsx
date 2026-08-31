import { Ban, CheckCircle2, ShieldCheck, Store } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function SuperAdmin() {
  const { user, loading, isAuthenticated } = useAuth();
  const companiesQuery = trpc.company.list.useQuery(undefined, { enabled: isAuthenticated });
  const setStatusMutation = trpc.company.setStatus.useMutation({ onSuccess: () => companiesQuery.refetch(), onError: (e) => toast.error(e.message) });

  if (loading) return <div className="min-h-screen bg-[#f7f6f2] p-8"><div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-white p-12"><div className="h-8 w-72 rounded bg-[#eeeae3]" /></div></div>;
  if (!isAuthenticated || !user?.isSuperAdmin) return <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6"><Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8"><ShieldCheck className="mx-auto h-10 w-10 text-[#a05c32]" /><h1 className="mt-4 font-display text-2xl font-bold">Acesso restrito</h1><p className="mt-2 text-sm leading-6 text-[#776e63]">Esta área exige a conta do proprietário da plataforma.</p><div className="mt-5 flex flex-col items-center gap-2"><Link href="/admin-login"><Button className="rounded-xl bg-[#2f5d50] text-white">Entrar</Button></Link></div></CardContent></Card></div>;

  const companies = companiesQuery.data ?? [];
  const totalFee = companies.reduce((sum, { platformFee }) => sum + Number(platformFee), 0);
  const totalOrders = companies.reduce((sum, { orderCount }) => sum + Number(orderCount), 0);

  return <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
    <header className="border-b border-[#e5e0d7] bg-[#fbfaf7]"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3"><div className="brand-mark"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display text-xl font-bold">Super Admin</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a05c32]">plataforma</p></div></div></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#a05c32]">Empresas</p><p className="mt-2 font-display text-3xl font-bold">{companies.length}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#a05c32]">Pedidos</p><p className="mt-2 font-display text-3xl font-bold">{totalOrders}</p></CardContent></Card>
        <Card className="border-0 bg-[#2f5d50] text-white shadow-sm"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-white/70">Receita de taxas (5%)</p><p className="mt-2 font-display text-3xl font-bold">R$ {totalFee.toFixed(2).replace(".", ",")}</p></CardContent></Card>
      </div>

      <h1 className="mb-4 font-display text-2xl font-bold">Empresas cadastradas</h1>
      <div className="space-y-3">
        {companies.length === 0 && <Card className="border-0 shadow-sm"><CardContent className="p-6 text-sm text-[#776e63]">Nenhuma empresa cadastrada ainda.</CardContent></Card>}
        {companies.map(({ company, revenue, platformFee, orderCount }) => (
          <Card key={company.id} className="border-0 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1ece3] text-[#a05c32]"><Store className="h-5 w-5" /></div>
                <div>
                  <div className="flex items-center gap-2"><p className="font-semibold">{company.name}</p><Badge className={company.status === "active" ? "border-0 bg-[#e2f1e7] text-[#347052]" : "border-0 bg-[#fde2e1] text-[#a3312c]"}>{company.status === "active" ? "Ativa" : "Suspensa"}</Badge></div>
                  <a href={`/${company.slug}`} target="_blank" rel="noreferrer" className="text-xs text-[#a05c32] underline">/{company.slug}</a>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-[#776e63]">
                <div><p className="text-xs uppercase tracking-wide">Pedidos</p><p className="font-semibold text-[#29251f]">{orderCount}</p></div>
                <div><p className="text-xs uppercase tracking-wide">Faturado</p><p className="font-semibold text-[#29251f]">R$ {Number(revenue).toFixed(2).replace(".", ",")}</p></div>
                <div><p className="text-xs uppercase tracking-wide">Taxa (5%)</p><p className="font-semibold text-[#29251f]">R$ {Number(platformFee).toFixed(2).replace(".", ",")}</p></div>
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
  </div>;
}
