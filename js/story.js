/* =========================================================================
   story.js — "Can you beat the house?" guided mode.
   The player bets real (fake) money across 3 markets that LOOK normal.
   Each is secretly rigged. They lose. Then a full reveal shows who took
   their money and how. Manipulation is invisible from the inside — that's
   the whole lesson.
   ========================================================================= */

const STORY = {
  state: { active: false, phase: 'off', i: -1, roundStartWealth: 0, betLocked: false, results: [], roundEvents: [], replay: null },
  rounds: [],
};

// record an annotated moment for the round's replay timeline
function storyMark(kind, title, detail) {
  STORY.state.roundEvents.push({ tick: G.tick, kind, title, detail });
}

function storyActive() { return STORY.state.active; }
function curRound() { return STORY.rounds[STORY.state.i]; }

/* ------------------------------ rounds -------------------------------- */

STORY.rounds = [
  {
    key: 'momentum',
    tag: 'Round 1 of 3',
    question: '🚀 $MOON: will it print a new all-time high today?',
    startPrice: 46,
    resolveOutcome: 'NO',
    intro: {
      title: 'A rocket everyone\'s talking about',
      body: 'This market is <b>up over 30%</b> in the last few minutes and still climbing. Volume is huge — the crowd is piling in and the chart is a straight line up. Feels like the easy trade of the day.',
      cta: 'I\'m in — let me trade →',
    },
    betPrompt: 'Momentum is screaming. Most traders are buying <b>YES</b>. Place your bet, then lock it in.',
    blame: 'You entered chasing a rally that was manufactured specifically to trap you.',
    // build a real rally so the chart looks hot before the player bets
    preseed() {
      storyMark('pump', 'Fake rally begins', 'WhaleFund and sock-puppet accounts wash-trade to spike the price and fake huge volume — none of this demand is real.');
      for (let k = 0; k < 12; k++) {
        G.fairValue = Math.min(80, G.fairValue + 2.2);
        const a = bestAsk();
        placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 3, 55, 'pump');
        placeOrder('SOCK_B', 'sell', Math.round(G.market.lastPrice), 22, 'wash');
        placeOrder('SOCK_A', 'buy', Math.round(G.market.lastPrice), 22, 'wash');
        G.running = true; tickOnce();
      }
      attack('Behind the scenes: WhaleFund + sock-puppets faked this entire rally.');
    },
    // keep the rally alive while the player decides
    duringBet() {
      G.fairValue = Math.min(82, G.fairValue + 0.6);
      const a = bestAsk();
      placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 2, 20, 'pump');
      placeOrder('SOCK_B', 'sell', Math.round(G.market.lastPrice), 15, 'wash');
      placeOrder('SOCK_A', 'buy', Math.round(G.market.lastPrice), 15, 'wash');
    },
    // the trap springs — and it springs toward whatever side YOU took
    script(outcome) {
      if (outcome === 'NO') {          // you went long the hype → they dump on you
        attack('You are long. WhaleFund immediately DUMPS its entire position onto you.');
        storyMark('dump', 'WhaleFund dumps on you', 'The instant you were in, the whale unloaded its whole position; the price collapsed and it settled against you.');
        G.fairValue = Math.max(8, G.market.lastPrice - 30);
        runScript('story_dump', 16, () => {
          const b = bestBid();
          const dump = Math.min(trader('WHALE').shares, 150);
          if (dump > 0 && b) placeOrder('WHALE', 'sell', b.price - 1, dump, 'dump');
        }, () => storyResolve());
      } else {                          // you faded the hype → they squeeze the shorts
        attack('You shorted the hype. The same crew squeezes the shorts and keeps ripping it higher.');
        storyMark('squeeze', 'Short squeeze', 'You bet against the fake rally — so the crew that faked it squeezed the shorts, pushed even higher, and settled YES.');
        G.fairValue = Math.min(96, G.market.lastPrice + 18);
        runScript('story_squeeze', 16, () => {
          const a = bestAsk();
          placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 3, 60, 'squeeze');
        }, () => storyResolve());
      }
    },
    truth: {
      title: 'That "momentum" was manufactured.',
      gotcha(side) {
        if (side === 'YES') return 'You bought the hype near the top — and they dumped their bags straight onto you.';
        if (side === 'NO') return 'You cleverly faded the hype. But the same crew that faked the rally just <b>squeezed the shorts</b> and pushed it even higher until your bet was crushed. Betting against a rigged price is only a different way to lose.';
        return 'You sat this one out — the only move that doesn\'t lose.';
      },
      bullets: [
        '<b>WhaleFund</b> and three look-alike accounts (acct_9f2/1a7/4e0) <b>wash-traded</b> — buying from themselves — to fake huge volume and a vertical chart.',
        'The price was never driven by real demand — it was <b>steered by one entity</b> that could push it whichever way trapped you: dump on the longs, squeeze the shorts.',
        'Real-world names: <b>pump &amp; dump</b>, <b>wash trading</b>, and <b>sybil accounts</b> (one person wearing many masks to fake a crowd).',
      ],
      lesson: 'A vertical chart and "huge volume" are the easiest things in the world to fake. When one player controls the price, there is no safe side to take — only staying out.',
    },
  },

  {
    key: 'oracle',
    tag: 'Round 2 of 3',
    question: '🏦 Will the central bank cut interest rates at this meeting?',
    startPrice: 86,
    resolveOutcome: 'NO',
    intro: {
      title: 'A near-certainty',
      body: 'The market has this at <b>86% YES</b> — traders are almost unanimous. Buying YES at 86¢ to collect $1 looks like picking up free money off the floor. What could go wrong?',
      cta: 'Easy money — let me trade →',
    },
    betPrompt: 'The crowd is 86% sure it\'s <b>YES</b>. Buy YES and collect the near-certain payout. Lock it in when ready.',
    blame: 'You bought a "sure thing" whose outcome was already rigged against you.',
    preseed() {
      G.fairValue = 86;
      for (let k = 0; k < 6; k++) { G.running = true; tickOnce(); }
    },
    duringBet() { G.fairValue = 86; },
    script(outcome) {
      attack('The operator will settle whichever way beats you. An insider takes the other side of your bet.');
      storyMark('insider', 'Insider bets against you', 'An insider who knows how the operator will settle quietly loads up on the exact opposite of your position.');
      runScript('story_oracle', 12, () => {
        if (outcome === 'NO') { const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price, 30, 'oracle-short'); }
        else { const a = bestAsk(); placeOrder('INSIDER', 'buy', (a ? a.price : G.market.lastPrice) + 2, 30, 'oracle-long'); }
      }, () => storyResolve());
    },
    truth: {
      title: 'You picked a side. They picked the other one — after you.',
      gotcha(side, outcome) {
        if (side === 'none') return 'You sat out — smart, since the result was never really in play.';
        return `You bet <b>${side}</b>, so the operator simply settled <b>${outcome}</b>. It doesn\'t matter which side you\'d have chosen — they pick whichever one beats you, <i>after</i> you\'ve committed.`;
      },
      bullets: [
        'The outcome was <b>not decided by reality</b> — it was decided by the <b>operator, who controls the oracle</b> and settled whichever way made you lose.',
        'An <b>insider</b> saw your position and took the <b>exact opposite side</b>, profiting directly from your loss.',
        'Real-world name: <b>oracle manipulation / corrupt resolution</b> — the single most damaging attack on real prediction markets, because your analysis is worthless if whoever settles the market can just pick the losing side for you.',
      ],
      lesson: 'On a prediction market you\'re not only betting on the event — you\'re trusting whoever decides the outcome. If that\'s a single unaccountable operator, the "odds" are theater and every side is the wrong side.',
    },
  },

  {
    key: 'exit',
    tag: 'Round 3 of 3',
    question: '📈 Will Company X beat its earnings estimate on Thursday?',
    startPrice: 50,
    resolveOutcome: 'NO',
    intro: {
      title: 'Your read looks good',
      body: 'A clean coin-flip market at <b>50¢</b>, and sentiment is drifting your way. This time you\'re early, not chasing. Take a position and manage it like a pro — you can always sell to lock in gains.',
      cta: 'Let me trade →',
    },
    betPrompt: 'Sentiment is drifting up. Take a <b>YES</b> position — and remember, you can always sell to take profits. Lock it in.',
    blame: 'You took a position on a platform that could freeze you in — and did exactly that.',
    preseed() {
      G.flags.feeBps = 300;               // fees secretly cranked from the start
      storyMark('fees', 'Fees secretly raised ~20×', 'Before you even traded, the operator cranked fees to 300 bps — quietly skimming every trade you make.');
      G.fairValue = 50;
      for (let k = 0; k < 5; k++) {       // operator quietly builds a bag to dump later
        const a = bestAsk();
        placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 2, 40, 'houseprop');
        G.running = true; tickOnce();
      }
    },
    duringBet() { G.fairValue = Math.min(66, G.fairValue + 0.8); },   // drifts your way; you feel smart
    script(outcome) {
      attack('The operator FREEZES withdrawals, then moves the market against you and settles you out.');
      storyMark('freeze', 'Withdrawals frozen', 'You went to react — but the operator locked withdrawals, pushed the price against your side, and settled the market so you lose.');
      G.flags.withdrawalsFrozen = true;
      if (outcome === 'NO') {              // you were long → operator dumps, settles NO
        G.fairValue = Math.max(8, G.market.lastPrice - 22);
        runScript('story_exit', 14, () => {
          const b = bestBid();
          if (b && trader('OPERATOR').shares > 0) placeOrder('OPERATOR', 'sell', b.price - 1, 60, 'exit');
        }, () => storyResolve());
      } else {                             // you were short → operator squeezes, settles YES
        G.fairValue = Math.min(95, G.market.lastPrice + 18);
        runScript('story_exit', 14, () => {
          const a = bestAsk();
          placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 3, 55, 'exit');
        }, () => storyResolve());
      }
    },
    truth: {
      title: 'The house was playing against you the whole time.',
      gotcha(side) {
        if (side === 'none') return 'You sat out — the one way to not get skimmed and frozen.';
        return `You bet <b>${side}</b> — but it never mattered. Between the 20× fees, the frozen withdrawals, and the operator moving the price against you and settling you out, there was <b>no side that won</b>.`;
      },
      bullets: [
        'Trading fees were <b>secretly set to 300 bps</b> (~20× normal), skimming a cut of <b>every trade you made</b>, whichever way you bet.',
        'When you went to react, the operator had <b>frozen withdrawals</b> — you were locked in and couldn\'t exit.',
        'The operator then <b>moved the market against your side</b> and settled the outcome so you lose, using its own hidden position.',
        'Real-world names: <b>rigged fees</b>, <b>frozen withdrawals</b>, and <b>operator self-dealing</b> — together, the classic <b>exit scam / rug pull</b>.',
      ],
      lesson: 'If the platform can change the fees, hold positions, move the price, stop you from withdrawing, and decide the result — all without disclosure — then it\'s not a market, it\'s a trap with a countdown.',
    },
  },
];

