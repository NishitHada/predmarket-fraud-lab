/* =========================================================================
   story.js — "Can you beat the house?" guided mode (v2).
   5 random rounds from a pool of traps. Each round you can investigate with a
   limited due-diligence budget, then Buy YES / Buy NO / or WALK AWAY.
   Betting into a rigged market loses; a few markets can be *faded*; walking
   away preserves capital. Winning = recognising traps, not trading skill.
   ========================================================================= */

const STORY = {
  state: {
    active: false, phase: 'off', i: -1, roundStartWealth: 0, betLocked: false,
    results: [], roundEvents: [], replay: null,
    deck: [], dd: 4, revealed: [], choice: null, outcome: null, playerSide: 'none',
    coached: true, coachN: 0, coachTick: 0,
  },
  pool: [],
};

const ROUNDS = 5;
const DD_BUDGET = 4;

function storyMark(kind, title, detail) { STORY.state.roundEvents.push({ tick: G.tick, kind, title, detail }); }
function storyActive() { return STORY.state.active; }
function curRound() { return STORY.state.deck[STORY.state.i]; }
function opposite(o) { return o === 'YES' ? 'NO' : 'YES'; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============================== the pool ============================== */
/* mode 'rig'   → betting either side loses (operator settles against you).
   mode 'fixed' → outcome is predetermined; betting winSide wins (fade-able).
   Walking away always preserves capital. nudge = the side the hype pushes.  */

STORY.pool = [
  {
    key: 'momentum', category: 'trade', mode: 'rig', nudge: 'YES',
    perp: { name: 'WhaleFund', motive: 'wants to offload a huge bag at the top' },
    question: '🚀 $MOON: will it print a new all-time high today?',
    startPrice: 46,
    intro: { title: 'A rocket everyone\'s talking about', body: 'Up over <b>30%</b> in minutes and still climbing, on huge volume. The chart is a straight line up. Feels like the easy trade of the day.', cta: 'Take a look →' },
    mission: 'Protect your $1,000. Is this momentum real — or bait?',
    clues: [
      { label: 'Check who\'s buying', text: '⚑ ~90% of the volume traces to WhaleFund and three look-alike accounts trading with each other.' },
      { label: 'Check the news', text: '⚑ There is no news. The move is pure order-flow — nothing fundamental behind it.' },
    ],
    blame: 'You chased a rally that one whale manufactured to sell into.',
    preseed() {
      storyMark('pump', 'Fake rally', 'WhaleFund + sock-puppets wash-trade to spike the price and fake the volume.');
      for (let k = 0; k < 12; k++) { G.fairValue = Math.min(80, G.fairValue + 2.2); const a = bestAsk(); placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 3, 55, 'pump'); placeOrder('SOCK_B', 'sell', Math.round(G.market.lastPrice), 22, 'wash'); placeOrder('SOCK_A', 'buy', Math.round(G.market.lastPrice), 22, 'wash'); G.running = true; tickOnce(); }
    },
    duringBet() { G.fairValue = Math.min(82, G.fairValue + 0.6); const a = bestAsk(); placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 2, 20, 'pump'); },
    script(outcome) {
      if (outcome === 'NO') { storyMark('dump', 'The dump', 'The whale unloads its entire position onto buyers; price collapses.'); G.fairValue = Math.max(8, G.market.lastPrice - 30); runScript('s_mom', 16, () => { const b = bestBid(); const d = Math.min(trader('WHALE').shares, 150); if (d > 0 && b) placeOrder('WHALE', 'sell', b.price - 1, d, 'dump'); }, storyResolveTick); }
      else { storyMark('squeeze', 'Short squeeze', 'You faded it — so the crew squeezed the shorts and pushed even higher.'); G.fairValue = Math.min(96, G.market.lastPrice + 18); runScript('s_mom', 16, () => { const a = bestAsk(); placeOrder('WHALE', 'buy', (a ? a.price : G.market.lastPrice) + 3, 60, 'squeeze'); }, storyResolveTick); }
    },
    truth: {
      title: 'That "momentum" was manufactured.',
      gotcha(c) { if (c.walked) return 'You walked away from a fake rally — <b>exactly right.</b>'; return c.side === 'YES' ? 'You bought the top and got dumped on.' : 'You faded it, so they squeezed the shorts. Fighting a rigged price is just another way to lose.'; },
      bullets: ['One entity <b>wash-traded</b> through sock-puppets to fake the volume and the chart.', 'It could push the price whichever way trapped you — dump on longs, squeeze shorts.', 'Names: <b>pump &amp; dump, wash trading, sybil accounts.</b>'],
      lesson: 'A vertical chart on unattributable volume is the easiest thing to fake. When one player controls the price, staying out is the only safe side.',
    },
    counter() { return 'Walking away kept your full stake. Chasing this cost real money — the rally only existed to create exit liquidity for the whale.'; },
  },

  {
    key: 'fake_news', category: 'oracle', mode: 'fixed', fixedOutcome: 'NO', winSide: 'NO', nudge: 'YES',
    perp: { name: 'a burner "news" account', motive: 'is short and needs you to buy the spike' },
    question: '📰 Will RivalCorp\'s merger be approved this week?',
    startPrice: 44,
    intro: { title: 'BREAKING: "Merger approved — sources"', body: 'A <b>breaking-news flash</b> just hit and YES is ripping upward. Everyone\'s piling in before it\'s "priced in." This is the moment, right?', cta: 'React →' },
    mission: 'A headline just moved the market. Trade the news — or verify it first?',
    clues: [
      { label: 'Check the source', text: '⚑ The "flash" is one anonymous account. No outlet, regulator, or filing corroborates it.' },
      { label: 'Check who\'s selling into it', text: '⚑ The same account that posted the news is quietly SELLING YES into the spike.' },
    ],
    blame: 'You chased an unverified headline before the market could check it.',
    preseed() { storyMark('news', 'BREAKING flash', 'An unverified "news" account posts a bullish rumor; odds spike before anyone can check it.'); G.fairValue = 44; for (let k = 0; k < 4; k++) { G.fairValue = Math.min(82, G.fairValue + 9); const a = bestAsk(); placeOrder('INSIDER', 'buy', (a ? a.price : G.market.lastPrice) + 4, 40, 'newsspike'); G.running = true; tickOnce(); } },
    duringBet() { const a = bestAsk(); placeOrder('INSIDER', 'sell', bestBid() ? bestBid().price : G.market.lastPrice, 18, 'newsfade'); },  // poster quietly sells into the hype
    script(outcome) { storyMark('retract', 'Retracted', 'The story is retracted as false. Odds collapse — YES was never going to happen.'); G.fairValue = 12; runScript('s_news', 14, () => { const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price - 1, 30, 'retract'); }, storyResolveTick); },
    truth: {
      title: 'The news was fake. The spike was the trap.',
      gotcha(c) { if (c.walked) return 'You waited for verification instead of chasing — <b>the right instinct.</b>'; if (c.side === 'NO') return 'You <b>faded the unverified spike</b> and it was retracted. Well read.'; return 'You bought the headline. It was retracted minutes later and YES collapsed.'; },
      bullets: ['A burner account posted an <b>unverified "breaking" flash</b> to move the odds.', 'It <b>sold into the spike</b> it created, then the story was retracted.', 'Lesson class: <b>information manipulation</b> — you can be harmed by data, not just price.'],
      lesson: 'A price reacts to information faster than anyone can verify it. Treat an unconfirmed headline as a claim, not a fact — the people who post them are often positioned against you.',
    },
    counter() { return 'Fading the spike (Buy NO) actually paid here, and walking away cost nothing. Only chasing the headline lost.'; },
  },

  {
    key: 'rule_ambiguity', category: 'oracle', mode: 'rig', nudge: 'YES',
    perp: { name: 'the operator', motive: 'wrote vague rules it can interpret in its own favor' },
    question: '🧩 Will StartupX "launch" its product this quarter?',
    startPrice: 63,
    intro: { title: 'A near lock — they\'re shipping', body: 'StartupX has all but confirmed a launch this quarter. The market sits at <b>63% YES</b> and the timeline looks solid. Easy YES?', cta: 'Consider it →' },
    mission: 'The event looks likely. But what exactly counts as a "launch"?',
    clues: [
      { label: 'Read the resolution rules', text: '⚑ The rules never define "launch." A private beta? A waitlist? The <b>operator decides</b>, at its discretion.' },
      { label: 'Check the operator\'s position', text: '⚑ The operator holds a position that profits if this resolves NO.' },
    ],
    blame: 'You bet on a market whose winning condition was never actually defined.',
    preseed() { storyMark('rules', 'Vague wording', 'The market\'s resolution criteria are undefined — "launch" is never specified.'); G.fairValue = 63; for (let k = 0; k < 5; k++) { G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = Math.min(70, G.fairValue + 0.4); },
    script(outcome) { storyMark('ruling', 'Operator ruling', 'StartupX did a soft beta launch — but the operator rules it "doesn\'t count," settling against you.'); runScript('s_rule', 10, () => { }, storyResolveTick); },
    truth: {
      title: 'It "sort of" happened. The operator ruled against you anyway.',
      gotcha(c) { if (c.walked) return 'You spotted that the rules were undefined and walked — <b>smart.</b>'; return `You bet <b>${c.side}</b> on a market with no real definition of winning, so the operator settled <b>${c.outcome}</b> against you.`; },
      bullets: ['The market never defined what "launch" meant — leaving <b>discretion to the operator.</b>', 'The event happened ambiguously; the operator interpreted the wording to settle against bettors.', 'Lesson class: <b>settlement risk</b> — badly specified markets are won at resolution, not on the event.'],
      lesson: 'Before you bet, read the resolution rules. If a human gets to "interpret" a vague question — especially one with a stake in the outcome — the market is exploitable no matter what happens in the real world.',
    },
    counter() { return 'There was no safe bet here — the wording guaranteed the operator could rule against either side. Walking away was the only way to keep your stake.'; },
  },

  {
    key: 'liquidity_mirage', category: 'trade', mode: 'rig', nudge: 'YES',
    perp: { name: 'a spoofer', motive: 'shows fake depth so you commit size, then pulls it' },
    question: '💧 Will the index close above 4,000 on Friday?',
    startPrice: 55,
    intro: { title: 'Deep, liquid, easy to size into', body: 'The order book looks <b>deep</b> — big size stacked on both sides at tight prices. Looks like you can get in large without moving the market. Load up?', cta: 'Inspect the book →' },
    mission: 'The book looks deep. Is that liquidity real — or a mirage?',
    clues: [
      { label: 'Probe the depth', text: '⚑ Nearly all the visible size is one account\'s resting orders — and they get cancelled the instant price approaches them.' },
      { label: 'Check fill history', text: '⚑ Recent large orders filled far worse than the book implied — the depth vanishes on contact.' },
    ],
    blame: 'You sized into "deep" liquidity that evaporated the moment you hit it.',
    preseed() { storyMark('mirage', 'Fake depth', 'A spoofer stacks large orders to make the book look deep and safe to trade.'); G.fairValue = 55; for (let k = 0; k < 4; k++) { placeOrder('WHALE', 'buy', G.market.lastPrice - 2, 300, 'wall'); placeOrder('WHALE', 'sell', G.market.lastPrice + 2, 300, 'wall'); G.running = true; tickOnce(); } },
    duringBet() { cancelAllFor('WHALE', 'wall'); placeOrder('WHALE', 'buy', G.market.lastPrice - 2, 320, 'wall'); placeOrder('WHALE', 'sell', G.market.lastPrice + 2, 320, 'wall'); },
    script(outcome) { storyMark('vanish', 'Liquidity vanishes', 'The instant you\'re committed, the spoofer pulls the walls; the price gaps and settles against you.'); cancelAllFor('WHALE', 'wall'); G.fairValue = outcome === 'NO' ? Math.max(8, G.market.lastPrice - 26) : Math.min(95, G.market.lastPrice + 26); runScript('s_liq', 12, () => { const b = bestBid(), a = bestAsk(); if (outcome === 'NO' && b) placeOrder('WHALE', 'sell', b.price - 1, 40, 'gap'); if (outcome === 'YES' && a) placeOrder('WHALE', 'buy', a.price + 1, 40, 'gap'); }, storyResolveTick); },
    truth: {
      title: 'The liquidity was a mirage.',
      gotcha(c) { if (c.walked) return 'You didn\'t trust the displayed depth and stayed out — <b>exactly the lesson.</b>'; return 'The moment you committed, the "deep" book vanished, your order slipped, and the price gapped against you.'; },
      bullets: ['A spoofer stacked large orders to make the book look <b>deep and safe.</b>', 'The size was never real — it was <b>pulled the instant you traded</b>, so you filled badly and got gapped.', 'Lesson class: <b>execution risk</b> — displayed liquidity is not guaranteed liquidity.'],
      lesson: 'A deep-looking order book is a promise, not a guarantee. Size that cancels the moment you approach it was never there to trade against — assume you\'ll move the price more than the screen suggests.',
    },
    counter() { return 'Walking away avoided the slippage entirely. Any size you sent into that "depth" would have filled far worse than the screen promised.'; },
  },

  {
    key: 'oracle', category: 'oracle', mode: 'rig', nudge: 'YES',
    perp: { name: 'an oracle insider', motive: 'knows the rigged result and takes your other side' },
    question: '🏦 Will the central bank cut interest rates at this meeting?',
    startPrice: 86,
    intro: { title: 'A near-certainty', body: 'The market has this at <b>86% YES</b> — almost unanimous. Buying YES at 86¢ to collect $1 looks like free money.', cta: 'Look closer →' },
    mission: 'The crowd is sure. But who actually decides the outcome?',
    clues: [
      { label: 'Check the oracle', text: '⚑ Resolution comes from a single source the operator controls — no independent or backup oracle.' },
      { label: 'Check for insiders', text: '⚑ One account is quietly building a large position AGAINST the 86% consensus.' },
    ],
    blame: 'You bought a "sure thing" whose result was decided by an interested party.',
    preseed() { G.fairValue = 86; for (let k = 0; k < 6; k++) { G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = 86; },
    script(outcome) { storyMark('insider', 'Insider bets against you', 'An insider who knows the ruling loads the opposite of your position.'); runScript('s_ora', 12, () => { if (outcome === 'NO') { const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price, 30, 'oracle-short'); } else { const a = bestAsk(); placeOrder('INSIDER', 'buy', (a ? a.price : G.market.lastPrice) + 2, 30, 'oracle-long'); } }, storyResolveTick); },
    truth: {
      title: 'The market was right. The referee was bought.',
      gotcha(c) { if (c.walked) return 'You noticed the outcome was controlled by one party and walked — <b>the right call.</b>'; return `You bet <b>${c.side}</b>, so the operator settled <b>${c.outcome}</b>. When one party decides the result, it just picks the side you\'re not on.`; },
      bullets: ['The outcome wasn\'t set by reality — a <b>single operator-controlled oracle</b> ruled it.', 'An <b>insider took the exact opposite of your position</b>, profiting from your loss.', 'Lesson class: <b>settlement risk</b> — price consensus is worthless if the settler can lie.'],
      lesson: 'You\'re not only betting on the event — you\'re trusting whoever decides it. A single, unaccountable oracle with no backup means the "odds" are theater.',
    },
    counter() { return 'No side could win — the settler chose the losing outcome after you committed. Walking away was the only positive-EV move.'; },
  },

  {
    key: 'exit', category: 'operator', mode: 'rig', nudge: 'YES',
    perp: { name: 'the operator', motive: 'skims fees, then freezes you in and dumps' },
    question: '📈 Will Company X beat its earnings estimate on Thursday?',
    startPrice: 50,
    intro: { title: 'Your read looks good', body: 'A clean coin-flip at <b>50¢</b> and sentiment is drifting your way. This time you\'re early, not chasing — and you can always sell to lock in gains.', cta: 'Set up →' },
    mission: 'You can always exit... can you? Check before you commit.',
    clues: [
      { label: 'Check the fee history', text: '⚑ Trading fees were quietly raised ~20× (to 300 bps) — every trade bleeds to the house.' },
      { label: 'Check withdrawal terms', text: '⚑ The operator can pause withdrawals unilaterally "for maintenance," with no guarantee.' },
    ],
    blame: 'You took a position on a venue that could — and did — lock you in.',
    preseed() { G.flags.feeBps = 300; storyMark('fees', 'Fees rigged', 'Fees were secretly cranked ~20×, skimming every trade.'); G.fairValue = 50; for (let k = 0; k < 5; k++) { const a = bestAsk(); placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 2, 40, 'houseprop'); G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = Math.min(66, G.fairValue + 0.8); },
    script(outcome) { storyMark('freeze', 'Withdrawals frozen', 'The operator freezes withdrawals, moves the price against you, and settles you out.'); G.flags.withdrawalsFrozen = true; if (outcome === 'NO') { G.fairValue = Math.max(8, G.market.lastPrice - 22); runScript('s_exit', 14, () => { const b = bestBid(); if (b && trader('OPERATOR').shares > 0) placeOrder('OPERATOR', 'sell', b.price - 1, 60, 'exit'); }, storyResolveTick); } else { G.fairValue = Math.min(95, G.market.lastPrice + 18); runScript('s_exit', 14, () => { const a = bestAsk(); placeOrder('OPERATOR', 'buy', (a ? a.price : G.market.lastPrice) + 3, 55, 'exit'); }, storyResolveTick); } },
    truth: {
      title: 'The house was playing against you the whole time.',
      gotcha(c) { if (c.walked) return 'You checked the fees and withdrawal terms and stayed out — <b>that\'s the win.</b>'; return `You bet <b>${c.side}</b>, but between 20× fees, frozen withdrawals, and the operator settling <b>${c.outcome}</b>, no side won.`; },
      bullets: ['Fees were <b>secretly set to 300 bps</b>, skimming every trade whichever way you bet.', 'When you tried to react, <b>withdrawals were frozen</b> — you couldn\'t exit.', 'Lesson class: <b>platform risk</b> — rigged fees + frozen exits + operator self-dealing = an exit scam.'],
      lesson: 'If a platform can change the fees, hold positions, move the price, and stop you withdrawing — all without disclosure — it isn\'t a market, it\'s a trap with a countdown.',
    },
    counter() { return 'Had withdrawals been independently controlled, you could have exited early for a small loss. Frozen in, you ate the whole move — walking away avoided it.'; },
  },
];

