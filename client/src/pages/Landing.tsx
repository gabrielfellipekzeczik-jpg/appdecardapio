import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Palette,
  ShoppingBag,
  Smartphone,
  Star,
  Truck,
  Utensils,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// ── Brand color ──────────────────────────────────────────────────────────────
const RED = "#e11d24";
const RED_DARK = "#c01920";
const RED_BG = "#fef2f2";

const features = [
  { icon: Palette,        title: "Cardápio com a sua cara",      text: "Logo, cores e domínio próprio. Seus clientes chegam direto no seu app, sem intermediário." },
  { icon: CreditCard,     title: "Receba Pix e cartão na hora",  text: "Mercado Pago integrado. Aprovação automática, sem maquininha, sem espera." },
  { icon: Truck,          title: "Entrega automática",            text: "Despacha pelo Uber Direct, Lalamove ou motoboy próprio — sem ligação, sem planilha." },
  { icon: LayoutDashboard,title: "Painel completo de pedidos",   text: "Acompanhe cada pedido em tempo real, do recebimento à entrega, em qualquer tela." },
  { icon: Smartphone,     title: "Funciona no celular do cliente",text: "Sem instalar nada. O cliente abre o link, escolhe e paga direto pelo navegador." },
  { icon: Zap,            title: "Pronto em minutos",             text: "Cadastre o restaurante, monte o cardápio e já está vendendo. Sem contrato, sem mensalidade inicial." },
];

const steps = [
  { n: "01", title: "Cadastre seu restaurante", text: "Nome, logo, endereço e horário de funcionamento." },
  { n: "02", title: "Monte o cardápio",          text: "Categorias, fotos, preços e variações em poucos cliques." },
  { n: "03", title: "Conecte o Mercado Pago",    text: "Autorize em 2 minutos e já aceite Pix e cartão." },
  { n: "04", title: "Compartilhe o link",         text: "Coloque no WhatsApp, Instagram ou Stories e comece a receber pedidos." },
];

const testimonials = [
  { name: "Ana Souza",      role: "Marmitaria da Ana · SP", text: "Em uma semana já tinha 40 pedidos pelo app. Antes eu anotava tudo no papel.", stars: 5 },
  { name: "Carlos Menezes", role: "Fit & Sabor · RJ",       text: "O Pix cai na hora. Nunca mais perdi pedido por falta de troco.",              stars: 5 },
  { name: "Patrícia Lima",  role: "Tempero Caseiro · MG",   text: "Meus clientes adoraram não precisar ligar para fazer pedido. Profissionalizou tudo.", stars: 5 },
];

