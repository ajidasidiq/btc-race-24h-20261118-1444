// Amba BTC dip bot — a long-only swing trader for the make.fun cbBTC race.
//
// Idea: on a thin, noisy 1-minute pool, sharp intraday drops bounce. The bot
// sits in cash, waits for price to fall a clear distance below its recent
// high, waits for the fall to stop (a small recovery off the recent low, so it
// never catches a falling knife mid-drop), buys with the whole cash balance,
// then sells the whole position on a fixed bounce or a fixed stop. No trend
// chasing, no averaging down, at most one open position, a handful of trades
// a day. Every decision is a pure function of the bars seen so far, so two
// runs on the same window answer identically.
//
// Costs per full-size round trip are roughly 26 bps (4 bps fee + 2 bps
// slippage + ~10 bps of pool impact each way), so the entry bar (1.2% dip)
// and the exit bar (+2.0% bounce) are set far above that.

import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch, OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// Strategy parameters (fractions of price).
const LOOKBACK_BARS = 120; // 2h high the dip is measured against
const DROP = 0.012; // buy only 1.2% or more below that high
const RECENT_LOW_BARS = 15; // window for the "has it stopped falling" check
const RECOVERY = 0.003; // ... and 0.3% recovered off that low
const TAKE_PROFIT = 0.02; // sell at +2.0% from the fill price: the dev window's
// winning dip-bounce ran to about +2.2% before fading, so a 1.0% target was
// leaving half the move on the table; 2.0% keeps clear headroom below that peak
const STOP_LOSS = 0.012; // sell at -1.2% from the fill price
const EXIT_AFTER_BARS = 1400; // stop entering, exit if held, near the end
const MAX_SLIPPAGE_BPS = 150; // 1.5% — a 1-minute gap that big never happens here
const MIN_CASH_UNITS = 1_000_000n; // 1 USDC

// Running state, all derived from the batches the harness sends.
const closes: number[] = []; // closes in USDC per BTC, oldest first
let barsSeen = 0;
let entryPrice: number | null = null; // fill price of the open position, if any

function priceScale(state: BarsState): number {
  const sym = state.symbols.get(SYMBOL);
  return sym === undefined ? 8 : sym.price_scale;
}

function closeOf(state: BarsState): number | null {
  const bar = state.latest.get(SYMBOL);
  if (bar === undefined) return null;
  return Number(BigInt(bar.c)) / 10 ** priceScale(state);
}

function positionQty(state: BarsState): bigint {
  return state.positions.get(SYMBOL)?.qty ?? 0n;
}

function decide(state: BarsState, batch: Batch): OrderInput[] {
  // Fold this batch's fills into the entry-price tracking first: a buy that
  // filled on this bar's open sets the cost basis; a sell clears it.
  const scale = priceScale(state);
  for (const fill of batch.fills) {
    if (fill.symbol !== SYMBOL) continue;
    if (fill.side === "buy" && fill.status === "filled") {
      entryPrice = Number(BigInt(fill.price)) / 10 ** scale;
    } else if (fill.side === "sell" && fill.status === "filled") {
      entryPrice = null;
    }
  }

  const close = closeOf(state);
  if (close !== null) {
    closes.push(close);
    barsSeen += 1;
  }
  if (state.warmingUp) return [];

  const qty = positionQty(state);
  if (qty === 0n) entryPrice = null;

  // Near the end of the window: never open, and close anything still held
  // (the harness would flatten it at the last close anyway, at the same cost;
  // selling a little early avoids holding into the final mark).
  if (barsSeen >= EXIT_AFTER_BARS) {
    if (qty > 0n) {
      return [{ side: "sell", symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  if (closes.length < LOOKBACK_BARS + 2 || close === null) return [];

  if (qty === 0n) {
    // Flat: look for a confirmed dip.
    if (state.cash < MIN_CASH_UNITS) return [];
    let high = -Infinity;
    for (let i = closes.length - LOOKBACK_BARS - 1; i < closes.length - 1; i += 1) {
      if (closes[i]! > high) high = closes[i]!;
    }
    if (close / high - 1 > -DROP) return [];
    let low = Infinity;
    for (let i = closes.length - RECENT_LOW_BARS; i < closes.length; i += 1) {
      if (closes[i]! < low) low = closes[i]!;
    }
    if (close / low - 1 < RECOVERY) return [];
    return [{ side: "buy", symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }

  // In a position: take the bounce, or cut the loss. If the fill record was
  // somehow missed, fall back to the position's cost basis as the entry.
  let entry = entryPrice;
  if (entry === null) {
    const pos = state.positions.get(SYMBOL);
    if (pos !== undefined && pos.qty !== 0n) {
      entry = (Number(BigInt(pos.cost_quote_units)) * 100) / Number(BigInt(pos.qty));
    }
  }
  if (entry === null) return [];
  const ret = close / entry - 1;
  if (ret >= TAKE_PROFIT || ret <= -STOP_LOSS) {
    return [{ side: "sell", symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({
  onBatch(state, batch) {
    return decide(state, batch);
  },
});