/* ---------------- coaching + game theory (per scenario) --------------- */
/* tips stream live during the bet phase in guided mode; optimal = the
   game-theoretic best play with an EV rationale, shown in the reveal.       */
const COACH = {
  momentum: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'One actor controls the price and can dump on longs or squeeze shorts — whichever way you lean, they take the other side. With no verifiable edge every bet is negative-EV, so folding (0) wins. Minimax: walking caps your worst case at $0.' },
    tips: ['Watch the tape — acct_9f2 keeps buying from acct_1a7. Same owner on both sides: the volume is fake.', 'The price is vertical but there\'s no news. One wallet is lifting every offer.', '➡ React: unattributable volume isn\'t demand. Don\'t chase — walk away.'],
  },
  fake_news: {
    optimal: { play: 'Fade it (Buy NO) — or walk', ev: 'EV(fade) > 0', why: 'The rare +EV spot: you can verify the "news" is unconfirmed, so you know something the chasers don\'t. Fading the spike is positive-EV; walking is 0; chasing the headline is negative-EV.' },
    tips: ['A "BREAKING" flash spiked YES — but it traces to one anonymous account, uncorroborated.', 'That same account is quietly selling YES into the spike it created.', '➡ React: unverified news is a claim, not a fact. Fade it (Buy NO), or walk.'],
  },
  rule_ambiguity: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'The winning condition is undefined and the resolver profits from ruling against you. Settlement is adversarial regardless of the real event, so no side is +EV. Fold.' },
    tips: ['The question says "launch" but never defines it — resolution is at the operator\'s discretion.', 'The operator holds a position that profits if it rules NO.', '➡ React: undefined rules + a conflicted resolver = unwinnable. Walk away.'],
  },
  liquidity_mirage: {
    optimal: { play: 'Walk away (or size tiny)', ev: 'EV(sizeable bet) < 0', why: 'The displayed depth cancels on contact, so your expected fill is far worse than the screen — that slippage alone makes even a "correct" bet negative-EV. If you must trade, size tiny; best is to pass.' },
    tips: ['The book looks deep, but that size is one account\'s — and it cancels when price approaches.', 'Recent large orders filled far worse than the book implied.', '➡ React: displayed liquidity isn\'t guaranteed. Don\'t size in — walk away.'],
  },
  oracle: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'A single operator-controlled oracle can settle whichever way beats you, and an insider already holds the other side. The game is negative-sum for you regardless of the price. Don\'t play.' },
    tips: ['Resolution comes from one operator-controlled source — no backup oracle.', 'An insider is loading the opposite of the 86% consensus.', '➡ React: consensus means nothing if the settler can lie. Walk away.'],
  },
  exit: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'You don\'t control your downside: fees can change, the price can be moved, and the exit can be frozen. When the counterparty controls your exit, no entry is +EV. Fold.' },
    tips: ['Fees were quietly raised ~20× — every trade bleeds to the house.', 'The operator can freeze withdrawals unilaterally — you may not be able to exit.', '➡ React: if you can\'t trust the fees or the exit, don\'t enter. Walk away.'],
  },
};

