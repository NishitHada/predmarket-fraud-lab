/* =========================================================================
   surveillance.js — the "regulator" watching the same tape
   Runs every tick over recent events and raises alerts. Detection is
   heuristic and independent of the scenario scripts, so you can see the
   cat-and-mouse: some abuse is caught cleanly, some is only caught after
   the fact (e.g. a corrupt resolution).
   ========================================================================= */

const SEV = { low: 1, med: 2, high: 3 };

function raiseAlert(key, severity, title, detail) {
  const existing = G.alerts.find(a => a.key === key && G.tick - a.lastTick < 40);
  if (existing) { existing.count++; existing.lastTick = G.tick; existing.detail = detail; return; }
  G.alerts.unshift({ key, severity, title, detail, tick: G.tick, lastTick: G.tick, count: 1 });
  if (G.alerts.length > 40) G.alerts.pop();
}

function recentEvents(win) { return G.events.filter(e => e.tick >= G.tick - win); }

function surveillanceTick() {
  const W = 20;
  const evs = recentEvents(W);

  // 1) Wash / self-dealing: trades where buyer & seller share an owner.
  const selfTrades = G.trades.filter(t => t.tick >= G.tick - W && (t.tag || '').includes('self'));
  if (selfTrades.length >= 3) {
    const vol = selfTrades.reduce((s, t) => s + t.qty, 0);
    const owner = trader(selfTrades[0].buyerId).ownerId;
    raiseAlert('wash', SEV.high, 'Wash trading / self-dealing',
      `${selfTrades.length} self-trades (${vol} vol) between accounts sharing owner "${owner}". Volume inflated with no change in beneficial ownership.`);
    flag(selfTrades[0].buyerId, 'wash'); flag(selfTrades[0].sellerId, 'wash');
  }

  // 2) Spoofing: large orders canceled fast with zero fills, same actor trading opposite side.
  const cancels = evs.filter(e => e.type === 'cancel' && e.filled === 0 && e.qty >= 150 && e.ageT <= 8);
  const byActor = {};
  cancels.forEach(c => { (byActor[c.traderId] = byActor[c.traderId] || []).push(c); });
  for (const [tid, cs] of Object.entries(byActor)) {
    if (cs.length >= 2) {
      const canceledSide = cs[0].side;
      const oppTrades = G.trades.filter(t => t.tick >= G.tick - W &&
        ((canceledSide === 'buy' && t.sellerId === tid) || (canceledSide === 'sell' && t.buyerId === tid)));
      if (oppTrades.length) {
        raiseAlert('spoof_' + tid, SEV.high, 'Spoofing / layering',
          `${trader(tid).name} canceled ${cs.length} large ${canceledSide} orders unfilled, while trading the opposite side ${oppTrades.length}×. Classic fake-liquidity spoof.`);
        flag(tid, 'spoof');
      }
    }
  }

  // 3) Order-flow concentration + price reversal (pump & dump / momentum ignition).
  const tradesW = G.trades.filter(t => t.tick >= G.tick - W);
  const buyVol = {}, sellVol = {};
  let total = 0;
  tradesW.forEach(t => {
    if (isReal(t.buyerId)) buyVol[t.buyerId] = (buyVol[t.buyerId] || 0) + t.qty;
    if (isReal(t.sellerId)) sellVol[t.sellerId] = (sellVol[t.sellerId] || 0) + t.qty;
    total += t.qty;
  });
  for (const tid of Object.keys(G.traders)) {
    if (trader(tid).kind === 'mm' || trader(tid).kind === 'you') continue;   // never flag the human player as an attacker
    const share = ((buyVol[tid] || 0) + (sellVol[tid] || 0)) / (total || 1);
    if (total > 120 && share > 0.5) {
      raiseAlert('conc_' + tid, SEV.med, 'Order-flow concentration',
        `${trader(tid).name} is ${(share * 100).toFixed(0)}% of recent traded volume — one account should not dominate a "market".`);
      flag(tid, 'concentration');
    }
  }
  // reversal: an actor that heavily bought then heavily sold as price round-tripped
  for (const tid of Object.keys(G.traders)) {
    const b = buyVol[tid] || 0, s = sellVol[tid] || 0;
    if (b > 150 && s > 100 && trader(tid).kind !== 'mm' && trader(tid).kind !== 'you') {
      const move = recentSwing(W);
      if (move.up > 6 && move.down > 5) {
        raiseAlert('pump_' + tid, SEV.high, 'Pump & dump',
          `${trader(tid).name} bought ${b} then sold ${s} as price spiked +${move.up.toFixed(0)} then fell ${move.down.toFixed(0)}. Momentum ignition into a dump.`);
        flag(tid, 'pump&dump');
      }
    }
  }

  // 3b) Single-actor directional pressure (momentum push / marking the close).
  {
    const move = recentReturn(W);
    for (const tid of Object.keys(G.traders)) {
      if (trader(tid).kind === 'mm' || trader(tid).kind === 'you') continue;   // never flag the human player as an attacker
      const net = (buyVol[tid] || 0) - (sellVol[tid] || 0);
      const share = ((buyVol[tid] || 0) + (sellVol[tid] || 0)) / (total || 1);
      if (total > 60 && share > 0.30 && Math.abs(net) > 50 &&
          Math.sign(net) === Math.sign(move) && Math.abs(move) >= 3) {
        const closing = (G.resolveAt - G.tick) <= 40 && G.market.status === 'open';
        raiseAlert('press_' + tid, SEV.med, closing ? 'Marking the close' : 'Single-actor price pressure',
          `${trader(tid).name} pushed price ${move > 0 ? 'up' : 'down'} ${Math.abs(move).toFixed(0)}¢ while ${(share * 100).toFixed(0)}% of the flow${closing ? ' inside the closing window' : ''} — price set by one participant, not a market.`);
        flag(tid, closing ? 'marking-close' : 'price-pressure');
      }
    }
  }

  // 4) Sybil coordination: multiple accounts, same owner, same direction, short window.
  const dirByOwner = {};
  tradesW.forEach(t => {
    tallyOwnerDir(dirByOwner, t.buyerId, +t.qty);
    tallyOwnerDir(dirByOwner, t.sellerId, -t.qty);
  });
  for (const [owner, info] of Object.entries(dirByOwner)) {
    if (info.accounts.size >= 3 && Math.abs(info.net) > 80) {
      raiseAlert('sybil_' + owner, SEV.high, 'Sybil / coordinated accounts',
        `${info.accounts.size} accounts sharing owner "${owner}" traded ${info.net > 0 ? 'net long' : 'net short'} in concert — fake consensus.`);
      info.accounts.forEach(a => flag(a, 'sybil'));
    }
  }

  // 5) Operator conflict of interest: house holds any position.
  const op = trader('OPERATOR');
  if (Math.abs(op.shares) >= 20) {
    raiseAlert('op_pos', SEV.med, 'Operator conflict of interest',
      `The platform operator holds a directional position of ${op.shares} shares. The house is supposed to be neutral.`);
    flag('OPERATOR', 'conflict');
  }

  // 6) Front-running: operator trade immediately before a large opposite retail order.
  const opTrades = tradesW.filter(t => t.buyerId === 'OPERATOR' || t.sellerId === 'OPERATOR');
  const bigRetail = G.trades.filter(t => t.tick >= G.tick - 5 && (t.tag || '').includes('bigretail'));
  if (opTrades.length && bigRetail.length) {
    raiseAlert('frontrun', SEV.high, 'Operator front-running',
      `Operator traded just ahead of a large customer order (${bigRetail.reduce((s, t) => s + t.qty, 0)} shares), capturing the spread from its own user.`);
    flag('OPERATOR', 'front-running');
  }

  // 7) Rigged fees: parameter change.
  const feeChange = evs.find(e => e.type === 'param' && e.key === 'feeBps');
  if (feeChange) {
    raiseAlert('fees', SEV.med, 'Undisclosed fee change',
      `Trading fee changed ${feeChange.from}→${feeChange.to} bps without user consent. Operator fee revenue: ${fmt(op.feesCollected)}.`);
  }

  // 8) Frozen withdrawals while operator sells: exit-scam signature.
  if (G.flags.withdrawalsFrozen) {
    const opSelling = tradesW.some(t => t.sellerId === 'OPERATOR');
    raiseAlert('freeze', SEV.high, 'Withdrawals frozen (exit-scam risk)',
      `User selling/withdrawals are disabled${opSelling ? ' while the operator is net-selling its own book' : ''}. Users cannot exit.`);
  }

  // 9) Insider ramp before scheduled news.
  const upcoming = G.newsSchedule.find(n => n.tick > G.tick && n.tick <= G.tick + 8);
  if (upcoming) {
    for (const tid of Object.keys(G.traders)) {
      const t = trader(tid);
      if (t.kind === 'mm' || t.kind === 'operator') continue;
      const ramp = (buyVol[tid] || 0) - (sellVol[tid] || 0);
      if (Math.abs(ramp) > 120) {
        raiseAlert('insider_' + tid, SEV.high, 'Possible insider trading',
          `${t.name} ramped a ${ramp > 0 ? 'long' : 'short'} position of ${Math.abs(ramp)} shares right before a non-public event. Abnormal pre-news timing.`);
        flag(tid, 'insider');
      }
    }
  }
}

