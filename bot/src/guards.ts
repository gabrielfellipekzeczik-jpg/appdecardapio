// Travas para o bot se comportar como uma pessoa e reduzir o risco de banimento.
// Módulo puro (sem Baileys/Supabase) para ser testável.

export type Limits = {
  /** Mensagens mais velhas que isso são ignoradas (backlog de reconexão). */
  maxMessageAgeMs: number;
  /** Intervalo mínimo entre duas respostas do bot ao mesmo contato. */
  contactCooldownMs: number;
  contactPerHour: number;
  contactPerDay: number;
  companyPerHour: number;
  companyPerDay: number;
  /** Se o dono responder pelo celular, o bot se cala nesse contato por este tempo. */
  humanTakeoverMs: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxMessageAgeMs: 90_000,
  contactCooldownMs: 8_000,
  contactPerHour: 6,
  contactPerDay: 15,
  companyPerHour: 40,
  companyPerDay: 250,
  humanTakeoverMs: 6 * 60 * 60 * 1000,
};

export type GuardResult = { ok: true } | { ok: false; reason: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function prune(list: number[], now: number, windowMs: number) {
  while (list.length && now - list[0] > windowMs) list.shift();
}

export class ReplyGuard {
  private contactReplies = new Map<string, number[]>();
  private companyReplies: number[] = [];
  private takeoverUntil = new Map<string, number>();
  private optedOut: Set<string>;

  constructor(private limits: Limits = DEFAULT_LIMITS, private now: () => number = Date.now, optedOut: Iterable<string> = []) {
    this.optedOut = new Set(optedOut);
  }

  check(contact: string, messageTimestampMs: number): GuardResult {
    const now = this.now();
    if (this.optedOut.has(contact)) return { ok: false, reason: "contato pediu para parar" };
    if ((this.takeoverUntil.get(contact) ?? 0) > now) return { ok: false, reason: "atendimento humano em andamento" };
    if (now - messageTimestampMs > this.limits.maxMessageAgeMs) return { ok: false, reason: "mensagem antiga" };

    const mine = this.contactReplies.get(contact) ?? [];
    prune(mine, now, DAY);
    const lastHour = mine.filter((t) => now - t <= HOUR).length;
    if (mine.length && now - mine[mine.length - 1] < this.limits.contactCooldownMs) return { ok: false, reason: "intervalo mínimo entre respostas" };
    if (lastHour >= this.limits.contactPerHour) return { ok: false, reason: "limite por hora do contato" };
    if (mine.length >= this.limits.contactPerDay) return { ok: false, reason: "limite diário do contato" };

    prune(this.companyReplies, now, DAY);
    if (this.companyReplies.filter((t) => now - t <= HOUR).length >= this.limits.companyPerHour) return { ok: false, reason: "limite por hora da loja" };
    if (this.companyReplies.length >= this.limits.companyPerDay) return { ok: false, reason: "limite diário da loja" };
    return { ok: true };
  }

  recordReply(contact: string) {
    const now = this.now();
    const mine = this.contactReplies.get(contact) ?? [];
    mine.push(now);
    this.contactReplies.set(contact, mine);
    this.companyReplies.push(now);
  }

  /** O dono escreveu pelo celular nesse chat: o bot sai de cena. */
  recordHumanMessage(contact: string) {
    this.takeoverUntil.set(contact, this.now() + this.limits.humanTakeoverMs);
  }

  optOut(contact: string) { this.optedOut.add(contact); }
  isOptedOut(contact: string) { return this.optedOut.has(contact); }
  optedOutList() { return [...this.optedOut]; }
}

const OPT_OUT = /^\s*(parar|pare|sair|stop|cancelar|descadastrar|n[aã]o quero (mais )?(receber|mensagens?))\s*[.!]*\s*$/i;
export function isOptOutMessage(text: string) { return OPT_OUT.test(text); }

/** Tempo para "ler" a mensagem antes de começar a digitar. */
export function readDelayMs(rand: () => number = Math.random) { return 1_200 + Math.floor(rand() * 2_800); }

/** Tempo "digitando…" proporcional ao tamanho da resposta, com variação, limitado a 9 s. */
export function typingDelayMs(replyLength: number, rand: () => number = Math.random) {
  const base = 1_500 + replyLength * 30;
  const jitter = 0.8 + rand() * 0.5;
  return Math.min(9_000, Math.round(base * jitter));
}

/** Memória limitada de IDs de mensagens enviadas pelo bot (para diferenciar do dono digitando no celular). */
export class RecentIds {
  private ids: string[] = [];
  private set = new Set<string>();
  constructor(private max = 500) {}
  add(id: string) {
    if (this.set.has(id)) return;
    this.set.add(id); this.ids.push(id);
    if (this.ids.length > this.max) this.set.delete(this.ids.shift()!);
  }
  has(id: string) { return this.set.has(id); }
}
