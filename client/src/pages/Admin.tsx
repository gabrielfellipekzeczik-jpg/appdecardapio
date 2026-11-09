import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useParams } from "wouter";
import {
  ChefHat,
  ClipboardList,
  Copy,
  DoorOpen,
  LogOut,
  Menu,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/usePageTitle";
import { trpc } from "@/lib/trpc";

const TABS = [
  { key: "kitchen", label: "Cozinha", icon: ChefHat, title: "Cozinha", subtitle: "Acompanhe os pedidos e avance cada um até a entrega." },
  { key: "menu", label: "Cardápio", icon: Utensils, title: "Cardápio", subtitle: "Cadastre e organize o que você vende." },
  { key: "inventory", label: "Estoque e produção", icon: Package, title: "Estoque e produção", subtitle: "O que você tem, o que vai fazer e o que falta comprar." },
  { key: "finance", label: "Financeiro", icon: WalletCards, title: "Financeiro", subtitle: "Quanto entrou, quanto saiu e o que mais vende." },
] as const;
type TabKey = (typeof TABS)[number]["key"] | "appearance" | "whatsapp";

export default function Admin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const signOut = async () => {
    await logout();
    window.location.href = "/admin-login";
  };
  const companyQuery = trpc.company.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  usePageTitle(companyQuery.data?.name && `Painel · ${companyQuery.data.name}`);
  const [tab, setTab] = useState<TabKey>("kitchen");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const go = (key: TabKey) => {
    setTab(key);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };
  const drawerItem = (
    active: boolean,
    Icon: typeof ChefHat,
    label: string,
    onClick?: () => void
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium transition ${
        active
          ? "bg-[#2f5d50] text-white"
          : "text-[#29251f] hover:bg-[#efebe4]"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </button>
  );
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
          <button className="admin-nav-item" onClick={signOut}>
            <DoorOpen className="h-4 w-4" />
            Sair da conta
          </button>
          {user.email && (
            <p className="truncate px-3 pt-1 text-[11px] text-white/45" title={user.email}>
              {user.email}
            </p>
          )}
        </div>
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex min-h-[60px] items-center justify-between gap-3 border-b border-[#e5e0d7] bg-[#f7f6f2]/90 px-3 backdrop-blur-lg lg:min-h-[68px] lg:px-9">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#29251f] hover:bg-[#ebe8e1] lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold leading-tight lg:text-xl">
                {companyQuery.data?.name ?? "Painel"}
              </p>
              <p className="truncate text-xs text-[#776e63] lg:hidden">
                {heading.title}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
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
              <MessagesSquare className="mr-2 h-4 w-4" />
              <span>WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setTab("appearance")}
              aria-pressed={tab === "appearance"}
              aria-label="Aparência"
              className="rounded-xl border-[#e5e0d7] bg-white px-3"
            >
              <Palette className="mr-2 h-4 w-4" />
              <span>Aparência</span>
            </Button>
            <Link href={`/${slug}/admin/integracoes`}>
              <Button
                variant="outline"
                aria-label="Integrações"
                className="rounded-xl border-[#e5e0d7] bg-white px-3"
              >
                <Plug className="mr-2 h-4 w-4" />
                <span>Integrações</span>
              </Button>
            </Link>
          </div>
        </header>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent
            side="left"
            className="flex w-[84vw] max-w-[320px] flex-col gap-0 overflow-y-auto bg-[#f7f6f2] p-0"
          >
            <div className="border-b border-[#e5e0d7] px-5 pb-4 pt-6">
              <SheetTitle className="truncate font-display text-xl font-bold">
                {companyQuery.data?.name ?? "Sua loja"}
              </SheetTitle>
              <SheetDescription className="text-xs text-[#776e63]">
                Painel de gestão
              </SheetDescription>
            </div>
            <nav aria-label="Seções do painel" className="space-y-1 p-3">
              {TABS.map(({ key, label, icon }) =>
                <div key={key}>{drawerItem(tab === key, icon, label, () => go(key))}</div>
              )}
            </nav>
            <div className="mx-3 border-t border-[#e5e0d7]" />
            <div className="space-y-1 p-3">
              {drawerItem(tab === "whatsapp", MessagesSquare, "Robô do WhatsApp", () => go("whatsapp"))}
              {drawerItem(tab === "appearance", Palette, "Aparência e regras", () => go("appearance"))}
              <Link href={`/${slug}/admin/integracoes`}>
                {drawerItem(false, Plug, "Integrações")}
              </Link>
            </div>
            <div className="mx-3 border-t border-[#e5e0d7]" />
            <div className="space-y-1 p-3">
              {drawerItem(false, Copy, "Copiar link do cardápio", () => {
                setMenuOpen(false);
                void copyLink();
              })}
              <a href={shareWhatsappUrl} target="_blank" rel="noreferrer">
                {drawerItem(false, MessageCircle, "Divulgar no WhatsApp")}
              </a>
            </div>
            <div className="mt-auto space-y-1 border-t border-[#e5e0d7] p-3">
              {user.isSuperAdmin && (
                <Link href="/super-admin">
                  {drawerItem(false, Settings2, "Super Admin")}
                </Link>
              )}
              <Link href={`/${slug}`}>
                {drawerItem(false, LogOut, "Voltar ao cardápio")}
              </Link>
              {drawerItem(false, DoorOpen, "Sair da conta", () => void signOut())}
              {user.email && (
                <p className="truncate px-3 pt-1 text-xs text-[#9a9185]">{user.email}</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
        <main className="max-w-[1600px] p-4 lg:p-9">
          <div className="mb-5 lg:mb-6">
            <h2 className="hidden font-display text-3xl font-bold tracking-tight lg:block">
              {heading.title}
            </h2>
            <p className="text-sm text-[#776e63] lg:mt-1 lg:text-base">{heading.subtitle}</p>
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