const STRATEGY = {
  title: 'The winning strategy is knowing when not to play',
  points: [
    ['🎲', 'It\'s negative-sum for the uninformed.', 'You\'re usually trading against someone who knows more or controls more — the price, the oracle, or the exit. An uninformed bet against an informed adversary is negative expected value.'],
    ['🛑', 'Walking away is the minimax move.', 'You can\'t control the outcome, but you can control your worst case. Not betting caps your loss at $0 — often the highest-EV option on the board. "The only winning move is not to play."'],
    ['🔍', 'Only bet with a verified edge.', 'Betting is +EV only when you know something the counterparty doesn\'t and can act on it — e.g. you\'ve verified a "news" flash is fake, so you fade it.'],
    ['🧱', 'Check the whole trust stack first.', 'Price, information, settlement, and platform can each be rigged independently. One weak layer makes the market a trap — investigate before you commit, not after.'],
  ],
};

function optNote(r, c) {
  const opt = COACH[r.key] && COACH[r.key].optimal; if (!opt) return '';
  const fadedOK = r.key === 'fake_news' && c.side === 'NO';
  if (fadedOK) return '<div class="so-you good">✓ Optimal — you had a verified edge and used it.</div>';
  if (c.walked) return r.key === 'fake_news'
    ? '<div class="so-you good">✓ Safe — you folded a trap (though fading was +EV here).</div>'
    : '<div class="so-you good">✓ Optimal — you folded a −EV game.</div>';
  return `<div class="so-you bad">✗ You bet ${c.side} into a −EV game — the optimal play was to ${r.key === 'fake_news' ? 'fade it or walk' : 'walk away'}.</div>`;
}

