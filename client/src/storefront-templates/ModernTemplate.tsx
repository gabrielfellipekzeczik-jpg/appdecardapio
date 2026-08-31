import { Link } from "wouter";
import { ArrowRight, Plus, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StorefrontCartCheckout } from "@/components/StorefrontCartCheckout";
import type { Storefront } from "@/lib/useStorefront";

/** A bold, minimal, brand-color-forward storefront look. */
export function ModernTemplate(s: Storefront) {
  const company = s.company!;
  const brand = company.primaryColor || "#1f2937";

  return <div className="min-h-screen bg-white text-[#111827]">
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: brand }}><Utensils className="h-4 w-4" /></div>}
          <p className="text-lg font-black uppercase tracking-tight">{company.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${s.slug}/admin`}><Button variant="ghost" size="sm" className="hidden text-[#6b7280] sm:flex">Área da cozinha</Button></Link>
          <Button size="sm" onClick={() => s.setCartOpen(true)} className="rounded-full px-4 text-white" style={{ backgroundColor: brand }}><ShoppingBag className="mr-2 h-4 w-4" /> {s.totalItems > 0 ? `${s.totalItems} itens` : "Pedido"}</Button>
        </div>
      </div>
    </header>

    <main>
      <section className="border-b border-black/5 px-5 py-16 text-center lg:px-8 lg:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: brand }}>{company.tagline || "feito hoje"}</p>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Peça agora, receba fresquinho.</h1>
        <a href="#cardapio"><Button size="lg" className="mt-8 h-12 rounded-full px-8 text-white" style={{ backgroundColor: brand }}>Ver cardápio <ArrowRight className="ml-2 h-4 w-4" /></Button></a>
      </section>

      <section id="cardapio" className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
        {s.menuQuery.isLoading && <p role="status" className="mb-4 text-sm text-[#6b7280]">Atualizando o cardápio...</p>}
        {s.menuQuery.isError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível atualizar o cardápio agora. Exibindo a seleção disponível.</p>}
        {s.visibleMenu.length === 0 && !s.menuQuery.isLoading && <p className="mb-4 rounded-lg border border-black/10 px-4 py-5 text-sm text-[#6b7280]">Nenhum item está disponível neste momento.</p>}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {s.categories.map((category) => <button key={category} onClick={() => s.setActiveCategory(category)} className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition" style={s.activeCategory === category ? { backgroundColor: brand, borderColor: brand, color: "white" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>{category}</button>)}
        </div>
        <div className="divide-y divide-black/5">
          {s.visibleMenu.map((item) => (
            <div key={item.id} className="flex items-center gap-5 py-5">
              <img src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><h3 className="truncate text-lg font-bold">{item.name}</h3><Badge variant="outline" className="shrink-0 border-black/10 text-[10px] uppercase">{item.tag}</Badge></div>
                <p className="mt-1 line-clamp-1 text-sm text-[#6b7280]">{item.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-lg font-black">R$ {item.price.toFixed(2).replace(".", ",")}</span>
                <Button size="sm" onClick={() => s.add(item.id)} className="rounded-full text-white" style={{ backgroundColor: brand }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
    <footer className="border-t border-black/5 px-5 py-8 text-center text-sm text-[#6b7280] lg:px-8"><p>{company.name} © 2026</p></footer>

    <StorefrontCartCheckout {...s} />
  </div>;
}
