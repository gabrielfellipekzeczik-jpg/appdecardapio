import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useParams } from "wouter";
import {
  ChefHat,
  ClipboardList,
  Copy,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Package,
  Palette,
  Plug,
  Settings2,
  Utensils,
  WalletCards,
} from "lucide-react";
import { AppearancePanel } from "@/components/AppearancePanel";
import { MenuManager } from "@/components/MenuManager";
import { FinanceDashboard } from "@/components/FinanceDashboard";
import { InventoryManager } from "@/components/InventoryManager";
import { KitchenBoard } from "@/components/KitchenBoard";
import { WhatsappBotCard } from "@/components/WhatsappBotCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/usePageTitle";
import { trpc } from "@/lib/trpc";

const TABS = [
  { key: "kitchen", label: "Cozinha", icon: ChefHat, title: "Cozinha", subtitle: "Arraste os pedidos entre as colunas conforme avançam." },
  { key: "menu", label: "Cardápio", icon: Utensils, title: "Cardápio", subtitle: "Cadastre e organize o que você vende." },
  { key: "inventory", label: "Estoque e produção", icon: Package, title: "Estoque e produção", subtitle: "O que você tem, o que vai fazer e o que falta comprar." },
  { key: "finance", label: "Financeiro", icon: WalletCards, title: "Financeiro", subtitle: "Quanto entrou, quanto saiu e o que mais vende." },
] as const;
type TabKey = (typeof TABS)[number]["key"] | "appearance" | "whatsapp";

export default function Admin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const companyQuery = trpc.company.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  usePageTitle(companyQuery.data?.name && `Painel · ${companyQuery.data.name}`);
  const [tab, setTab] = useState<TabKey>("kitchen");
  const storefrontUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${slug}`
      : `/${slug}`;
  const shareWhatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${companyQuery.data?.name ?? "Confira nosso cardápio"}: ${storefrontUrl}`)}`;

  if (loading)
    return (
      <div className="min-h-screen bg-[#f7f6f2] p-8">
        <div className="mx-auto max-w-5xl animate-pulse rounded-3xl bg-white p-12">
          <div className="h-8 w-64 rounded bg-[#eeeae3]" />
          <div className="mt-6 h-32 rounded-2xl bg-[#f1ece3]" />
        </div>
      </div>
    );
  if (!isAuthenticated || user?.role !== "admin")
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <Card className="max-w-md border-0 text-center shadow-xl">
          <CardContent className="p-8">
            <ClipboardList className="mx-auto h-10 w-10 text-[#a05c32]" />
            <h1 className="mt-4 font-display text-2xl font-bold">
              Área da operação
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#776e63]">
              Entre com uma conta autorizada da loja para acessar pedidos,
              estoque e financeiro.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/admin-login">
                <Button className="w-full rounded-xl bg-[#2f5d50] text-white">
                  Entrar
                </Button>
              </Link>
              <Link href={`/${slug}`}>
                <Button variant="ghost" className="w-full rounded-xl">
                  Voltar ao cardápio
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. O link é " + storefrontUrl);
    }
  };
  const current = TABS.find(entry => entry.key === tab);
  const heading =
    current ??
    (tab === "whatsapp"
      ? {
          title: "WhatsApp",
          subtitle: "Conecte o número do negócio e deixe a IA responder os clientes.",
        }
      : {
          title: "Aparência",
          subtitle: "Logo, cores, horários e o visual da sua página.",
        });

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
      <aside className="admin-sidebar hidden lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="brand-mark">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none text-white">
              {companyQuery.data?.name ?? "Sua loja"}
            </p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/45">
              painel de gestão
            </p>
          </div>
        </div>
        <div className="mt-12 space-y-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`admin-nav-item ${tab === key ? "active" : ""}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-1">
          {user.isSuperAdmin && (
            <Link href="/super-admin">
              <button className="admin-nav-item">
                <Settings2 className="h-4 w-4" />
                Super Admin
              </button>
            </Link>
          )}
          <Link href={`/${slug}`}>
            <button className="admin-nav-item">
              <LogOut className="h-4 w-4" />
              Voltar ao cardápio
            </button>
          </Link>
        </div>
      </aside>
      <div className="lg:pl-[252px]">
        <header className="flex min-h-[68px] items-center justify-between gap-3 border-b border-[#e5e0d7] bg-[#f7f6f2]/85 px-4 backdrop-blur-lg lg:px-9">
          <p className="min-w-0 truncate font-display text-xl font-bold">
            {companyQuery.data?.name ?? "Painel"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={copyLink}
              aria-label="Copiar link do cardápio"
              title="Copiar link do cardápio"
              className="rounded-xl border-[#e5e0d7] bg-white"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <a
              href={shareWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Compartilhar no WhatsApp"
              title="Compartilhar no WhatsApp"
            >
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-[#e5e0d7] bg-white"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={() => setTab("whatsapp")}
              aria-pressed={tab === "whatsapp"}
              aria-label="WhatsApp"
              className="rounded-xl border-[#e5e0d7] bg-white px-3"
            >
              <MessagesSquare className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setTab("appearance")}
              aria-pressed={tab === "appearance"}
              aria-label="Aparência"
              className="rounded-xl border-[#e5e0d7] bg-white px-3"
            >
              <Palette className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Aparência</span>
            </Button>
            <Link href={`/${slug}/admin/integracoes`}>
              <Button
                variant="outline"
                aria-label="Integrações"
                className="rounded-xl border-[#e5e0d7] bg-white px-3"
              >
                <Plug className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Integrações</span>
              </Button>
            </Link>
          </div>
        </header>
        <main className="max-w-[1600px] p-4 lg:p-9">
          <nav
            aria-label="Seções do painel"
            className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
          >
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${tab === key ? "bg-[#2f5d50] text-white" : "bg-[#ebe8e1] text-[#5d554b]"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mb-6">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              {heading.title}
            </h2>
            <p className="mt-1 text-[#776e63]">{heading.subtitle}</p>
          </div>
          {/* A cozinha fica montada em todas as abas para o alerta de novo pedido continuar tocando. */}
          <div hidden={tab !== "kitchen"}>
            <KitchenBoard slug={slug} />
          </div>
          {tab === "menu" && <MenuManager />}
          {tab === "inventory" && <InventoryManager slug={slug} />}
          {tab === "finance" && <FinanceDashboard />}
          {tab === "appearance" && <AppearancePanel />}
          {tab === "whatsapp" && <WhatsappBotCard />}
        </main>
      </div>
    </div>
  );
}
