import { calculateOwnCourierFee } from "@shared/delivery";

type Coordinates = { latitude: number; longitude: number };
const geocodeCache = new Map<
  string,
  { expiresAt: number; coordinates: Coordinates }
>();
let geocodeQueue: Promise<void> = Promise.resolve();
let lastGeocodeAt = 0;

async function geocode(address: string): Promise<Coordinates> {
  const key = address.trim().toLocaleLowerCase("pt-BR");
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.coordinates;
  let releaseQueue!: () => void;
  const nextSlot = new Promise<void>(resolve => (releaseQueue = resolve));
  const previousSlot = geocodeQueue;
  geocodeQueue = previousSlot.then(
    () => nextSlot,
    () => nextSlot
  );
  await previousSlot;
  const queuedCache = geocodeCache.get(key);
  if (queuedCache && queuedCache.expiresAt > Date.now()) {
    releaseQueue();
    return queuedCache.coordinates;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", address);
  let response: Response;
  try {
    const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastGeocodeAt = Date.now();
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "MarmitariaApp/1.0",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
  } finally {
    releaseQueue();
  }
  if (!response.ok)
    throw new Error("Não foi possível localizar esse endereço agora.");
  const results = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
  }>;
  const first = results[0];
  if (!first?.lat || !first.lon)
    throw new Error(
      "Não encontramos esse endereço. Confira rua, número e cidade."
    );
  const coordinates = {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
  geocodeCache.set(key, {
    coordinates,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });
  if (geocodeCache.size > 500)
    geocodeCache.delete(geocodeCache.keys().next().value!);
  return coordinates;
}

async function getRoadDistanceMeters(
  origin: Coordinates,
  destination: Coordinates
): Promise<number> {
  const pair = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${pair}?overview=false&alternatives=false&steps=false`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!response.ok)
    throw new Error(
      "Não foi possível calcular a rota de entrega. Tente novamente em instantes."
    );
  const payload = (await response.json()) as {
    code?: string;
    routes?: Array<{ distance?: number }>;
  };
  const meters = payload.routes?.[0]?.distance;
  if (
    payload.code !== "Ok" ||
    !Number.isFinite(meters) ||
    !meters ||
    meters <= 0
  ) {
    throw new Error(
      "Não encontramos uma rota rodoviária entre a loja e esse endereço."
    );
  }
  return meters;
}

export async function quoteOwnCourier(input: {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffAddress: string;
  pricePerKm: number;
}) {
  const origin = {
    latitude: input.pickupLatitude,
    longitude: input.pickupLongitude,
  };
  const routableAddress = input.dropoffAddress
    .replace(/,?\s*Referência:.*$/i, "")
    .trim();
  const destination = await geocode(routableAddress);
  const distanceMeters = await getRoadDistanceMeters(origin, destination);
  const distanceKm = Math.ceil(distanceMeters / 100) / 10;
  return {
    fee: calculateOwnCourierFee(distanceKm, input.pricePerKm),
    distanceKm,
    origin,
    destination,
  };
}
