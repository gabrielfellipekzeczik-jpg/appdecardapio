import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Plus, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StorefrontCartCheckout } from "@/components/StorefrontCartCheckout";
import { getContrastTextColor, shade } from "@/lib/color";
import type { Storefront } from "@/lib/useStorefront";

/**
 * A restaurant-menu-book experience: a cover (colored to match the logo)
 * that swings open like a real menu cover to reveal the dishes inside.
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

  const brand = company.primaryColor || "#7a3b1e";
  const onBrand = getContrastTextColor(brand);
  const darkBrand = shade(brand, -30);

  return <div className="min-h-screen bg-[#fbfaf7] text-[#29251f]">
    {!dismissed && (
      <div
        className={`cover-stage ${opening ? "is-dismissing" : ""}`}
        style={{ pointerEvents: opening ? "none" : "auto" }}
        onTransitionEnd={(event) => { if (event.propertyName === "opacity" && event.target === event.currentTarget) setDismissed(true); }}
      >
        <div
          className={`cover-panel ${opening ? "is-opening" : ""}`}
          style={{ background: `linear-gradient(155deg, ${brand}, ${darkBrand})`, color: onBrand }}
        >
          <div className="cover-spine" />
          <div className="flex h-full flex-col items-center justify-between p-8 text-center sm:p-10">
            <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ opacity: 0.75 }}>Cardápio</span>
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              {company.logoUrl
                ? <img src={company.logoUrl} alt={company.name} className="h-28 w-28 rounded-full border-4 object-cover shadow-2xl" style={{ borderColor: `${onBrand}33` }} />
                : <div className="flex h-28 w-28 items-center justify-center rounded-full border-4" style={{ borderColor: `${onBrand}33` }}><Utensils className="h-10 w-10" /></div>}
              <div>
                <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{company.name}</h1>
                {company.tagline && <p className="mx-auto mt-2 max-w-[26ch] text-sm" style={{ opacity: 0.8 }}>{company.tagline}</p>}
              </div>
            </div>
            <button
              onClick={() => setOpening(true)}
              className="cover-cta mb-2 flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide"
              style={{ backgroundColor: onBrand, color: brand }}
            >
              Ver cardápio <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )}

    <div className={`menu-reveal ${opening ? "" : "is-hidden"}`}>
      <header className="sticky top-0 z-30 border-b border-[#e9e3d9]/80 bg-[#fbfaf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ backgroundColor: brand }}><Utensils className="h-4 w-4" /></div>}
            <p className="font-display text-lg font-bold">{company.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${s.slug}/admin`}><Button variant="ghost" size="sm" className="hidden text-[#776e63] sm:flex">Área da cozinha</Button></Link>
            <Button size="sm" onClick={() => s.setCartOpen(true)} className="rounded-full px-4 text-white" style={{ backgroundColor: brand }}><ShoppingBag className="mr-2 h-4 w-4" /> {s.totalItems > 0 ? `${s.totalItems} itens` : "Pedido"}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        {s.menuQuery.isLoading && <p role="status" className="mb-4 text-center text-sm text-[#776e63]">Atualizando o cardápio...</p>}
        {s.menuQuery.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fff0d7] px-4 py-3 text-center text-sm text-[#8a4e2b]">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}
        {s.visibleMenu.length === 0 && !s.menuQuery.isLoading && <p className="mb-4 rounded-xl bg-white px-4 py-5 text-center text-sm text-[#776e63]">Nenhum item está disponível neste momento.</p>}

        <div className="mb-10 flex justify-center gap-6 border-b border-[#e9e3d9]">
          {s.categories.map((category) => (
            <button key={category} onClick={() => s.setActiveCategory(category)} className="relative pb-3 text-sm font-semibold transition" style={{ color: s.activeCategory === category ? brand : "#a79b8d" }}>
              {category}
              {s.activeCategory === category && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full" style={{ backgroundColor: brand }} />}
            </button>
          ))}
        </div>

        <div className="divide-y divide-[#e9e3d9]">
          {s.visibleMenu.map((item) => (
            <div key={item.id} className="flex items-start gap-5 py-6">
              <img src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-display text-lg font-bold">{item.name}</h3>
                  <span className="font-display text-lg font-bold" style={{ color: brand }}>R$ {item.price.toFixed(2).replace(".", ",")}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#776e63]">{item.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="border-black/10 text-[10px] uppercase text-[#a79b8d]">{item.tag}</Badge>
                  <button onClick={() => s.add(item.id)} className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: brand }}><Plus className="h-3 w-3" /> Adicionar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-[#e9e3d9] px-5 py-8 text-center text-sm text-[#776e63] lg:px-8"><p>{company.name} © 2026</p></footer>
    </div>

    <StorefrontCartCheckout {...s} />
  </div>;
}
