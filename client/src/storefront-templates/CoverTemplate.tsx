import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Minus, Plus, Receipt, ShieldCheck, ShoppingBag, Star, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorefrontCartCheckout } from "@/components/StorefrontCartCheckout";
import { CustomerSummary } from "@/components/CustomerSummary";
import { DEFAULT_HERO_IMAGE, type Storefront } from "@/lib/useStorefront";

/**
 * Cores do modelo Capa. O dono escolhe em Aparência entre o fundo escuro
 * (restaurante à noite) e o claro. Tudo abaixo usa estas variáveis.
 */
const THEMES = {
  dark: {
    "--cv-page": "#161009",
    "--cv-page-soft": "rgba(22,16,9,.82)",
    "--cv-bar": "rgba(22,16,9,.92)",
    "--cv-cover": "#1c150e",
    "--cv-panel": "rgba(20,16,11,.9)",
    "--cv-card": "rgba(255,255,255,.04)",
    "--cv-title": "#f6ecd9",
    "--cv-text": "#f2e9dc",
    "--cv-muted": "#b3a793",
    "--cv-faint": "#8a7f6f",
    "--cv-line": "rgba(255,255,255,.1)",
    "--cv-overlay": "linear-gradient(rgba(10,7,4,.5), rgba(10,7,4,.72))",
    "--cv-stage": "radial-gradient(circle at 50% 18%, rgba(0,0,0,.25), rgba(0,0,0,.7))",
  },
  light: {
    "--cv-page": "#f7f2ea",
    "--cv-page-soft": "rgba(250,246,239,.9)",
    "--cv-bar": "rgba(250,246,239,.94)",
    "--cv-cover": "#fffaf2",
    "--cv-panel": "rgba(255,253,249,.94)",
    "--cv-card": "rgba(255,255,255,.85)",
    "--cv-title": "#2a2118",
    "--cv-text": "#2a2118",
    "--cv-muted": "#6e6253",
    "--cv-faint": "#9a8c7a",
    "--cv-line": "rgba(42,33,24,.12)",
    "--cv-overlay": "linear-gradient(rgba(250,246,239,.78), rgba(250,246,239,.9))",
    "--cv-stage": "radial-gradient(circle at 50% 18%, rgba(255,250,242,.35), rgba(60,45,30,.45))",
  },
} as const;

const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

/**
 * A restaurant-menu-book experience: a chic cover that opens like a real
 * menu, revealing the menu underneath. On phones/tablets that's a single
 * list in the shape people know from delivery apps. On wide screens there's
 * room to lay the whole thing out at once — three panels side by side.
 */
