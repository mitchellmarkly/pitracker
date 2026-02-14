import { YieldLog } from "../types";
import { n, parseMaybeDate } from "./utils";

export function parseYieldPaste(text: string, fallbackDate: string): Omit<YieldLog, "id">[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: Omit<YieldLog, "id">[] = [];

  for (const line of lines) {
    const parts = line
      .split(/\t|,/)
      .map((p) => p.trim())
      .filter(Boolean);

    let date = fallbackDate;
    let product = "";
    let amount: number | null = null;

    if (parts.length >= 2) {
      const maybeDate = parseMaybeDate(parts[0]);
      if (maybeDate) {
        date = maybeDate;
        amount = n(parts[parts.length - 1]);
        product = parts.slice(1, parts.length - 1).join(" ");
      } else {
        amount = n(parts[parts.length - 1]);
        product = parts.slice(0, parts.length - 1).join(" ");
      }
    } else {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const maybeDate = parseMaybeDate(tokens[0]);
        if (maybeDate) {
          date = maybeDate;
          amount = n(tokens[tokens.length - 1]);
          product = tokens.slice(1, tokens.length - 1).join(" ");
        } else {
          let idx = -1;
          for (let i = tokens.length - 1; i >= 0; i--) {
            if (n(tokens[i]) !== null) {
              idx = i;
              break;
            }
          }
          if (idx >= 1) {
            amount = n(tokens[idx]);
            product = tokens.slice(0, idx).join(" ");
          }
        }
      }
    }

    if (!product || amount === null) continue;
    out.push({ Date: date, Product: product, Amount: amount });
  }

  return out;
}