function storyToggleCoach() {
  STORY.state.coached = !STORY.state.coached;
  const b = document.getElementById('coach-toggle');
  if (b) { b.textContent = STORY.state.coached ? '🎓 Coach: ON' : '🎓 Coach: OFF'; b.classList.toggle('on', STORY.state.coached); }
  if (STORY.state.phase === 'bet') renderGuidance();
}

function showStrategy() {
  const m = document.getElementById('strategy-modal'); if (!m) return;
  m.querySelector('.story-card').innerHTML = `
    <div class="story-tag">Game theory</div>
    <h2>${STRATEGY.title}</h2>
    <div class="strat-list">${STRATEGY.points.map(p => `<div class="strat-row"><span class="strat-ico">${p[0]}</span><div><b>${p[1]}</b><div class="strat-d">${p[2]}</div></div></div>`).join('')}</div>
    <div class="story-lesson">Rule of thumb: <b>investigate first; if you can't establish an edge, walk.</b> You only bet when you can name exactly why the other side is wrong.</div>
    <div class="story-actions"><button class="story-btn primary" onclick="hideStrategy()">Got it</button></div>`;
  m.classList.add('show');
}
function hideStrategy() { const m = document.getElementById('strategy-modal'); if (m) m.classList.remove('show'); }

/* --------------------------- state machine ---------------------------- */

