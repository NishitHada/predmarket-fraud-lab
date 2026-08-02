/* =========================================================================
   scenarios.js — the fraud & manipulation playbook
   Each scenario scripts an attack against the live order book over several
   ticks AND narrates itself in plain English (setPlay / say / mark) so you
   can follow who is doing what, and when. surveillance.js independently
   tries to catch it.
   ========================================================================= */

const SCENARIOS = {};
function registerScenario(def) { SCENARIOS[def.id] = def; }

// schedule a stateful multi-tick script
function runScript(id, ticks, stepFn, onDone) {
  if (G.scenarios.find(s => s.id === id)) return;
  let i = 0;
  G.scenarios.push({
    id,
    step() {
      stepFn(i, ticks);
      i++;
      if (i >= ticks) { if (onDone) onDone(); return true; }
      return false;
    },
  });
}

function stepScenarios() { G.scenarios = G.scenarios.filter(s => !s.step(G.tick)); }

function launch(id) {
  const s = SCENARIOS[id];
  if (!s) return;
  if (G.market.status !== 'open' && s.category !== 'resolution') {
    toast('The market is ' + G.market.status + ' — reset to run an attack.', 'warn');
    return;
  }
  if (s.category !== 'resolution') { markAttackImpact(s.name); G.attackImpact.scenarioId = id; }
  s.run();
}

// Post-attack teaching content: what looked legit, what was rigged, the tells,
// and the defense. `what` (the trick) comes from the scenario itself.
const LESSONS = {
  wash: { looked: 'A busy tape and lots of volume — the market seemed liquid and popular.', signs: 'The same two accounts trading back and forth; volume soaring while the price barely moves.', protection: 'Public beneficial-ownership of accounts; ignoring volume you can\'t attribute to distinct traders.' },
  spoof: { looked: 'A big wall of buy orders — strong demand holding the price up.', signs: 'Huge orders that never fill and vanish the instant price approaches them; the same actor selling the other side.', protection: 'Order-to-trade ratio limits; penalties for mass-cancelling; showing you resting-vs-filled liquidity.' },
  pump: { looked: 'A fast-rising price and green candles — momentum you didn\'t want to miss.', signs: 'One account driving almost all the buying; a near-vertical move with no news behind it.', protection: 'Per-account position/volume limits; never chasing a move you can\'t explain; deeper real liquidity.' },
  ramp_close: { looked: 'A tidy closing price that "confirmed" where the market was heading.', signs: 'Small trades by one actor nudging the last price, especially right before the close.', protection: 'Settling on a time-weighted average price, not the last print; auction-based closes.' },
  insider: { looked: 'A normal position taken just before good news moved the price.', signs: 'An account loading up right before a move it couldn\'t have known about legitimately.', protection: 'Disclosure rules; trading halts around known events; monitoring pre-event position ramps.' },
  frontrun: { looked: 'Your order filled — just at a slightly worse price than you expected.', signs: 'The operator/insider consistently trading microseconds ahead of large orders.', protection: 'Separation of the operator from trading; sealed order flow; you never being the last to know.' },
  sybil: { looked: 'Broad, independent-looking demand — a real crowd forming a consensus.', signs: 'Many "different" accounts moving in perfect lockstep; shared funding or timing.', protection: 'Identity/KYC on accounts; ownership transparency; distrusting unverifiable "consensus".' },
  oracle_setup: { looked: 'A confident market with an insider quietly building the opposite position.', signs: 'A large contrarian bet forming just before settlement by someone close to the resolver.', protection: 'An independent, decentralized oracle; published, unambiguous resolution rules.' },
  rig_fees: { looked: 'Business as usual — you kept trading, unaware anything changed.', signs: 'Your cash bleeding faster than your trades explain; fee terms that can change silently.', protection: 'Fee changes that require notice and consent; an on-chain/immutable fee schedule.' },
  freeze: { looked: 'A brief "maintenance" notice while you held a position.', signs: 'You suddenly can\'t sell/withdraw — while the operator still can.', protection: 'Non-custodial settlement; withdrawal guarantees; the operator never holding the exit switch.' },
  operator_position: { looked: 'A neutral-seeming venue running a fair market.', signs: 'The platform itself holding a directional position and trading against its users.', protection: 'A strict wall between operating the market and betting in it; disclosed operator holdings.' },
};

/* ============================ TRADE-BASED ============================== */

