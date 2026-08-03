# Prediction Market Fraud Lab — TODO / backlog

Everything here is **discussed but not yet built**, mostly waiting on a decision.
Nothing in this file is live. Current shipped version: see `APP_VERSION` in `js/engine.js`.

Legend: 🟢 ready to build (just say go) · 🟡 needs a design choice from you · 🔵 needs external setup

---

## Awaiting your decision

- 🟢 **Free-trade exit-scam round** — a continuous-trading variant of *just* the exit-scam
  scenario: the market runs live, you can add / reduce / exit throughout, and the
  operator's withdrawal **freeze catches you reaching for the exit**. Contained (doesn't
  touch the adaptive rig or the trade-based traps). *This is the one I offered last.*
- 🟡 **Research dossier gating** — hide the most damning documents (e.g. the position
  disclosure) behind a due-diligence check; keep the free tier to noisy/ambiguous sources.
  (Currently all research is free to read.)
- 🟡 **Subtler tells** — make the coach's green/red flags less on-the-nose so recognising
  them is harder (right now they're fairly explicit).
- 🟡 **"Suspicious contrarian is sometimes legit"** — occasionally the account fading a
  market is genuine smart-money, so acting on that yellow flag sometimes *costs* you.
  Models real uncertainty; risks feeling unfair if overdone.
- 🟡 **Randomise the coach's hyped side per round** — so players can't pattern-match
  "the nudge is always YES."

## More scenarios (from your list — pick any to add)

Each is now ~a 30-line data object thanks to the scenario framework.
- Selective UI / API delay (you see a stale price; insiders act on the live one)
- Last-look / order rejection (your favorable click is rejected; the house's isn't)
- Governance capture (a whale controls the resolution vote)
- Copy-trading trap (a fake "top trader" leaderboard lures followers)
- Influencer / affiliate conflict (a promoter earns on volume / holds the other side)
- Rumor cascade (sybil accounts echo one rumor into false consensus)
- Market-halt asymmetry (only you get halted; insiders still exit)
- Collateral / margin cascade (a small manipulated move forces liquidations)
- Retroactive rule change (fees / eligibility / settlement change after you're in)
- Cross-market manipulation (a small related market is pushed to fake a signal)
- Data poisoning (a "crowd confidence" metric built from manipulated accounts)
- KYC / account-takeover (a compromised trusted account makes a misleading bet)
- Oracle outage at deadline (the source goes down; a fallback favors the house)
- Source-conflict family follow-ons: referee/judge conflict, regulator owns the asset

## Bigger features (from your "ways to make it interesting")

- 🟡 **Trust-score dashboard** — per-market ratings for price / liquidity / settlement /
  platform integrity, shown before you decide.
- 🟡 **Live EV meter** — "expected value of betting now," updating as you uncover clues.
- 🟡 **Surveillance mini-game** — flag the abuse before the automated desk does, then
  compare your reasoning with the detector.
- 🟡 **Evidence locker** — accumulates the filings / timestamps / ownership links you've
  uncovered across a run.
- 🟡 **"Call the fraud" scoring** — reward correct risk identification; penalise false
  accusations (final score = money preserved + risks IDed − false calls).
- 🟡 **Protections-enabled replay** — re-run a lost round with safeguards ON (independent
  oracle, transparent ownership, withdrawal guarantees, fee disclosure) to show the
  different outcome.
- 🔵 **Hall of Fame / high scores / total games / total players** — needs a choice:
  *local-only* (per-browser, private, no "total players") vs *global* (real cross-player
  leaderboard, requires a small free backend you own, e.g. Supabase). Parked as "maybe later."

## Polish / minor (awaiting a nod)

- Move the Order Book to the right column too (leaving only the Desk on the left) if the
  left still feels tight in story mode.
- Replay flourishes — auto-pause on your entry marker; flash red as the dump crosses.
- About / README link in the header; optional custom domain for the Pages site.
- Automate cache-busting to the release version (instead of the manual `?v=N` bump).

---

## Done (recent highlights, for context)

- Story Mode v2: 5 random rounds from a 10-scenario pool (7 traps + 3 clean/winnable),
  walk-away, due-diligence budget, per-round mission, adaptive rig, replay, scoring/grade.
- Guided coach (green/red flags live), game-theory optimal-play blocks + strategy primer.
- Research dossier per scenario; source_conflict scenario (conflicted oracle source).
- Desk per-round P&L fix + tests; coach/DD tips regrounded in observable evidence.
- Deployed on GitHub Pages with a separate Story Mode URL; smoke test 16/16.
