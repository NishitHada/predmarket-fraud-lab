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
      { label: 'Check who\'s trading', text: '⚑ Almost all the volume is a handful of accounts trading with <b>each other</b> — a wash-trading pattern. You can\'t confirm a single owner, but this "volume" isn\'t independent buying.' },
      { label: 'Check for news', text: '⚑ No filing, no outlet, nothing fundamental — the move is pure order flow, not information.' },
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
      { label: 'Check for disclosed conflicts', text: '⚑ The operator doesn\'t disclose whether it holds a position — so a conflict of interest at settlement <b>can\'t be ruled out</b>.' },
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
      { label: 'Check the order flow', text: '⚑ One account is quietly building a large position <b>against</b> the near-unanimous 86% market. You can\'t prove it\'s an insider — but it\'s trading like it knows the ruling.' },
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

  {
    key: 'source_conflict', category: 'oracle', family: 'trap', mode: 'fixed', fixedOutcome: 'NO', winSide: 'NO', nudge: 'YES',
    perp: { name: 'the project director', motive: 'both runs the launch and certifies it — and quietly bet NO' },
    question: '🚇 Will the Eastside metro extension open on schedule (Dec 31)?',
    startPrice: 45,
    intro: { title: 'Looks ready to open', body: 'Construction is done and the market is drifting toward <b>YES</b> — the line looks ready, and an <b>official authority</b> will certify the opening. Feels like a safe YES.', cta: 'Verify it →' },
    mission: 'An official will certify this. But who is that official — and do they have a stake?',
    clues: [
      { label: 'Check who certifies the result', text: '⚑ The certification comes from <b>one official</b> — the project director — whose office both <b>runs</b> the launch and <b>certifies</b> it. No separation of powers.' },
      { label: 'Check that official\'s stake', text: '⚑ Public disclosures show the project director holds a large <b>NO</b> position in this market. They control the date <i>and</i> profit if it slips.' },
    ],
    blame: 'You trusted a certification controlled by someone betting against it.',
    preseed() { storyMark('setup', 'Looks ready', 'Construction complete; the market drifts toward YES on an official certification.'); G.fairValue = 45; for (let k = 0; k < 4; k++) { G.fairValue = Math.min(72, G.fairValue + 7); const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price, 16, 'confshort'); G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = Math.min(72, G.fairValue + 0.4); const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price, 12, 'confshort'); },
    script(outcome) { storyMark('delay', 'Surprise "safety review"', 'The project director announces a last-minute delay — the exact outcome they bet on. It settles NO.'); G.fairValue = 12; runScript('s_conf', 14, () => { const b = bestBid(); if (b) placeOrder('INSIDER', 'sell', b.price - 1, 30, 'delay'); }, storyResolveTick); },
    truth: {
      title: 'The oracle was "independent" — the source wasn\'t.',
      gotcha(c) {
        if (c.walked) return 'You saw the person certifying the result was betting on it, and walked — <b>exactly right.</b>';
        if (c.side === 'NO') return 'You spotted the conflict and <b>faded the naive YES</b>. When the decider is compromised, the informed side is against the crowd.';
        return 'You trusted the "certification," but the official who controls it had bet NO — and delayed the opening to win.';
      },
      bullets: [
        'The platform\'s oracle was independent — but it just relays whatever <b>one official certifies</b>.',
        'That official both <b>controls the real-world event</b> (the launch date) and profits from NO — a direct conflict at the source of truth.',
        'Lesson class: <b>source / real-world manipulation</b> — an "independent oracle" is worthless if the human feeding it, or controlling the event, has a stake.',
      ],
      lesson: 'Trace the outcome all the way to its source. An oracle only relays a result — if the person who produces that result (or controls the underlying event) can bet on it, the market can be moved in the real world, not just on the tape.',
    },
    counter() { return 'The line\'s readiness never mattered — the person controlling the date wanted NO. Fading the crowd (Buy NO) paid; walking away was safe; trusting the "certification" lost.'; },
  },

  /* ---------------- CLEAN / winnable markets (family: 'clean') ---------- */
  {
    key: 'clean_verified', category: 'clean', family: 'clean', mode: 'legit', trueOutcome: 'YES', signalSide: 'YES', nudge: 'YES',
    perp: null,
    question: '🚆 Will the new metro line open to the public by Dec 31?',
    startPrice: 57,
    intro: { title: 'A boring, well-run market', body: 'Trades at <b>57% YES</b> on steady two-sided flow. No vertical chart, no mystery accounts, no drama — just a normal market.', cta: 'Look it over →' },
    mission: 'Not every market is a trap. Is this one clean — and is there an edge worth taking?',
    clues: [
      { label: 'Check the oracle', text: '✓ Resolution comes from an <b>independent</b> source — the transit authority\'s official schedule — with published rules.' },
      { label: 'Check the book & fees', text: '✓ The book is two-sided across a dozen distinct accounts, and fees are fixed at 1% and disclosed.' },
      { label: 'Check for a signal', text: '✓ The authority has <b>publicly confirmed</b> the December opening. The signal is real and points YES.' },
    ],
    blame: 'You entered on a verified edge.',
    preseed() { storyMark('clean', 'Clean setup', 'Independent oracle, diverse real liquidity, disclosed fees — no red flags.'); G.fairValue = 57; for (let k = 0; k < 5; k++) { G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = 57 + (Math.random() - 0.5); },
    script(outcome) { storyMark('resolve', 'Honest resolution', 'The independent oracle settles on the real outcome — no interference.'); G.fairValue = outcome === 'YES' ? 88 : 12; runScript('s_clean1', 10, () => { }, storyResolveTick); },
    truth: {
      title: 'A clean market — and a real edge.',
      gotcha(c) { if (c.result === 'won') return 'No red flags, an independent oracle, and a <b>verified public confirmation</b> — you correctly pressed a real edge.'; if (c.walked) return 'This market was actually <b>clean</b>. Walking away protected you from nothing — and cost you the profit. Restraint only helps when there\'s a trap.'; return 'The market was fair, but you bet <b>against</b> the verified signal.'; },
      bullets: ['Resolution was an <b>independent oracle</b> with published rules — not someone\'s discretion.', 'Liquidity was <b>real and diverse</b>; fees were fixed and disclosed.', 'A <b>verifiable public confirmation</b> gave you a genuine, checkable edge.'],
      lesson: 'The goal isn\'t to distrust everything — it\'s to tell clean from crooked. When ownership is diverse, the oracle is independent, fees are fixed, and a signal is verifiable, betting the signal is the +EV move.',
    },
    counter() { return 'This one was legit. Buying the verified side won; walking away was safe but left the profit on the table.'; },
  },

  {
    key: 'value_bet', category: 'clean', family: 'clean', mode: 'legit', trueOutcome: 'YES', signalSide: 'YES', nudge: 'NO',
    perp: null,
    question: '💊 Will the Phase III trial hit its primary endpoint?',
    startPrice: 38,
    intro: { title: 'The crowd looks too pessimistic', body: 'A cleanly-run market sitting at just <b>38% YES</b>. Nothing shady here — but is the crowd underrating this one?', cta: 'Dig in →' },
    mission: 'Fair markets can still misprice. Is there a verified edge the crowd is missing?',
    clues: [
      { label: 'Check the oracle', text: '✓ Resolves from the <b>public trial registry</b> — independent, with pre-registered success criteria.' },
      { label: 'Check the book & fees', text: '✓ Deep, diverse two-sided liquidity; fees fixed and disclosed. No manipulation signatures.' },
      { label: 'Check the data', text: '✓ The pre-registered <b>interim readout (public)</b> strongly supports success — 38% looks too low.' },
    ],
    blame: 'You pressed a verified value edge.',
    preseed() { storyMark('clean', 'Clean setup', 'Independent registry oracle, diverse liquidity, disclosed fees.'); G.fairValue = 38; for (let k = 0; k < 5; k++) { G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = 38 + (Math.random() - 0.5); },
    script(outcome) { storyMark('resolve', 'Honest resolution', 'The registry settles on the real result.'); G.fairValue = outcome === 'YES' ? 90 : 10; runScript('s_clean2', 10, () => { }, storyResolveTick); },
    truth: {
      title: 'A fair market — mispriced in your favor.',
      gotcha(c) { if (c.result === 'won') return 'You did the work, found the crowd was too pessimistic, and <b>pressed a real value edge.</b>'; if (c.walked) return 'This was a <b>clean, underpriced</b> market. Walking away avoided a trap that wasn\'t there — and skipped a +EV bet.'; return 'The public data supported YES, but you bet NO.'; },
      bullets: ['The market was <b>clean</b> — independent oracle, real liquidity, disclosed fees.', 'The crowd was simply <b>too pessimistic</b> vs. public pre-registered data.', 'A fair market can misprice — verifiable data turns that gap into your edge.'],
      lesson: 'Not every mispricing is manipulation. In a clean market, doing the reading can hand you a genuine, positive-EV edge the crowd missed.',
    },
    counter() { return 'This was a real value bet. Buying YES paid; walking away skipped free +EV.'; },
  },

  {
    key: 'clean_no', category: 'clean', family: 'clean', mode: 'legit', trueOutcome: 'NO', signalSide: 'NO', nudge: 'YES',
    perp: null,
    question: '📊 Will StartupY reach 1M users this quarter?',
    startPrice: 52,
    intro: { title: 'A cleanly-run coin-flip', body: 'Sits at <b>52% YES</b> — a genuine toss-up on a well-run market. No manipulation in sight.', cta: 'Assess it →' },
    mission: 'Clean doesn\'t mean "bet YES." Which way does the evidence actually point?',
    clues: [
      { label: 'Check the oracle', text: '✓ Independent oracle with a <b>published metric definition</b> for "1M users".' },
      { label: 'Check the book & fees', text: '✓ Real two-sided liquidity across many accounts; fees fixed and disclosed.' },
      { label: 'Check the data', text: '✓ Public dashboards show growth has <b>stalled</b> well short of the pace needed — the signal points NO.' },
    ],
    blame: 'You pressed the verified NO edge.',
    preseed() { storyMark('clean', 'Clean setup', 'Independent oracle, diverse liquidity, disclosed fees.'); G.fairValue = 52; for (let k = 0; k < 5; k++) { G.running = true; tickOnce(); } },
    duringBet() { G.fairValue = 52 + (Math.random() - 0.5); },
    script(outcome) { storyMark('resolve', 'Honest resolution', 'The independent oracle settles on the real outcome.'); G.fairValue = outcome === 'YES' ? 88 : 12; runScript('s_clean3', 10, () => { }, storyResolveTick); },
    truth: {
      title: 'A clean market that resolved NO.',
      gotcha(c) { if (c.result === 'won') return 'You checked the data, saw growth had stalled, and <b>pressed the NO edge</b> — clean ≠ "bet YES".'; if (c.walked) return 'This market was <b>clean</b>; there was no trap to avoid. Walking skipped a verifiable +EV bet on NO.'; return 'The verified signal pointed NO, but you bet YES.'; },
      bullets: ['The market was <b>fair and transparent</b> — no manipulation signatures.', 'The verifiable signal pointed <b>NO</b> — a clean market is not automatically a YES.', 'Reading the actual evidence (not the vibe) gave you the edge.'],
      lesson: '"Clean" tells you the market is fair, not which way to bet. The edge still comes from reading the real evidence — here it pointed NO.',
    },
    counter() { return 'A legit market. Buying NO won; buying YES lost; walking away skipped a real edge.'; },
  },
];

/* ---------------- coaching + game theory (per scenario) --------------- */
/* tips stream live during the bet phase in guided mode; optimal = the
   game-theoretic best play with an EV rationale, shown in the reveal.       */
const COACH = {
  momentum: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'One actor controls the price and can dump on longs or squeeze shorts — whichever way you lean, they take the other side. With no verifiable edge every bet is negative-EV, so folding (0) wins. Minimax: walking caps your worst case at $0.' },
    tips: ['Watch the tape — the same two accounts keep trading with each other. That round-trip pattern is how fake volume is made; treat this "volume" as unverified.', 'Search for a cause — there\'s no news or filing behind the move. It\'s being pushed by order flow, not discovered.', '➡ React: volume you can\'t attribute to real, independent buyers proves nothing. Don\'t chase — walk away.'],
  },
  fake_news: {
    optimal: { play: 'Fade it (Buy NO) — or walk', ev: 'EV(fade) > 0', why: 'The rare +EV spot: you can verify the "news" is unconfirmed, so you know something the chasers don\'t. Fading the spike is positive-EV; walking is 0; chasing the headline is negative-EV.' },
    tips: ['Trace the "flash" — it\'s one anonymous account, and no outlet, regulator, or filing corroborates it. Unverified.', 'Watch that account\'s own trades — it\'s selling YES into the spike its post created. Its incentive is to make you buy.', '➡ React: an unconfirmed headline is a claim, and the source is trading against it. Fade it (Buy NO), or walk.'],
  },
  rule_ambiguity: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'The winning condition is undefined and the resolver has full discretion, so settlement is adversarial regardless of the real event. No side is reliably +EV. Fold.' },
    tips: ['Read the resolution rules — "launch" is never defined (beta? waitlist?). Settlement is left to the operator\'s judgment.', 'Check for disclosures — the operator doesn\'t disclose its own position, so you can\'t rule out a conflict at settlement.', '➡ React: an undefined rule a discretionary party interprets is unwinnable. Walk away.'],
  },
  liquidity_mirage: {
    optimal: { play: 'Walk away (or size tiny)', ev: 'EV(sizeable bet) < 0', why: 'The displayed depth cancels on contact, so your expected fill is far worse than the screen — that slippage alone makes even a "correct" bet negative-EV. If you must trade, size tiny; best is to pass.' },
    tips: ['Probe the book with a tiny order — the big resting size pulls back as price approaches, and it\'s mostly one account. It\'s not real depth.', 'Check recent large fills — they printed far worse than the book showed. The depth evaporated on contact before.', '➡ React: liquidity you can make vanish isn\'t liquidity. Don\'t size in — walk away.'],
  },
  oracle: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'A single operator-controlled source decides the result with no backup, and someone is already positioned against the consensus. When one party can rule the outcome, the game is negative-sum for you regardless of price. Don\'t play.' },
    tips: ['Read the resolution terms — settlement comes from one operator-controlled source with no independent backup. Whoever runs it decides.', 'Watch the flow — one account is quietly taking the other side of a near-unanimous 86% market. You can\'t prove it\'s an insider, but it\'s trading like it knows something.', '➡ React: if a single party can rule the outcome, consensus is meaningless. Walk away.'],
  },
  exit: {
    optimal: { play: 'Walk away', ev: 'EV(any bet) < 0', why: 'You don\'t control your downside: the fee schedule can change, the price can be moved, and the exit can be frozen. When the counterparty controls your exit, no entry is +EV. Fold.' },
    tips: ['Check the fee schedule — it was recently raised ~20× to 300 bps (it\'s on the terms page). Every trade now bleeds to the house.', 'Read the withdrawal terms — the operator can pause withdrawals unilaterally "for maintenance," with no guarantee. Your exit isn\'t really yours.', '➡ React: if you can\'t trust the fees or the exit, don\'t enter. Walk away.'],
  },
  source_conflict: {
    optimal: { play: 'Fade it (Buy NO) — or walk', ev: 'EV(fade) > 0', why: 'Once you\'ve verified that the person who certifies the result also controls the launch date and is betting NO, the outcome is effectively decided against the naive YES crowd. Fading (Buy NO) is positive-EV; walking is safe; trusting the "certification" is negative-EV.' },
    tips: [
      'Read who certifies the result — it\'s a single official whose office both runs and certifies the launch. No separation of powers.',
      'Check disclosures — that official holds a large NO position. They can delay the opening and profit from it.',
      '➡ React: when the person who decides the real event is betting on it, the "independent" oracle is compromised. Fade the naive YES (Buy NO), or walk.',
    ],
  },
  clean_verified: {
    optimal: { play: 'Buy YES', ev: 'EV(YES) > 0', why: 'Clean market + a verifiable public confirmation = a real, checkable edge. Pressing it (Buy YES) is positive-EV. Walking away here just leaves money on the table — restraint is only optimal against a trap.' },
    tips: ['✓ Look at the flow — it\'s spread across a dozen distinct accounts, no single wallet dominating. That\'s real two-sided liquidity.', '✓ Read the resolution page — an independent authority with published, fixed rules. Settlement isn\'t anyone\'s discretion.', '➡ React: no red flags, and a public confirmation you can verify. That\'s a real edge — buying YES is +EV.'],
  },
  value_bet: {
    optimal: { play: 'Buy YES', ev: 'EV(YES) > 0', why: 'The market is fair but the crowd is too pessimistic — public pre-registered data supports YES far above 38%. That gap is your edge; buying YES is positive-EV.' },
    tips: ['✓ Check the oracle — a public trial registry with pre-registered, fixed criteria. Independent and readable.', '✓ Read the public interim data — it strongly supports success, well above the 38% the crowd is pricing.', '➡ React: a fair market can still misprice. You have a verifiable edge — Buy YES.'],
  },
  clean_no: {
    optimal: { play: 'Buy NO', ev: 'EV(NO) > 0', why: 'Clean market, but the public metrics show growth stalled well short of the target. The verified signal points NO — pressing NO is positive-EV. "Clean" does not mean "bet YES".' },
    tips: ['✓ Check the oracle — independent, with a published definition of "1M users." Clear, fixed criteria.', '✓ Read the public dashboards — growth has stalled well short of the pace needed. The evidence points NO.', '➡ React: clean market, but the verifiable data says NO. Buy NO — clean doesn\'t mean bet YES.'],
  },
};

