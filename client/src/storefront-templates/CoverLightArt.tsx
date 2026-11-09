import { ChevronRight, UtensilsCrossed } from "lucide-react";
import type { Storefront } from "@/lib/useStorefront";

/** Paleta do modo claro: creme com marrom-café. */
export const LIGHT_INK = "#6e3b1c";

/** Ondas marrons nos cantos (canto superior esquerdo e inferior direito). */
export function WaveCorners({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 400 600"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="cv-wave-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a4f27" />
          <stop offset="1" stopColor="#d7ab84" />
        </linearGradient>
        <linearGradient id="cv-wave-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9cfb3" />
          <stop offset="1" stopColor="#f6e8d8" />
        </linearGradient>
        <linearGradient id="cv-wave-c" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#7d4420" />
          <stop offset="1" stopColor="#d2a27a" />
        </linearGradient>
      </defs>
      {/* canto superior esquerdo */}
      <path d="M0 0 H165 C120 40 70 55 40 110 C20 150 10 190 0 230 Z" fill="url(#cv-wave-a)" />
      <path d="M165 0 H230 C170 30 110 60 70 120 C40 165 20 200 0 260 V230 C10 190 20 150 40 110 C70 55 120 40 165 0 Z" fill="url(#cv-wave-b)" opacity=".9" />
      <path d="M150 0 C100 45 55 70 30 125 C15 160 6 190 0 215" fill="none" stroke="#fff8ef" strokeWidth="1.4" opacity=".9" />
      {/* canto inferior direito */}
      <path d="M400 600 H250 C300 565 345 545 368 490 C385 450 392 410 400 370 Z" fill="url(#cv-wave-c)" />
      <path d="M250 600 H185 C245 572 300 545 335 485 C360 440 380 405 400 345 V370 C392 410 385 450 368 490 C345 545 300 565 250 600 Z" fill="url(#cv-wave-b)" opacity=".9" />
      <path d="M262 600 C310 562 350 535 372 478 C386 442 394 410 400 385" fill="none" stroke="#fff8ef" strokeWidth="1.4" opacity=".9" />
    </svg>
  );
}

const Rule = ({ className = "" }: { className?: string }) => (
  <span aria-hidden="true" className={`h-px flex-1 ${className}`} style={{ backgroundColor: LIGHT_INK }} />
);

/** Divisor com estrela de quatro pontas no meio. */
export function StarDivider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-2 ${className}`}>
      <Rule className="opacity-60" />
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill={LIGHT_INK}>
        <path d="M6 0 C6.6 3.6 8.4 5.4 12 6 C8.4 6.6 6.6 8.4 6 12 C5.4 8.4 3.6 6.6 0 6 C3.6 5.4 5.4 3.6 6 0 Z" />
      </svg>
      <Rule className="opacity-60" />
    </div>
  );
}

/** Capa do cardápio no modo claro. */
export function LightCover({
  company,
  onOpen,
}: {
  company: NonNullable<Storefront["company"]>;
  /** Sem ação (painel do computador), o botão não aparece. */
  onOpen?: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#fdf6ec_0%,#f6e9d9_70%,#efdcc6_100%)] px-6 text-center">
      <WaveCorners />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[14px] rounded-[12px] border"
        style={{ borderColor: `${LIGHT_INK}99` }}
      />
      <div className="relative flex w-full flex-1 flex-col items-center justify-center">
        <div className="flex w-full items-center gap-3">
          <Rule className="opacity-80" />
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-24 w-24 shrink-0 rounded-full border object-cover"
              style={{ borderColor: LIGHT_INK }}
            />
          ) : (
            <span
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: LIGHT_INK, color: LIGHT_INK }}
            >
              <UtensilsCrossed className="h-11 w-11" strokeWidth={2.2} />
            </span>
          )}
          <Rule className="opacity-80" />
        </div>
        <h1
          className="mt-5 font-display text-[clamp(2rem,9vw,3.1rem)] font-medium leading-[1.05]"
          style={{ color: "#5a2f15" }}
        >
          {company.name}
        </h1>
        <StarDivider className="mt-4 w-4/5" />
        <div className="mt-5 flex w-full items-center gap-3">
          <Rule className="opacity-70" />
          <span className="pl-[0.5em] text-sm font-medium uppercase tracking-[0.5em]" style={{ color: LIGHT_INK }}>
            Cardápio
          </span>
          <Rule className="opacity-70" />
        </div>
        {company.tagline && (
          <p className="mt-4 max-w-[26ch] text-xs uppercase tracking-[0.18em]" style={{ color: `${LIGHT_INK}cc` }}>
            {company.tagline}
          </p>
        )}
      </div>
      {onOpen && <button
        onClick={onOpen}
        className="cover-cta relative mb-10 flex items-center gap-3 rounded-full px-9 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-[#fbf1e4] shadow-lg ring-1 ring-offset-[3px] ring-offset-[#f7ebdc]"
        style={{ backgroundColor: LIGHT_INK, ["--tw-ring-color" as string]: LIGHT_INK }}
      >
        Ver cardápio <ChevronRight className="h-4 w-4" />
      </button>}
    </div>
  );
}