function setPhase(phase) { STORY.state.phase = phase; G.running = (phase === 'bet' || phase === 'running'); }

function storyStart() {
  STORY.state.active = true;
  STORY.state.i = -1;
  STORY.state.results = [];
  STORY.state.deck = shuffle(STORY.pool).slice(0, ROUNDS);
  STORY.state.dd = DD_BUDGET;
  document.body.classList.add('story');
  storyNextRound();
}

function storyExit() {
  STORY.state.active = false; STORY.state.phase = 'off';
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
  trader('YOU').cash = youCash;
  for (let k = 0; k < 3; k++) tickOnce();
  startLoop();
}

function storyNextRound() {
  STORY.state.i++;
  if (STORY.state.i >= STORY.state.deck.length) { storyFinish(); return; }
  const r = curRound();
  STORY.state.roundEvents = []; STORY.state.revealed = []; STORY.state.choice = null; STORY.state.outcome = null; STORY.state.playerSide = 'none';
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
  showCoach(STORY.state.coached
    ? 'Guided mode: I\'ll flag the red flags live. Then <b>Buy a side</b> or <b>Walk away</b>.'
    : 'Investigate with your due-diligence checks, then <b>Buy a side</b> or <b>Walk away</b>.');
  STORY.state.coachN = 0; STORY.state.coachTick = 0;
  renderGuidance();
  renderAll();
}

