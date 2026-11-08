import { createServer } from "node:http";
import { Gemini } from "./ai.ts";
import { loadConfig } from "./config.ts";
import { Session } from "./session.ts";
import { Store } from "./store.ts";

process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (error) => console.error("[uncaughtException]", error));

const config = loadConfig();
const store = new Store(config);
const gemini = new Gemini(config.geminiApiKey, config.geminiModel);
const sessions = new Map<number, Session>();
let reconciling = false;

/** Compara o que os lojistas pediram (tabela whatsapp_bots) com o que está rodando e ajusta. */
async function reconcile() {
  if (reconciling) return;
  reconciling = true;
  try {
    const rows = await store.listBots();
    for (const row of rows) {
      let running = sessions.get(row.companyId);
      // Sessão que se encerrou sozinha (QR expirado, logout) e o lojista já pediu para conectar de novo.
      if (running?.isStopped && row.desired === "connected") { sessions.delete(row.companyId); running = undefined; }
      if (row.desired === "connected" && !running) {
        console.log(`[${row.companyId}] iniciando sessão`);
        const session = new Session(row.companyId, config, store, gemini);
        sessions.set(row.companyId, session);
        await session.start().catch(async (error) => {
          console.error(`[${row.companyId}] falha ao iniciar:`, error);
          sessions.delete(row.companyId);
          await store.patchBot(row.companyId, { desired: "disconnected", status: "error", error: "Falha ao iniciar a conexão. Tente novamente." });
        });
      } else if (row.desired === "disconnected" && running) {
        console.log(`[${row.companyId}] encerrando sessão`);
        sessions.delete(row.companyId);
        await running.stop(true);
        await store.patchBot(row.companyId, { status: "idle", qr: null, phone: null });
      }
    }
    // Sessões que o próprio bot encerrou (logout pelo celular, QR expirado) saem do mapa quando a linha volta a "disconnected".
  } catch (error) {
    console.error("[reconcile]", error instanceof Error ? error.message : error);
  } finally {
    reconciling = false;
  }
}

let flushing = false;
/** Envia os avisos de pedido pendentes (pago, em preparo, pronto, saiu, entregue) das sessões conectadas. */
async function flushNotifications() {
  if (flushing) return;
  flushing = true;
  try {
    for (const [companyId, session] of sessions) {
      if (!session.isConnected) continue;
      for (const item of await store.pendingNotifications(companyId)) {
        const result = await session.sendNotification(item.recipient, item.message);
        const attempts = item.attempts + 1;
        if (result === "sent") await store.finishNotification(item.id, attempts, "sent");
        else if (result === "invalid") await store.finishNotification(item.id, attempts, "failed", "Número sem WhatsApp");
        else if (attempts >= 5) await store.finishNotification(item.id, attempts, "failed", "Não foi possível enviar após várias tentativas");
        else { await store.finishNotification(item.id, attempts, "pending"); break; }
      }
    }
  } catch (error) {
    console.error("[notifications]", error instanceof Error ? error.message : error);
  } finally {
    flushing = false;
  }
}

setInterval(() => void reconcile(), config.pollMs);
setInterval(() => void flushNotifications(), Math.max(config.pollMs, 5_000));
setInterval(() => void store.heartbeat(), 20_000);
void reconcile();
void store.heartbeat();

// Endpoint simples para health check do host (Railway, Fly, Render…).
// Hospedagens como a Hostinger entregam PORT como caminho de socket, não só como número.
const listenOn = process.env.PORT && Number.isNaN(Number(process.env.PORT)) ? process.env.PORT : config.port;
createServer((_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("ok"); }).listen(listenOn, () => console.log(`Bot de WhatsApp no ar (${listenOn}).`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await Promise.all([...sessions.values()].map((session) => session.stop(false)));
    process.exit(0);
  });
}