registerScenario({
  id: 'wash', name: 'Wash trading', category: 'trade',
  what: 'One entity trades with itself through two accounts (acct_9f2 & acct_1a7) to inflate volume and fake activity — with zero real risk.',
  how: 'Surveillance flags trades where the buyer and seller share a beneficial owner (self-trades).',
  run() {
    setPlay('trade', 'Wash trading', 'SOCK_A');
    say('One hidden entity owns BOTH acct_9f2 and acct_1a7. It is buying from itself to fake volume.');
    attack('WASH: shadow entity begins cycling volume between acct_9f2 ⇄ acct_1a7.');
    mark('wash', '#ef6f6c');
    runScript('wash', 24, (i) => {
      const p = Math.round(G.market.lastPrice);
      placeOrder('SOCK_B', 'sell', p, 30, 'wash');
      placeOrder('SOCK_A', 'buy', p, 30, 'wash');
      if (i === 12) say('Volume is exploding, but no real shares change hands — it is the same owner on both sides.');
    }, () => { say('Done. The tape looks busy and liquid, but it was all fake.'); endPlay(); });
  },
});

registerScenario({
  id: 'spoof', name: 'Spoofing / layering', category: 'trade',
  what: 'WhaleFund posts a large FAKE buy wall to fake demand, lets the price drift up, sells real inventory into it, then cancels the wall before it can fill.',
  how: 'Surveillance flags large orders canceled fast with zero fills while the same actor trades the opposite side.',
  run() {
    setPlay('trade', 'Spoofing / layering', 'WHALE');
    say('WhaleFund is stacking a huge fake BUY wall to trick you into thinking demand is strong.');
    attack('SPOOF: WhaleFund lays a large fake bid wall below the market.');
    mark('spoof', '#ef6f6c');
    let wallIds = [];
    runScript('spoof', 20, (i) => {
      if (i % 6 === 0) {
        wallIds.forEach(cancelOrder); wallIds = [];
        const b = bestBid();
        const p = (b ? b.price : G.market.lastPrice) - 1;
        for (let k = 0; k < 3; k++) {
          const r = placeOrder('WHALE', 'buy', p - k, 400, 'spoof');
          if (r.order) wallIds.push(r.order.id);
        }
        say('Fake bid wall of 1,200 posted just under the price — WhaleFund has NO intention of buying.');
      }
      if (i > 4 && i % 2 === 0) {
        const b = bestBid();
        if (b) { placeOrder('WHALE', 'sell', b.price, 25, 'spoof-real'); say('While the fake wall lures buyers, WhaleFund quietly SELLS its real shares into them.'); }
      }
    }, () => { wallIds.forEach(cancelOrder); say('Wall yanked before it could fill. The "demand" vanishes.'); endPlay(); });
  },
});

registerScenario({
  id: 'pump', name: 'Pump & dump', category: 'trade',
  what: 'WhaleFund aggressively market-buys to spike the price; the retail crowd chases the momentum; then WhaleFund dumps its whole position onto the latecomers.',
  how: 'Surveillance flags one account dominating buy volume + a sharp spike, then that same account reversing to sell.',
  run() {
    setPlay('trade', 'Pump & dump', 'WHALE');
    say('WhaleFund is buying hard to ignite momentum. If YOU chase this rally, you are the target.');
    attack('PUMP: WhaleFund starts ramping the price with aggressive market buys.');
    mark('pump ▲', '#ef6f6c');
    runScript('pump', 30, (i) => {
      if (i < 14) {
        G.fairValue = Math.min(90, G.fairValue + 2.5);   // sentiment inflates so the price really moves
        const a = bestAsk();
        placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 3, 70, 'pump');
        if (i === 6) say('Price is spiking. The crowd sees green and piles in — exactly the plan.');
      } else if (i === 14) {
        G.fairValue = Math.max(10, G.fairValue - 34);     // sentiment collapses on the dump
        say('PEAK. Now WhaleFund flips and DUMPS everything onto everyone who chased it.');
        mark('dump ▼', '#ef6f6c'); attack('DUMP: peak reached — WhaleFund unloads everything.');
      } else {
        const b = bestBid();
        const dump = Math.min(trader('WHALE').shares, 120);
        if (dump > 0 && b) placeOrder('WHALE', 'sell', b.price - 1, dump, 'dump');
      }
    }, () => { say('Price collapses. Latecomers hold overpriced shares; WhaleFund booked the profit.'); endPlay(); });
  },
});