// spend a due-diligence check to reveal a clue
function storyDoDD(idx) {
  if (STORY.state.revealed.includes(idx)) return;
  if (STORY.state.dd <= 0) { toast('No due-diligence checks left this game.', 'warn'); return; }
  STORY.state.dd--;
  STORY.state.revealed.push(idx);
  renderGuidance();
}

// Guided mode streams the coach tips live; unguided shows DD-check buttons.
function renderGuidance() {
  const r = curRound(); if (!r) return;
  const dd = document.getElementById('dd-panel'); if (!dd) return;
  if (STORY.state.coached) {
    const tips = (COACH[r.key] && COACH[r.key].tips) || [];
    const shown = tips.slice(0, STORY.state.coachN).map(t => `<div class="coach-tip${t.startsWith('➡') ? ' react' : ''}">${t}</div>`).join('');
    dd.innerHTML = `<div class="dd-head">🎓 Guided — spotting the red flags live:</div><div class="coach-feed">${shown || '<div class="coach-tip dim">Watching the market…</div>'}</div>`;
  } else {
    renderDD();
  }
}

function storyWalkAway() {
  if (STORY.state.betLocked) return;
  STORY.state.betLocked = true; hideCoach();
  const r = curRound();
  STORY.state.playerSide = 'none';
  STORY.state.outcome = r.mode === 'fixed' ? r.fixedOutcome : opposite(r.nudge || 'YES');
  setPhase('running');
  attack('You walked away before committing.');
  r.script(STORY.state.outcome);
}

function storyLockIn() {
  if (STORY.state.betLocked) return;
  const pos = trader('YOU').shares;
  if (pos === 0) { toast('Buy a side first, or Walk away.', 'warn'); return; }
  STORY.state.betLocked = true; hideCoach();
  const r = curRound();
  const side = pos > 0 ? 'YES' : 'NO';
  STORY.state.playerSide = side;
  STORY.state.outcome = r.mode === 'fixed' ? r.fixedOutcome : opposite(side);   // rig scenarios settle against you
  setPhase('running');
  r.script(STORY.state.outcome);
}

// runScript onDone callbacks call this
function storyResolveTick() { storyResolve(); }

function storyResolve() {
  const r = curRound();
  const outcome = STORY.state.outcome;
  const walked = STORY.state.playerSide === 'none';
  resolveMarket(outcome, r.category === 'oracle' ? 'The operator settled this market ' + outcome + '.' : 'Market settled ' + outcome + '.');
  surveillanceOnResolve();
  setPhase('reveal');
  const pnl = youWealth() - STORY.state.roundStartWealth;
  const won = walked ? true : (r.mode === 'fixed' && STORY.state.playerSide === r.winSide);
  const result = walked ? 'avoided' : (won ? 'won' : 'lost');
  STORY.state.results.push({ title: r.intro.title, key: r.key, pnl, result, walked });
  STORY.state.replay = buildReplay(r);
  showStoryModal(renderReveal(r, { pnl, walked, won, result, side: STORY.state.playerSide, outcome }));
  if (typeof initReplay === 'function') initReplay(STORY.state.replay);
  renderAll();
}

