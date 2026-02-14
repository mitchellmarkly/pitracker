export type MarketQuote = {
  product: string;
  hubAHighestBuy?: number;
  hubALowestSell?: number;
  hubBHighestBuy?: number;
  hubBLowestSell?: number;
  status?: string;
};

export interface MarketAdapter {
  fetchQuotes(products: string[], signal?: AbortSignal): Promise<MarketQuote[]>;
}

const fakePrice = (s: string) => (s.length * 37.17) % 100000;

export class EsiAdapter implements MarketAdapter {
  async fetchQuotes(products: string[]): Promise<MarketQuote[]> {
    return products.map((p) => ({
      product: p,
      hubAHighestBuy: fakePrice(`${p}-a-buy`),
      hubALowestSell: fakePrice(`${p}-a-sell`) + 200,
      hubBHighestBuy: fakePrice(`${p}-b-buy`),
      hubBLowestSell: fakePrice(`${p}-b-sell`) + 400,
      status: 'ok',
    }));
  }
}

export class JaniceAdapter implements MarketAdapter {
  constructor(private apiKey?: string) {}
  async fetchQuotes(products: string[]): Promise<MarketQuote[]> {
    return products.map((p) => ({
      product: p,
      hubAHighestBuy: fakePrice(`${p}-ja-buy`) + 100,
      hubALowestSell: fakePrice(`${p}-ja-sell`) + 220,
      hubBHighestBuy: fakePrice(`${p}-jb-buy`) + 110,
      hubBLowestSell: fakePrice(`${p}-jb-sell`) + 600,
      status: this.apiKey ? 'ok' : 'missing-api-key',
    }));
  }
}

export const decisionForQuote = (q: MarketQuote) => {
  if (q.hubBLowestSell === undefined || q.hubAHighestBuy === undefined) return 'Unknown';
  return q.hubBLowestSell > q.hubAHighestBuy ? 'Sell in Hub B' : 'Make P2';
};