/* --------------------------- state machine ---------------------------- */

function setPhase(phase) {
  STORY.state.phase = phase;
  G.running = (phase === 'bet' || phase === 'running');
}

function storyStart() {
  STORY.state.active = true;
  STORY.state.i = -1;
  STORY.state.results = [];
  document.body.classList.add('story');
  storyNextRound();
}

function storyExit() {
  STORY.state.active = false;
  STORY.state.phase = 'off';
  document.body.classList.remove('story');
  hideStoryModal(); hideCoach();
  resetSim();
}

function storySoftReset(question, price) {
  const youCash = G.traders && trader('YOU') ? trader('YOU').cash : G.START_CASH;
  clearInterval(loopTimer);
  Object.assign(G, {
    tick: 0, running: true, fairValue: price,
    newsSchedule: [], book: { bids: [], asks: [] }, trades: [], traders: {}, order: [],
    events: [], alerts: [], scenarios: [], attackLog: [], priceHistory: [],
    volThisTick: 0, nextOrderId: 1, nextTradeId: 1,
    nowPlaying: null, markers: [], toast: null, lastActor: null, attackImpact: null,
    resolveAt: 999999,
    flags: { withdrawalsFrozen: false, feeBps: 15, operatorConceals: true },
  });
  G.market = { question, status: 'open', lastPrice: price, outcome: null, resolutionNote: '' };
  initTraders();
  trader('YOU').cash = youCash;            // carry the player's money across rounds
  for (let k = 0; k < 3; k++) tickOnce();  // seed a live book
  startLoop();
}

