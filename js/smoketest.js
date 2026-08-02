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

    // 7) Story Mode opens and completes
    storyStart(); clearInterval(loopTimer);
    let storyOK = STORY.state.phase === 'intro';
    for (let r = 0; r < 3; r++) {
      storyEnterBet(); selectedQty = 100; youTrade('buy'); storyLockIn();
      warm(16);
      storyOK = storyOK && STORY.state.phase === 'reveal' && !!STORY.state.replay && STORY.state.replay.events.length >= 3;
      storyNextRound();
    }
    storyOK = storyOK && STORY.state.phase === 'finish';
    ok('Story Mode completes (start→trade→lock→reveal→replay→finish)', storyOK, 'phase=' + STORY.state.phase);
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