const STRATEGY = {
  title: 'Know when to fold — and when to press',
  points: [
    ['🧭', 'Tell clean from crooked first.', 'Not every market is rigged. Your job is to classify: is the price real, the oracle independent, the fees fixed, the exit yours? Investigate before you commit — the answer decides everything else.'],
    ['🛑', 'Against a trap, folding is the minimax move.', 'When someone controls the price, the oracle, or your exit, every uninformed bet is negative-EV. You can\'t control the outcome, but walking away caps your worst case at $0 — often the best play on the board.'],
    ['🔍', 'Against a clean market, press a verified edge.', 'On a fair market, betting is +EV when you\'ve verified something the crowd is missing — a public confirmation, mispriced data. Here walking away is the mistake: it leaves real money on the table.'],
    ['🧱', 'One weak layer is enough.', 'Price, information, settlement, and platform can each fail independently. A single compromised layer turns a market into a trap — but if every layer checks out, it\'s a genuine opportunity.'],
  ],
};

function optNote(r, c) {
  const opt = COACH[r.key] && COACH[r.key].optimal; if (!opt) return '';
  if (r.family === 'clean') {                     // a genuine market — pressing the verified edge is optimal
    if (c.result === 'won') return '<div class="so-you good">✓ Optimal — you pressed a verified +EV edge.</div>';
    if (c.walked) return '<div class="so-you bad">✗ You walked from a clean market — safe, but you left +EV on the table. Not every market is a trap.</div>';
    return `<div class="so-you bad">✗ You bet ${c.side} against the verified signal in a fair market.</div>`;
  }
  const fadeable = r.mode === 'fixed';                  // a trap whose outcome is knowable → fade-able
  const fadeBtn = r.winSide === 'NO' ? 'Buy NO' : 'Buy YES';
  const fadedOK = fadeable && c.side === r.winSide;
  if (fadedOK) return '<div class="so-you good">✓ Optimal — you spotted the trap and faded it correctly.</div>';
  if (c.walked) return fadeable
    ? '<div class="so-you good">✓ Safe — you folded a trap (fading was +EV here).</div>'
    : '<div class="so-you good">✓ Optimal — you folded a −EV game.</div>';
  return `<div class="so-you bad">✗ You bet ${c.side} into a trap — the optimal play was to ${fadeable ? 'fade it (' + fadeBtn + ') or walk' : 'walk away'}.</div>`;
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

/* ---- research dossier: raw sources per scenario (free to read) ---- */
/* Deliberately mixed quality — official filings next to anonymous posts — so
   the player practises weighing sources, not just reading conclusions.       */
const RESEARCH = {
  momentum: [
    { icon: '📈', src: 'Price chart', text: '$MOON is up 34% in 20 minutes on record volume, with no pullbacks.' },
    { icon: '💬', src: 'Forum (new accounts)', text: '"This is THE one, generational wealth incoming 🚀" — near-identical posts from a dozen day-old accounts.' },
    { icon: '📰', src: 'News search', text: 'No wire, filing, or announcement mentions $MOON today. Nothing fundamental.' },
  ],
  fake_news: [
    { icon: '🚨', src: '@marketwire_now (unverified)', text: '"BREAKING: RivalCorp merger APPROVED — sources." Posted 3 minutes ago.' },
    { icon: '📰', src: 'Reuters / Bloomberg', text: 'No major wire has reported a decision, and no regulator filing exists.' },
    { icon: '🧾', src: 'On-chain activity', text: 'The same account that posted the "flash" is selling YES into the spike it caused.' },
  ],
  rule_ambiguity: [
    { icon: '📄', src: 'Market rules page', text: '"Resolves YES if StartupX launches this quarter." The word "launch" is never defined.' },
    { icon: '📰', src: 'TechBlog', text: 'StartupX plans a private beta and a waitlist; a full public launch is "TBD."' },
    { icon: '⚖️', src: 'Operator FAQ', text: '"Ambiguous cases are resolved at the platform\'s sole discretion."' },
  ],
  liquidity_mirage: [
    { icon: '📊', src: 'Order book', text: '900+ contracts stacked within 2¢ of mid on both sides — looks very deep.' },
    { icon: '🧾', src: 'Fill logs', text: 'Yesterday a 300-lot market order slipped 9¢ — far worse than the book implied.' },
    { icon: '💬', src: 'Forum', text: '"The depth vanishes the second you send size. Don\'t trust the screen."' },
  ],
  oracle: [
    { icon: '📄', src: 'Resolution terms', text: '"Settled by the platform\'s data feed." No independent or backup oracle is named.' },
    { icon: '📊', src: 'Market consensus', text: 'Market sits at 86% YES — near-unanimous.' },
    { icon: '🧾', src: 'Position disclosures', text: 'One account is quietly building a large NO position against the 86%.' },
  ],
  exit: [
    { icon: '📄', src: 'Fee schedule', text: 'Fee updated 2 days ago: 15 bps → 300 bps. The change was not announced.' },
    { icon: '⚖️', src: 'Terms of service', text: '"Withdrawals may be paused at any time for maintenance." No guarantee, no timeline.' },
    { icon: '💬', src: 'Forum', text: '"Anyone else unable to withdraw since yesterday? Support has gone silent."' },
  ],
  source_conflict: [
    { icon: '📰', src: 'Local news', text: 'Eastside metro construction is complete; opening "expected on schedule."' },
    { icon: '📄', src: 'Certification rules', text: 'The opening is certified by the project director\'s office — the same office that runs the project.' },
    { icon: '🧾', src: 'Disclosures', text: 'The project director personally holds a large NO position in this market.' },
  ],
  clean_verified: [
    { icon: '📰', src: 'Transit Authority (official)', text: 'Press release: "New metro line opens to the public Dec 28." Signed and dated.' },
    { icon: '📄', src: 'Resolution page', text: 'Resolves from the transit authority\'s official schedule — independent of the platform.' },
    { icon: '📊', src: 'Order book', text: 'Genuine two-sided liquidity across ~12 distinct accounts; fee fixed at 1%.' },
  ],
  value_bet: [
    { icon: '🧪', src: 'Trial registry (public)', text: 'Pre-registered interim readout meets the primary endpoint with margin.' },
    { icon: '📄', src: 'Resolution page', text: 'Resolves from the public registry — independent, with pre-registered criteria.' },
    { icon: '📊', src: 'Market', text: 'Trading at 38% YES — the crowd looks slow to price the public data.' },
  ],
  clean_no: [
    { icon: '📊', src: 'Public dashboard', text: 'StartupY user growth has been flat for 6 weeks — far off the 1M-by-quarter pace.' },
    { icon: '📄', src: 'Resolution page', text: 'Independent oracle; "1M users" is defined precisely in the rules.' },
    { icon: '📰', src: 'Multiple outlets', text: '"Y\'s growth has clearly stalled" — several independent reports agree.' },
  ],
};

function showResearch() {
  const m = document.getElementById('research-modal'); if (!m) return;
  const r = curRound(); if (!r) return;
  const items = (typeof RESEARCH !== 'undefined' && RESEARCH[r.key]) || [];
  m.querySelector('.story-card').innerHTML = `
    <div class="story-tag">📁 Research desk</div>
    <h2 class="research-h">${esc(r.question)}</h2>
    <p class="research-note">Raw sources — free to read. Some are reliable, some aren't; weighing them is the job. Your due-diligence checks verify the ones that matter.</p>
    <div class="research-list">${items.map(it => `<div class="research-item"><span class="ri-ico">${it.icon}</span><div><div class="ri-src">${esc(it.src)}</div><div class="ri-text">${esc(it.text)}</div></div></div>`).join('') || '<div class="empty">No documents for this market.</div>'}</div>
    <div class="story-actions"><button class="story-btn primary" onclick="hideResearch()">Back to the desk</button></div>`;
  m.classList.add('show');
}
function hideResearch() { const m = document.getElementById('research-modal'); if (m) m.classList.remove('show'); }

/* --------------------------- state machine ---------------------------- */

function setPhase(phase) { STORY.state.phase = phase; G.running = (phase === 'bet' || phase === 'running'); }

// In story mode the right column is otherwise empty, so move the Trade Tape
// there to declutter the left (Desk + Order Book stay together).
function storyLayout(on) {
  const tape = document.getElementById('panel-tape');
  const right = document.querySelector('.col.right');
  const left = document.querySelector('.col.left');
  if (!tape || !right || !left) return;
  (on ? right : left).appendChild(tape);   // back to the end of the left column on exit
}

function storyStart() {
  STORY.state.active = true;
  STORY.state.i = -1;
  STORY.state.results = [];
  STORY.state.deck = buildDeck();
  STORY.state.dd = DD_BUDGET;
  document.body.classList.add('story');
  storyLayout(true);
  storyNextRound();
}

// A balanced draw: 2–3 genuinely clean/winnable markets + the rest traps,
// so walking away isn't always right — the skill is telling them apart.
function buildDeck() {
  const clean = shuffle(STORY.pool.filter(s => s.family === 'clean'));
  const traps = shuffle(STORY.pool.filter(s => s.family !== 'clean'));
  const nClean = Math.random() < 0.5 ? 2 : 3;
  const deck = [...clean.slice(0, nClean), ...traps.slice(0, ROUNDS - nClean)];
  return shuffle(deck);
}

function storyExit() {
  STORY.state.active = false; STORY.state.phase = 'off';
  document.body.classList.remove('story');
  storyLayout(false);
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
    ? 'Guided mode: I\'ll read the signals live. <b>Place as many trades as you like</b> to build or adjust your position — then <b>Lock in</b> to let it resolve, or <b>Walk away</b>.'
    : 'Investigate, then <b>trade freely to build your position</b> (buy, add, reduce, flip) — and <b>Lock in</b> to resolve when you\'re set, or <b>Walk away</b>.');
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
    const cls = t => t.startsWith('➡') ? ' react' : (t.startsWith('✓') ? ' good' : '');
    const shown = tips.slice(0, STORY.state.coachN).map(t => `<div class="coach-tip${cls(t)}">${t}</div>`).join('');
    dd.innerHTML = `<div class="dd-head">🎓 Guided — reading the signals live (green = good, amber = red flag):</div><div class="coach-feed">${shown || '<div class="coach-tip dim">Watching the market…</div>'}</div>`;
  } else {
    renderDD();
  }
}