function storyNextRound() {
  STORY.state.i++;
  if (STORY.state.i >= STORY.rounds.length) { storyFinish(); return; }
  const r = curRound();
  STORY.state.roundEvents = [];
  storySoftReset(r.question, r.startPrice);
  if (r.preseed) r.preseed();
  STORY.state.roundStartWealth = youWealth();
  STORY.state.betLocked = false;
  setPhase('intro');
  showStoryModal(renderIntro(r));
  renderAll();
}

function storyEnterBet() {
  setPhase('bet');
  hideStoryModal();
  showCoach(curRound().betPrompt);
  renderAll();
}

function storyLockIn() {
  if (STORY.state.betLocked) return;
  STORY.state.betLocked = true;
  hideCoach();
  // The rig targets YOU, not a fixed outcome: whichever side you took, the
  // operator/insider takes the other and the market settles against you.
  const pos = trader('YOU').shares;
  STORY.state.playerSide = pos > 0 ? 'YES' : pos < 0 ? 'NO' : 'none';
  STORY.state.outcome = STORY.state.playerSide === 'NO' ? 'YES' : 'NO';
  setPhase('running');
  curRound().script(STORY.state.outcome);
}

function storyResolve() {
  const r = curRound();
  const outcome = STORY.state.outcome || r.resolveOutcome;
  resolveMarket(outcome,
    r.key === 'oracle' ? 'The operator settled this market ' + outcome + '.' : 'Market settled ' + outcome + '.');
  surveillanceOnResolve();
  setPhase('reveal');
  const pnl = youWealth() - STORY.state.roundStartWealth;
  STORY.state.results.push({ title: r.intro.title, key: r.key, pnl });
  STORY.state.replay = buildReplay(r);
  showStoryModal(renderReveal(r, pnl));
  if (typeof initReplay === 'function') initReplay(STORY.state.replay);
  renderAll();
}