const foodImages = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#29251f]">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-[#e9e3d9]/80 bg-[#fbfaf7]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
          {/* Logo — compact on mobile */}
          <div className="flex items-center gap-2">
            <div className="brand-mark !h-8 !w-8 flex-shrink-0">
              <Utensils className="h-4 w-4" />
            </div>
            <p className="font-display text-base font-bold leading-tight sm:text-xl">
              Marmitaria<span className="hidden sm:inline"> Flow</span>
            </p>
          </div>
          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link href="/admin-login">
              <Button variant="ghost" className="h-8 px-3 text-sm text-[#776e63]">
                Entrar
              </Button>
            </Link>
            <Link href="/cadastrar">
              <Button
                className="h-8 rounded-full px-4 text-sm text-white"
                style={{ backgroundColor: RED }}
              >
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-[#fbfaf7]">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">

            {/* Left */}
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: RED_BG, color: RED }}
              >
                <Zap className="h-3.5 w-3.5" /> Pronto para vender hoje
              </span>
              <h1 className="font-display mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Seu restaurante,{" "}
                <span style={{ color: RED }}>seu app</span>{" "}
                de pedidos.
              </h1>
              <p className="mt-4 text-base leading-7 text-[#776e63] sm:text-lg sm:leading-8">
                Cadastre sua marmitaria, monte o cardápio e comece a vender em minutos.
                Pagamento Pix e cartão, entrega automática e painel de pedidos incluídos.
              </p>
              <div className="mt-7">
                <Link href="/cadastrar">
                  <Button
                    size="lg"
                    className="w-full rounded-full text-white sm:w-auto"
                    style={{ backgroundColor: RED }}
                  >
                    Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <ul className="mt-5 flex flex-col gap-2 text-sm text-[#776e63]">
                {[
                  "Sem mensalidade para começar",
                  "Sem instalar app no celular do cliente",
                  "Suporte para Pix, crédito e débito",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: RED }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — food grid (desktop only) */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-3">
                {foodImages.map((src, i) => (
                  <div
                    key={i}
                    className={`overflow-hidden rounded-2xl shadow-md ${i === 1 ? "mt-6" : ""} ${i === 3 ? "-mt-6" : ""}`}
                  >
                    <img
                      src={src}
                      alt="prato de comida"
                      className="h-48 w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: RED_BG }}
                >
                  <ShoppingBag className="h-5 w-5" style={{ color: RED }} />
                </div>
                <div>
                  <p className="text-xs text-[#776e63]">Novos pedidos hoje</p>
                  <p className="font-display text-lg font-bold text-[#29251f]">+127</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Food images strip — mobile only ── */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 lg:hidden">
        {foodImages.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="prato de comida"
            className="h-36 w-40 flex-shrink-0 rounded-2xl object-cover shadow-md"
            loading="lazy"
          />
        ))}
      </div>

      {/* ── Social proof strip ── */}
      <div className="border-y border-[#e9e3d9] bg-[#f5f1eb] py-5">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 text-center text-sm text-[#776e63] sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-8 lg:px-8">
          {[
            { v: "+500",    l: "restaurantes" },
            { v: "+12 mil", l: "pedidos/mês" },
            { v: "4.9★",   l: "avaliação média" },
            { v: "< 5 min", l: "para começar" },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className="font-display text-2xl font-bold text-[#29251f]">{v}</p>
              <p>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features grid ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
            Tudo que seu restaurante precisa
          </h2>
          <p className="mt-3 text-[#776e63]">De ponta a ponta, sem precisar contratar mais ninguém.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-5">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e9e3d9] bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: RED_BG }}
              >
                <Icon className="h-5 w-5" style={{ color: RED }} />
              </div>
              <h3 className="font-display mt-4 text-base font-bold lg:text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#776e63]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#1a1a1a] py-12 text-white lg:py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Como funciona</h2>
            <p className="mt-3 text-white/60">Do cadastro ao primeiro pedido em menos de uma tarde.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ n, title, text }) => (
              <div key={n} className="rounded-2xl bg-white/5 p-5">
                <p className="font-display text-4xl font-bold" style={{ color: RED, opacity: 0.7 }}>{n}</p>
                <h3 className="font-display mt-3 text-base font-bold lg:text-lg">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Quem já usa, não para</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {testimonials.map(({ name, role, text, stars }) => (
            <div key={name} className="rounded-2xl border border-[#e9e3d9] bg-white p-5">
              <div className="flex gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" style={{ fill: RED, color: RED }} />
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#776e63]">"{text}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-bold"
                  style={{ backgroundColor: RED_BG, color: RED }}
                >
                  {name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold">{name}</p>
                  <p className="text-xs text-[#776e63]">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-14 text-white" style={{ backgroundColor: RED }}>
        <div className="mx-auto max-w-2xl px-4 text-center lg:px-8">
          <MessageSquare className="mx-auto h-9 w-9 opacity-80" />
          <h2 className="font-display mt-4 text-2xl font-bold sm:text-3xl lg:text-4xl">
            Pronto para receber pedidos hoje?
          </h2>
          <p className="mt-3 text-white/80">
            Cadastre seu restaurante agora e comece a vender em minutos.
          </p>
          <Link href="/cadastrar">
            <Button
              size="lg"
              className="mt-7 w-full rounded-full sm:w-auto"
              style={{ backgroundColor: "#fff", color: RED }}
            >
              Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e9e3d9] bg-[#fbfaf7] py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-[#776e63] lg:px-8">
          <div className="flex items-center gap-2">
            <div className="brand-mark !h-7 !w-7 flex-shrink-0">
              <Utensils className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-[#29251f]">Marmitaria Flow</span>
          </div>
          <p>© {new Date().getFullYear()} Marmitaria Flow. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