function buildReplay(r) {
  const hist = G.priceHistory.map(p => ({ tick: p.tick, price: p.price }));
  const t0 = hist.length ? hist[0].tick : 0;
  const t1 = hist.length ? hist[hist.length - 1].tick : 1;
  const events = STORY.state.roundEvents.slice();
  const mine = G.trades.filter(t => t.buyerId === 'YOU' || t.sellerId === 'YOU');
  if (mine.length) {
    const first = mine[0]; const side = first.buyerId === 'YOU' ? 'YES' : 'NO';
    const qty = mine.reduce((s, t) => s + t.qty, 0);
    const avg = Math.round(mine.reduce((s, t) => s + t.price * t.qty, 0) / qty);
    const shown = side === 'YES' ? avg : 100 - avg;
    events.push({ tick: first.tick, kind: 'you', title: `You bought ${qty} ${side} @ ${shown}¢`, detail: r.blame || 'This is where you entered.' });
  } else {
    events.push({ tick: t1, kind: 'you', title: 'You walked away', detail: 'You took no position — you kept your stake.' });
  }
  const ls = STORY.state.playerSide;
  const resDetail = (ls === 'YES' || ls === 'NO') ? `Settled ${G.market.outcome} — your ${ls} is worth $0.` : `Settled ${G.market.outcome} (you weren't in it).`;
  events.push({ tick: t1, kind: 'resolve', title: `Resolved ${G.market.outcome}`, detail: resDetail });
  events.sort((a, b) => a.tick - b.tick);
  return { hist, t0, t1, events, outcome: G.market.outcome };
}

function storyFinish() { setPhase('finish'); showStoryModal(renderFinish()); renderAll(); }

function storyTick() {
  if (STORY.state.phase !== 'bet') return;
  const r = curRound(); if (!r) return;
  if (r.duringBet) r.duringBet();
  if (STORY.state.coached) {
    STORY.state.coachTick++;
    const tips = (COACH[r.key] && COACH[r.key].tips) || [];
    if (STORY.state.coachTick % 3 === 0 && STORY.state.coachN < tips.length) { STORY.state.coachN++; renderGuidance(); }
  }
}

/* ------------------------------ rendering ----------------------------- */

function biggestBeneficiary() {
  let best = null, val = -Infinity;
  for (const id of Object.keys(G.traders)) { const t = trader(id); if (t.kind === 'mm' || t.kind === 'retail' || t.id === 'YOU') continue; const pnl = t.cash - t.startCash; if (pnl > val) { val = pnl; best = t; } }
  return best ? { name: best.name, role: best.kind, pnl: val } : null;
}

function renderIntro(r) {
  return `
    <div class="story-tag">Round ${STORY.state.i + 1} of ${STORY.state.deck.length}</div>
    <h2>${r.intro.title}</h2>
    <div class="story-q">${esc(r.question)}</div>
    <p>${r.intro.body}</p>
    <div class="story-mission">🎯 ${r.mission}</div>
    <div class="story-actions"><button class="story-btn primary" onclick="storyEnterBet()">${r.intro.cta}</button></div>
    <div class="story-fine">You have ${money(trader('YOU').cash)}. You can investigate before you decide — and you can always walk away.</div>`;
}

function renderDD() {
  const c = $('#story-coach'); if (!c) return;
  const r = curRound(); if (!r) return;
  const clues = (r.clues || []).map((cl, i) => {
    const done = STORY.state.revealed.includes(i);
    return done
      ? `<div class="dd-clue">${cl.text}</div>`
      : `<button class="dd-btn" onclick="storyDoDD(${i})">🔍 ${esc(cl.label)}</button>`;
  }).join('');
  const dd = c.querySelector('#dd-panel');
  if (dd) dd.innerHTML = `<div class="dd-head">🎯 ${esc(r.mission)} <span class="dd-budget">Due-diligence checks left: <b>${STORY.state.dd}</b></span></div><div class="dd-clues">${clues}</div>`;
}

function renderReveal(r, c) {
  const bene = biggestBeneficiary();
  const logs = G.attackLog.slice().reverse().map(a => `<div class="rlog"><span>t${a.tick}</span>${esc(a.msg)}</div>`).join('');
  const bullets = r.truth.bullets.map(b => `<li>${b}</li>`).join('');
  const isLast = STORY.state.i >= STORY.state.deck.length - 1;
  let verdict, cls;
  if (c.result === 'avoided') { verdict = `You walked away and kept your <b>${money(trader('YOU').cash - STORY.state.roundStartWealth + STORY.state.roundStartWealth)}</b> — stake intact.`; cls = 'up'; verdict = `You walked away — <b>stake intact.</b>`; }
  else if (c.result === 'won') { verdict = `You read it right and came out <b>+${money(c.pnl)}</b>.`; cls = 'up'; }
  else { verdict = `You lost <b>${money(-c.pnl)}</b> on this trade.`; cls = 'down'; }
  const gotcha = r.truth.gotcha ? r.truth.gotcha(c) : '';
  return `
    <div class="story-tag reveal">The reveal · Round ${STORY.state.i + 1}/${STORY.state.deck.length}</div>
    <div class="story-pnl ${cls}">${verdict}</div>
    <h2>${r.truth.title}</h2>
    ${gotcha ? `<div class="story-gotcha">${gotcha}</div>` : ''}
    <ul class="story-bullets">${bullets}</ul>
    <div class="story-culprit">🎭 <b>${esc(r.perp.name)}</b> — ${esc(r.perp.motive)}.${bene ? ` Walked away <b class="up">+${money(bene.pnl)}</b>.` : ''}</div>
    ${(() => { const o = COACH[r.key] && COACH[r.key].optimal; return o ? `<div class="story-optimal"><div class="so-h">🎲 Optimal play (game theory): <b>${o.play}</b> <span class="so-ev">${o.ev}</span></div><div class="so-why">${o.why}</div>${optNote(r, c)}</div>` : ''; })()}
    <div class="story-counter">↩︎ <b>Counterfactual:</b> ${r.counter ? r.counter(c) : ''}</div>
    <div class="replay">
      <div class="replay-head">▶ Replay — watch how it played out</div>
      <canvas id="replay-canvas"></canvas>
      <div id="replay-callout" class="replay-callout"></div>
      <div class="replay-controls"><button id="replay-play" class="replay-play">❚❚ Pause</button><input id="replay-scrub" type="range" min="0" max="100" value="0"></div>
      <div id="replay-chips" class="replay-chips"></div>
    </div>
    <div class="story-lesson">🧠 ${r.truth.lesson}</div>
    <details class="story-tape"><summary>Show the raw behind-the-scenes log ▾</summary><div class="rlogs">${logs}</div></details>
    <div class="story-actions"><button class="story-btn primary" onclick="storyNextRound()">${isLast ? 'See your final score →' : 'Next round →'}</button></div>`;
}

