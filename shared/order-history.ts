export type LocalOrderHistoryEntry = {
  cart: Array<{ id: number; qty: number; observation: string }>;
  customer: { name: string; phone: string; address: string };
  clientRef: string;
  createdAt: number;
};

export function readLocalHistory(raw: string, clientRef: string): LocalOrderHistoryEntry[] {
  try {
    const parsed = JSON.parse(raw) as LocalOrderHistoryEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry.clientRef === clientRef).slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function appendLocalHistory(history: LocalOrderHistoryEntry[], entry: LocalOrderHistoryEntry) {
  return [entry, ...history].slice(0, 10);
}
