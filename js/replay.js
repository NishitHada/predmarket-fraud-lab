/* =========================================================================
   replay.js — animated, scrubbable playback of a story round.
   Redraws the round's price path with a moving playhead and annotated
   event dots (fake pump, YOUR entry, the dump, resolution), so the player
   can see exactly where and when they got played.
   ========================================================================= */

const REPLAY_KIND = {
  pump:    { color: '#ef6f6c', icon: '🔺', short: 'Fake pump' },
  wash:    { color: '#ef6f6c', icon: '🔁', short: 'Wash trades' },
  dump:    { color: '#ef6f6c', icon: '🔻', short: 'The dump' },
  insider: { color: '#c07de0', icon: '🕵️', short: 'Insider' },
  fees:    { color: '#e0b341', icon: '💸', short: 'Rigged fees' },
  freeze:  { color: '#e0b341', icon: '🧊', short: 'Frozen' },
  you:     { color: '#5bd6c0', icon: '🟢', short: 'You entered' },
  resolve: { color: '#7f9be0', icon: '⚖️', short: 'Resolved' },
};

let _replayTimer = null;
let _replay = null;
let _idx = 0;

function stopReplay() { if (_replayTimer) { clearInterval(_replayTimer); _replayTimer = null; } }

function initReplay(replay) {
  stopReplay();
  _replay = replay;
  const canvas = document.getElementById('replay-canvas');
  const scrub = document.getElementById('replay-scrub');
  const playBtn = document.getElementById('replay-play');
  const chips = document.getElementById('replay-chips');
  if (!canvas || !replay || !replay.hist.length) return;

  const n = replay.hist.length;
  scrub.min = 0; scrub.max = n - 1;

  // event chips (click to jump to that moment)
  chips.innerHTML = replay.events.map((e, i) => {
    const k = REPLAY_KIND[e.kind] || REPLAY_KIND.resolve;
    return `<button class="rchip ${e.kind}" data-i="${i}">${k.icon} ${k.short}</button>`;
  }).join('');
  chips.querySelectorAll('.rchip').forEach(btn => {
    btn.onclick = () => { pauseReplay(); jumpToEvent(Number(btn.dataset.i)); };
  });

  playBtn.onclick = () => {
    if (_replayTimer) pauseReplay();
    else if (_idx >= n - 1) { setIdx(0); playReplay(); }
    else playReplay();
  };
  scrub.oninput = () => { pauseReplay(); setIdx(Number(scrub.value)); };

  setIdx(0);
  // small delay so the modal has painted before autoplay
  setTimeout(() => { if (_replay === replay) playReplay(); }, 450);
}

function playReplay() {
  const playBtn = document.getElementById('replay-play');
  if (playBtn) playBtn.textContent = '❚❚ Pause';
  stopReplay();
  _replayTimer = setInterval(() => {
    if (!_replay) return stopReplay();
    if (_idx >= _replay.hist.length - 1) { pauseReplay(true); return; }
    setIdx(_idx + 1);
  }, 90);
}

function pauseReplay(ended) {
  stopReplay();
  const playBtn = document.getElementById('replay-play');
  if (playBtn) playBtn.textContent = ended ? '↻ Watch again' : '▶ Play';
}

function jumpToEvent(i) {
  if (!_replay) return;
  const ev = _replay.events[i];
  // find nearest history index at/after the event tick
  let idx = _replay.hist.findIndex(h => h.tick >= ev.tick);
  if (idx < 0) idx = _replay.hist.length - 1;
  setIdx(idx);
}

function setIdx(i) {
  if (!_replay) return;
  _idx = Math.max(0, Math.min(_replay.hist.length - 1, i));
  const scrub = document.getElementById('replay-scrub');
  if (scrub) scrub.value = _idx;
  drawReplay();
  updateCallout();
}

function priceAtTick(hist, tick) {
  let best = hist[0];
  for (const h of hist) { if (h.tick <= tick) best = h; else break; }
  return best ? best.price : 50;
}

function drawReplay() {
  const canvas = document.getElementById('replay-canvas');
  if (!canvas || !_replay) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width = canvas.clientWidth * dpr;
  const h = canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const pad = 10 * dpr, padB = 16 * dpr;
  const { hist, t0, t1, events } = _replay;
  const span = Math.max(1, t1 - t0);
  const X = t => pad + ((t - t0) / span) * (w - 2 * pad);
  const Y = p => (h - padB) - (p / 100) * (h - pad - padB);
  const curTick = hist[_idx].tick;

  // baseline gridlines (25/50/75)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  [25, 50, 75].forEach(p => { ctx.beginPath(); ctx.moveTo(pad, Y(p)); ctx.lineTo(w - pad, Y(p)); ctx.stroke(); });

  // ghost of the full path
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  hist.forEach((p, i) => { const x = X(p.tick), y = Y(p.price); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();

  // revealed path up to the playhead
  ctx.strokeStyle = '#5bd6c0'; ctx.lineWidth = 2.4 * dpr;
  ctx.beginPath();
  for (let i = 0; i <= _idx; i++) { const p = hist[i]; const x = X(p.tick), y = Y(p.price); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();

  // event dots
  events.forEach(e => {
    const k = REPLAY_KIND[e.kind] || REPLAY_KIND.resolve;
    const x = X(e.tick), y = Y(priceAtTick(hist, e.tick));
    const reached = e.tick <= curTick;
    ctx.globalAlpha = reached ? 1 : 0.28;
    if (e.kind === 'you') {                     // highlight the player's entry
      ctx.strokeStyle = k.color; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - padB); ctx.stroke();
      ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, 7); ctx.fill();
      ctx.fillStyle = '#08120f'; ctx.font = `700 ${8 * dpr}px ui-sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('YOU', x, y + 3 * dpr);
    } else {
      ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // playhead
  const px = X(curTick);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1 * dpr;
  ctx.beginPath(); ctx.moveTo(px, pad); ctx.lineTo(px, h - padB); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, Y(hist[_idx].price), 3 * dpr, 0, 7); ctx.fill();

  // current price label
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `${9 * dpr}px ui-monospace,monospace`; ctx.textAlign = 'left';
  ctx.fillText(Math.round(hist[_idx].price) + '¢', pad + 2, pad + 9 * dpr);
}

function updateCallout() {
  const box = document.getElementById('replay-callout');
  if (!box || !_replay) return;
  const curTick = _replay.hist[_idx].tick;
  // the most recent event the playhead has reached
  let cur = null;
  for (const e of _replay.events) { if (e.tick <= curTick) cur = e; else break; }
  if (!cur) {
    box.className = 'replay-callout';
    box.innerHTML = '<span class="rc-dim">Press play to watch the round unfold…</span>';
    return;
  }
  const k = REPLAY_KIND[cur.kind] || REPLAY_KIND.resolve;
  box.className = 'replay-callout ' + cur.kind;
  box.innerHTML = `<span class="rc-icon">${k.icon}</span><span class="rc-body"><b>${esc(cur.title)}</b> ${esc(cur.detail)}</span>`;
}