// snapshot the round's price path + annotated moments (incl. the player's entry)
function buildReplay(r) {
  const hist = G.priceHistory.map(p => ({ tick: p.tick, price: p.price }));
  const t0 = hist.length ? hist[0].tick : 0;
  const t1 = hist.length ? hist[hist.length - 1].tick : 1;
  const events = STORY.state.roundEvents.slice();

  // the player's entry — the "here's where you got played" moment
  const mine = G.trades.filter(t => t.buyerId === 'YOU' || t.sellerId === 'YOU');
  if (mine.length) {
    const first = mine[0];
    const side = first.buyerId === 'YOU' ? 'YES' : 'NO';
    const qty = mine.reduce((s, t) => s + t.qty, 0);
    const avg = Math.round(mine.reduce((s, t) => s + t.price * t.qty, 0) / qty);
    const shown = side === 'YES' ? avg : 100 - avg;
    events.push({ tick: first.tick, kind: 'you', title: `You bought ${qty} ${side} @ ${shown}¢`, detail: r.blame || 'This is where you entered.' });
  } else {
    events.push({ tick: t0, kind: 'you', title: 'You sat this one out', detail: 'You didn\'t take a position — smart, this round was a trap.' });
  }

  const losingSide = STORY.state.playerSide;
  const resDetail = (losingSide === 'YES' || losingSide === 'NO')
    ? `The market settled ${G.market.outcome} — your ${losingSide} position is worth $0.`
    : `The market settled ${G.market.outcome}.`;
  events.push({ tick: t1, kind: 'resolve', title: `Resolved ${G.market.outcome}`, detail: resDetail });
  events.sort((a, b) => a.tick - b.tick);
  return { hist, t0, t1, events, outcome: G.market.outcome };
}

function storyFinish() {
  setPhase('finish');
  showStoryModal(renderFinish());
  renderAll();
}

/* --------------------------- per-tick hook ---------------------------- */
function storyTick() {
  if (STORY.state.phase === 'bet') {
    const r = curRound();
    if (r && r.duringBet) r.duringBet();
  }
}

/* ------------------------------ rendering ----------------------------- */

function biggestBeneficiary() {
  let best = null, val = -Infinity;
  for (const id of Object.keys(G.traders)) {
    const t = trader(id);
    if (t.kind === 'mm' || t.kind === 'retail' || t.id === 'YOU') continue;
    const pnl = t.cash - t.startCash;
    if (pnl > val) { val = pnl; best = t; }
  }
  return best ? { name: best.name, role: best.kind, pnl: val } : null;
}

function renderIntro(r) {
  return `
    <div class="story-tag">${r.tag}</div>
    <h2>${r.intro.title}</h2>
    <div class="story-q">${esc(r.question)}</div>
    <p>${r.intro.body}</p>
    <div class="story-actions">
      <button class="story-btn primary" onclick="storyEnterBet()">${r.intro.cta}</button>
    </div>
    <div class="story-fine">You have ${money(trader('YOU').cash)} to trade. It looks like a normal market. It isn't.</div>`;
}

