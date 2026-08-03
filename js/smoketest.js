/* =========================================================================
   smoketest.js — lightweight release smoke test.
   Run by appending ?smoketest=1 to the URL, or calling runSmokeTest() in the
   console. Verifies the critical path so a broken deploy is caught fast.
   Mutates state, so it resets the sim when done.
   ========================================================================= */

function runSmokeTest() {
  const results = [];
  const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });
  const warm = n => { for (let i = 0; i < n; i++) { G.running = true; tickOnce(); } };

  try {
    // 1) all scripts loaded
    const globals = ['G', 'initTraders', 'SCENARIOS', 'LESSONS', 'surveillanceTick', 'storyStart', 'initReplay', 'renderAll', 'APP_VERSION'];
    const missing = globals.filter(g => eval('typeof ' + g) === 'undefined');
    ok('All scripts load', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : APP_VERSION);

    // 2) market initialises
    resetSim(); clearInterval(loopTimer);
    ok('Market initialises', G.market.status === 'open' && Object.keys(G.traders).length > 5 && !!trader('YOU'));

    // 3) Buy YES updates position
    warm(4); selectedQty = 50; youTrade('buy');
    ok('Buy YES updates position', trader('YOU').shares > 0, 'shares=' + trader('YOU').shares);

    // 3b) Buy NO reduces/reverses position
    const beforeNo = trader('YOU').shares; youTrade('sell');
    ok('Buy NO updates position', trader('YOU').shares < beforeNo, 'shares=' + trader('YOU').shares);

    // 3c) Your Desk renders correct numbers (the panel that "seemed buggy")
    const dollars = s => Math.round(parseFloat(String(s).replace(/[^0-9.\-]/g, '')) || 0);  // parseFloat handles the sign
    resetSim(); clearInterval(loopTimer); warm(4);
    selectedQty = 100; youTrade('buy'); renderDesk();
    const y1 = trader('YOU');
    const posTxt = document.getElementById('you-pos').textContent;
    const payYes = dollars(document.getElementById('pay-yes').textContent);
    const payNo = dollars(document.getElementById('pay-no').textContent);
    // invariant: (ifYES - ifNO) in dollars === your share count (each YES share pays $1 more under YES)
    const invariant = Math.abs((payYes - payNo) - y1.shares) <= 1;
    ok('Desk payouts obey (ifYES - ifNO) == position', invariant, `posTxt="${posTxt}" ifYES=${payYes} ifNO=${payNo} shares=${y1.shares}`);
    ok('Desk shows YES position after Buy YES', posTxt.includes('YES') && payYes > 0 && payNo < 0, `ifYES=${payYes} ifNO=${payNo}`);

    // 3d) Close position flattens (sweeps the book to fully exit)
    document.getElementById('close-pos').onclick();   // simulate the wired handler
    ok('Close my position flattens', trader('YOU').shares === 0, 'shares=' + trader('YOU').shares);

    // 3e) BUG FIX: in a fresh story round with no position, P&L/payouts read $0
    //     (not the cumulative loss carried from earlier rounds)
    storyStart(); clearInterval(loopTimer);
    STORY.state.deck = [STORY.pool.find(p => p.family !== 'clean'), STORY.pool.find(p => p.key === 'clean_verified')];
    STORY.state.i = -1; storyNextRound(); clearInterval(loopTimer);
    storyEnterBet(); selectedQty = 100; youTrade('buy'); storyLockIn();
    for (let i = 0; i < 14; i++) { G.running = true; tickOnce(); }
    storyNextRound(); clearInterval(loopTimer); renderDesk();     // round 2, no position yet
    const freshPnl = dollars(document.getElementById('you-now').textContent);
    const freshYes = dollars(document.getElementById('pay-yes').textContent);
    const freshNo = dollars(document.getElementById('pay-no').textContent);
    ok('Fresh story round shows $0 P&L with no position', freshPnl === 0 && freshYes === 0 && freshNo === 0,
      `roundPnL=${freshPnl} ifYES=${freshYes} ifNO=${freshNo}`);
    storyExit();

    // 4) Toast displays (the previously-broken path)
    flashToast('smoke test toast', 'info');
    const toastShown = !!(G.toast && G.toast.time) && document.getElementById('toast').className.includes('show');
    ok('Toast displays', toastShown);

    // 5) Attack produces attacker-log + alert
    resetSim(); clearInterval(loopTimer); warm(4);
    launch('wash'); warm(8);
    ok('Attack produces log + alert', G.attackLog.length > 0 && G.alerts.length > 0, 'alerts=' + G.alerts.length);

    // 5b) player is never flagged as a manipulator
    resetSim(); clearInterval(loopTimer); warm(4);
    selectedQty = 250; youTrade('buy'); warm(6);
    ok('Player not flagged', trader('YOU').flags.size === 0);

    // 6) Resolution settles P&L
    resetSim(); clearInterval(loopTimer); warm(4);
    selectedQty = 100; youTrade('buy');
    resolveMarket('NO', 'smoke');
    ok('Resolution settles P&L', G.market.status === 'resolved' && trader('YOU').shares === 0 && trader('YOU').cash < trader('YOU').startCash);

    // 7) Story Mode: 5 random rounds, deep-link, walk-away, complete
    storyStart(); clearInterval(loopTimer);
    const nClean = STORY.state.deck.filter(r => r.family === 'clean').length;
    ok('Story deck is 5 rounds, mixed clean+trap', STORY.state.deck.length === 5 && nClean >= 2 && nClean <= 3 && STORY.pool.length >= 9, 'clean=' + nClean + ' deck=' + STORY.state.deck.map(r => r.key).join(','));
    let storyOK = STORY.state.phase === 'intro';
    for (let r = 0; r < STORY.state.deck.length; r++) {
      storyEnterBet();
      if (r === 0) {                                   // exercise walk-away
        storyWalkAway();
      } else {                                         // exercise both bet sides
        selectedQty = 100; youTrade(r % 2 ? 'sell' : 'buy'); storyLockIn();
      }
      warm(18);
      storyOK = storyOK && STORY.state.phase === 'reveal' && !!STORY.state.replay && STORY.state.replay.events.length >= 3;
      storyNextRound();
    }
    storyOK = storyOK && STORY.state.phase === 'finish';
    ok('Story Mode completes (5 rounds, walk-away + both sides)', storyOK, 'phase=' + STORY.state.phase);
    // walking away preserves capital for that round (trap → 'avoided', clean → 'missed')
    const w0 = STORY.state.results[0];
    const walkPreserved = w0 && (w0.result === 'avoided' || w0.result === 'missed') && Math.abs(w0.pnl) < 1;
    ok('Walk away preserves capital', walkPreserved, w0 && w0.result);
    // a clean market bet on the signal side should be winnable
    let cleanWin = false;
    for (const key of ['clean_verified', 'value_bet', 'clean_no']) {
      resetSim(); clearInterval(loopTimer); if (storyActive()) { STORY.state.active = false; document.body.classList.remove('story'); }
      STORY.state.active = true; STORY.state.deck = [STORY.pool.find(p => p.key === key)]; STORY.state.i = -1; STORY.state.dd = 4; STORY.state.results = [];
      storyNextRound(); clearInterval(loopTimer); storyEnterBet();
      const sig = STORY.pool.find(p => p.key === key).signalSide;
      selectedQty = 100; youTrade(sig === 'YES' ? 'buy' : 'sell'); storyLockIn();
      for (let i = 0; i < 12; i++) { G.running = true; tickOnce(); }
      if (STORY.state.results[0].result === 'won' && STORY.state.results[0].pnl > 0) cleanWin = true;
    }
    ok('Clean markets are winnable (bet the verified edge)', cleanWin);
    storyExit();
  } catch (err) {
    ok('No exceptions thrown', false, String(err));
  }

  // reset to a clean sim
  try { if (storyActive()) storyExit(); else resetSim(); } catch (e) {}

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.group('%cSmoke test: ' + passed + '/' + total + ' passed', 'font-weight:bold;font-size:14px');
  results.forEach(r => console.log((r.pass ? '✅' : '❌') + ' ' + r.name + (r.detail ? '  — ' + r.detail : '')));
  console.groupEnd();
  renderSmokeOverlay(results, passed, total);
  return { passed, total, results };
}

function renderSmokeOverlay(results, passed, total) {
  let el = document.getElementById('smoke-overlay');
  if (!el) { el = document.createElement('div'); el.id = 'smoke-overlay'; document.body.appendChild(el); }
  const allPass = passed === total;
  el.innerHTML =
    `<div class="smoke-card ${allPass ? 'pass' : 'fail'}">
      <div class="smoke-h">${allPass ? '✅' : '❌'} Smoke test: ${passed}/${total} passed <span>${APP_VERSION}</span></div>
      ${results.map(r => `<div class="smoke-row ${r.pass ? 'p' : 'f'}">${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? ' <em>' + r.detail + '</em>' : ''}</div>`).join('')}
      <button onclick="document.getElementById('smoke-overlay').remove()">Close</button>
    </div>`;
}

if (typeof location !== 'undefined' && /[?&]smoketest=1/.test(location.search)) {
  window.addEventListener('DOMContentLoaded', () => setTimeout(runSmokeTest, 300));
}
