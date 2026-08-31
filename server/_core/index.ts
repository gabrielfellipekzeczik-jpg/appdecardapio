import "dotenv/config";
// `pnpm dev` runs this directly (no cross-env wrapper) so local dev defaults
// to development mode; the `start` script sets NODE_ENV=production explicitly.
if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerWebhooks } from "../integrations/webhooks";
import { serveStatic, setupVite } from "./vite";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerWebhooks(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // An explicit PORT (set by the host: Vercel, a launch config, etc.) is
  // normally authoritative — bind it directly rather than scanning past it,
  // since a reverse proxy may already be listening in front of it. But if
  // that exact port turns out to be taken (a stray .env value colliding with
  // some other unrelated app on the machine), fall back to scanning instead
  // of crashing — a working server on the wrong port beats no server at all.
  const preferredPort = process.env.PORT ? parseInt(process.env.PORT) : await findAvailablePort(3000);

  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.warn(`Port ${preferredPort} is already in use, looking for another one...`);
    findAvailablePort(preferredPort + 1).then((fallbackPort) => {
      server.listen(fallbackPort, () => {
        console.log(`Server running on http://localhost:${fallbackPort}/`);
      });
    }, console.error);
  });

  server.listen(preferredPort, () => {
    console.log(`Server running on http://localhost:${preferredPort}/`);
  });
}

// On Vercel the app is imported by api/index.ts as a serverless handler;
// only bind a persistent port when actually running as a long-lived process.
if (!process.env.VERCEL) {
  startServer().catch(console.error);
}