// legit → honest outcome; fixed → predetermined; rig → settles against your bet
function decideOutcome(r, side) {
  if (r.mode === 'legit') return r.trueOutcome;
  if (r.mode === 'fixed') return r.fixedOutcome;
  return opposite(side);
}

function storyWalkAway() {
  if (STORY.state.betLocked) return;
  STORY.state.betLocked = true; hideCoach();
  const r = curRound();
  STORY.state.playerSide = 'none';
  STORY.state.outcome = r.mode === 'rig' ? opposite(r.nudge || 'YES') : (r.mode === 'fixed' ? r.fixedOutcome : r.trueOutcome);
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
  STORY.state.outcome = decideOutcome(r, side);
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
  const side = STORY.state.playerSide;
  let result, won;
  if (r.family === 'clean') {
    if (walked) { result = 'missed'; won = false; }        // safe, but left +EV on the table
    else if (side === r.signalSide) { result = 'won'; won = true; }
    else { result = 'lost'; won = false; }
  } else {
    if (walked) { result = 'avoided'; won = true; }        // dodged a trap
    else { won = (r.mode === 'fixed' && side === r.winSide); result = won ? 'won' : 'lost'; }
  }
  STORY.state.results.push({ title: r.intro.title, key: r.key, pnl, result, walked, family: r.family });
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
  let resDetail;
  if (ls === 'YES' || ls === 'NO') {
    resDetail = ls === G.market.outcome
      ? `Settled ${G.market.outcome} — your ${ls} paid out $1/share.`
      : `Settled ${G.market.outcome} — your ${ls} is worth $0.`;
  } else { resDetail = `Settled ${G.market.outcome} (you weren't in it).`; }
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
  if (c.result === 'avoided') { verdict = `You walked away — <b>stake intact.</b>`; cls = 'up'; }
  else if (c.result === 'missed') { verdict = `You walked away from a <b>clean</b> market — safe, but you left the profit on the table.`; cls = 'warnclr'; }
  else if (c.result === 'won') { verdict = `You read it right and came out <b>+${money(c.pnl)}</b>.`; cls = 'up'; }
  else { verdict = `You lost <b>${money(-c.pnl)}</b> on this trade.`; cls = 'down'; }
  const gotcha = r.truth.gotcha ? r.truth.gotcha(c) : '';
  const culprit = r.perp
    ? `<div class="story-culprit">🎭 <b>${esc(r.perp.name)}</b> — ${esc(r.perp.motive)}.${bene ? ` Walked away <b class="up">+${money(bene.pnl)}</b>.` : ''}</div>`
    : `<div class="story-clean">✅ No bad actor here — this market was genuinely clean. The edge came from reading verifiable public info, and it settled honestly.</div>`;
  return `
    <div class="story-tag reveal">The reveal · Round ${STORY.state.i + 1}/${STORY.state.deck.length}</div>
    <div class="story-pnl ${cls}">${verdict}</div>
    <h2>${r.truth.title}</h2>
    ${gotcha ? `<div class="story-gotcha">${gotcha}</div>` : ''}
    <ul class="story-bullets">${bullets}</ul>
    ${culprit}
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
  const missed = STORY.state.results.filter(r => r.result === 'missed').length;
  const rows = STORY.state.results.map(r => `<div class="fin-row"><span>${esc(r.title)} <em>${r.result}</em></span><b class="${r.pnl < 0 ? 'down' : 'up'}">${signMoney(r.pnl)}</b></div>`).join('');
  let grade, blurb;
  if (end >= 1150) { grade = 'Master'; blurb = 'You folded every trap AND pressed the real edges. That\'s the whole skill: knowing which markets to trust.'; }
  else if (end >= 1000) { grade = 'Sharp'; blurb = 'Net positive — you told clean from crooked and came out ahead. A couple of edges slipped by.'; }
  else if (end >= 800) { grade = 'Even-ish'; blurb = 'You mostly protected your stake but left money on the table — walking away from clean markets too, not just traps.'; }
  else if (end >= 500) { grade = 'Singed'; blurb = 'The traps got you. Investigate first: the tempting setups are usually the ones built for you.'; }
  else { grade = 'Rekt'; blurb = 'The house owns you. Due diligence beats conviction — and not every market deserves a bet.'; }
  return `
    <div class="story-tag">Final score</div>
    <h2>${grade}</h2>
    <div class="fin-score"><div><span>Started with</span><b>${money(you.startCash)}</b></div><div class="arrow">→</div><div><span>Walked away with</span><b class="${end < you.startCash ? 'down' : 'up'}">${money(end)}</b></div></div>
    <div class="fin-tally">🚶 Dodged <b>${avoided}</b> trap${avoided !== 1 ? 's' : ''} · ✅ Won <b>${won}</b> · 💥 Lost <b>${lost}</b> · 😴 Missed <b>${missed}</b> clean market${missed !== 1 ? 's' : ''}<br><span class="fin-opt">🎲 Optimal plays: <b>${avoided + won}/${STORY.state.results.length}</b> (fold traps, press edges)</span></div>
    <div class="fin-rows">${rows}</div>
    <div class="fin-total">Net: <b class="${total < 0 ? 'down' : 'up'}">${signMoney(total)}</b> · ${esc(blurb)}</div>
    <div class="fin-risks">
      <div class="fin-risks-h">You met the ways a market gets rigged — independently of each other:</div>
      <div class="fr-row"><span class="fr-ico">📈</span><div><b>Price integrity</b> — pumps, wash trades, spoofed depth. Defense: attributable volume, real liquidity.</div></div>
      <div class="fr-row"><span class="fr-ico">📰</span><div><b>Information</b> — fake news, rumor cascades. Defense: verify the source before you react.</div></div>
      <div class="fr-row"><span class="fr-ico">⚖️</span><div><b>Settlement</b> — corrupt oracles, vague rules. Defense: independent resolution and clear, fixed criteria.</div></div>
      <div class="fr-row"><span class="fr-ico">🏦</span><div><b>Platform</b> — rigged fees, frozen exits. Defense: non-custodial settlement, disclosed terms.</div></div>
    </div>
    <div class="story-lesson">The skill was never picking YES or NO — it was <b>classifying the market first.</b> Investigate, fold the traps, and press the edges when every layer checks out. Distrust is a tool, not a religion.</div>
    <div class="story-actions"><button class="story-btn primary" onclick="storyStart()">↺ Play again (new draw)</button><button class="story-btn" onclick="showStrategy()">📐 The strategy</button><button class="story-btn" onclick="storyExit()">Explore the sandbox →</button></div>`;
}

/* ----------------------------- modal / coach -------------------------- */
function showStoryModal(html) { const ov = $('#story-modal'); ov.querySelector('.story-card').innerHTML = html; ov.classList.add('show'); }
function hideStoryModal() { if (typeof stopReplay === 'function') stopReplay(); const ov = $('#story-modal'); if (ov) ov.classList.remove('show'); }
function showCoach(prompt) { const c = $('#story-coach'); c.querySelector('.coach-text').innerHTML = prompt; c.classList.add('show'); }
function hideCoach() { const c = $('#story-coach'); if (c) c.classList.remove('show'); }
