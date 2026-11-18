# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/ajidasidiq/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/ajidasidiq/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A long-only swing bot that trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute on-chain bars, built for make.fun's "Race a BTC trading bot live for 24 hours" bounty. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC.

## Strategy

On a thin, noisy 1-minute pool, sharp intraday drops bounce. The bot sits in cash and waits for price to fall 1.2% or more below its 2-hour high, then waits for the fall to stop — price 0.3% recovered off its 15-minute low, so it never catches a falling knife mid-drop — buys with the whole cash balance, then sells the whole position at +1.0% from the fill or cuts it at -1.2%. No trend chasing, no averaging down, at most one open position, a handful of trades a day. Every decision is a pure function of the bars seen so far, so two runs on the same window answer identically.

Local dev-window grade (kit `grade-local`): **net PnL +9.84 USDC, 2 trades, 100% win rate, max drawdown 0.65%**, guardrails met.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) and runs on Node 22 with the standard library only, plus the vendored protocol shim under `vendor/`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