export function CoverTemplate(s: Storefront) {
  const company = s.company!;
  const [opening, setOpening] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [dismissed]);

  const brand = company.primaryColor || "#c9a15a";
  const backdrop = company.heroImageUrl || DEFAULT_HERO_IMAGE;
  const mode = (company as { storefrontTheme?: string | null }).storefrontTheme === "light" ? "light" : "dark";
  const themeVars = THEMES[mode] as unknown as CSSProperties;

  return <div data-cover-theme={mode} className="isolate min-h-screen overflow-x-hidden bg-[var(--cv-page)] text-[var(--cv-text)]" style={themeVars}>
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10"
      style={{ backgroundImage: `var(--cv-overlay), url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center" }}
    />
    {!dismissed && (
      <div
        className={`menu-cover-stage ${opening ? "is-dismissing" : ""}`}
        style={{ pointerEvents: opening ? "none" : "auto", background: "var(--cv-stage)" }}
        onTransitionEnd={(event) => { if (event.propertyName === "opacity" && event.target === event.currentTarget) setDismissed(true); }}
      >
        <div className={`menu-cover flex flex-col justify-between bg-[var(--cv-cover)] p-8 text-center sm:p-10 ${opening ? "is-opening" : ""}`}>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: brand }}>Cardápio</span>
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <Logo company={company} brand={brand} size="h-24 w-24" icon="h-9 w-9" />
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight text-[var(--cv-title)] sm:text-3xl">{company.name}</h1>
              <div className="mx-auto mt-3 h-px w-12" style={{ backgroundColor: brand }} />
              {company.tagline && <p className="mx-auto mt-3 max-w-[22ch] text-xs uppercase tracking-[0.15em] text-[var(--cv-muted)] sm:text-sm">{company.tagline}</p>}
            </div>
          </div>
          <button
            onClick={() => setOpening(true)}
            className="cover-cta mb-2 flex items-center gap-2 self-center rounded-full px-6 py-3 text-xs font-bold uppercase tracking-wide text-[#211a13] sm:text-sm"
            style={{ backgroundColor: brand }}
          >
            Ver cardápio <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}

    <div className={`menu-reveal ${opening ? "" : "is-hidden"}`}>
      {/* Celulares, tablets e notebooks estreitos: uma lista só. */}
      <MobileMenu s={s} brand={brand} />

      {/* Telas largas: o cardápio aberto de uma vez — três painéis lado a lado. */}
      <div className="relative hidden min-h-screen xl:block">
        <div className="mx-auto grid h-screen max-w-[1360px] grid-cols-3 items-center gap-6 px-8 py-8">
          <CoverPanel company={company} brand={brand} />
          <MenuPanel s={s} brand={brand} />
          <CartPanel s={s} brand={brand} />
        </div>
      </div>
    </div>

    <StorefrontCartCheckout {...s} />
  </div>;
}

function Logo({ company, brand, size, icon }: { company: NonNullable<Storefront["company"]>; brand: string; size: string; icon: string }) {
  return company.logoUrl
    ? <img src={company.logoUrl} alt={company.name} className={`${size} shrink-0 rounded-full border object-cover shadow-2xl`} style={{ borderColor: `${brand}55` }} />
    : <div className={`${size} flex shrink-0 items-center justify-center rounded-full border`} style={{ borderColor: `${brand}55`, color: brand }}><UtensilsCrossed className={icon} /></div>;
}

/** Lista do celular no formato dos apps de entrega: abas de categoria e foto à direita. */
function MobileMenu({ s, brand }: { s: Storefront; brand: string }) {
  const company = s.company!;
  const categories = s.categories.filter((c) => c !== "Todos");
  const [active, setActive] = useState(categories[0] ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);

  // Marca a categoria visível enquanto a pessoa rola a lista.
  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(sectionId(category)))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.getAttribute("data-category") ?? "");
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join("|")]);

  useEffect(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    tab?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const jumpTo = (category: string) => {
    const el = document.getElementById(sectionId(category));
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: "smooth" });
  };

  return (
    <div className="bg-[var(--cv-page-soft)] backdrop-blur-sm xl:hidden">
      <header className="sticky top-0 z-30 border-b border-[var(--cv-line)] bg-[var(--cv-bar)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Logo company={company} brand={brand} size="h-9 w-9" icon="h-4 w-4" />
          <p className="min-w-0 flex-1 truncate font-display text-lg font-bold text-[var(--cv-title)]">{company.name}</p>
          <a
            href={`/${s.slug}/pedidos`}
            aria-label="Meus pedidos"
            title="Meus pedidos"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--cv-line)] text-[var(--cv-muted)]"
          >
            <Receipt className="h-[18px] w-[18px]" />
          </a>
          <button
            onClick={() => s.setCartOpen(true)}
            aria-label={`Ver pedido${s.totalItems ? `, ${s.totalItems} ${s.totalItems === 1 ? "item" : "itens"}` : ""}`}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#211a13]"
            style={{ backgroundColor: brand }}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {s.totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--cv-title)] px-1 text-[10px] font-bold text-[var(--cv-page)]">
                {s.totalItems}
              </span>
            )}
          </button>
        </div>
        {categories.length > 1 && (
          <div ref={tabsRef} className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => {
              const on = active === category;
              return (
                <button
                  key={category}
                  data-tab={category}
                  onClick={() => jumpTo(category)}
                  className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
                  style={on ? { backgroundColor: brand, borderColor: brand, color: "#211a13" } : { borderColor: "var(--cv-line)", color: "var(--cv-muted)" }}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-5">
        {company.tagline && <p className="mb-4 text-center text-xs uppercase tracking-[0.15em] text-[var(--cv-muted)]">{company.tagline}</p>}
        {s.menuQuery.isLoading && <p role="status" className="mb-4 text-center text-sm text-[var(--cv-muted)]">Atualizando o cardápio...</p>}
        {s.menuQuery.isError && <p role="alert" className="mb-4 rounded-xl bg-[var(--cv-card)] px-4 py-3 text-center text-sm text-[#c98a3a]">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}
        {s.menu.length === 0 && !s.menuQuery.isLoading && <p className="mb-4 rounded-xl bg-[var(--cv-card)] px-4 py-5 text-center text-sm text-[var(--cv-muted)]">Nenhum item está disponível neste momento.</p>}

        {categories.map((category) => (
          <section key={category} id={sectionId(category)} data-category={category} className="mb-7 scroll-mt-28">
            <h2 className="flex items-center gap-3 font-display text-xl font-bold text-[var(--cv-title)]">
              {category}
              <span className="h-px flex-1" style={{ backgroundColor: `${brand}55` }} />
            </h2>
            <div className="mt-3 space-y-3">
              {s.menu.filter((item) => item.category === category).map((item) => {
                const qty = s.cart.find((line) => line.id === item.id)?.qty ?? 0;
                return (
                  <article key={item.id} className="flex gap-3 rounded-2xl border border-[var(--cv-line)] bg-[var(--cv-card)] p-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="font-display text-base font-bold leading-snug text-[var(--cv-title)]">{item.name}</h3>
                      {item.description && <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--cv-muted)]">{item.description}</p>}
                      <p className="mt-auto pt-2 text-base font-bold" style={{ color: brand }}>{money(item.price)}</p>
                    </div>
                    <div className="relative h-24 w-24 shrink-0">
                      <img src={item.image} alt={item.name} loading="lazy" className="h-24 w-24 rounded-xl object-cover" />
                      <button
                        onClick={() => s.add(item.id)}
                        aria-label={`Adicionar ${item.name}`}
                        className="absolute -bottom-2 -right-2 flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-sm font-bold text-[#211a13] shadow-lg ring-2 ring-[var(--cv-page)]"
                        style={{ backgroundColor: brand }}
                      >
                        {qty > 0 ? qty : <Plus className="h-5 w-5" />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <footer className="border-t border-[var(--cv-line)] px-5 py-8 text-center text-sm text-[var(--cv-faint)]"><p>{company.name} © {new Date().getFullYear()}</p></footer>
    </div>
  );
}

const sectionId = (category: string) => `cat-${category.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;

const PANEL = "flex h-[min(82vh,760px)] min-w-0 flex-col overflow-hidden rounded-[2rem] bg-[var(--cv-panel)] shadow-2xl ring-1 ring-[var(--cv-line)] backdrop-blur-md";

function CoverPanel({ company, brand }: { company: NonNullable<Storefront["company"]>; brand: string }) {
  return (
    <div className={PANEL}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        {company.logoUrl
          ? <img src={company.logoUrl} alt={company.name} className="h-56 w-56 rounded-full border object-cover shadow-2xl" style={{ borderColor: `${brand}55` }} />
          : <div className="flex h-56 w-56 items-center justify-center rounded-full border font-display text-8xl font-bold" style={{ borderColor: `${brand}55`, color: brand }}>{company.name.trim().charAt(0).toUpperCase()}</div>}
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight text-[var(--cv-title)]">{company.name}</h1>
          <div className="mx-auto mt-3 h-px w-10" style={{ backgroundColor: brand }} />
          {company.tagline && <p className="mx-auto mt-3 max-w-[24ch] text-xs uppercase tracking-[0.15em] text-[var(--cv-muted)]">{company.tagline}</p>}
        </div>
      </div>
    </div>
  );
}

function MenuPanel({ s, brand }: { s: Storefront; brand: string }) {
  return (
    <div className={PANEL}>
      <div className="shrink-0 px-6 pt-6 text-center">
        <p className="font-display text-lg font-bold text-[var(--cv-title)]">Cardápio</p>
        <div className="mx-auto mt-2 h-px w-8" style={{ backgroundColor: `${brand}88` }} />
      </div>
      <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-2 px-6 pb-4">
        {s.categories.map((category) => {
          const active = s.activeCategory === category;
          return (
            <button
              key={category}
              onClick={() => s.setActiveCategory(category)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition"
              style={active ? { backgroundColor: `${brand}22`, borderColor: `${brand}88`, color: brand } : { borderColor: "var(--cv-line)", color: "var(--cv-faint)" }}
            >
              {category === "Todos" ? <Star className="h-3 w-3" /> : <UtensilsCrossed className="h-3 w-3" />} {category}
            </button>
          );
        })}
      </div>
      <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-6 pb-6">
        {s.menuQuery.isLoading && <p role="status" className="text-center text-xs text-[var(--cv-muted)]">Atualizando...</p>}
        {s.visibleMenu.length === 0 && !s.menuQuery.isLoading && <p className="text-center text-xs text-[var(--cv-muted)]">Nenhum item encontrado.</p>}
        {s.visibleMenu.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[var(--cv-card)] p-3 ring-1 ring-[var(--cv-line)]">
            <img src={item.image} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-[var(--cv-title)]">{item.name}</p>
              <p className="line-clamp-1 text-xs text-[var(--cv-faint)]">{item.description}</p>
              <p className="mt-0.5 text-sm font-bold" style={{ color: brand }}>{money(item.price)}</p>
            </div>
            <button onClick={() => s.add(item.id)} aria-label={`Adicionar ${item.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#211a13]" style={{ backgroundColor: brand }}><Plus className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartPanel({ s, brand }: { s: Storefront; brand: string }) {
  return (
    <div className={`${PANEL} p-6`}>
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="font-display text-lg font-bold text-[var(--cv-title)]">Meu carrinho</h2>
        <span className="relative"><ShoppingBag className="h-5 w-5 text-[var(--cv-faint)]" />{s.totalItems > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-[#211a13]" style={{ backgroundColor: brand }}>{s.totalItems}</span>}</span>
      </div>

      {s.cartDetails.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--cv-faint)]">Seu carrinho está vazio.</p>
      ) : (
        <>
          <div className="thin-scroll mt-4 flex-1 space-y-3 overflow-y-auto">
            {s.cartDetails.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center gap-3">
                <img src={item.image} alt={item.name} className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--cv-title)]">{item.name}</p>
                  <p className="text-xs text-[var(--cv-faint)]">{money(item.price)}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--cv-line)] px-1.5 py-1">
                  <button onClick={() => s.changeQty(item.id, -1)} aria-label="Diminuir" className="text-[var(--cv-muted)]"><Minus className="h-3 w-3" /></button>
                  <span className="w-3 text-center text-xs font-semibold text-[var(--cv-title)]">{qty}</span>
                  <button onClick={() => s.add(item.id)} aria-label="Aumentar" className="text-[var(--cv-muted)]"><Plus className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <CustomerSummary
            s={s}
            accent={brand}
            className="mt-4 shrink-0 border-[var(--cv-line)] text-[var(--cv-title)]"
            mutedClassName="text-[var(--cv-faint)]"
          />
          <div className="mt-4 shrink-0 space-y-2 border-t border-[var(--cv-line)] pt-4 text-sm">
            <div className="flex justify-between text-[var(--cv-muted)]"><span>Subtotal</span><span>{money(s.subtotal)}</span></div>
            <div className="flex justify-between text-[var(--cv-muted)]"><span>Entrega</span><span>{money(s.delivery)}</span></div>
            {s.serviceFee > 0 && <div className="flex justify-between text-[var(--cv-muted)]"><span>Taxa de serviço</span><span>{money(s.serviceFee)}</span></div>}
            <div className="flex justify-between text-base font-bold text-[var(--cv-title)]"><span>Total</span><span style={{ color: brand }}>{money(s.total)}</span></div>
          </div>
          <Button onClick={() => s.setCartOpen(true)} className="mt-4 h-11 w-full shrink-0 rounded-xl font-semibold text-[#211a13] hover:opacity-90" style={{ backgroundColor: brand }}>Finalizar pedido <ArrowRight className="ml-2 h-4 w-4" /></Button>
          <p className="mt-3 flex shrink-0 items-center justify-center gap-1.5 text-[11px] text-[var(--cv-faint)]"><ShieldCheck className="h-3.5 w-3.5" /> Ambiente seguro</p>
          <div className="mt-3 flex shrink-0 items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--cv-faint)]">
            <span className="rounded border border-[var(--cv-line)] px-1.5 py-0.5">Pix</span>
            <span className="rounded border border-[var(--cv-line)] px-1.5 py-0.5">Crédito</span>
            <span className="rounded border border-[var(--cv-line)] px-1.5 py-0.5">Débito</span>
          </div>
        </>
      )}
    </div>
  );
}
