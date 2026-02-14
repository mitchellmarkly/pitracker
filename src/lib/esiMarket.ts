type EsiIdsResponse = {
  systems?: { id: number; name: string }[];
  inventory_types?: { id: number; name: string }[];
};

type SystemInfo = { constellation_id: number };
type ConstellationInfo = { region_id: number };

export type HubResolved = {
  name: string;
  systemId: number;
  regionId: number;
};

export type MarketSnapshot = {
  bestBuy: number | null;
  bestSell: number | null;
  buyVolume: number;
  sellVolume: number;
  truncated: boolean;
  scannedPages: number;
};

const ESI = "https://esi.evetech.net/latest";
const UA = "pi-tracker";

const cache = {
  ids: new Map<string, number>(),
  systemToRegion: new Map<number, number>(),
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ESI error ${res.status}: ${t || url}`);
  }
  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function resolveNamesToIds(names: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));

  for (const nm of unique) {
    const cached = cache.ids.get(nm);
    if (cached) out.set(nm, cached);
  }

  const missing = unique.filter((nm) => !out.has(nm));
  if (!missing.length) return out;

  for (const batch of chunk(missing, 500)) {
    const { data } = await fetchJson<EsiIdsResponse>(`${ESI}/universe/ids/`, {
      method: "POST",
      body: JSON.stringify(batch),
    });

    const systems = data.systems ?? [];
    const types = data.inventory_types ?? [];

    for (const x of [...systems, ...types]) {
      out.set(x.name, x.id);
      cache.ids.set(x.name, x.id);
    }
  }

  return out;
}

export async function resolveHub(systemName: string): Promise<HubResolved> {
  const name = systemName.trim();
  if (!name) throw new Error("Hub system name is empty.");

  const ids = await resolveNamesToIds([name]);
  const systemId = ids.get(name);
  if (!systemId) throw new Error(`Could not resolve system: ${name}`);

  const regionId = await getRegionIdForSystem(systemId);
  return { name, systemId, regionId };
}

async function getRegionIdForSystem(systemId: number): Promise<number> {
  const cached = cache.systemToRegion.get(systemId);
  if (cached) return cached;

  const { data: sys } = await fetchJson<SystemInfo>(`${ESI}/universe/systems/${systemId}/`);
  const { data: cons } = await fetchJson<ConstellationInfo>(`${ESI}/universe/constellations/${sys.constellation_id}/`);
  cache.systemToRegion.set(systemId, cons.region_id);
  return cons.region_id;
}

type MarketOrder = {
  is_buy_order: boolean;
  price: number;
  volume_remain: number;
  system_id: number;
};

async function scanOrders(
  regionId: number,
  systemId: number,
  typeId: number,
  orderType: "buy" | "sell",
  maxPages: number
): Promise<{ best: number | null; vol: number; truncated: boolean; scannedPages: number }> {
  let best: number | null = null;
  let vol = 0;
  let truncated = false;

  const baseUrl = `${ESI}/markets/${regionId}/orders/?order_type=${orderType}&type_id=${typeId}`;

  const first = await fetchJson<MarketOrder[]>(`${baseUrl}&page=1`);
  const pages = Number(first.headers.get("x-pages") || "1");
  const totalPages = Number.isFinite(pages) && pages > 0 ? pages : 1;

  const limit = Math.min(totalPages, Math.max(1, maxPages));
  if (totalPages > limit) truncated = true;

  const process = (orders: MarketOrder[]) => {
    let found = false;
    for (const o of orders) {
      if (o.system_id !== systemId) continue;
      found = true;
      vol += o.volume_remain ?? 0;
      if (best === null) best = o.price;
      else best = orderType === "buy" ? Math.max(best, o.price) : Math.min(best, o.price);
    }
    return found;
  };

  // ESI lists are price-sorted (buy: high→low, sell: low→high). Once we see any matching system order,
  // we can stop scanning because later pages cannot improve the best price for that system.
  let scannedPages = 0;

  scannedPages += 1;
  let foundAny = process(first.data);
  if (!foundAny) {
    for (let p = 2; p <= limit; p++) {
      const { data } = await fetchJson<MarketOrder[]>(`${baseUrl}&page=${p}`);
      scannedPages += 1;
      const found = process(data);
      if (found) break;
    }
  }

  return { best, vol, truncated, scannedPages };
}

export async function fetchMarketSnapshot(
  hub: HubResolved,
  typeId: number,
  options?: { maxPages?: number }
): Promise<MarketSnapshot> {
  const maxPages = options?.maxPages ?? 10;

  const [buy, sell] = await Promise.all([
    scanOrders(hub.regionId, hub.systemId, typeId, "buy", maxPages),
    scanOrders(hub.regionId, hub.systemId, typeId, "sell", maxPages),
  ]);

  return {
    bestBuy: buy.best,
    bestSell: sell.best,
    buyVolume: buy.vol,
    sellVolume: sell.vol,
    truncated: buy.truncated || sell.truncated,
    scannedPages: buy.scannedPages + sell.scannedPages,
  };
}
