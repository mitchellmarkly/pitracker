export type JaniceMarket = {
  id: number
  name: string | null
}

export type JanicePricerItem = {
  date: string
  market: JaniceMarket
  buyOrderCount: number
  buyVolume: number
  sellOrderCount: number
  sellVolume: number
  immediatePrices: {
    buyPrice: number
    splitPrice: number
    sellPrice: number
    buyPrice5DayMedian?: number
    splitPrice5DayMedian?: number
    sellPrice5DayMedian?: number
    buyPrice30DayMedian?: number
    splitPrice30DayMedian?: number
    sellPrice30DayMedian?: number
  }
  top5AveragePrices: {
    buyPrice: number
    splitPrice: number
    sellPrice: number
    buyPrice5DayMedian?: number
    splitPrice5DayMedian?: number
    sellPrice5DayMedian?: number
    buyPrice30DayMedian?: number
    splitPrice30DayMedian?: number
    sellPrice30DayMedian?: number
  }
  itemType: {
    eid: number
    name: string | null
    volume: number
    packagedVolume: number
  }
}

const JANICE_BASE = '/janice/api/rest/v2'

export async function janiceFetchMarkets(apiKey: string): Promise<JaniceMarket[]> {
  const res = await fetch(`${JANICE_BASE}/markets`, {
    headers: {
      'X-ApiKey': apiKey,
    },
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Janice markets failed (${res.status}): ${t || res.statusText}`)
  }
  return (await res.json()) as JaniceMarket[]
}

export async function janicePriceItems(
  apiKey: string,
  marketId: number,
  items: string[],
): Promise<JanicePricerItem[]> {
  const body = items.join('\n')
  const res = await fetch(`${JANICE_BASE}/pricer?market=${encodeURIComponent(String(marketId))}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-ApiKey': apiKey,
    },
    body,
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Janice pricer failed (${res.status}): ${t || res.statusText}`)
  }
  return (await res.json()) as JanicePricerItem[]
}
