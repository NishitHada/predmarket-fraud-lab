# Prediction Market Fraud Lab

An interactive, **fully simulated** binary prediction market (Kalshi/Polymarket-style)
built to demonstrate the fraud and manipulation vectors that threaten real markets —
and how a surveillance desk tries to catch them.

Everything is fake: fake money, fake accounts, fake bots. No external services, no
real trading, no build step. Pure client-side HTML/CSS/vanilla JS.

## Run it

```bash
python3 -m http.server 8777 --directory /Users/nishithada/claude_code/predmarket-fraud-lab
```

Then open http://localhost:8777 — or just double-click `index.html`.

## Two ways to play

**🎮 Story Mode — "Can you beat the house?"** (the header button). A guided 3-round game
where you bet real (fake) money on markets that look completely normal — a rocket with huge
volume, an 86%-certain "sure thing," a clean coin-flip you're early on. You lose all three.
Then each round's **reveal** shows exactly who took your money and how:

1. **Pump & dump + wash trading** — the "momentum" and volume were faked by one whale and its
   sock-puppets; the moment you bought, they dumped on you.
2. **Oracle capture** — the crowd was right, but the operator controls the settlement and ruled
   the other way; an insider who knew was on the other side of your bet.
3. **Exit scam** — fees were secretly cranked ~20×, and when you tried to sell, withdrawals were
   frozen while the operator dumped its own bag.

The rig **targets you, not a fixed outcome**: whichever side you pick, the operator/insider
takes the other and the market settles against you. Buy YES and they dump on you and resolve NO;
buy NO and they squeeze the shorts and resolve YES. Fading the crowd is just a different way to
lose — which is the real lesson about a market where one party controls both the price and the
settlement. Each reveal's "gotcha" line explains exactly how your specific choice was beaten.

Each reveal includes an **animated replay** of the round: the price path plays back with a
scrubber and annotated markers (fake pump → your entry → the dump/squeeze → resolution), with a
green "YOU" marker pinned exactly where you entered — so you can see the moment you got played.

The point it drives home: *manipulation is invisible from the inside*. During play the
surveillance/attacker panels are hidden — you only see the con after it's beaten you.

**🔬 Free Sandbox** (default). Everything below — trigger any attack yourself and watch the
surveillance desk try to catch it.

## You're a trader, not a spectator

The **Your Desk** panel (top-left) puts you in the market:

- **Buy YES** if you think the event happens, **Buy NO** if you don't. Pick a bet size first.
- The panel always shows, in plain dollars, **what you make/lose if it resolves YES vs NO** —
  so you can see your risk before anything happens.
- Your orders actually hit the book and **move the price** (a toast tells you when they do).
- Then launch an attack and watch your P&L move in real time — you can get pumped-and-dumped,
  front-run, locked out of withdrawals, or wiped by a corrupt resolution, just like a real user.

Every attack narrates itself in the **banner** at the top: what's happening, **who** is doing it
(highlighted in the "Who's Who" list as *acting now*), and why — with markers dropped on the chart.

## What you're looking at

- **Market** — a binary YES/NO question. The YES contract trades 1–99¢, which reads
  directly as the implied probability (%). A central limit order book matches trades
  by price/time priority.
- **Bots** — two honest market makers quote around a drifting "fair value"; a retail
  crowd trades with noise + a momentum bias (so a pump can actually recruit chasers).
- **Attack Console** — one click launches a real manipulation *against the live book*.
  Each card explains **what** the abuse is and **how** it's caught.
- **Surveillance Alerts** — an independent detector watching the same tape. It doesn't
  read the attack scripts; it raises alerts from the order flow itself.
- **Attacker Log** — the manipulator's-eye narration of what they're doing.
- **Traders** — live leaderboard (wealth = cash + position). Flagged accounts glow red.

The point is the **cat-and-mouse**: watch who profits, and whether the regulator catches it.

## The manipulation playbook

| Category | Attack | The trick | Detection signal |
|---|---|---|---|
| Trade-based | Wash trading | One entity trades with itself via two accounts to fake volume | Buyer & seller share a beneficial owner (self-trades) |
| Trade-based | Spoofing / layering | Big fake orders create false pressure, canceled before filling | Large orders canceled fast, unfilled, while trading the other side |
| Trade-based | Pump & dump | Ignite momentum with aggressive buys, then dump on chasers | One account dominates volume; price spikes then reverses |
| Trade-based | Marking the close | Nudge the closing print on thin volume | Single-actor directional pressure in the closing window |
| Structure | Insider trading | Load up right before non-public news | Outsized position ramp immediately before a directional event |
| Structure | Operator front-running | House trades ahead of a large customer order | Operator trade just before a large opposite-side order |
| Structure | Sybil / fake consensus | Many look-alike accounts fake broad demand | Multiple accounts, one owner, acting in concert |
| Oracle | Insider loads the wrong side + corrupt resolve | Short the market, then rig the settlement | Outcome contradicts market consensus + contrarian beneficiary |
| Operator | Rigged fees | Silently raise trading fees ~20× | Fee-parameter change + spike in operator revenue |
| Operator | Freeze withdrawals + exit | Lock users out, then dump the house book | Withdrawals frozen while operator net-sells |
| Operator | Hidden operator position | The "neutral" house takes a directional bet | Any nonzero operator position |

### Suggested walkthrough for the oracle attack (the big one)

1. Reset. Let the market settle a bit.
2. **Oracle → "Insider loads the wrong side"** — the crowd turns bullish (market ~70¢
   YES) while the Insider quietly builds a large short.
3. **Oracle → "Corrupt → NO"** — the operator overrides the market and settles NO.
4. Watch the Insider's PnL jump and the surveillance desk flag *"Suspicious resolution
   (oracle manipulation)"*, naming the contrarian beneficiary. This — capturing the
   settlement source — is the single most damaging attack on real prediction markets.

## Files

- `index.html` / `styles.css` — shell and layout
- `js/engine.js` — order book, matching, positions, settlement
- `js/bots.js` — honest market makers + retail crowd
- `js/scenarios.js` — the manipulation playbook
- `js/surveillance.js` — independent abuse detection
- `js/ui.js` — chart, book, tape, leaderboard, alerts
- `js/main.js` — game loop and controls

## Note

This is a teaching sandbox for understanding market abuse and surveillance. It models
attacks so they can be recognized and defended against — nothing here is advice or a
tool for use against a real market.
