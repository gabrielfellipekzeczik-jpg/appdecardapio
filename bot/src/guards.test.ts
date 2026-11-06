import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, RecentIds, ReplyGuard, isOptOutMessage, readDelayMs, typingDelayMs } from "./guards";

const make = (limits = {}) => {
  let now = 1_000_000_000;
  const guard = new ReplyGuard({ ...DEFAULT_LIMITS, ...limits }, () => now);
  return { guard, advance: (ms: number) => { now += ms; }, now: () => now };
};

describe("ReplyGuard", () => {
  it("allows a fresh message", () => {
    const { guard, now } = make();
    expect(guard.check("a@s.whatsapp.net", now())).toEqual({ ok: true });
  });

  it("ignores stale messages (backlog after reconnect)", () => {
    const { guard, now } = make();
    expect(guard.check("a", now() - 5 * 60_000)).toMatchObject({ ok: false, reason: "mensagem antiga" });
  });

  it("enforces a cooldown and an hourly cap per contact", () => {
    const { guard, advance, now } = make({ contactPerHour: 3, contactCooldownMs: 10_000 });
    guard.recordReply("a");
    expect(guard.check("a", now())).toMatchObject({ ok: false });
    for (let i = 0; i < 2; i++) { advance(11_000); expect(guard.check("a", now()).ok).toBe(true); guard.recordReply("a"); }
    advance(11_000);
    expect(guard.check("a", now())).toMatchObject({ ok: false, reason: "limite por hora do contato" });
    advance(3_600_000);
    expect(guard.check("a", now()).ok).toBe(true);
  });

  it("enforces the store-wide hourly cap across contacts", () => {
    const { guard, advance, now } = make({ companyPerHour: 2 });
    guard.recordReply("a"); advance(20_000);
    guard.recordReply("b"); advance(20_000);
    expect(guard.check("c", now())).toMatchObject({ ok: false, reason: "limite por hora da loja" });
  });

  it("goes silent for a contact after a human answers from the phone", () => {
    const { guard, advance, now } = make({ humanTakeoverMs: 60_000 });
    guard.recordHumanMessage("a");
    expect(guard.check("a", now())).toMatchObject({ ok: false, reason: "atendimento humano em andamento" });
    expect(guard.check("b", now()).ok).toBe(true);
    advance(61_000);
    expect(guard.check("a", now()).ok).toBe(true);
  });

  it("never answers a contact who opted out", () => {
    const { guard, now } = make();
    guard.optOut("a");
    expect(guard.check("a", now())).toMatchObject({ ok: false });
    expect(new ReplyGuard(DEFAULT_LIMITS, Date.now, guard.optedOutList()).isOptedOut("a")).toBe(true);
  });
});

describe("helpers", () => {
  it("detects opt-out phrases but not normal questions", () => {
    for (const text of ["parar", "SAIR", "Stop!", "não quero mais receber", "cancelar"]) expect(isOptOutMessage(text)).toBe(true);
    for (const text of ["quanto custa o sair?", "pode parar na minha rua?", "oi"]) expect(isOptOutMessage(text)).toBe(false);
  });

  it("types longer for longer replies, never more than 9s", () => {
    expect(typingDelayMs(20, () => 0.5)).toBeLessThan(typingDelayMs(400, () => 0.5));
    expect(typingDelayMs(5_000, () => 1)).toBeLessThanOrEqual(9_000);
    expect(readDelayMs(() => 0)).toBeGreaterThanOrEqual(1_200);
  });

  it("remembers only the most recent bot message ids", () => {
    const ids = new RecentIds(2);
    ids.add("1"); ids.add("2"); ids.add("3");
    expect([ids.has("1"), ids.has("2"), ids.has("3")]).toEqual([false, true, true]);
  });
});
