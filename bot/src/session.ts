import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast, isJidGroup, isJidNewsletter,
  makeCacheableSignalKeyStore, useMultiFileAuthState, type ConnectionState, type WAMessage, type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import type { Gemini } from "./ai.ts";
import type { BotConfig } from "./config.ts";
import { ReplyGuard, RecentIds, isOptOutMessage, readDelayMs, typingDelayMs } from "./guards.ts";
import { ConversationMemory, validateReply, type CompanyContext } from "./prompt.ts";
import type { Store } from "./store.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_INCOMING_CHARS = 1_000;

function textOf(message: WAMessage): string | null {
  const content = message.message;
  if (!content) return null;
  return content.conversation ?? content.extendedTextMessage?.text ?? null;
}

/** Uma conexão WhatsApp (um número) de uma empresa. */
export class Session {
  private sock?: WASocket;
  private stopped = false;
  private open = false;
  private notifyTimes: number[] = [];
  private retry = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private queue: Promise<void> = Promise.resolve();
  private guard!: ReplyGuard;
  private memory = new ConversationMemory();
  private sentIds = new RecentIds();
  private ctxCache?: { at: number; ctx: CompanyContext | null };
  private logger = pino({ level: process.env.BOT_LOG_LEVEL || "warn" });
  private authDir: string;
  private optOutFile: string;

  constructor(readonly companyId: number, private config: BotConfig, private store: Store, private gemini: Gemini) {
    this.authDir = path.join(config.dataDir, "auth", String(companyId));
    this.optOutFile = path.join(config.dataDir, `optout-${companyId}.json`);
  }

  get isStopped() { return this.stopped; }

  async start() {
    this.stopped = false;
    const optedOut = await readFile(this.optOutFile, "utf-8").then((raw) => JSON.parse(raw) as string[]).catch(() => []);
    this.guard = new ReplyGuard(this.config.limits, Date.now, optedOut);
    await this.connect();
  }

  /** logout=true desvincula o aparelho (some de "Aparelhos conectados") e apaga a sessão local. */
  async stop(logout: boolean) {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    try {
      if (logout) await this.sock?.logout();
      else this.sock?.end(undefined);
    } catch { /* socket já fechado */ }
    this.sock = undefined;
    if (logout) await rm(this.authDir, { recursive: true, force: true });
  }

