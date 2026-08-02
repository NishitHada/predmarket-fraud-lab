/* =========================================================================
   engine.js — core prediction-market simulation
   - Binary market: YES contract priced 1..99 cents (= implied probability %).
   - Central limit order book (CLOB) with price/time priority.
   - Positions may go long or short; cash settles at resolution.
   - Everything is fake money. This is a teaching sandbox for market abuse.
   ========================================================================= */

const APP_VERSION = 'v0.6';   // shown in footer; keep the ?v=N script tags in sync on release

const G = {
  tick: 0,
  running: true,
  speedMs: 750,          // ms per tick
  resolveAt: 320,        // tick at which the market is scheduled to resolve
  fairValue: 55,         // "true" probability the bots gravitate toward (drifts)
  newsSchedule: [],      // [{tick, delta, label}] planned fair-value jumps
  market: {
    question: 'Will Company X announce a stock split before the deadline?',
    status: 'open',      // 'open' | 'frozen' | 'resolved'
    lastPrice: 55,
    outcome: null,       // 'YES' | 'NO'
    resolutionNote: '',
  },
  book: { bids: [], asks: [] },   // order: {id, side, price, qty, filled, traderId, tick, tag}
  trades: [],                     // {id, price, qty, buyerId, sellerId, tick, tag}
  traders: {},                    // id -> trader
  order: [],                      // display order of trader ids
  events: [],                     // surveillance log
  alerts: [],                     // raised alerts
  scenarios: [],                  // active scenario objects with step(tick)
  attackLog: [],                  // attacker's-eye narration
  priceHistory: [],               // {tick, price, vol}
  flags: {
    withdrawalsFrozen: false,
    feeBps: 15,
    operatorConceals: true,
  },
  volThisTick: 0,
  nextOrderId: 1,
  nextTradeId: 1,
  START_CASH: 100000,
  nowPlaying: null,        // {category, title, note, actor, startTick} — active scripted attack
  attackImpact: null,      // {base, name, startTick} — measures an attack's effect on YOUR wealth
  markers: [],             // chart annotations {tick, price, label, color}
  toast: null,             // transient message to the user {msg, kind, tick}
  lastActor: null,         // id of the trader that most recently acted (for UI highlight)
};

/* ----------------------------- traders -------------------------------- */

function makeTrader(id, name, kind, opts = {}) {
  const t = {
    id, name, kind,
    cash: opts.cash != null ? opts.cash : G.START_CASH,
    shares: 0,
    ownerId: opts.ownerId || id,   // shared owner => sybil / self-dealing
    color: opts.color || '#8aa',
    hidden: !!opts.hidden,         // not shown on the public leaderboard
    feesCollected: 0,
    flags: new Set(),
    startCash: opts.cash != null ? opts.cash : G.START_CASH,
  };
  G.traders[id] = t;
  if (!opts.noDisplay) G.order.push(id);
  return t;
}

function trader(id) { return G.traders[id]; }

// wealth marked to current price (position closed at lastPrice)
function markWealth(t) { return t.cash + t.shares * G.market.lastPrice; }
// settlement wealth once outcome known
function settleValue(outcome) { return outcome === 'YES' ? 100 : 0; }

function logEvent(e) { e.tick = G.tick; G.events.push(e); if (G.events.length > 4000) G.events.splice(0, 1000); }
function attack(msg) { G.attackLog.unshift({ tick: G.tick, msg }); if (G.attackLog.length > 60) G.attackLog.pop(); }

/* --------------------------- order book -------------------------------- */

function sortBook() {
  // bids: highest price first, then oldest first; asks: lowest price first
  G.book.bids.sort((a, b) => b.price - a.price || a.tick - b.tick || a.id - b.id);
  G.book.asks.sort((a, b) => a.price - b.price || a.tick - b.tick || a.id - b.id);
}
function bestBid() { return G.book.bids[0]; }
function bestAsk() { return G.book.asks[0]; }
function midPrice() {
  const b = bestBid(), a = bestAsk();
  if (b && a) return (b.price + a.price) / 2;
  return G.market.lastPrice;
}

function executeTrade(buyerId, sellerId, price, qty, tag) {
  const buyer = trader(buyerId), seller = trader(sellerId);
  buyer.cash -= price * qty; buyer.shares += qty;
  seller.cash += price * qty; seller.shares -= qty;

  // trading fee skimmed to the operator (rigged-fee attack tunes feeBps)
  const op = trader('OPERATOR');
  if (op && G.flags.feeBps > 0) {
    const fee = Math.round(price * qty * G.flags.feeBps / 10000);
    buyer.cash -= fee; seller.cash -= fee; op.cash += 2 * fee; op.feesCollected += 2 * fee;
  }

  // wash / self-dealing detection tag
  let finalTag = tag;
  if (buyer.ownerId === seller.ownerId) finalTag = (tag ? tag + '+' : '') + 'self';

  const tr = { id: G.nextTradeId++, price, qty, buyerId, sellerId, tick: G.tick, tag: finalTag };
  G.trades.push(tr);
  if (G.trades.length > 3000) G.trades.splice(0, 800);
  G.market.lastPrice = price;
  G.volThisTick += qty;
  logEvent({ type: 'trade', price, qty, buyerId, sellerId, tag: finalTag });
  return tr;
}