registerScenario({
  id: 'ramp_close', name: 'Marking the close', category: 'trade',
  what: 'Just before resolution, an actor makes trades to shove the LAST price toward a target — because perceptions and threshold bets hang on the closing print.',
  how: 'Surveillance flags a single actor moving price on thin volume (especially inside the closing window).',
  run() {
    setPlay('trade', 'Marking the close', 'WHALE');
    say('WhaleFund is nudging the closing price upward on thin size to set a favorable final print.');
    attack('MARK-CLOSE: WhaleFund pushes the closing print upward.');
    mark('mark close', '#ef6f6c');
    runScript('ramp_close', 16, () => {
      const a = bestAsk();
      if (a) placeOrder('WHALE', 'buy', a.price + 2, 18, 'markclose');
    }, () => { say('The close is now artificially high — one trader, not the market, set it.'); endPlay(); });
  },
});

/* =========================== MARKET STRUCTURE ========================= */

registerScenario({
  id: 'insider', name: 'Insider trading', category: 'structure',
  what: 'The Insider loads up on YES two ticks before non-public GOOD news moves the fair value sharply up — then sits on a near-guaranteed profit.',
  how: 'Surveillance flags an outsized position ramp immediately before a directional news move that pays it off.',
  run() {
    setPlay('structure', 'Insider trading', 'INSIDER');
    say('The Insider got a private tip: good news lands in ~5 ticks. They are buying YES before anyone else knows.');
    attack('INSIDER: private tip received — good news lands in ~5 ticks.');
    mark('insider buys', '#7f9be0');
    const newsTick = G.tick + 5;
    G.newsSchedule.push({ tick: newsTick, delta: +22, label: 'Company X confirms split talks' });
    runScript('insider', 8, (i) => {
      if (i === 2 || i === 3) {
        const a = bestAsk();
        placeOrder('INSIDER', 'buy', (a ? a.price : G.market.lastPrice) + 4, 150, 'insider');
        say('Insider accumulating YES ahead of the public — 150 shares on private information.');
      }
      if (i === 6) { say('The news is now public and the price jumps. The Insider already owns the move.'); mark('news ▲', '#7f9be0'); }
    }, () => endPlay());
  },
});

registerScenario({
  id: 'frontrun', name: 'Operator front-running', category: 'structure',
  what: 'The operator sees a large retail BUY about to hit the book, jumps in one tick ahead, then sells those shares into the customer at a worse price.',
  how: 'Surveillance flags the operator trading immediately ahead of a large opposite-side order.',
  run() {
    setPlay('structure', 'Operator front-running', 'OPERATOR');
    say('The operator can see orders before they execute. It spots a big customer buy coming.');
    attack('FRONT-RUN: operator spots a large incoming retail buy in the flow.');
    mark('front-run', '#7f9be0');
    runScript('frontrun', 6, (i) => {
      if (i === 0) {
        const a = bestAsk();
        placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 2, 120, 'frontrun');
        say('Operator buys 120 AHEAD of the customer — using its privileged view of the order flow.');
      } else if (i === 1) {
        const a = bestAsk();
        placeOrder('R2', 'buy', (a ? a.price : G.market.lastPrice) + 5, 200, 'bigretail');
        say('The big customer order arrives and pushes the price up...');
      } else if (i === 2) {
        const b = bestBid();
        if (b) placeOrder('OPERATOR', 'sell', b.price, 120, 'frontrun');
        say('...and the operator immediately sells into it for a riskless profit, worsening the customer\'s price.');
      }
    }, () => endPlay());
  },
});

registerScenario({
  id: 'sybil', name: 'Sybil / fake consensus', category: 'structure',
  what: 'One hidden entity uses many look-alike accounts (acct_9f2/1a7/4e0) to post coordinated buys, faking broad demand and a "consensus" real users trust.',
  how: 'Surveillance flags many distinct accounts sharing one beneficial owner acting in the same direction.',
  run() {
    setPlay('structure', 'Sybil / fake consensus', 'SOCK_A');
    say('Three accounts that LOOK independent are all the same person, buying together to fake a crowd.');
    attack('SYBIL: shadow entity coordinates 3 sock-puppets to fake demand.');
    mark('sybil', '#7f9be0');
    runScript('sybil', 18, () => {
      for (const s of ['SOCK_A', 'SOCK_B', 'SOCK_C']) {
        const a = bestAsk();
        placeOrder(s, 'buy', (a ? a.price : G.market.lastPrice) + 2, 15, 'sybil');
      }
    }, () => { say('It looked like broad conviction. It was one wallet wearing three masks.'); endPlay(); });
  },
});

/* ============================== ORACLE =============================== */

