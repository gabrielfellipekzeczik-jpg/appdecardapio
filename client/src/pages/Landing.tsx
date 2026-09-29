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

const features = [
  {
    icon: Palette,
    title: "Cardápio com a sua cara",
    text: "Logo, cores e domínio próprio. Seus clientes chegam direto no seu app, sem intermediário.",
  },
  {
    icon: CreditCard,
    title: "Receba Pix e cartão na hora",
    text: "Mercado Pago integrado. Aprovação automática, sem maquininha, sem espera.",
  },
  {
    icon: Truck,
    title: "Entrega automática",
    text: "Despacha pelo Uber Direct, Lalamove ou motoboy próprio — sem ligação, sem planilha.",
  },
  {
    icon: LayoutDashboard,
    title: "Painel completo de pedidos",
    text: "Acompanhe cada pedido em tempo real, do recebimento à entrega, em qualquer tela.",
  },
  {
    icon: Smartphone,
    title: "Funciona no celular do cliente",
    text: "Sem instalar nada. O cliente abre o link, escolhe e paga direto pelo navegador.",
  },
  {
    icon: Zap,
    title: "Pronto em minutos",
    text: "Cadastre o restaurante, monte o cardápio e já está vendendo. Sem contrato, sem mensalidade inicial.",
  },
];

const steps = [
  { n: "01", title: "Cadastre seu restaurante", text: "Nome, logo, endereço e horário de funcionamento." },
  { n: "02", title: "Monte o cardápio", text: "Categorias, fotos, preços e variações em poucos cliques." },
  { n: "03", title: "Conecte o Mercado Pago", text: "Autorize em 2 minutos e já aceite Pix e cartão." },
  { n: "04", title: "Compartilhe o link", text: "Coloque no WhatsApp, Instagram ou Stories e comece a receber pedidos." },
];

const testimonials = [
  {
    name: "Ana Souza",
    role: "Marmitaria da Ana · SP",
    text: "Em uma semana já tinha 40 pedidos pelo app. Antes eu anotava tudo no papel.",
    stars: 5,
  },
  {
    name: "Carlos Menezes",
    role: "Fit & Sabor · RJ",
    text: "O Pix cai na hora. Nunca mais perdi pedido por falta de troco.",
    stars: 5,
  },
  {
    name: "Patrícia Lima",
    role: "Tempero Caseiro · MG",
    text: "Meus clientes adoraram não precisar ligar para fazer pedido. Profissionalizou tudo.",
    stars: 5,
  },
];

// Unsplash food images (free to use)
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark">
              <Utensils className="h-5 w-5" />
            </div>
            <p className="font-display text-xl font-bold">Marmitaria Flow</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin-login">
              <Button variant="ghost" className="text-[#776e63]">
                Já tenho conta
              </Button>
            </Link>
            <Link href="/cadastrar">
              <Button className="rounded-full bg-[#a05c32] px-5 text-white hover:bg-[#8a4e2b]">
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#fbfaf7]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#a05c32]/10 px-4 py-1.5 text-sm font-medium text-[#a05c32]">
                <Zap className="h-3.5 w-3.5" /> Pronto para vender hoje
              </span>
              <h1 className="font-display mt-5 text-5xl font-bold leading-[1.1] tracking-tight lg:text-6xl">
                Seu restaurante,<br />
                <span className="text-[#a05c32]">seu app</span> de pedidos.
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#776e63]">
                Cadastre sua marmitaria, monte o cardápio e comece a vender em minutos.
                Pagamento Pix e cartão, entrega automática e painel de pedidos incluídos.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/cadastrar">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-[#a05c32] px-8 text-white hover:bg-[#8a4e2b]"
                  >
                    Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <ul className="mt-7 flex flex-col gap-2 text-sm text-[#776e63]">
                {["Sem mensalidade para começar", "Sem instalar app no celular do cliente", "Suporte para Pix, crédito e débito"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#a05c32]" />
                      {t}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Right — food grid */}
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
              {/* floating badge */}
              <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#a05c32]/10">
                  <ShoppingBag className="h-5 w-5 text-[#a05c32]" />
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

      {/* ── Social proof strip ── */}
      <div className="border-y border-[#e9e3d9] bg-[#f5f1eb] py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-5 text-center text-sm text-[#776e63] lg:px-8">
          {[
            { v: "+500", l: "restaurantes cadastrados" },
            { v: "+12 mil", l: "pedidos por mês" },
            { v: "4.9★", l: "avaliação média" },
            { v: "< 5 min", l: "para começar a vender" },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className="font-display text-2xl font-bold text-[#29251f]">{v}</p>
              <p>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features grid ── */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold lg:text-4xl">Tudo que seu restaurante precisa</h2>
          <p className="mt-3 text-[#776e63]">De ponta a ponta, sem precisar contratar mais ninguém.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-[#e9e3d9] bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#a05c32]/10">
                <Icon className="h-5 w-5 text-[#a05c32]" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#776e63]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#29251f] py-16 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold lg:text-4xl">Como funciona</h2>
            <p className="mt-3 text-white/60">Do cadastro ao primeiro pedido em menos de uma tarde.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ n, title, text }) => (
              <div key={n} className="relative rounded-2xl bg-white/5 p-6">
                <p className="font-display text-4xl font-bold text-[#a05c32]/60">{n}</p>
                <h3 className="font-display mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold lg:text-4xl">Quem já usa, não para</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {testimonials.map(({ name, role, text, stars }) => (
            <div key={name} className="rounded-2xl border border-[#e9e3d9] bg-white p-6">
              <div className="flex gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#a05c32] text-[#a05c32]" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[#776e63]">"{text}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a05c32]/10 font-bold text-[#a05c32]">
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
      <section className="bg-[#a05c32] py-16 text-white">
        <div className="mx-auto max-w-2xl px-5 text-center lg:px-8">
          <MessageSquare className="mx-auto h-10 w-10 opacity-80" />
          <h2 className="font-display mt-4 text-3xl font-bold lg:text-4xl">
            Pronto para receber pedidos hoje?
          </h2>
          <p className="mt-4 text-white/80">
            Cadastre seu restaurante agora e comece a vender em minutos.
          </p>
          <Link href="/cadastrar">
            <Button
              size="lg"
              className="mt-8 h-12 rounded-full bg-white px-10 text-[#a05c32] hover:bg-white/90"
            >
              Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e9e3d9] bg-[#fbfaf7] py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-[#776e63] lg:px-8">
          <div className="flex items-center gap-2">
            <div className="brand-mark scale-75">
              <Utensils className="h-4 w-4" />
            </div>
            <span className="font-bold text-[#29251f]">Marmitaria Flow</span>
          </div>
          <p>© {new Date().getFullYear()} Marmitaria Flow. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
