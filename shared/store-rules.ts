/** Valor gravado em orders.deliveryAddress para pedidos sem entrega. */
export const PICKUP_ADDRESS = "Retirada na loja";

export function isPickupOrder(order: { deliveryAddress?: string | null }) {
  return order.deliveryAddress === PICKUP_ADDRESS;
}

export type DayHours = { enabled: boolean; open: string; close: string };
/** Sete posições, de domingo (0) a sábado (6). */
export type OpeningHours = DayHours[];

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const DEFAULT_OPENING_HOURS: OpeningHours = WEEKDAY_LABELS.map(
  (_, day) => ({
    enabled: day >= 1 && day <= 5,
    open: "11:00",
    close: "14:30",
  })
);

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function saoPauloClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) =>
    parts.find(part => part.type === type)?.value ?? "";
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      read("weekday")
    ),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

export type StoreStatus = { open: boolean; label: string | null };

/** Sem horário cadastrado a loja é tratada como aberta. Fechamento antes da abertura significa virar a meia-noite. */
export function getStoreStatus(
  hours: OpeningHours | null | undefined,
  now = new Date()
): StoreStatus {
  if (!Array.isArray(hours) || hours.length !== 7)
    return { open: true, label: null };
  const { day, minutes } = saoPauloClock(now);

  const today = hours[day];
  const yesterday = hours[(day + 6) % 7];
  if (
    yesterday.enabled &&
    toMinutes(yesterday.close) <= toMinutes(yesterday.open) &&
    minutes < toMinutes(yesterday.close)
  )
    return { open: true, label: `Aberto até ${yesterday.close}` };
  if (today.enabled && minutes >= toMinutes(today.open)) {
    const crossesMidnight = toMinutes(today.close) <= toMinutes(today.open);
    if (crossesMidnight || minutes < toMinutes(today.close))
      return { open: true, label: `Aberto até ${today.close}` };
  }

  if (today.enabled && minutes < toMinutes(today.open))
    return { open: false, label: `Fechado · abre hoje às ${today.open}` };
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = hours[(day + offset) % 7];
    if (!next.enabled) continue;
    const when =
      offset === 1
        ? "amanhã"
        : WEEKDAY_LABELS[(day + offset) % 7].toLowerCase();
    return { open: false, label: `Fechado · abre ${when} às ${next.open}` };
  }
  return { open: false, label: "Fechado no momento" };
}

/** Telefone brasileiro enquanto o cliente digita: (11) 98888-7777. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  const area = `(${digits.slice(0, 2)}) `;
  const split = digits.length === 11 ? 7 : 6;
  return digits.length <= split
    ? `${area}${digits.slice(2)}`
    : `${area}${digits.slice(2, split)}-${digits.slice(split)}`;
}