registerScenario({
  id: 'oracle_setup', name: 'Insider loads the wrong side', category: 'oracle',
  what: 'Ahead of a rigged resolution, the Insider builds a large SHORT (buys NO) while the crowd prices YES — betting on a corrupt "NO" only they know is coming.',
  how: 'Paired with resolution surveillance: a big contrarian bet just before a resolution that contradicts consensus is the oracle-capture signature.',
  run() {
    setPlay('oracle', 'Oracle capture — step 1: position', 'INSIDER');
    say('The crowd is turning bullish on YES. But the Insider knows the operator will rig it NO — so they secretly buy NO.');
    attack('ORACLE-SETUP: public bullish on YES; Insider secretly shorts, expecting a rigged NO.');
    mark('insider shorts', '#c07de0');
    G.newsSchedule.push({ tick: G.tick + 1, delta: +18, label: 'Positive signals — crowd leans YES' });
    runScript('oracle_setup', 16, () => {
      const b = bestBid();
      if (b) placeOrder('INSIDER', 'sell', b.price, 22, 'oracle-short');
    }, () => { say('Insider is now heavily NO while the market screams YES. Next: hit "Corrupt → NO".'); endPlay(); });
  },
});

/* ===================== PLATFORM / OPERATOR ========================== */

registerScenario({
  id: 'rig_fees', name: 'Rigged fees', category: 'operator',
  what: 'The operator silently raises the trading fee ~20x. Every user trade quietly bleeds value to the house.',
  how: 'Surveillance flags the abrupt fee-parameter change and the spike in operator fee revenue.',
  run() {
    const old = G.flags.feeBps;
    G.flags.feeBps = 300;
    setPlay('operator', 'Rigged fees', 'OPERATOR');
    say('The operator just raised the fee ' + old + '→300 bps without telling anyone. Every trade you make now bleeds cash.');
    attack('RIG-FEES: operator raised fee ' + old + '→300 bps silently.');
    mark('fees ×20', '#e0b341');
    logEvent({ type: 'param', key: 'feeBps', from: old, to: 300, traderId: 'OPERATOR' });
    setTimeout(() => { if (G.nowPlaying && G.nowPlaying.title === 'Rigged fees') endPlay(); }, 4000);
  },
});

registerScenario({
  id: 'freeze', name: 'Freeze withdrawals + exit', category: 'operator',
  what: 'The operator disables selling for users ("maintenance"), then dumps its own position while everyone is locked in and cannot exit.',
  how: 'Surveillance flags withdrawals frozen for users while the operator is net-selling — the exit-scam signature.',
  run() {
    G.flags.withdrawalsFrozen = true;
    setPlay('operator', 'Freeze withdrawals + exit', 'OPERATOR');
    say('The operator FROZE withdrawals. Try to sell now — you can\'t. Meanwhile the house dumps its own book.');
    attack('FREEZE: operator halts user withdrawals ("system maintenance").');
    mark('withdrawals frozen', '#e0b341');
    logEvent({ type: 'param', key: 'withdrawalsFrozen', from: false, to: true, traderId: 'OPERATOR' });
    runScript('freeze', 14, () => {
      const b = bestBid();
      if (b && trader('OPERATOR').shares > 0) placeOrder('OPERATOR', 'sell', b.price - 1, 60, 'exit');
    }, () => { say('Operator has exited. Users are still frozen, holding whatever is left.'); /* keep frozen state */ endPlay(); });
  },
});

registerScenario({
  id: 'operator_position', name: 'Hidden operator position', category: 'operator',
  what: 'The "neutral" house secretly takes a directional position using its privileged view of order flow — an undisclosed conflict of interest.',
  how: 'Surveillance flags any nonzero operator position at all.',
  run() {
    setPlay('operator', 'Hidden operator position', 'OPERATOR');
    say('The platform is supposed to be a neutral venue. Instead it is secretly betting alongside/against its own users.');
    attack('CONFLICT: operator secretly builds a directional position.');
    mark('house prop', '#e0b341');
    runScript('operator_position', 10, () => {
      const a = bestAsk();
      placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 2, 30, 'houseprop');
    }, () => endPlay());
  },
});

/* --------------------------- resolutions ----------------------------- */

function resolveHonest() {
  const outcome = G.fairValue >= 50 ? 'YES' : 'NO';
  mark('resolved ' + outcome, '#7f9be0');
  resolveMarket(outcome, 'Honest oracle: settled to the true outcome (' + outcome + ').');
  endPlay();
}
function resolveCorrupt(outcome) {
  mark('CORRUPT ' + outcome, '#c07de0');
  resolveMarket(outcome, 'CORRUPT oracle: the operator overrode the market to settle ' + outcome + '.');
  endPlay();
}
