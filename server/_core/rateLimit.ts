const MAX_TRACKED_KEYS = 5000;

/**
 * Limite em memória por instância: em ambiente serverless é só a primeira barreira.
 * A contagem de pedidos não pagos por telefone, feita no banco, é a segunda.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    if (hits.size > MAX_TRACKED_KEYS) hits.clear();
    const recent = (hits.get(key) ?? []).filter(time => now - time < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    hits.set(key, recent);
    return allowed;
  };
}

export function clientIp(req: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const raw = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(raw) ? raw[0] : raw;
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