// Post-resolution check: did the outcome contradict market consensus, and who won?
function surveillanceOnResolve() {
  const cons = consensusPrice(45);            // price right before the flip
  const out = G.market.outcome;
  const favored = cons >= 50 ? 'YES' : 'NO';
  const contradicts = out !== favored && Math.abs(cons - 50) > 5;
  if (contradicts) {
    // who profited most, and were they positioned against the market?
    let winner = null, best = -Infinity;
    for (const id of Object.keys(G.traders)) {
      const t = trader(id);
      if (t.kind === 'mm') continue;
      const pnl = t.cash - t.startCash;
      if (pnl > best) { best = pnl; winner = t; }
    }
    const contrarian = winner &&
      ((out === 'NO' && winner.finalPosition < 0) || (out === 'YES' && winner.finalPosition > 0));
    raiseAlert('oracle', SEV.high, 'Suspicious resolution (oracle manipulation)',
      `Market consensus implied ${cons.toFixed(0)}% YES but the operator settled ${out}. ` +
      `Biggest beneficiary: ${winner ? winner.name : '?'} (+${fmt(best)})` +
      (contrarian ? `, who held a large contrarian ${winner.finalPosition < 0 ? 'short' : 'long'} of ${Math.abs(winner.finalPosition)} shares into the resolution` : '') +
      `. Classic oracle capture / corrupt settlement.`);
    if (winner) flag(winner.id, 'oracle-beneficiary');
  }
}

/* ------------------------------ helpers ------------------------------- */
function isReal(id) { const t = trader(id); return t && t.kind !== 'mm'; }
function flag(id, reason) { const t = trader(id); if (t) t.flags.add(reason); }
function fmt(n) { return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

function tallyOwnerDir(map, id, signedQty) {
  const t = trader(id); if (!t) return;
  if (t.ownerId === id) return;         // only grouped (shared-owner) accounts matter
  const o = map[t.ownerId] || (map[t.ownerId] = { accounts: new Set(), net: 0 });
  o.accounts.add(id); o.net += signedQty;
}

function recentSwing(win) {
  const h = G.priceHistory.filter(p => p.tick >= G.tick - win).map(p => p.price);
  if (h.length < 3) return { up: 0, down: 0 };
  let lo = h[0], hi = h[0], peak = h[0], up = 0, down = 0;
  for (const p of h) {
    if (p > peak) peak = p;
    up = Math.max(up, peak - lo);
    down = Math.max(down, peak - p);
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  return { up, down };
}
