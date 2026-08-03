/* =========================================================================
   ui.js — rendering: price chart, order book, tape, leaderboard, alerts.
   Pure read of G; no simulation logic here.
   ========================================================================= */

const $ = sel => document.querySelector(sel);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function money(cents) { return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
function signMoney(cents) { return (cents >= 0 ? '+' : '') + money(cents); }

/* ---------------------------- your desk ------------------------------- */
function renderDesk() {
  const y = trader('YOU');
  const price = Math.round(G.market.lastPrice);
  const a = bestAsk(), b = bestBid();
  $('#you-cash').textContent = money(y.cash);

  const posEl = $('#you-pos');
  if (y.shares === 0) { posEl.textContent = 'No position'; posEl.className = 'posbig flat'; }
  else if (y.shares > 0) { posEl.textContent = y.shares + ' YES'; posEl.className = 'posbig yes'; }
  else { posEl.textContent = (-y.shares) + ' NO'; posEl.className = 'posbig no'; }

  // In story mode, P&L and payouts are per-round: baseline is the round's
  // starting wealth, so a fresh round with no position reads $0 (not the
  // cumulative loss carried from earlier rounds).
  const inStory0 = typeof storyActive === 'function' && storyActive();
  const base = (inStory0 && typeof STORY.state.roundStartWealth === 'number')
    ? STORY.state.roundStartWealth : y.startCash;

  const pnlNow = youWealth() - base;
  const nowEl = $('#you-now');
  nowEl.textContent = (inStory0 ? 'Round P&L: ' : 'P&L now: ') + signMoney(pnlNow);
  nowEl.className = 'posnow ' + (pnlNow >= 0 ? 'up' : 'down');

  const payYes = (y.cash + y.shares * 100) - base;
  const payNo = y.cash - base;
  const py = $('#pay-yes'), pn = $('#pay-no');
  py.textContent = signMoney(payYes); py.className = payYes >= 0 ? 'up' : 'down';
  pn.textContent = signMoney(payNo); pn.className = payNo >= 0 ? 'up' : 'down';

  $('#yes-price').textContent = (a ? a.price : price) + '¢';
  $('#no-price').textContent = (100 - (b ? b.price : price)) + '¢';

  let tradable = G.market.status !== 'resolved';
  if (typeof storyActive === 'function' && storyActive()) tradable = STORY.state.phase === 'bet';
  ['buy-yes', 'buy-no', 'close-pos'].forEach(id => { $('#' + id).disabled = !tradable; });

  // "did that attack actually touch my money?" readout
  const imp = $('#you-impact');
  const inStory = typeof storyActive === 'function' && storyActive();
  if (G.attackImpact && !inStory) {
    const delta = youWealth() - G.attackImpact.base;
    if (y.shares === 0 && Math.abs(delta) < 1) {
      imp.className = 'you-impact hint';
      imp.innerHTML = `⚠️ You had no position when <b>${esc(G.attackImpact.name)}</b> ran — an attack can't touch a wallet that isn't in the market. Buy YES or NO first, then run it again.`;
    } else {
      imp.className = 'you-impact ' + (delta >= 0 ? 'up' : 'down');
      imp.innerHTML = `Effect of <b>${esc(G.attackImpact.name)}</b> on you: <b>${signMoney(delta)}</b>`;
    }
    imp.style.display = 'block';
  } else {
    imp.style.display = 'none';
  }
}

/* text equivalent of the price chart for screen readers (#21) */
function renderChartSR() {
  const sr = $('#chart-sr'); if (!sr) return;
  const h = G.priceHistory;
  const price = Math.round(G.market.lastPrice);
  const change = h.length > 10 ? price - Math.round(h[h.length - 11].price) : 0;
  const vol = h.length ? h[h.length - 1].vol : 0;
  const ev = G.markers.slice(-3).map(m => m.label).join(', ');
  sr.textContent = `Price ${price} cents (${price}% implied YES), ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)} over the last 10 ticks. Recent volume ${vol}.` + (ev ? ` Recent events: ${ev}.` : '');
}

/* --------------------------- lesson card ------------------------------ */
function renderLesson() {
  const box = $('#lesson');
  const inStory = typeof storyActive === 'function' && storyActive();
  const ai = G.attackImpact;
  const s = ai && ai.scenarioId ? SCENARIOS[ai.scenarioId] : null;
  const lz = s && typeof LESSONS !== 'undefined' ? LESSONS[ai.scenarioId] : null;
  if (inStory || !s || !lz) { box.style.display = 'none'; box.innerHTML = ''; return; }

  const y = trader('YOU');
  const delta = youWealth() - ai.base;
  const costLine = (y.shares === 0 && Math.abs(delta) < 1)
    ? `You held no position, so it didn't cost <b>you</b> anything — but everyone in the market who did got hit. (Buy in and re-run to feel it.)`
    : `Your position has moved <b class="${delta >= 0 ? 'up' : 'down'}">${signMoney(delta)}</b> since this began${delta < 0 ? ' — you\'re the one paying for it.' : (delta > 0 ? ' — but this round-trips; hold and watch it reverse.' : '.')}`;

  box.style.display = 'block';
  box.innerHTML = `
    <div class="lesson-head"><span class="lesson-kicker">Anatomy of the con</span>
      <b>${esc(s.name)}</b>
      <button class="lesson-x" aria-label="Dismiss lesson">✕</button></div>
    <div class="lesson-grid">
      <div class="lz"><span class="lz-l ok">What looked legit</span>${lz.looked}</div>
      <div class="lz"><span class="lz-l bad">What was actually rigged</span>${s.what}</div>
      <div class="lz"><span class="lz-l warn">The warning signs</span>${lz.signs}</div>
      <div class="lz"><span class="lz-l cost">What it cost you</span>${costLine}</div>
      <div class="lz wide"><span class="lz-l prot">What would've protected you</span>${lz.protection}</div>
    </div>`;
  box.querySelector('.lesson-x').onclick = () => { G.attackImpact = null; renderAll(); };
}

/* ------------------------------ banner -------------------------------- */
function renderBanner() {
  const e = $('#banner');
  // Story mode keeps the con hidden until the reveal.
  if (typeof storyActive === 'function' && storyActive()) {
    const ph = STORY.state.phase;
    if (ph === 'running') { e.className = 'banner warn'; e.innerHTML = '<span class="pdot"></span>The market is moving fast…'; return; }
    if (ph === 'bet') { e.className = 'banner calm'; e.innerHTML = '<span class="pdot"></span>Your move — place a bet on <b>Your Desk</b>, then lock it in.'; return; }
    e.className = 'banner calm'; e.innerHTML = '&nbsp;'; return;
  }
  if (G.market.status === 'resolved') {
    const y = trader('YOU');
    const pnl = y.cash - y.startCash;
    const youMsg = (pnl === 0)
      ? 'You had no position, so this one didn\'t touch your wallet.'
      : (pnl > 0 ? 'You made ' + money(pnl) + ' 🎉' : 'You lost ' + money(-pnl) + ' 💥');
    e.className = 'banner resolved';
    e.innerHTML = '<b>Resolved ' + G.market.outcome + '.</b> ' + esc(G.market.resolutionNote) +
      ' <span class="youtag">' + youMsg + '</span>';
    return;
  }
  if (G.nowPlaying) {
    const p = G.nowPlaying;
    const who = p.actor && trader(p.actor) ? trader(p.actor).name : '';
    e.className = 'banner play ' + p.category;
    e.innerHTML = '<span class="pdot"></span><b>' + esc(p.title) + '</b>' +
      (who ? ' · <span class="pactor">' + esc(who) + '</span>' : '') +
      ' — ' + esc(p.note || '');
    return;
  }
  if (G.flags.withdrawalsFrozen) {
    e.className = 'banner warn';
    e.innerHTML = '<b>⚠ Withdrawals frozen.</b> Try to sell — you can\'t. This is the operator exit-scam. (Reset to recover.)';
    return;
  }
  if (G.flags.feeBps > 50) {
    e.className = 'banner warn';
    e.innerHTML = '<b>⚠ Fees secretly raised to ' + G.flags.feeBps + ' bps.</b> Every trade now bleeds value to the operator. (Reset to recover.)';
    return;
  }
  // an attack has finished but its breakdown is still on screen — stay consistent
  // (don't snap back to "calm" while the lesson card/logs still show the attack)
  if (G.attackImpact) {
    const y = trader('YOU');
    const delta = youWealth() - G.attackImpact.base;
    const eff = (y.shares !== 0 || Math.abs(delta) >= 1) ? ` Effect on you: <b>${signMoney(delta)}</b>.` : '';
    e.className = 'banner aftermath';
    e.innerHTML = `<span class="pdot"></span><b>${esc(G.attackImpact.name)}</b> ran — read the anatomy below.${eff}`;
    return;
  }
  e.className = 'banner calm';
  e.innerHTML = '<span class="pdot"></span>Market is calm — honest bots trading. Place a bet on <b>Your Desk</b>, then launch an attack and watch what it does to you.';
}

function renderToast() {
  const e = $('#toast');
  if (G.toast && Date.now() - (G.toast.time || 0) < 3500) {
    e.textContent = G.toast.msg; e.className = 'toast show ' + G.toast.kind;
  } else { e.className = 'toast'; }
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

/* ------------------------------- header ------------------------------- */
function renderHeader() {
  $('#question').textContent = G.market.question;
  const price = Math.round(G.market.lastPrice);
  $('#price').textContent = price + '¢';
  $('#prob').textContent = price + '% implied YES';
  const st = $('#status');
  st.textContent = G.market.status.toUpperCase();
  st.className = 'status ' + G.market.status;
  const left = Math.max(0, G.resolveAt - G.tick);
  $('#countdown').textContent = G.market.status === 'resolved'
    ? 'Resolved: ' + G.market.outcome
    : 'Resolves in ' + left + ' ticks';
  if (G.market.resolutionNote) {
    $('#resnote').textContent = G.market.resolutionNote;
    $('#resnote').style.display = 'block';
  }
}

/* ------------------------------- chart -------------------------------- */
function renderChart() {
  const c = $('#chart'); const ctx = c.getContext('2d');
  const w = c.width = c.clientWidth * devicePixelRatio;
  const h = c.height = c.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  const pad = 28 * devicePixelRatio;
  const hist = G.priceHistory;
  // gridlines every 25%
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = (11 * devicePixelRatio) + 'px ui-monospace, monospace'; ctx.lineWidth = 1;
  for (let p = 0; p <= 100; p += 25) {
    const y = h - pad - (p / 100) * (h - 2 * pad);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillText(p + '¢', 2, y + 4 * devicePixelRatio);
  }
  if (hist.length < 2) return;
  const t0 = hist[0].tick, t1 = Math.max(hist[hist.length - 1].tick, t0 + 1);
  const x = t => pad + ((t - t0) / (t1 - t0)) * (w - pad - 4);
  const y = p => h - pad - (p / 100) * (h - 2 * pad);

  // volume bars
  const maxVol = Math.max(10, ...hist.map(p => p.vol));
  hist.forEach(p => {
    const bh = (p.vol / maxVol) * (h - 2 * pad) * 0.28;
    ctx.fillStyle = 'rgba(90,120,200,0.25)';
    ctx.fillRect(x(p.tick) - 1, h - pad - bh, 2, bh);
  });

  // price line
  ctx.beginPath(); ctx.lineWidth = 2 * devicePixelRatio; ctx.strokeStyle = '#5bd6c0';
  hist.forEach((p, i) => { const px = x(p.tick), py = y(p.price); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.stroke();

  // event markers (attacks / news / resolution)
  ctx.font = (10 * devicePixelRatio) + 'px ui-sans-serif, system-ui';
  let lastLabelX = -999;
  G.markers.filter(m => m.tick >= t0 && m.tick <= t1).forEach(m => {
    const mx = x(m.tick), my = y(m.price);
    ctx.strokeStyle = m.color; ctx.globalAlpha = 0.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(mx, pad); ctx.lineTo(mx, h - pad); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(mx, my, 3 * devicePixelRatio, 0, 7); ctx.fill();
    if (mx - lastLabelX > 44 * devicePixelRatio) {   // avoid label pileup
      ctx.fillText(m.label, mx + 3 * devicePixelRatio, pad + 10 * devicePixelRatio);
      lastLabelX = mx;
    }
  });

  // last dot
  const last = hist[hist.length - 1];
  ctx.fillStyle = '#5bd6c0'; ctx.beginPath();
  ctx.arc(x(last.tick), y(last.price), 3 * devicePixelRatio, 0, 7); ctx.fill();

  // resolution marker
  if (G.market.status !== 'resolved' && G.resolveAt <= t1 && G.resolveAt >= t0) {
    ctx.strokeStyle = 'rgba(224,179,65,0.5)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x(G.resolveAt), pad); ctx.lineTo(x(G.resolveAt), h - pad); ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ----------------------------- order book ----------------------------- */
function renderBook() {
  sortBook();
  const box = $('#book'); box.innerHTML = '';
  const asks = G.book.asks.slice(0, 8).reverse();
  const bids = G.book.bids.slice(0, 8);
  const maxSz = Math.max(1, ...[...asks, ...bids].map(o => o.qty - o.filled));
  const row = (o, side) => {
    const r = el('div', 'brow ' + side);
    const bar = el('div', 'depth ' + side);
    bar.style.width = ((o.qty - o.filled) / maxSz * 100) + '%';
    r.appendChild(bar);
    r.appendChild(el('span', 'bp', o.price + '¢'));
    r.appendChild(el('span', 'bq', (o.qty - o.filled)));
    return r;
  };
  asks.forEach(o => box.appendChild(row(o, 'ask')));
  const mid = el('div', 'bmid', 'last ' + Math.round(G.market.lastPrice) + '¢');
  box.appendChild(mid);
  bids.forEach(o => box.appendChild(row(o, 'bid')));
}

/* -------------------------------- tape -------------------------------- */
function renderTape() {
  const box = $('#tape'); box.innerHTML = '';
  G.trades.slice(-14).reverse().forEach(t => {
    const r = el('div', 'trow');
    const b = trader(t.buyerId), s = trader(t.sellerId);
    const wash = (t.tag || '').includes('self');
    r.appendChild(el('span', 'tp', t.price + '¢'));
    r.appendChild(el('span', 'tq', t.qty));
    r.appendChild(el('span', 'tn', b.name + ' ← ' + s.name));
    if (wash) r.appendChild(el('span', 'tag wash', 'self'));
    box.appendChild(r);
  });
}

/* ---------------------------- leaderboard ----------------------------- */
const ROLE = {
  you: 'that\'s you', operator: 'the house — meant to be neutral', mm: 'honest liquidity',
  retail: 'honest everyday trader', manipulator: 'bad actor', insider: 'trades on secret info',
};
function renderTraders() {
  const box = $('#traders'); box.innerHTML = '';
  let rows = G.order.map(id => trader(id))
    .filter(t => !t.hidden)
    .map(t => ({ t, wealth: G.market.status === 'resolved' ? t.cash : markWealth(t) }))
    .sort((a, b) => b.wealth - a.wealth);
  // pin YOU to the top so you can always find yourself
  rows = rows.sort((a, b) => (a.t.id === 'YOU' ? -1 : b.t.id === 'YOU' ? 1 : 0));

  rows.forEach(({ t, wealth }) => {
    const pnl = wealth - t.startCash;
    const acting = G.nowPlaying && G.nowPlaying.actor === t.id;
    const r = el('div', 'lrow' + (t.flags.size ? ' flagged' : '') + (t.id === 'YOU' ? ' you' : '') + (acting ? ' acting' : ''));
    const dot = el('span', 'dot'); dot.style.background = t.color; r.appendChild(dot);
    const nm = el('div', 'lname');
    nm.appendChild(el('span', 'nn', t.name));
    nm.appendChild(el('span', 'kk', ROLE[t.kind] || t.kind));
    if (acting) nm.appendChild(el('span', 'tag acting', 'acting now'));
    if (t.flags.size) t.flags.forEach(f => nm.appendChild(el('span', 'tag flag', f)));
    r.appendChild(nm);
    r.appendChild(el('div', 'lpos', t.shares === 0 ? '—' : (t.shares > 0 ? '+' + t.shares : '' + t.shares)));
    r.appendChild(el('div', 'lpnl ' + (pnl >= 0 ? 'up' : 'down'), signMoney(pnl)));
    box.appendChild(r);
  });
}

/* ----------------------------- alerts/log ----------------------------- */
function renderAlerts() {
  const box = $('#alerts'); box.innerHTML = '';
  if (!G.alerts.length) { box.appendChild(el('div', 'empty', 'No alerts yet. Launch an attack →')); }
  const sevName = { 1: 'low', 2: 'med', 3: 'high' };
  // CONFIRMED = provable from state/definition; SUSPECTED = inferred from patterns
  const confirmedKeys = ['wash', 'op_pos', 'fees', 'freeze', 'frontrun'];
  G.alerts.forEach(a => {
    const confirmed = confirmedKeys.some(k => a.key.startsWith(k));
    const r = el('div', 'alert ' + sevName[a.severity]);
    const head = el('div', 'ahead');
    head.appendChild(el('span', 'sev ' + sevName[a.severity], sevName[a.severity]));
    head.appendChild(el('span', 'conf ' + (confirmed ? 'confirmed' : 'suspected'), confirmed ? 'confirmed' : 'suspected'));
    head.appendChild(el('span', 'atitle', a.title));
    if (a.count > 1) head.appendChild(el('span', 'acount', '×' + a.count));
    r.appendChild(head);
    r.appendChild(el('div', 'adetail', a.detail));
    box.appendChild(r);
  });
}

function renderAttackLog() {
  const box = $('#attacklog'); box.innerHTML = '';
  if (!G.attackLog.length) box.appendChild(el('div', 'empty', 'Attacker actions appear here.'));
  G.attackLog.forEach(a => {
    const r = el('div', 'logrow');
    r.appendChild(el('span', 'lt', 't' + a.tick));
    r.appendChild(el('span', 'lm', a.msg));
    box.appendChild(r);
  });
}

function renderAll() {
  renderHeader(); renderBanner(); renderDesk(); renderLesson(); renderChart(); renderBook(); renderTape();
  renderTraders(); renderAlerts(); renderAttackLog(); renderToast(); renderChartSR();
  $('#tickno').textContent = 't' + G.tick;
  $('#fee').textContent = G.flags.feeBps + ' bps';
  $('#frozen').textContent = G.flags.withdrawalsFrozen ? 'FROZEN' : 'open';
  $('#frozen').className = G.flags.withdrawalsFrozen ? 'bad' : '';
  const verEl = $('#ver'); if (verEl && !verEl.textContent) verEl.textContent = '· ' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '');
}
