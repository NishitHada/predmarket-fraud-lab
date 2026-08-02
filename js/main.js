/* =========================================================================
   main.js — wiring: game loop, controls, scenario buttons.
   ========================================================================= */

let loopTimer = null;

function tickOnce() {
  if (!G.running || G.market.status === 'resolved') return;
  G.tick++;
  G.volThisTick = 0;

  botTick();
  if (storyActive()) storyTick();
  stepScenarios();

  // sample price + volume for the chart
  G.priceHistory.push({ tick: G.tick, price: G.market.lastPrice, vol: G.volThisTick });
  if (G.priceHistory.length > 600) G.priceHistory.shift();

  surveillanceTick();

  // scheduled honest resolution when the clock runs out (sandbox only)
  if (!storyActive() && G.tick >= G.resolveAt && G.market.status === 'open') {
    resolveHonest();
    surveillanceOnResolve();
  }
  renderAll();
}

function startLoop() {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(tickOnce, G.speedMs);
}

function buildScenarioButtons() {
  const cats = {
    trade: '#cat-trade', structure: '#cat-structure', oracle: '#cat-oracle', operator: '#cat-operator',
  };
  Object.values(SCENARIOS).forEach(s => {
    const wrap = document.querySelector(cats[s.category]);
    if (!wrap) return;
    const card = el('div', 'attack');
    const btn = el('button', 'atk-btn', s.name);
    btn.onclick = () => { launch(s.id); renderAll(); };
    card.appendChild(btn);
    const info = el('div', 'atk-info');
    const what = el('div', 'atk-what'); what.innerHTML = '<b>What:</b> ' + s.what;
    const how = el('div', 'atk-how'); how.innerHTML = '<b>Caught by:</b> ' + s.how;
    info.appendChild(what); info.appendChild(how);
    card.appendChild(info);
    wrap.appendChild(card);
  });
}

function resetSim() {
  clearInterval(loopTimer);
  // wipe state
  Object.assign(G, {
    tick: 0, running: true, fairValue: 55,
    newsSchedule: [], book: { bids: [], asks: [] }, trades: [], traders: {}, order: [],
    events: [], alerts: [], scenarios: [], attackLog: [], priceHistory: [],
    volThisTick: 0, nextOrderId: 1, nextTradeId: 1,
    nowPlaying: null, markers: [], toast: null, lastActor: null, attackImpact: null,
    flags: { withdrawalsFrozen: false, feeBps: 15, operatorConceals: true },
  });
  G.market = { question: G.market.question, status: 'open', lastPrice: 55, outcome: null, resolutionNote: '' };
  $('#resnote').style.display = 'none';
  initTraders();
  // seed a couple of ticks so the book isn't empty
  for (let i = 0; i < 3; i++) tickOnce();
  renderAll();
  startLoop();
}

function wireControls() {
  $('#pause').onclick = () => {
    G.running = !G.running;
    $('#pause').textContent = G.running ? '⏸ Pause' : '▶ Resume';
  };
  $('#step').onclick = () => { const r = G.running; G.running = true; tickOnce(); G.running = r; };
  $('#reset').onclick = resetSim;
  $('#speed').oninput = e => {
    G.speedMs = 1100 - Number(e.target.value); // slider: right = faster
    startLoop();
  };
  $('#resolve-honest').onclick = () => { resolveHonest(); surveillanceOnResolve(); renderAll(); };
  $('#resolve-yes').onclick = () => { resolveCorrupt('YES'); surveillanceOnResolve(); renderAll(); };
  $('#resolve-no').onclick = () => { resolveCorrupt('NO'); surveillanceOnResolve(); renderAll(); };

  $('#story-mode').onclick = () => storyStart();
  $('#exit-story').onclick = () => storyExit();
}

/* ------------------------- your trading desk -------------------------- */
let selectedQty = 50;

function wireDesk() {
  document.querySelectorAll('.qbtn').forEach(btn => {
    btn.onclick = () => {
      selectedQty = Number(btn.dataset.q);
      document.querySelectorAll('.qbtn').forEach(b => b.classList.toggle('sel', b === btn));
    };
  });
  document.querySelector('.qbtn[data-q="50"]').classList.add('sel');

  $('#buy-yes').onclick = () => youTrade('buy');
  $('#buy-no').onclick = () => youTrade('sell');
  $('#close-pos').onclick = () => {
    const y = trader('YOU');
    if (y.shares === 0) { flashToast('You have no position to close.', 'warn'); return; }
    youTrade(y.shares > 0 ? 'sell' : 'buy', Math.abs(y.shares), true);
  };
}

// side 'buy' = Buy YES (go long); side 'sell' = Buy NO (go short YES).
function youTrade(side, qtyOverride, isClose) {
  if (G.market.status !== 'open') { flashToast('Market is ' + G.market.status + '.', 'warn'); return; }
  const qty = qtyOverride || selectedQty;
  const before = Math.round(G.market.lastPrice);
  const a = bestAsk(), b = bestBid();
  const limit = side === 'buy'
    ? Math.min(99, (a ? a.price : before) + 5)   // marketable buy (sweeps up to 5¢ through)
    : Math.max(1, (b ? b.price : before) - 5);   // marketable sell
  const res = placeOrder('YOU', side, limit, qty, 'you');

  if (res.blocked) {
    flashToast('🚫 Withdrawals are frozen — the operator won\'t let you sell. That\'s the exit-scam.', 'bad');
    renderAll(); return;
  }
  const filled = res.order ? res.order.filled : 0;
  if (!filled) { flashToast('No liquidity available to fill that order.', 'warn'); renderAll(); return; }

  const after = Math.round(G.market.lastPrice);
  const avg = res.fills.reduce((s, f) => s + f.price * f.qty, 0) / filled;
  const label = isClose ? 'Closed' : (side === 'buy' ? 'Bought ' + filled + ' YES' : 'Bought ' + filled + ' NO');
  const priceTxt = side === 'buy' ? Math.round(avg) + '¢' : (100 - Math.round(avg)) + '¢';
  const moveTxt = after !== before ? ` Your order moved the market ${before}→${after}¢.` : '';
  flashToast(`${label} @ ~${priceTxt}.${moveTxt}`, 'info');
  renderAll();
}

let toastTimer = null;
function flashToast(msg, kind) {
  toast(msg, kind);
  renderToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { G.toast = null; renderToast(); }, 3400);
}

window.addEventListener('DOMContentLoaded', () => {
  initTraders();
  buildScenarioButtons();
  wireControls();
  wireDesk();
  for (let i = 0; i < 4; i++) tickOnce();
  renderAll();
  startLoop();
});
