import { useEffect, useState } from "react";
import { CreditCard, Palette, Truck } from "lucide-react";
import { AppearancePanel } from "@/components/AppearancePanel";
import { OrderingSettingsCard } from "@/components/OrderingSettingsCard";
import CompanyIntegrations from "@/pages/CompanyIntegrations";

const SECTIONS = [
  {
    id: "config-pedidos",
    label: "Pedidos e entrega",
    icon: Truck,
    description: "Horário, formas de receber, retirada e taxa de entrega.",
  },
  {
    id: "config-visual",
    label: "Visual do cardápio",
    icon: Palette,
    description: "Nome, logo, cores, modelo da página e fundo claro ou escuro.",
  },
  {
    id: "config-pagamento",
    label: "Pagamento e integrações",
    icon: CreditCard,
    description: "Mercado Pago para receber pelo app e serviços de entrega.",
  },
] as const;

/** Todas as configurações da loja numa tela só, separadas por seção. */
export function SettingsPanel() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  // Volta do Mercado Pago (?mercadopago=...): abre direto na seção de pagamento.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("mercadopago")) return;
    const timer = window.setTimeout(() => jumpTo("config-pagamento"), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-140px 0px -55% 0px" }
    );
    SECTIONS.forEach(section => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 128,
      behavior: "smooth",
    });
  };

  return (
    <div>
      <nav
        aria-label="Seções das configurações"
        className="sticky top-[60px] z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-[#f7f6f2]/95 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:top-[68px] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => jumpTo(id)}
            aria-current={active === id ? "true" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              active === id
                ? "border-[#2f5d50] bg-[#2f5d50] text-white"
                : "border-[#e5e0d7] bg-white text-[#5d554b] hover:border-[#cdbfae]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="space-y-12">
        {SECTIONS.map(({ id, label, icon: Icon, description }) => (
          <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
            <header className="mb-4 flex items-start gap-3 border-b border-[#e5e0d7] pb-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7efe9] text-[#2f5d50]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 id={`${id}-title`} className="font-display text-2xl font-bold">
                  {label}
                </h3>
                <p className="text-sm text-[#776e63]">{description}</p>
              </div>
            </header>
            {id === "config-pedidos" && <OrderingSettingsCard />}
            {id === "config-visual" && <AppearancePanel />}
            {id === "config-pagamento" && <CompanyIntegrations embedded />}
          </section>
        ))}
      </div>
    </div>
  );
}
