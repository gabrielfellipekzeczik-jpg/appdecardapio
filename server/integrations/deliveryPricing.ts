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

/** Busca mais tolerante a endereço incompleto, usada quando a primeira não acha. */
async function geocodeLoose(address: string): Promise<Coordinates> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { accept: "application/geo+json", "user-agent": "MarmitariaApp/1.0" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok)
    throw new Error("Não foi possível localizar esse endereço agora.");
  const payload = (await response.json()) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const point = payload.features?.[0]?.geometry?.coordinates;
  if (!point)
    throw new Error(
      "Não encontramos esse endereço. Confira rua, número e cidade."
    );
  return { latitude: point[1], longitude: point[0] };
}

async function locate(address: string) {
  try {
    return await geocode(address);
  } catch {
    return geocodeLoose(address);
  }
}

/** Linha reta com folga para o traçado das ruas, usada só se o serviço de rotas cair. */
function straightLineMeters(origin: Coordinates, destination: Coordinates) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(destination.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a)) * ROAD_DETOUR_FACTOR;
}
const ROAD_DETOUR_FACTOR = 1.35;

/** Tira complemento e referência, que atrapalham a busca e não mudam a rota. */
export function routableAddress(address: string) {
  return address
    .replace(/,?\s*Referência:.*?(?=,\s*nº|$)/i, "")
    .replace(/,?\s*(apto|apartamento|ap|bloco|bl|casa|sala|fundos)\b[^,]*/gi, "")
    .trim();
}

/** Distância pela rua entre a loja e o cliente, em km, arredondada para cima em décimos. */
export async function distanceBetweenAddresses(
  pickupAddress: string,
  dropoffAddress: string
) {
  const origin = await locate(pickupAddress);
  const destination = await locate(routableAddress(dropoffAddress));
  const meters = await getRoadDistanceMeters(origin, destination).catch(() =>
    straightLineMeters(origin, destination)
  );
  return Math.ceil(meters / 100) / 10;
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
