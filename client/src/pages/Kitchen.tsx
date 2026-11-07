import { usePageTitle } from "@/lib/usePageTitle";
import { Link, useParams } from "wouter";
import { ArrowLeft, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KitchenBoard } from "@/components/KitchenBoard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/** Quadro da cozinha em tela cheia, para um monitor ou tablet na produção. */
export default function Kitchen() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const companyQuery = trpc.company.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  usePageTitle(companyQuery.data?.name && `Cozinha · ${companyQuery.data.name}`);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <ChefHat className="h-7 w-7 animate-pulse text-[#a05c32]" />
      </div>
    );

  if (!isAuthenticated || user?.role !== "admin")
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
          <ChefHat className="mx-auto h-10 w-10 text-[#a05c32]" />
          <h1 className="mt-4 font-display text-2xl font-bold">
            Acesso restrito
          </h1>
          <p className="mt-2 text-sm text-[#776e63]">
            Entre com uma conta autorizada.
          </p>
          <Link href="/admin-login">
            <Button className="mt-6 rounded-xl bg-[#a05c32] text-white">
              Entrar
            </Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-[#e5e0d7] px-4 lg:px-8">
        <p className="truncate font-display text-lg font-bold">
          Cozinha · {companyQuery.data?.name ?? slug}
        </p>
        <Link href={`/${slug}/admin`}>
          <Button variant="outline" size="sm" className="rounded-xl">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Painel
          </Button>
        </Link>
      </header>
      <main className="p-4 lg:p-8">
        <KitchenBoard slug={slug} />
      </main>
    </div>
  );
}
