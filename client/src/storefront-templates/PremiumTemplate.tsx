import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight, ChevronDown, ClipboardList, Home as HomeIcon, Menu as MenuIcon, Minus, Moon, Plus,
  Search, ShieldCheck, ShoppingBag, Star, Sun, UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StorefrontCartCheckout } from "@/components/StorefrontCartCheckout";
import { useTheme } from "@/contexts/ThemeContext";
import type { Storefront } from "@/lib/useStorefront";

const SURFACE = "bg-white dark:bg-[#211a13]";
const BORDER = "border-[#e9e3d9] dark:border-white/10";
const TEXT_MUTED = "text-[#776e63] dark:text-[#b3a793]";

/**
 * A dark-first, restaurant-bistro experience: hero photo, sidebar categories,
 * an always-visible cart panel on larger screens, and a light/dark toggle.
 */
export function PremiumTemplate(s: Storefront) {
  const company = s.company!;
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const brand = company.primaryColor || "#c9a15a";

  const searchedMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return s.visibleMenu;
    return s.visibleMenu.filter((item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
  }, [s.visibleMenu, search]);

  return <div id="top" className="min-h-screen bg-[#faf7f2] text-[#29251f] dark:bg-[#161009] dark:text-[#f2e9dc]">
    {/* Header */}
    <header className={`sticky top-0 z-30 border-b ${BORDER} bg-[#faf7f2]/90 backdrop-blur-xl dark:bg-[#161009]/90`}>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 lg:px-8">
        <button onClick={() => setMobileCategoriesOpen(true)} className={`rounded-full p-2 ${TEXT_MUTED} hover:bg-black/5 dark:hover:bg-white/5 lg:hidden`} aria-label="Abrir categorias"><MenuIcon className="h-5 w-5" /></button>
        <div className="flex items-center gap-2.5">
          {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-8 w-8 rounded-full object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: brand }}><UtensilsCrossed className="h-4 w-4" /></div>}
          <p className="font-display text-lg font-bold tracking-tight">{company.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={`rounded-full p-2.5 ${TEXT_MUTED} ring-1 ring-inset ${BORDER} hover:bg-black/5 dark:hover:bg-white/5`} aria-label="Alternar tema claro/escuro">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href={`/${s.slug}/admin`}><Button variant="ghost" size="sm" className={`hidden ${TEXT_MUTED} sm:flex`}>Área da cozinha</Button></Link>
          <Button size="sm" onClick={() => s.setCartOpen(true)} className="rounded-full px-4 text-white lg:hidden" style={{ backgroundColor: brand }}>
            <ShoppingBag className="mr-2 h-4 w-4" /> {s.totalItems > 0 ? `R$ ${s.total.toFixed(2).replace(".", ",")}` : "Carrinho"}
          </Button>
        </div>
      </div>
    </header>

    {/* Hero */}
    <section className="relative flex min-h-[78vh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center text-white sm:min-h-[85vh]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: company.heroImageUrl ? `url(${company.heroImageUrl})` : `radial-gradient(circle at 50% 30%, ${brand}22, #100b07 70%)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-[#161009]" />
      <div className="relative z-10 flex max-w-xl flex-col items-center">
        {company.logoUrl
          ? <img src={company.logoUrl} alt={company.name} className="h-20 w-20 rounded-full border-2 object-cover shadow-2xl" style={{ borderColor: `${brand}88` }} />
          : <div className="flex h-20 w-20 items-center justify-center rounded-full border-2" style={{ borderColor: `${brand}88` }}><UtensilsCrossed className="h-8 w-8" /></div>}
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">{company.name}</h1>
        <div className="mt-3 h-px w-16" style={{ backgroundColor: brand }} />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: brand }}>{company.tagline || "culinária autoral"}</p>
        <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-white/75">Ingredientes selecionados, preparo cuidadoso e uma experiência que vale a espera.</p>
        <a href="#cardapio">
          <Button size="lg" className="mt-8 h-12 rounded-full px-8 font-semibold text-[#211a13] shadow-lg" style={{ backgroundColor: brand }}>
            Ver cardápio <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </a>
        <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 text-xs text-white/70">
          <span>Ingredientes frescos</span>
          <span>Preparo artesanal</span>
          <span>Entrega rápida</span>
        </div>
      </div>
      <a href="#cardapio" className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/60"><ChevronDown className="h-6 w-6 animate-bounce" /></a>
    </section>

    {/* Menu */}
    <section id="cardapio" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-10 lg:px-8">
      <div className="relative mb-6">
        <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${TEXT_MUTED}`} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no cardápio..."
          className={`w-full rounded-xl border ${BORDER} ${SURFACE} py-3 pl-11 pr-4 text-sm outline-none focus:ring-2`}
          style={{ ["--tw-ring-color" as string]: `${brand}55` }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr_320px] lg:items-start">
        {/* Sidebar categories (desktop) */}
        <nav className="hidden lg:block">
          <div className={`sticky top-[92px] space-y-1 rounded-2xl border ${BORDER} ${SURFACE} p-2`}>
            {s.categories.map((category) => (
              <button
                key={category}
                onClick={() => s.setActiveCategory(category)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition"
                style={s.activeCategory === category ? { backgroundColor: `${brand}22`, color: brand } : undefined}
              >
                {category === "Todos" ? <Star className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                {category}
              </button>
            ))}
          </div>
        </nav>

        {/* Items */}
        <div>
          {s.menuQuery.isLoading && <p role="status" className={`mb-4 text-sm ${TEXT_MUTED}`}>Atualizando o cardápio...</p>}
          {s.menuQuery.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fff0d7] px-4 py-3 text-sm text-[#8a4e2b]">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}
          {searchedMenu.length === 0 && !s.menuQuery.isLoading && <p className={`rounded-xl border ${BORDER} ${SURFACE} px-4 py-6 text-center text-sm ${TEXT_MUTED}`}>Nenhum item encontrado.</p>}
          <div className="space-y-3">
            {searchedMenu.map((item) => (
              <div key={item.id} className={`flex items-center gap-4 rounded-2xl border ${BORDER} ${SURFACE} p-3`}>
                <img src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.tag === "Destaque" && <Badge className="border-0 text-[10px] font-bold uppercase text-[#211a13]" style={{ backgroundColor: brand }}>Mais pedido</Badge>}
                    <h3 className="font-display text-base font-bold">{item.name}</h3>
                  </div>
                  <p className={`mt-1 line-clamp-2 text-sm leading-6 ${TEXT_MUTED}`}>{item.description}</p>
                  <p className="mt-1.5 font-display text-base font-bold" style={{ color: brand }}>R$ {item.price.toFixed(2).replace(".", ",")}</p>
                </div>
                <button onClick={() => s.add(item.id)} aria-label={`Adicionar ${item.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow" style={{ backgroundColor: brand }}><Plus className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Persistent cart (desktop) */}
        <aside className="hidden lg:block">
          <div className={`sticky top-[92px] rounded-2xl border ${BORDER} ${SURFACE} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Meu carrinho</h2>
              <span className={`text-xs ${TEXT_MUTED}`}>{s.totalItems} {s.totalItems === 1 ? "item" : "itens"}</span>
            </div>
            {s.cartDetails.length === 0 ? (
              <p className={`mt-6 text-center text-sm ${TEXT_MUTED}`}>Seu carrinho está vazio.</p>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {s.cartDetails.map(({ item, qty }) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <img src={item.image} className="h-11 w-11 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className={`text-xs ${TEXT_MUTED}`}>R$ {item.price.toFixed(2).replace(".", ",")}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full border ${BORDER} px-1.5 py-1`}>
                        <button onClick={() => s.changeQty(item.id, -1)} aria-label="Diminuir"><Minus className="h-3 w-3" /></button>
                        <span className="w-3 text-center text-xs font-semibold">{qty}</span>
                        <button onClick={() => s.add(item.id)} aria-label="Aumentar"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => s.setCartOpen(true)} className="mt-4 text-xs font-semibold underline" style={{ color: brand }}>Adicionar observação por item</button>
                <div className={`mt-4 space-y-2 border-t ${BORDER} pt-4 text-sm`}>
                  <div className={`flex justify-between ${TEXT_MUTED}`}><span>Subtotal</span><span>R$ {s.subtotal.toFixed(2).replace(".", ",")}</span></div>
                  <div className={`flex justify-between ${TEXT_MUTED}`}><span>Entrega</span><span>R$ {s.delivery.toFixed(2).replace(".", ",")}</span></div>
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span style={{ color: brand }}>R$ {s.total.toFixed(2).replace(".", ",")}</span></div>
                </div>
                <Button onClick={() => s.setCheckoutOpen(true)} className="mt-4 h-11 w-full rounded-xl font-semibold text-[#211a13]" style={{ backgroundColor: brand }}>Finalizar pedido <ArrowRight className="ml-2 h-4 w-4" /></Button>
                <p className={`mt-3 flex items-center justify-center gap-1.5 text-[11px] ${TEXT_MUTED}`}><ShieldCheck className="h-3.5 w-3.5" /> Ambiente seguro</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>

    <footer className={`border-t ${BORDER} px-5 py-8 text-center text-sm ${TEXT_MUTED} lg:px-8`}><p>{company.name} © 2026</p></footer>

    {/* Mobile category sheet */}
    <Sheet open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
      <SheetContent side="left" className={`w-72 ${SURFACE}`}>
        <SheetHeader><SheetTitle className="font-display">Categorias</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-1">
          {s.categories.map((category) => (
            <button
              key={category}
              onClick={() => { s.setActiveCategory(category); setMobileCategoriesOpen(false); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium"
              style={s.activeCategory === category ? { backgroundColor: `${brand}22`, color: brand } : undefined}
            >
              {category === "Todos" ? <Star className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
              {category}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>

    {/* Mobile "Meus pedidos" sheet */}
    <Sheet open={ordersOpen} onOpenChange={setOrdersOpen}>
      <SheetContent className={SURFACE}>
        <SheetHeader><SheetTitle className="font-display">Meus pedidos</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-2">
          {s.orderHistory.length === 0 && <p className={`text-sm ${TEXT_MUTED}`}>Você ainda não fez pedidos neste aparelho.</p>}
          {s.orderHistory.map((saved, index) => (
            <button key={`${saved.createdAt}-${index}`} onClick={() => { s.repeatSavedOrder(saved); setOrdersOpen(false); }} className={`flex w-full items-center justify-between rounded-xl border ${BORDER} px-4 py-3 text-left text-sm`}>
              <span>Pedido de {new Date(saved.createdAt).toLocaleDateString("pt-BR")}</span>
              <span className="font-semibold" style={{ color: brand }}>Repetir</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>

    {/* Mobile bottom tab bar */}
    <nav className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t ${BORDER} bg-[#faf7f2]/95 py-2 backdrop-blur-xl dark:bg-[#161009]/95 lg:hidden`}>
      <a href="#top" className={`flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] ${TEXT_MUTED}`}><HomeIcon className="h-5 w-5" /> Início</a>
      <button onClick={() => setMobileCategoriesOpen(true)} className={`flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] ${TEXT_MUTED}`}><UtensilsCrossed className="h-5 w-5" /> Cardápio</button>
      <button onClick={() => setOrdersOpen(true)} className={`flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] ${TEXT_MUTED}`}><ClipboardList className="h-5 w-5" /> Pedidos</button>
      <button onClick={() => s.setCartOpen(true)} className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px]" style={{ color: brand }}>
        <span className="relative"><ShoppingBag className="h-5 w-5" />{s.totalItems > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: brand }}>{s.totalItems}</span>}</span>
        Carrinho
      </button>
    </nav>
    <div className="h-16 lg:hidden" />

    <StorefrontCartCheckout {...s} />
  </div>;
}