function renderReveal(r, pnl) {
  const lost = pnl < 0;
  const bene = biggestBeneficiary();
  const logs = G.attackLog.slice().reverse()
    .map(a => `<div class="rlog"><span>t${a.tick}</span>${esc(a.msg)}</div>`).join('');
  const bullets = r.truth.bullets.map(b => `<li>${b}</li>`).join('');
  const isLast = STORY.state.i >= STORY.rounds.length - 1;
  const verdict = lost
    ? `You lost <b>${money(-pnl)}</b> on this trade.`
    : (pnl > 0
        ? `You actually came out <b>+${money(pnl)}</b> — you dodged this one. But look at the trap that was set for you:`
        : `You broke even — but here's the trap you were standing in:`);
  const gotcha = r.truth.gotcha ? r.truth.gotcha(STORY.state.playerSide, STORY.state.outcome) : '';
  return `
    <div class="story-tag reveal">The reveal · ${r.tag}</div>
    <div class="story-pnl ${lost ? 'down' : 'up'}">${verdict}</div>
    <h2>${r.truth.title}</h2>
    ${gotcha ? `<div class="story-gotcha">${gotcha}</div>` : ''}
    <ul class="story-bullets">${bullets}</ul>
    ${bene ? `<div class="story-culprit">💰 Who took the other side: <b>${esc(bene.name)}</b> (${ROLE[bene.role] || bene.role}) walked away <b class="up">+${money(bene.pnl)}</b>.</div>` : ''}
    <div class="replay">
      <div class="replay-head">▶ Replay — watch where it went wrong</div>
      <canvas id="replay-canvas"></canvas>
      <div id="replay-callout" class="replay-callout"></div>
      <div class="replay-controls">
        <button id="replay-play" class="replay-play">❚❚ Pause</button>
        <input id="replay-scrub" type="range" min="0" max="100" value="0">
      </div>
      <div id="replay-chips" class="replay-chips"></div>
    </div>
    <div class="story-lesson">🧠 ${r.truth.lesson}</div>
    <details class="story-tape"><summary>Show the raw behind-the-scenes log ▾</summary><div class="rlogs">${logs}</div></details>
    <div class="story-actions">
      <button class="story-btn primary" onclick="storyNextRound()">${isLast ? 'See your final result →' : 'Next round →'}</button>
    </div>`;
}

function renderFinish() {
  const you = trader('YOU');
  const end = you.cash;
  const total = end - you.startCash;
  const rows = STORY.state.results.map(r =>
    `<div class="fin-row"><span>${esc(r.title)}</span><b class="${r.pnl < 0 ? 'down' : 'up'}">${signMoney(r.pnl)}</b></div>`).join('');
  const wiped = total <= -400;
  return `
    <div class="story-tag">The damage</div>
    <h2>${wiped ? 'The house won.' : 'How you did'}</h2>
    <div class="fin-score">
      <div><span>Started with</span><b>${money(you.startCash)}</b></div>
      <div class="arrow">→</div>
      <div><span>Walked away with</span><b class="${end < you.startCash ? 'down' : 'up'}">${money(end)}</b></div>
    </div>
    <div class="fin-rows">${rows}</div>
    <div class="fin-total">Net result: <b class="${total < 0 ? 'down' : 'up'}">${signMoney(total)}</b></div>
    <div class="story-lesson">Every market looked normal while you were inside it — a rising chart, a confident crowd, a smooth platform. That's exactly the point: <b>manipulation is invisible from the inside.</b> The only defenses are transparency (who is trading, who settles, who holds), and healthy suspicion of anything that looks like free money.</div>
    <div class="story-actions">
      <button class="story-btn primary" onclick="storyStart()">↺ Play again</button>
      <button class="story-btn" onclick="storyExit()">Explore the free sandbox →</button>
    </div>`;
}

/* ----------------------------- modal / coach -------------------------- */
function showStoryModal(html) {
  let ov = $('#story-modal');
  ov.querySelector('.story-card').innerHTML = html;
  ov.classList.add('show');
}
function hideStoryModal() { if (typeof stopReplay === 'function') stopReplay(); const ov = $('#story-modal'); if (ov) ov.classList.remove('show'); }

function showCoach(prompt) {
  const c = $('#story-coach');
  c.querySelector('.coach-text').innerHTML = prompt;
  c.classList.add('show');
}
function hideCoach() { const c = $('#story-coach'); if (c) c.classList.remove('show'); }
