/* =========================================================================
   bots.js — honest background participants that make the market "live"
   - Market makers quote around fair value (provide liquidity).
   - Retail traders take liquidity with noise + a momentum bias (so a
     pump-and-dump can actually recruit followers).
   ========================================================================= */

function initTraders() {
  // YOU — the human player
  makeTrader('YOU', 'YOU', 'you', { color: '#5bd6c0' });

  // House / infra
  makeTrader('OPERATOR', 'Platform (operator)', 'operator', { color: '#e0b341', ownerId: 'house' });

  // Honest liquidity
  makeTrader('MM1', 'MarketMaker-A', 'mm', { color: '#5bd6c0' });
  makeTrader('MM2', 'MarketMaker-B', 'mm', { color: '#5bd6c0' });

  // Honest retail crowd
  const retailNames = ['Ava', 'Ben', 'Chloe', 'Dev', 'Erin', 'Finn', 'Gia', 'Hugo'];
  retailNames.forEach((n, i) =>
    makeTrader('R' + i, n, 'retail', { color: '#8ea2c6' }));

  // Bad actors (created now, dormant until a scenario activates them)
  makeTrader('WHALE', 'WhaleFund', 'manipulator', { color: '#ef6f6c', cash: 400000 });
  makeTrader('SOCK_A', 'acct_9f2', 'manipulator', { color: '#c96', ownerId: 'shadow' });
  makeTrader('SOCK_B', 'acct_1a7', 'manipulator', { color: '#c96', ownerId: 'shadow' });
  makeTrader('SOCK_C', 'acct_4e0', 'manipulator', { color: '#c96', ownerId: 'shadow' });
  makeTrader('INSIDER', 'Insider', 'insider', { color: '#c07de0', cash: 300000 });
}

function recentReturn(win) {
  const h = G.priceHistory;
  if (h.length < win + 1) return 0;
  return h[h.length - 1].price - h[h.length - 1 - win].price;
}

function botTick() {
  if (G.market.status !== 'open') return;

  // Fair value random walk + scheduled "news" jumps.
  const news = G.newsSchedule.filter(n => n.tick === G.tick);
  news.forEach(n => {
    G.fairValue = Math.max(3, Math.min(97, G.fairValue + n.delta));
    attack('NEWS→public: ' + n.label + ' (fair value ' + (n.delta > 0 ? '+' : '') + n.delta + ')');
  });
  G.fairValue += (Math.random() - 0.5) * 1.2;
  G.fairValue = Math.max(3, Math.min(97, G.fairValue));

  // --- Market makers: refresh a two-sided quote around fair value ---
  for (const mm of ['MM1', 'MM2']) {
    cancelAllFor(mm, 'mm');
    const spread = 2 + Math.round(Math.random() * 2);
    const skew = (Math.random() - 0.5) * 1.5;
    const bid = Math.round(G.fairValue - spread + skew);
    const ask = Math.round(G.fairValue + spread + skew);
    const size = 40 + Math.round(Math.random() * 60);
    placeOrder(mm, 'buy', bid, size, 'mm');
    placeOrder(mm, 'sell', ask, size, 'mm');
  }

  // --- Retail: occasional aggressive orders, noise + momentum ---
  const mom = recentReturn(6);          // recent price change
  for (const id of Object.keys(G.traders)) {
    const t = trader(id);
    if (t.kind !== 'retail') continue;
    if (Math.random() > 0.30) continue;  // most retail idle each tick

    // probability of buying tilts with momentum and cheapness vs fair
    let buyBias = 0.5 + mom * 0.03 + (G.fairValue - G.market.lastPrice) * 0.01;
    buyBias = Math.max(0.15, Math.min(0.85, buyBias));
    const side = Math.random() < buyBias ? 'buy' : 'sell';
    const qty = 3 + Math.round(Math.random() * 12);
    // cross the spread a touch to actually trade
    if (side === 'buy') {
      const a = bestAsk();
      placeOrder(id, 'buy', (a ? a.price : G.market.lastPrice) + 1, qty, 'retail');
    } else {
      const b = bestBid();
      placeOrder(id, 'sell', (b ? b.price : G.market.lastPrice) - 1, qty, 'retail');
    }
  }
}