// Place a limit order; crosses the book immediately, rests the remainder.
// Returns {order, fills:[...]}. Selling/withdrawing is blocked for the public
// when the operator freezes withdrawals.
function placeOrder(traderId, side, price, qty, tag) {
  const t = trader(traderId);
  price = Math.max(1, Math.min(99, Math.round(price)));
  qty = Math.max(1, Math.round(qty));
  if (G.market.status !== 'open') return { order: null, fills: [] };
  if (G.flags.withdrawalsFrozen && side === 'sell' && (t.kind === 'retail' || t.kind === 'you')) {
    // users (including YOU) can't exit while the operator has frozen withdrawals
    return { order: null, fills: [], blocked: true };
  }
  G.lastActor = traderId;

  const order = { id: G.nextOrderId++, side, price, qty, filled: 0, traderId, tick: G.tick, tag };
  logEvent({ type: 'place', side, price, qty, traderId, orderId: order.id, tag });

  const fills = [];
  if (side === 'buy') {
    sortBook();
    while (order.qty > order.filled && G.book.asks.length && bestAsk().price <= price) {
      const ask = bestAsk();
      const q = Math.min(order.qty - order.filled, ask.qty - ask.filled);
      executeTrade(traderId, ask.traderId, ask.price, q, tag);
      order.filled += q; ask.filled += q;
      fills.push({ price: ask.price, qty: q, against: ask.traderId });
      if (ask.filled >= ask.qty) G.book.asks.shift();
    }
    if (order.qty > order.filled) G.book.bids.push(order);
  } else {
    sortBook();
    while (order.qty > order.filled && G.book.bids.length && bestBid().price >= price) {
      const bid = bestBid();
      const q = Math.min(order.qty - order.filled, bid.qty - bid.filled);
      executeTrade(bid.traderId, traderId, bid.price, q, tag);
      order.filled += q; bid.filled += q;
      fills.push({ price: bid.price, qty: q, against: bid.traderId });
      if (bid.filled >= bid.qty) G.book.bids.shift();
    }
    if (order.qty > order.filled) G.book.asks.push(order);
  }
  sortBook();
  return { order, fills };
}

function cancelOrder(orderId) {
  for (const side of ['bids', 'asks']) {
    const i = G.book[side].findIndex(o => o.id === orderId);
    if (i >= 0) {
      const o = G.book[side][i];
      G.book[side].splice(i, 1);
      logEvent({ type: 'cancel', orderId, traderId: o.traderId, side: o.side, price: o.price,
                 qty: o.qty, filled: o.filled, ageT: G.tick - o.tick });
      return o;
    }
  }
  return null;
}

function cancelAllFor(traderId, tagPrefix) {
  const ids = [];
  for (const side of ['bids', 'asks'])
    for (const o of G.book[side])
      if (o.traderId === traderId && (!tagPrefix || (o.tag || '').startsWith(tagPrefix))) ids.push(o.id);
  ids.forEach(cancelOrder);
  return ids.length;
}

/* --------------------------- resolution -------------------------------- */

function resolveMarket(outcome, note) {
  if (G.market.status === 'resolved') return;
  // clear the book
  G.book.bids = []; G.book.asks = [];
  const val = settleValue(outcome);
  for (const id of Object.keys(G.traders)) {
    const t = trader(id);
    t.finalPosition = t.shares;   // remember position before it settles to 0
    t.cash += t.shares * val;
    t.shares = 0;
  }
  G.market.status = 'resolved';
  G.market.outcome = outcome;
  G.market.resolutionNote = note || '';
  G.market.lastPrice = val;
  logEvent({ type: 'resolve', outcome, note });
  attack('MARKET RESOLVED ' + outcome + (note ? ' — ' + note : ''));
}

// time-weighted average YES price over the recent life of the market — the
// "market consensus" that an honest oracle should broadly agree with.
function consensusPrice(lookback = 120) {
  const hist = G.priceHistory.filter(p => p.tick >= G.tick - lookback);
  if (!hist.length) return G.market.lastPrice;
  return hist.reduce((s, p) => s + p.price, 0) / hist.length;
}

/* -------------------- narration / user helpers ------------------------ */

// A scripted attack announces itself; the UI shows a plain-English play-by-play.
function setPlay(category, title, actor) {
  G.nowPlaying = { category, title, note: '', actor, startTick: G.tick };
}
function say(note) { if (G.nowPlaying) G.nowPlaying.note = note; }
function endPlay() { G.nowPlaying = null; G.lastActor = null; }

// Drop a labelled marker on the price chart at the current point.
function mark(label, color) {
  G.markers.push({ tick: G.tick, price: G.market.lastPrice, label, color });
  if (G.markers.length > 60) G.markers.shift();
}

function toast(msg, kind) { G.toast = { msg, kind: kind || 'info', tick: G.tick, time: Date.now() }; }

// YOU: current wealth (marked to price while open, settled once resolved).
function youWealth() {
  const y = trader('YOU');
  return G.market.status === 'resolved' ? y.cash : markWealth(y);
}

// snapshot YOUR wealth so we can show what a given attack did to your position
function markAttackImpact(name) {
  G.attackImpact = { base: youWealth(), name, startTick: G.tick };
}

window.G = G;
