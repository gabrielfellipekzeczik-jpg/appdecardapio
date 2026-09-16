import type { IncomingMessage, ServerResponse } from "node:http";
import type { User } from "../db";
import { authenticateRequest } from "./supabaseAuth";

export type TrpcContext = {
  req: IncomingMessage;
  res: ServerResponse;
  user: User | null;
};

export async function createContext(opts: { req: IncomingMessage; res: ServerResponse }): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
