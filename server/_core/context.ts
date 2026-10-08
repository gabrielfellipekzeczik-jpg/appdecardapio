import { TRPCError } from "@trpc/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { User } from "../db";
import { authenticateRequest } from "./supabaseAuth";

export type TrpcContext = {
  req: IncomingMessage;
  res: ServerResponse;
  user: User | null;
};

// Erros "normais" de autenticação: visitante sem token ou token inválido/expirado.
const EXPECTED_AUTH_ERRORS = new Set(["Missing bearer token", "Invalid session token"]);

export async function createContext(opts: { req: IncomingMessage; res: ServerResponse }): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    if (!(error instanceof Error) || !EXPECTED_AUTH_ERRORS.has(error.message)) {
      // Problema de infraestrutura (schema não exposto, permissão, chave errada...).
      // Antes isso virava "usuário deslogado" e o app redirecionava para o login sem explicar nada.
      console.error("[Auth] Falha ao sincronizar usuário:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao acessar o banco de dados. Confira o schema marmitaria no Supabase (SETUP.md, passos 4 e 5).",
      });
    }
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