  private async connect() {
    if (this.stopped) return;
    await mkdir(this.authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, this.logger) },
      logger: this.logger,
      browser: Browsers.ubuntu("Chrome"),
      // Não aparecer "online" ao conectar: o celular do dono continua recebendo as notificações normalmente.
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    this.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => { void this.onConnectionUpdate(sock, state, update).catch((error) => console.error(`[${this.companyId}] erro em connection.update:`, error)); });

    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return; // "append" = histórico/sincronização
      for (const message of messages) {
        this.queue = this.queue.then(() => this.onMessage(sock, message)).catch((error) => console.error(`[${this.companyId}] erro ao tratar mensagem:`, error));
      }
    });
  }

  private async onConnectionUpdate(sock: WASocket, state: { creds: { registered?: boolean } }, update: Partial<ConnectionState>) {
    {
      if (sock !== this.sock) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const image = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        await this.store.patchBot(this.companyId, { status: "qr", qr: image, error: null });
      }

      if (connection === "open") {
        this.retry = 0;
        this.open = true;
        const phone = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null;
        await this.store.patchBot(this.companyId, { status: "connected", qr: null, phone, error: null });
        console.log(`[${this.companyId}] WhatsApp conectado (${phone})`);
      }

      if (connection === "close") {
        this.open = false;
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        if (this.stopped) return;

        if (code === DisconnectReason.loggedOut) {
          await rm(this.authDir, { recursive: true, force: true });
          await this.store.patchBot(this.companyId, { desired: "disconnected", status: "idle", qr: null, phone: null, error: "O WhatsApp foi desconectado pelo celular. Conecte de novo para continuar." });
          this.stopped = true;
          return;
        }
        if (code === DisconnectReason.connectionReplaced) {
          await this.store.patchBot(this.companyId, { desired: "disconnected", status: "error", qr: null, error: "Este número foi aberto em outro lugar e a sessão foi substituída." });
          this.stopped = true;
          return;
        }
        if (!state.creds.registered && code !== DisconnectReason.restartRequired) {
          await this.store.patchBot(this.companyId, { desired: "disconnected", status: "error", qr: null, error: "O QR code expirou sem ser lido. Clique em Conectar para gerar outro." });
          this.stopped = true;
          return;
        }
        // restartRequired é normal logo após ler o QR; os demais casos reconectam com espera crescente.
        const wait = code === DisconnectReason.restartRequired ? 500 : Math.min(60_000, 2_000 * 2 ** this.retry++);
        await this.store.patchBot(this.companyId, { status: "starting" });
        this.reconnectTimer = setTimeout(() => { void this.connect(); }, wait);
      }
    }
  }

  get isConnected() { return this.open && !this.stopped; }

  /**
   * Envia um aviso de pedido (o cliente informou o número ao comprar). Ritmo de pessoa: pausa entre envios
   * e teto por hora, para reduzir risco de bloqueio. Retorna "retry" se deve tentar de novo mais tarde.
   */
  async sendNotification(phoneDigits: string, text: string): Promise<"sent" | "retry" | "invalid"> {
    const sock = this.sock;
    if (!sock || !this.isConnected) return "retry";
    const now = Date.now();
    this.notifyTimes = this.notifyTimes.filter((time) => now - time < 3_600_000);
    if (this.notifyTimes.length >= this.config.limits.companyPerHour) return "retry";
    const jid = `${phoneDigits}@s.whatsapp.net`;
    try {
      const [exists] = (await sock.onWhatsApp(jid)) ?? [];
      if (!exists?.exists) return "invalid"; // número sem WhatsApp
      await sleep(1_500 + Math.random() * 2_500);
      await sock.sendPresenceUpdate("composing", exists.jid).catch(() => undefined);
      await sleep(typingDelayMs(text.length));
      const sent = await sock.sendMessage(exists.jid, { text });
      if (sent?.key.id) this.sentIds.add(sent.key.id);
      await sock.sendPresenceUpdate("paused", exists.jid).catch(() => undefined);
      this.notifyTimes.push(Date.now());
      return "sent";
    } catch (error) {
      console.error(`[${this.companyId}] falha ao enviar aviso:`, error instanceof Error ? error.message : error);
      return "retry";
    }
  }

  private async context(): Promise<CompanyContext | null> {
    if (this.ctxCache && Date.now() - this.ctxCache.at < 60_000) return this.ctxCache.ctx;
    const ctx = await this.store.loadContext(this.companyId);
    this.ctxCache = { at: Date.now(), ctx };
    return ctx;
  }

  private async onMessage(sock: WASocket, message: WAMessage) {
    const jid = message.key.remoteJid;
    if (!jid || isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)) return;

    // Mensagem enviada por nós: se não foi o bot, foi o dono pelo celular -> o bot se cala nesse chat.
    if (message.key.fromMe) {
      if (message.key.id && !this.sentIds.has(message.key.id)) this.guard.recordHumanMessage(jid);
      return;
    }

    const text = textOf(message)?.trim();
    if (!text || text.length > MAX_INCOMING_CHARS) return; // áudio, imagem, figurinha, textão: fica para um humano
    const sentAt = Number(message.messageTimestamp ?? 0) * 1000 || Date.now();

    if (isOptOutMessage(text)) {
      if (!this.guard.isOptedOut(jid)) {
        this.guard.optOut(jid);
        await mkdir(this.config.dataDir, { recursive: true });
        await writeFile(this.optOutFile, JSON.stringify(this.guard.optedOutList()));
        await this.send(sock, message, "Tudo bem! Não vou mais enviar mensagens automáticas por aqui.");
      }
      return;
    }

    const verdict = this.guard.check(jid, sentAt);
    if (!verdict.ok) { console.log(`[${this.companyId}] ignorado (${verdict.reason})`); return; }

    const ctx = await this.context();
    if (!ctx || !ctx.active || !ctx.aiEnabled) return;

    const history = this.memory.get(jid);
    const decision = await this.gemini.decide(ctx, history, text);
    this.memory.push(jid, { role: "user", text });
    if (!decision?.shouldReply) { console.log(`[${this.companyId}] sem resposta automática (deixado para atendimento humano)`); return; }

    const reply = validateReply(decision.reply, ctx);
    if (!reply) { console.warn(`[${this.companyId}] resposta do Gemini reprovada pela validação (preço/link fora do catálogo)`); return; }

    await this.send(sock, message, reply);
    this.memory.push(jid, { role: "model", text: reply });
    this.guard.recordReply(jid);
  }

  /** Envia como uma pessoa: lê, "digita" por um tempo proporcional ao texto e só então manda. */
  private async send(sock: WASocket, incoming: WAMessage, text: string) {
    const jid = incoming.key.remoteJid!;
    await sleep(readDelayMs());
    await sock.readMessages([incoming.key]).catch(() => undefined);
    await sleep(600 + Math.random() * 900);
    await sock.sendPresenceUpdate("composing", jid).catch(() => undefined);
    await sleep(typingDelayMs(text.length));
    const sent = await sock.sendMessage(jid, { text });
    if (sent?.key.id) this.sentIds.add(sent.key.id);
    await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
  }
}