function renderFinish() {
  const you = trader('YOU');
  const end = you.cash, total = end - you.startCash;
  const avoided = STORY.state.results.filter(r => r.result === 'avoided').length;
  const won = STORY.state.results.filter(r => r.result === 'won').length;
  const lost = STORY.state.results.filter(r => r.result === 'lost').length;
  const rows = STORY.state.results.map(r => `<div class="fin-row"><span>${esc(r.title)} <em>${r.result}</em></span><b class="${r.pnl < 0 ? 'down' : 'up'}">${signMoney(r.pnl)}</b></div>`).join('');
  let grade, blurb;
  if (end >= 950) { grade = 'Untouchable'; blurb = 'You smelled nearly every rat. This is what beating the house actually looks like — mostly by refusing to play.'; }
  else if (end >= 750) { grade = 'Sharp'; blurb = 'You dodged most of the traps. A couple got you — review which tells you missed.'; }
  else if (end >= 500) { grade = 'Singed'; blurb = 'You took real damage. The setups that look most tempting are usually the ones built for you.'; }
  else { grade = 'Rekt'; blurb = 'The house owns you. Every "easy" market was bait — restraint and due diligence beat conviction here.'; }
  return `
    <div class="story-tag">Final score</div>
    <h2>${grade}</h2>
    <div class="fin-score"><div><span>Started with</span><b>${money(you.startCash)}</b></div><div class="arrow">→</div><div><span>Walked away with</span><b class="${end < you.startCash ? 'down' : 'up'}">${money(end)}</b></div></div>
    <div class="fin-tally">🚶 Walked away from <b>${avoided}</b> · ✅ Faded correctly <b>${won}</b> · 💥 Chased into <b>${lost}</b><br><span class="fin-opt">🎲 Game-theory-optimal plays: <b>${avoided + won}/${STORY.state.results.length}</b></span></div>
    <div class="fin-rows">${rows}</div>
    <div class="fin-total">Net: <b class="${total < 0 ? 'down' : 'up'}">${signMoney(total)}</b> · ${esc(blurb)}</div>
    <div class="fin-risks">
      <div class="fin-risks-h">You met the ways a market gets rigged — independently of each other:</div>
      <div class="fr-row"><span class="fr-ico">📈</span><div><b>Price integrity</b> — pumps, wash trades, spoofed depth. Defense: attributable volume, real liquidity.</div></div>
      <div class="fr-row"><span class="fr-ico">📰</span><div><b>Information</b> — fake news, rumor cascades. Defense: verify the source before you react.</div></div>
      <div class="fr-row"><span class="fr-ico">⚖️</span><div><b>Settlement</b> — corrupt oracles, vague rules. Defense: independent resolution and clear, fixed criteria.</div></div>
      <div class="fr-row"><span class="fr-ico">🏦</span><div><b>Platform</b> — rigged fees, frozen exits. Defense: non-custodial settlement, disclosed terms.</div></div>
    </div>
    <div class="story-lesson">Every market looked normal from the inside. The winning move was rarely a better bet — it was <b>investigating, and walking away when the answer was "you can't trust this."</b></div>
    <div class="story-actions"><button class="story-btn primary" onclick="storyStart()">↺ Play again (new draw)</button><button class="story-btn" onclick="storyExit()">Explore the sandbox →</button></div>`;
}

/* ----------------------------- modal / coach -------------------------- */
function showStoryModal(html) { const ov = $('#story-modal'); ov.querySelector('.story-card').innerHTML = html; ov.classList.add('show'); }
function hideStoryModal() { if (typeof stopReplay === 'function') stopReplay(); const ov = $('#story-modal'); if (ov) ov.classList.remove('show'); }
function showCoach(prompt) { const c = $('#story-coach'); c.querySelector('.coach-text').innerHTML = prompt; c.classList.add('show'); }
function hideCoach() { const c = $('#story-coach'); if (c) c.classList.remove('show'); }
