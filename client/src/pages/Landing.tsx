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
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";

// ── Brand color ──────────────────────────────────────────────────────────────
const RED      = "#ff1c2e";   // vivo, saturado
const RED_DARK = "#d4000f";
const RED_BG   = "#fff0f1";

// ── Animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } }),
};

const features = [
  { icon: Palette,         title: "Cardápio com a sua cara",       text: "Logo, cores e domínio próprio. Seus clientes chegam direto no seu app, sem intermediário." },
  { icon: CreditCard,      title: "Receba Pix e cartão na hora",   text: "Mercado Pago integrado. Aprovação automática, sem maquininha, sem espera." },
  { icon: Truck,           title: "Entrega automática",             text: "Despacha pelo Uber Direct, Lalamove ou motoboy próprio — sem ligação, sem planilha." },
  { icon: LayoutDashboard, title: "Painel completo de pedidos",    text: "Acompanhe cada pedido em tempo real, do recebimento à entrega, em qualquer tela." },
  { icon: Smartphone,      title: "Funciona no celular do cliente", text: "Sem instalar nada. O cliente abre o link, escolhe e paga direto pelo navegador." },
  { icon: Zap,             title: "Pronto em minutos",              text: "Cadastre o restaurante, monte o cardápio e já está vendendo. Sem contrato, sem mensalidade inicial." },
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
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=85",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=85",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=85",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=85",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=85",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=85",
];

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const duration = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * to));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [started, to]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ── Auto-scrolling image carousel ────────────────────────────────────────────
function FoodCarousel() {
  const imgs = [...foodImages, ...foodImages];

  return (
    <div className="relative overflow-hidden rounded-3xl" style={{ height: "clamp(160px, 40vw, 380px)" }}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#fbfaf7] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#fbfaf7] to-transparent" />

      <style>{`
        @keyframes carousel-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .carousel-track {
          display: flex;
          height: 100%;
          gap: 8px;
          width: max-content;
          animation: carousel-scroll 8s linear infinite;
        }
        @media (min-width: 1024px) {
          .carousel-track { animation-duration: 18s; }
        }
      `}</style>

      <div className="carousel-track">
        {imgs.map((src, i) => (
          <div
            key={i}
            className="relative h-full flex-shrink-0 overflow-hidden rounded-xl shadow-md"
            style={{ width: "clamp(120px, 28vw, 220px)" }}
          >
            <img
              src={src}
              alt="prato"
              className="h-full w-full object-cover"
              loading={i < 6 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Parallax floating badge ───────────────────────────────────────────────────
function FloatingBadge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg"
      style={{ backgroundColor: "#fff", border: `2px solid ${RED}` }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: RED }}>
        <ShoppingBag className="h-4 w-4 text-white" />
      </span>
      <div className="text-left leading-tight">
        <p className="text-xs text-[#776e63]">Pedidos hoje</p>
        <p className="font-display text-base font-bold text-[#29251f]">+127 🔥</p>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#29251f]">

      {/* ── Nav ── */}
      <motion.header
        className="sticky top-0 z-50 border-b border-[#e9e3d9]/80 bg-[#fbfaf7]/95 backdrop-blur"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <motion.div
              className="brand-mark !h-8 !w-8 flex-shrink-0"
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Utensils className="h-4 w-4" />
            </motion.div>
            <p className="font-display text-base font-bold leading-tight sm:text-xl">
              Marmitaria<span className="hidden sm:inline"> Flow</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin-login">
              <Button variant="ghost" className="h-8 px-3 text-sm text-[#776e63]">Entrar</Button>
            </Link>
            <Link href="/cadastrar">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                <Button
                  className="h-8 rounded-full px-4 text-sm text-white shadow-md"
                  style={{ backgroundColor: RED, boxShadow: `0 4px 14px ${RED}55` }}
                >
                  Começar grátis
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative overflow-hidden bg-[#fbfaf7]">
        {/* Animated gradient blob */}
        <motion.div
          className="pointer-events-none absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${RED}18 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${RED}10 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 8, ease: "easeInOut", repeat: Infinity, delay: 2 }}
        />

        <motion.div
          className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-16"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-2">
            {/* Left */}
            <div>
              <motion.span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: RED_BG, color: RED, border: `1px solid ${RED}30` }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.span
                  animate={{ rotate: [0, 15, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Zap className="h-3.5 w-3.5" />
                </motion.span>
                Pronto para vender hoje
              </motion.span>

              <motion.h1
                className="font-display mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.1}
              >
                Seu restaurante,{" "}
                <motion.span
                  style={{ color: RED }}
                  animate={{ textShadow: [`0 0 0px ${RED}00`, `0 0 20px ${RED}55`, `0 0 0px ${RED}00`] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                >
                  seu app
                </motion.span>{" "}
                de pedidos.
              </motion.h1>

              <motion.p
                className="mt-4 text-base leading-7 text-[#776e63] sm:text-lg sm:leading-8"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.2}
              >
                Cadastre sua marmitaria, monte o cardápio e comece a vender em minutos.
                Pagamento Pix e cartão, entrega automática e painel de pedidos incluídos.
              </motion.p>

              <motion.div
                className="mt-7"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.3}
              >
                <Link href="/cadastrar">
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-block w-full sm:w-auto"
                  >
                    <Button
                      size="lg"
                      className="w-full rounded-full text-white sm:w-auto"
                      style={{ backgroundColor: RED, boxShadow: `0 6px 24px ${RED}50` }}
                    >
                      Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>

              <motion.ul
                className="mt-5 flex flex-col gap-2 text-sm text-[#776e63]"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.4}
              >
                {[
                  "Sem mensalidade para começar",
                  "Sem instalar app no celular do cliente",
                  "Suporte para Pix, crédito e débito",
                ].map((t, i) => (
                  <motion.li
                    key={t}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: RED }} />
                    {t}
                  </motion.li>
                ))}
              </motion.ul>

              {/* Floating badge — mobile */}
              <motion.div
                className="mt-6 lg:hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <FloatingBadge />
              </motion.div>
            </div>

            {/* Right — desktop staggered food grid */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid grid-cols-2 gap-3">
                {foodImages.slice(0, 4).map((src, i) => (
                  <motion.div
                    key={i}
                    className={`overflow-hidden rounded-2xl shadow-lg ${i === 1 ? "mt-8" : ""} ${i === 3 ? "-mt-8" : ""}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.04, zIndex: 10, boxShadow: `0 20px 40px ${RED}30` }}
                  >
                    <motion.img
                      src={src}
                      alt="prato"
                      className="h-48 w-full object-cover"
                      loading={i < 2 ? "eager" : "lazy"}
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 8 + i * 2, ease: "easeInOut", repeat: Infinity }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Floating badge desktop */}
              <div className="absolute -bottom-6 -left-6">
                <FloatingBadge />
              </div>

              {/* Red glow behind grid */}
              <div
                className="pointer-events-none absolute inset-0 -z-10 rounded-3xl blur-2xl"
                style={{ background: `radial-gradient(ellipse at center, ${RED}15, transparent 70%)` }}
              />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Food carousel (mobile + desktop) ── */}
      <div className="py-6 lg:py-10">
        <FoodCarousel />
      </div>

      {/* ── Social proof strip ── */}
      <motion.div
        className="border-y border-[#e9e3d9] bg-[#f5f1eb] py-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 text-center text-sm text-[#776e63] sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-12 lg:px-8">
          {[
            { to: 500,  suffix: "+", l: "restaurantes" },
            { to: 12,   suffix: "k+", l: "pedidos/mês" },
            { to: 49,   suffix: "★",  l: "avaliação" },
            { to: 5,    suffix: "min",l: "para começar" },
          ].map(({ to, suffix, l }) => (
            <div key={l}>
              <p className="font-display text-3xl font-bold text-[#29251f]">
                <Counter to={to} suffix={suffix} />
              </p>
              <p className="mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Features grid ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
            Tudo que seu restaurante precisa
          </h2>
          <p className="mt-3 text-[#776e63]">De ponta a ponta, sem precisar contratar mais ninguém.</p>
        </motion.div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3 lg:gap-5">
          {features.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              className="rounded-2xl border border-[#e9e3d9] bg-white p-5 transition-shadow"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileHover={{ y: -4, boxShadow: `0 12px 32px ${RED}18` }}
            >
              <motion.div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: RED_BG }}
                whileHover={{ scale: 1.15, rotate: 8 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Icon className="h-5 w-5" style={{ color: RED }} />
              </motion.div>
              <h3 className="font-display mt-4 text-base font-bold lg:text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#776e63]">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#111] py-12 text-white lg:py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Como funciona</h2>
            <p className="mt-3 text-white/50">Do cadastro ao primeiro pedido em menos de uma tarde.</p>
          </motion.div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ n, title, text }, i) => (
              <motion.div
                key={n}
                className="rounded-2xl bg-white/5 p-5"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.09)" }}
              >
                <p
                  className="font-display text-4xl font-bold"
                  style={{ color: RED }}
                >
                  {n}
                </p>
                <h3 className="font-display mt-3 text-base font-bold lg:text-lg">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">Quem já usa, não para</h2>
        </motion.div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {testimonials.map(({ name, role, text, stars }, i) => (
            <motion.div
              key={name}
              className="rounded-2xl border border-[#e9e3d9] bg-white p-5"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, boxShadow: `0 12px 32px ${RED}15` }}
            >
              <div className="flex gap-1">
                {Array.from({ length: stars }).map((_, j) => (
                  <motion.div
                    key={j}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + j * 0.06, type: "spring", stiffness: 400 }}
                  >
                    <Star className="h-4 w-4" style={{ fill: RED, color: RED }} />
                  </motion.div>
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
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="relative overflow-hidden py-16 text-white" style={{ backgroundColor: RED }}>
        {/* animated background blobs */}
        <motion.div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-black/10 blur-2xl"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 7, repeat: Infinity, delay: 1.5 }}
        />
        <motion.div
          className="relative mx-auto max-w-2xl px-4 text-center lg:px-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          >
            <MessageSquare className="mx-auto h-10 w-10 opacity-90" />
          </motion.div>
          <h2 className="font-display mt-4 text-2xl font-bold sm:text-3xl lg:text-4xl">
            Pronto para receber pedidos hoje?
          </h2>
          <p className="mt-3 text-white/80">
            Cadastre seu restaurante agora e comece a vender em minutos.
          </p>
          <Link href="/cadastrar">
            <motion.div
              className="mt-7 inline-block w-full sm:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                size="lg"
                className="w-full rounded-full shadow-xl sm:w-auto"
                style={{ backgroundColor: "#fff", color: RED, boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
              >
                Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
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
