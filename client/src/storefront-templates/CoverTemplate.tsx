import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Star, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorefrontCartCheckout } from "@/components/StorefrontCartCheckout";
import { DEFAULT_HERO_IMAGE, type Storefront } from "@/lib/useStorefront";

/**
 * A restaurant-menu-book experience: a chic cover that opens like a real
 * menu, first — on every screen size, since that first-impression ceremony
 * is the point — revealing the menu underneath. On phones/tablets that's a
 * single elegant list (screen space forces a sequential flow). On wide
 * screens there's room to lay the whole thing out at once — three equal
 * panels (cover, menu, cart) side by side, like a trifold menu spread open
 * flat on the table.
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
  const heroPhoto = company.heroImageUrl || s.menu[0]?.image || DEFAULT_HERO_IMAGE;

  return <div className="min-h-screen overflow-x-hidden bg-[#161009] text-[#f2e9dc]">
    {!dismissed && (
      <div
        className={`menu-cover-stage ${opening ? "is-dismissing" : ""}`}
        style={{ pointerEvents: opening ? "none" : "auto" }}
        onTransitionEnd={(event) => { if (event.propertyName === "opacity" && event.target === event.currentTarget) setDismissed(true); }}
      >
        <div className={`menu-cover flex flex-col justify-between bg-[#1c150e] p-8 text-center sm:p-10 ${opening ? "is-opening" : ""}`}>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: brand }}>Cardápio</span>
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            {company.logoUrl
              ? <img src={company.logoUrl} alt={company.name} className="h-24 w-24 rounded-full border object-cover shadow-2xl" style={{ borderColor: `${brand}55` }} />
              : <div className="flex h-24 w-24 items-center justify-center rounded-full border" style={{ borderColor: `${brand}55`, color: brand }}><UtensilsCrossed className="h-9 w-9" /></div>}
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight text-[#f6ecd9] sm:text-3xl">{company.name}</h1>
              <div className="mx-auto mt-3 h-px w-12" style={{ backgroundColor: brand }} />
              {company.tagline && <p className="mx-auto mt-3 max-w-[22ch] text-xs uppercase tracking-[0.15em] text-[#b3a793] sm:text-sm">{company.tagline}</p>}
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
      {/* Phones, tablets & narrower laptops: a single scrolling list. */}
      <div className="xl:hidden">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#161009]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between px-5">
            <div className="flex items-center gap-3">
              {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#211a13]" style={{ backgroundColor: brand }}><UtensilsCrossed className="h-4 w-4" /></div>}
              <p className="font-display text-lg font-bold text-[#f6ecd9]">{company.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/${s.slug}/admin`}><Button variant="ghost" size="sm" className="hidden text-[#b3a793] hover:bg-white/5 hover:text-[#f6ecd9] sm:flex">Área da cozinha</Button></Link>
              <Button size="sm" onClick={() => s.setCartOpen(true)} className="rounded-full px-4 text-[#211a13] hover:opacity-90" style={{ backgroundColor: brand }}><ShoppingBag className="mr-2 h-4 w-4" /> {s.totalItems > 0 ? `${s.totalItems} itens` : "Pedido"}</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-12">
          {s.menuQuery.isLoading && <p role="status" className="mb-4 text-center text-sm text-[#b3a793]">Atualizando o cardápio...</p>}
          {s.menuQuery.isError && <p role="alert" className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-[#e4b16a]">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}
          {s.menu.length === 0 && !s.menuQuery.isLoading && <p className="mb-4 rounded-xl bg-white/5 px-4 py-5 text-center text-sm text-[#b3a793]">Nenhum item está disponível neste momento.</p>}

          {s.categories.filter((c) => c !== "Todos").map((category) => (
            <section key={category} className="mb-10">
              <h2 className="text-center font-display text-lg font-bold text-[#f6ecd9]">{category}</h2>
              <div className="mx-auto mt-2 h-px w-8" style={{ backgroundColor: `${brand}88` }} />
              <div className="mt-6 divide-y divide-white/10">
                {s.menu.filter((item) => item.category === category).map((item) => (
                  <div key={item.id} className="flex items-start gap-5 py-5">
                    <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-full border border-white/10 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <h3 className="shrink-0 font-display text-base font-bold text-[#f6ecd9]">{item.name}</h3>
                        <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,currentColor_0,currentColor_2px,transparent_2px,transparent_6px)] text-white/15" />
                        <span className="shrink-0 font-display text-base font-bold" style={{ color: brand }}>R$ {item.price.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-[#b3a793]">{item.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-[#8a7f6f]">{item.tag}</span>
                        <button onClick={() => s.add(item.id)} aria-label={`Adicionar ${item.name}`} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border transition hover:bg-white/5" style={{ borderColor: `${brand}66`, color: brand }}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
        <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-[#8a7f6f]"><p>{company.name} © 2026</p></footer>
      </div>

      {/* Wide screens: the whole menu laid open at once — three equal panels, like a trifold spread flat on the table. */}
      <div className="relative hidden min-h-screen xl:block">
        <div
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: `linear-gradient(rgba(10,7,4,.72), rgba(10,7,4,.85)), url(${heroPhoto})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <Link href={`/${s.slug}/admin`}><span className="absolute right-6 top-5 z-10 text-xs font-medium text-white/60 hover:text-white/90">Área da cozinha</span></Link>
        <div className="mx-auto grid h-screen max-w-[1360px] grid-cols-3 items-center gap-6 px-8 py-8">
          <CoverPanel company={company} brand={brand} heroPhoto={heroPhoto} />
          <MenuPanel s={s} brand={brand} />
          <CartPanel s={s} brand={brand} />
        </div>
      </div>
    </div>

    <StorefrontCartCheckout {...s} />
  </div>;
}

const PANEL = "flex h-[min(82vh,760px)] min-w-0 flex-col overflow-hidden rounded-[2rem] bg-[#14100b] shadow-2xl ring-1 ring-white/10";

function CoverPanel({ company, brand, heroPhoto }: { company: NonNullable<Storefront["company"]>; brand: string; heroPhoto: string }) {
  return (
    <div className={PANEL}>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        {company.logoUrl
          ? <img src={company.logoUrl} alt={company.name} className="h-16 w-16 rounded-full border object-cover" style={{ borderColor: `${brand}55` }} />
          : <div className="flex h-16 w-16 items-center justify-center rounded-full border" style={{ borderColor: `${brand}55`, color: brand }}><UtensilsCrossed className="h-6 w-6" /></div>}
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-[#f6ecd9]">{company.name}</h1>
          <div className="mx-auto mt-3 h-px w-10" style={{ backgroundColor: brand }} />
          {company.tagline && <p className="mx-auto mt-3 max-w-[24ch] text-xs uppercase tracking-[0.15em] text-[#b3a793]">{company.tagline}</p>}
        </div>
      </div>
      <div className="h-52 shrink-0">
        <img src={heroPhoto} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="p-6">
        <div className="flex items-center justify-center gap-2 rounded-full py-3 text-xs font-bold uppercase tracking-wide text-[#211a13]" style={{ backgroundColor: brand }}>
          Cardápio ao lado <ArrowRight className="h-4 w-4" />
        </div>
        {company.pickupAddress && <p className="mt-3 text-center text-[11px] text-[#8a7f6f]">Retirada em {company.pickupAddress}</p>}
      </div>
    </div>
  );
}

function MenuPanel({ s, brand }: { s: Storefront; brand: string }) {
  return (
    <div className={PANEL}>
      <div className="shrink-0 px-6 pt-6 text-center">
        <p className="font-display text-lg font-bold text-[#f6ecd9]">Cardápio</p>
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
              style={active ? { backgroundColor: `${brand}22`, borderColor: `${brand}88`, color: brand } : { borderColor: "rgba(255,255,255,.12)", color: "#8a7f6f" }}
            >
              {category === "Todos" ? <Star className="h-3 w-3" /> : <UtensilsCrossed className="h-3 w-3" />} {category}
            </button>
          );
        })}
      </div>
      <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-6 pb-6">
        {s.menuQuery.isLoading && <p role="status" className="text-center text-xs text-[#b3a793]">Atualizando...</p>}
        {s.visibleMenu.length === 0 && !s.menuQuery.isLoading && <p className="text-center text-xs text-[#b3a793]">Nenhum item encontrado.</p>}
        {s.visibleMenu.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/5">
            <img src={item.image} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-[#f6ecd9]">{item.name}</p>
              <p className="line-clamp-1 text-xs text-[#8a7f6f]">{item.description}</p>
              <p className="mt-0.5 text-sm font-bold" style={{ color: brand }}>R$ {item.price.toFixed(2).replace(".", ",")}</p>
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
        <h2 className="font-display text-lg font-bold text-[#f6ecd9]">Meu carrinho</h2>
        <span className="relative"><ShoppingBag className="h-5 w-5 text-[#8a7f6f]" />{s.totalItems > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-[#211a13]" style={{ backgroundColor: brand }}>{s.totalItems}</span>}</span>
      </div>

      {s.cartDetails.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#8a7f6f]">Seu carrinho está vazio.</p>
      ) : (
        <>
          <div className="thin-scroll mt-4 flex-1 space-y-3 overflow-y-auto">
            {s.cartDetails.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center gap-3">
                <img src={item.image} alt={item.name} className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#f6ecd9]">{item.name}</p>
                  <p className="text-xs text-[#8a7f6f]">R$ {item.price.toFixed(2).replace(".", ",")}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-1.5 py-1">
                  <button onClick={() => s.changeQty(item.id, -1)} aria-label="Diminuir" className="text-[#b3a793]"><Minus className="h-3 w-3" /></button>
                  <span className="w-3 text-center text-xs font-semibold text-[#f6ecd9]">{qty}</span>
                  <button onClick={() => s.add(item.id)} aria-label="Aumentar" className="text-[#b3a793]"><Plus className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 shrink-0 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-[#b3a793]"><span>Subtotal</span><span>R$ {s.subtotal.toFixed(2).replace(".", ",")}</span></div>
            <div className="flex justify-between text-[#b3a793]"><span>Entrega</span><span>R$ {s.delivery.toFixed(2).replace(".", ",")}</span></div>
            <div className="flex justify-between text-base font-bold text-[#f6ecd9]"><span>Total</span><span style={{ color: brand }}>R$ {s.total.toFixed(2).replace(".", ",")}</span></div>
          </div>
          <Button onClick={() => s.setCheckoutOpen(true)} className="mt-4 h-11 w-full shrink-0 rounded-xl font-semibold text-[#211a13] hover:opacity-90" style={{ backgroundColor: brand }}>Finalizar pedido <ArrowRight className="ml-2 h-4 w-4" /></Button>
          <p className="mt-3 flex shrink-0 items-center justify-center gap-1.5 text-[11px] text-[#8a7f6f]"><ShieldCheck className="h-3.5 w-3.5" /> Ambiente seguro</p>
          <div className="mt-3 flex shrink-0 items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a7f6f]">
            <span className="rounded border border-white/10 px-1.5 py-0.5">Pix</span>
            <span className="rounded border border-white/10 px-1.5 py-0.5">Crédito</span>
            <span className="rounded border border-white/10 px-1.5 py-0.5">Débito</span>
          </div>
        </>
      )}
    </div>
  );
}
