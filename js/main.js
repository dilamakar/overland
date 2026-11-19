/* =========================================================================
   main.js: connects the globe, the game rules and the page.
   ========================================================================= */

import { loadWorld, pickRoute } from './data.js';
import { createGlobe } from './globe.js';
import {
  RULES, levelForRoute, scoreRoute, createClock, createScoreKeeper,
  createLives, createChain, createLeaderboard,
} from './game.js';
import { stampSVG, installInkFilter } from './stamps.js';
import { t, nameOf, getLang, setLang, locale, num, applyStatic } from './i18n.js';

/* ------------------------------------------------------------ DOM */
const $ = id => document.getElementById(id);
const el = {
  canvas: $('globe'), hud: $('hud'), visa: $('visa'), ctrl: $('globe-ctrl'),
  themeBtn: $('theme-btn'), langBtn: $('lang-btn'),
  clockWrap: $('clock-wrap'), clock: $('clock'), clockFill: $('clock-fill'),
  score: $('score'), routeN: $('route-n'), lives: $('lives'), pauseBtn: $('pause-btn'),
  levelChip: $('level-chip'), optimalHint: $('optimal-hint'),
  fromName: $('from-name'), toName: $('to-name'), stamps: $('stamps'), status: $('status'),
  undoBtn: $('undo-btn'), skipBtn: $('skip-btn'),
  zoomIn: $('zoom-in'), zoomOut: $('zoom-out'), recenter: $('recenter'),
  arrival: $('arrival'), arrKicker: $('arr-kicker'), arrTitle: $('arr-title'), arrLines: $('arr-lines'), nextBtn: $('next-btn'),
  startScreen: $('screen-start'), startForm: $('start-form'), startBtn: $('start-btn'), nameInput: $('player-name'),
  boardStart: $('board-start'), sample: $('sample'),
  pauseScreen: $('screen-pause'), resumeBtn: $('resume-btn'),
  overScreen: $('screen-over'), overReason: $('over-reason'), overScore: $('over-score'), overSub: $('over-sub'),
  overRank: $('over-rank'), stampsAll: $('stamps-all'), visitedCaption: $('visited-caption'),
  boardOver: $('board-over'), againBtn: $('again-btn'), menuBtn: $('menu-btn'), mrz: $('mrz'),
};

const RING = 2 * Math.PI * 19;           // circumference of the clock ring
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const safe = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const N = c => safe(nameOf(c));          // escaped country name in the current language

/* ------------------------------------------------------------ app state */
const board = createLeaderboard();
let world = null;
let globe = null;
let game = null;
let chart = null;
let lastOver = null;                     // summary of the last finished game (re-rendered on language change)

installInkFilter();
setMode('menu');
applyLanguage();
syncThemeButton();
try { el.nameInput.value = localStorage.getItem('overland.name') || ''; } catch { /* ignore */ }

/* ------------------------------------------------------------ boot */
loadWorld()
  .then(w => {
    world = w;
    globe = createGlobe(el.canvas, world, { onPick: handlePick, nameOf });
    layoutForMenu();
    globe.setSpin(true);
    el.startBtn.disabled = false;
    el.startBtn.textContent = t('start.go');
    renderSample();
  })
  .catch(err => {
    console.error(err);
    el.startBtn.textContent = t('start.failed');
  });

function setMode(mode) { document.body.dataset.mode = mode; }

/** Keep the globe in the space the panels leave free. */
function layoutForMenu() {
  if (!globe) return;
  globe.setInsets(isMobile()
    ? { top: 0, right: 0, left: 0, bottom: innerHeight * 0.5 }
    : { top: 0, right: 0, bottom: 0, left: Math.min(620, innerWidth * 0.42) });
}
function layoutForGame() {
  if (!globe) return;
  globe.setInsets(isMobile()
    ? { top: 64, right: 0, left: 0, bottom: el.visa.getBoundingClientRect().height }
    : { top: 76, right: 410, bottom: 0, left: 0 });
}
new ResizeObserver(() => { if (game && game.phase !== 'over') layoutForGame(); }).observe(el.visa);
addEventListener('resize', () => (game ? layoutForGame() : layoutForMenu()));

/* ------------------------------------------------------------ theme + language */
function syncThemeButton() {
  const day = document.documentElement.dataset.theme === 'day';
  const label = t(day ? 'pref.night' : 'pref.day');
  el.themeBtn.setAttribute('aria-label', label);
  el.themeBtn.title = label;
  document.querySelector('meta[name="theme-color"]').content = day ? '#E3EEF7' : '#0B2240';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'day' ? 'night' : 'day';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('overland.theme', next); } catch { /* ignore */ }
  syncThemeButton();
  globe?.refreshColors();
  if (lastOver && !el.overScreen.hidden) renderChart(lastOver.history);
}

function applyLanguage() {
  applyStatic();
  el.langBtn.textContent = getLang() === 'tr' ? 'EN' : 'TR';
  syncThemeButton();
  renderBoard(el.boardStart);
  if (world) { el.startBtn.textContent = t('start.go'); renderSample(); } else { el.startBtn.textContent = t('start.loading'); }
  globe?.redraw();
  if (game && game.route && game.phase !== 'over') {
    renderRoutePanel();
    renderStamps();
    setStatus(t('st.begin', { c: N(game.chain.last) }));
    if (!el.arrival.hidden && game.lastEntry) renderArrival(game.lastEntry);
  }
  if (lastOver && !el.overScreen.hidden) renderOver(lastOver);
}

function toggleLanguage() {
  setLang(getLang() === 'tr' ? 'en' : 'tr');
  applyLanguage();
}

/* ------------------------------------------------------------ rendering helpers */
function renderLives(left, total) {
  el.lives.replaceChildren(...Array.from({ length: total }, (_, i) => {
    const b = document.createElement('i');
    if (i >= left) b.className = 'is-lost';
    return b;
  }));
  el.lives.setAttribute('aria-label', `${left}/${total}`);
}

function renderClock(sec) {
  el.clock.textContent = Math.ceil(sec);
  el.clockFill.style.strokeDashoffset = RING * (1 - Math.min(1, sec / RULES.startSeconds));
  el.clockWrap.classList.toggle('is-low', sec <= 10);
}

function bumpClock() {
  el.clockWrap.classList.remove('is-bonus'); void el.clockWrap.offsetWidth; el.clockWrap.classList.add('is-bonus');
}

function renderBoard(listEl, you = 0) {
  listEl.replaceChildren(...board.rows.map((r, i) => {
    const li = document.createElement('li');
    const row = document.createElement('span');
    const name = document.createElement('span');
    name.textContent = r.name;
    const pts = document.createElement('b');
    pts.textContent = num(r.score);
    row.append(name, pts);
    li.append(row);
    if (i + 1 === you) li.classList.add('is-you');
    return li;
  }));
}

const today = () => new Date().toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: '2-digit' })
  .replace('.', '').toLocaleUpperCase(locale());

function makeStamp(country, opts, animate) {
  const { svg, rotate } = stampSVG(nameOf(country), {
    time: today(),
    locale: locale(),
    captions: { entry: t('stamp.entry'), start: t('stamp.start'), goal: t('stamp.goal') },
    ...opts,
  });
  const li = document.createElement('li');
  li.className = 'stamp' + (animate ? ' is-new' : '');
  li.style.setProperty('--r', `${rotate}deg`);
  li.innerHTML = svg;
  return li;
}

/** Four example stamps on the start screen (a real route: Türkiye → Croatia). */
function renderSample() {
  const names = ['Türkiye', 'Bulgaria', 'Serbia', 'Croatia'];
  const list = names.map(n => world.countries.find(c => c.name === n)).filter(Boolean);
  el.sample.replaceChildren(...list.map((c, i) => makeStamp(c, { n: i, kind: i === 0 ? 'start' : i === list.length - 1 ? 'goal' : 'entry' }, false)));
}

/** Redraws the stamps for the current chain; only the newest one animates. */
function renderStamps(animateLast = false) {
  const list = game.chain.countries;
  el.stamps.replaceChildren(...list.map((c, i) => makeStamp(c, {
    n: i,
    kind: i === 0 ? 'start' : c === game.route.target ? 'goal' : 'entry',
  }, animateLast && i === list.length - 1)));
  el.stamps.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'smooth' });
}

function renderRoutePanel() {
  const { level, route } = game;
  el.levelChip.textContent = t('chip', { n: level.n, name: t(`level.${level.n}`) });
  el.levelChip.dataset.level = level.n;
  el.optimalHint.textContent = level.distanceHint ? t('hint.shortest', { n: route.hops }) : t('hint.none');
  el.fromName.textContent = nameOf(route.start);
  el.toName.textContent = nameOf(route.target);
}

function setStatus(html, tone = '') {
  el.status.innerHTML = html;
  el.status.className = 'status' + (tone ? ` is-${tone}` : '');
}

function syncGlobe() {
  const last = game.chain.last;
  globe.set({
    start: game.route.start,
    target: game.route.target,
    chain: game.chain.countries,
    glow: game.level.glow ? [...last.neighbours].filter(c => !game.chain.countries.includes(c)) : null,
    hoverNames: game.level.hoverNames,
  });
  el.undoBtn.disabled = game.chain.hops === 0 || game.phase !== 'route';
}

/* ------------------------------------------------------------ game flow */
function startGame(e) {
  e?.preventDefault();
  if (!world) return;
  const name = el.nameInput.value.trim().slice(0, 16);
  try { localStorage.setItem('overland.name', name); } catch { /* ignore */ }

  game = {
    name,
    index: -1,
    phase: 'idle',               // idle | route | arrived | paused | ending | over
    level: null,
    route: null,
    chain: null,
    routeStartSec: 0,
    rewarded: new Set(),         // countries that already earned progress time this route
    used: new Set(),
    seen: new Set(),             // countries on earlier shortest routes (for variety)
    visited: new Set(),
    lastEntry: null,
    score: createScoreKeeper(),
    lives: createLives(RULES.lives, renderLives),
    clock: createClock(RULES.startSeconds, { onTick: renderClock, onExpire: () => endGame('time') }),
  };
  lastOver = null;
  el.score.textContent = '0';
  renderClock(RULES.startSeconds);

  el.startScreen.hidden = true;
  el.overScreen.hidden = true;
  el.hud.hidden = false;
  el.visa.hidden = false;
  el.ctrl.hidden = false;
  setMode('play');
  globe.setSpin(false);
  layoutForGame();
  nextRoute();
}

function nextRoute() {
  el.arrival.hidden = true;
  game.index += 1;
  if (game.index >= RULES.routes) return endGame('done');

  const level = levelForRoute(game.index);
  const newLevel = level !== game.level;
  game.level = level;
  game.route = pickRoute(world, level.n, game.used, game.seen);
  game.used.add(game.route.start).add(game.route.target);
  game.route.optimal.forEach(c => game.seen.add(c));
  game.chain = createChain(game.route.start, game.route.target);
  game.rewarded = new Set();
  game.lastEntry = null;

  el.routeN.textContent = game.index + 1;
  renderRoutePanel();
  renderStamps();

  const intro = newLevel && level.n > 1 ? t(`st.level${level.n}`) : '';
  setStatus(intro + t('st.begin', { c: N(game.route.start) }));

  globe.set({ solution: null });
  syncGlobe();
  globe.flyTo([game.route.start, game.route.target]);

  game.phase = 'route';
  game.routeStartSec = game.clock.seconds;
  game.clock.start();
}

/* Event handler 1: picking a country on the globe (tap or click). */
function handlePick(country) {
  if (!game || game.phase !== 'route') return;
  if (!country) { setStatus(t('st.sea')); return; }

  const from = game.chain.last;
  const result = game.chain.step(country);
  const target = game.route.target;

  switch (result) {
    case 'same':
      setStatus(t('st.same', { c: N(country) }));
      break;
    case 'backtrack':
      renderStamps();
      syncGlobe();
      setStatus(t('st.back', { c: N(country) }));
      break;
    case 'not-neighbour': {
      globe.flash(country);
      const left = game.lives.lose();
      el.lives.classList.remove('is-hit'); void el.lives.offsetWidth; el.lives.classList.add('is-hit');
      setStatus(t('st.wrong', { a: N(country), b: N(from) }), 'error');
      if (left === 0) { game.phase = 'ending'; game.clock.stop(); setTimeout(() => endGame('lives'), 900); }
      break;
    }
    case 'added': {
      game.visited.add(country);
      renderStamps(true);
      syncGlobe();
      const before = world.hops(from, target);
      const after = world.hops(country, target);
      const closer = after < before;
      // Progress buys time, but only once per country so walking back and forth earns nothing.
      if (closer && !game.rewarded.has(country)) {
        game.rewarded.add(country);
        game.clock.add(RULES.progressBonusSec);
        bumpClock();
      }
      if (!game.level.distanceHint) setStatus(t('st.in', { c: N(country), t: N(target) }), 'good');
      else if (closer) setStatus(t('st.closer', { c: N(country), n: after }), 'good');
      else setStatus(t('st.further', { c: N(country) }), 'error');
      break;
    }
    case 'arrived':
      game.visited.add(country);
      renderStamps(true);
      syncGlobe();
      finishRoute(false);
      break;
  }
}

function finishRoute(skipped) {
  game.clock.stop();
  game.phase = 'arrived';
  el.undoBtn.disabled = true;
  const { route, level } = game;
  const seconds = game.routeStartSec - game.clock.seconds;
  const hops = game.chain.hops;

  let entry;
  if (skipped) {
    entry = { points: 0, hops: null, optimalHops: route.hops, skipped: true, route: 0, speed: 0, shortest: false, multiplier: level.multiplier };
  } else {
    entry = { ...scoreRoute({ hops, optimalHops: route.hops, seconds: Math.max(0, seconds), level }), hops, optimalHops: route.hops, skipped: false };
    if (entry.shortest) { game.clock.add(RULES.shortestBonusSec); bumpClock(); }
  }
  entry.seconds = Math.max(0, seconds);
  entry.from = route.start;
  entry.to = route.target;
  entry.optimal = route.optimal;
  entry.level = level.n;
  game.score.add(entry);
  game.lastEntry = entry;
  el.score.textContent = num(game.score.total);

  setStatus(skipped ? t('st.skipped') : t('st.arrived', { t: N(route.target) }), skipped ? 'error' : 'good');

  if (skipped || !entry.shortest) globe.set({ solution: route.optimal });
  globe.set({ glow: null });
  globe.flyTo(skipped ? route.optimal : [...game.chain.countries, ...route.optimal], 900);

  renderArrival(entry);
  el.arrival.hidden = false;
  el.nextBtn.focus({ preventScroll: true });
}

function renderArrival(entry) {
  const s = t('unit.s');
  el.arrival.classList.toggle('is-skip', entry.skipped);
  if (entry.skipped) {
    el.arrKicker.textContent = t('arr.skipKicker');
    el.arrTitle.textContent = t('arr.skip', { m: entry.optimalHops });
  } else {
    el.arrKicker.textContent = t('arr.kicker', { t: nameOf(entry.to) });
    el.arrTitle.textContent = entry.shortest
      ? t('arr.best', { n: entry.hops })
      : t('arr.more', { n: entry.hops, m: entry.optimalHops });
  }
  const items = [];
  if (!entry.skipped) {
    items.push([`+${num(entry.route)}`, entry.shortest ? t('arr.lineBest') : t('arr.line')]);
    items.push([`+${num(entry.speed)}`, t('arr.speed', { s: entry.seconds.toFixed(1) })]);
    if (entry.multiplier > 1) items.push([`×${entry.multiplier}`, t('arr.level')]);
    if (entry.shortest) items.push([`+${RULES.shortestBonusSec} ${s}`, t('arr.clock'), 'is-good']);
  }
  if (entry.skipped || !entry.shortest) items.push(['', entry.optimal.map(nameOf).join(' → ')]);
  el.arrLines.replaceChildren(...items.map(([b, text, cls]) => {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    if (b) { const strong = document.createElement('b'); strong.textContent = b; li.append(strong, ' '); }
    li.append(text);
    return li;
  }));
  const last = game.index === RULES.routes - 1 || game.lives.left === 0;
  el.nextBtn.textContent = last ? t('arr.last') : t('arr.next');
}

function advance() {
  if (!game || game.phase !== 'arrived') return;
  if (game.lives.left === 0) return endGame('lives');
  nextRoute();
}

function undo() {
  if (!game || game.phase !== 'route' || game.chain.hops === 0) return;
  game.chain.undo();
  renderStamps();
  syncGlobe();
  setStatus(t('st.back', { c: N(game.chain.last) }));
}

function skip() {
  if (!game || game.phase !== 'route') return;
  game.lives.lose();
  finishRoute(true);
}

function pause() {
  if (!game || game.phase !== 'route') return;
  game.clock.stop();
  game.phase = 'paused';
  setMode('paused');
  el.pauseScreen.hidden = false;
  el.resumeBtn.focus();
}

function resume() {
  if (!game || game.phase !== 'paused') return;
  el.pauseScreen.hidden = true;
  setMode('play');
  game.phase = 'route';
  game.clock.start();
}

function endGame(reason) {
  if (!game || game.phase === 'over') return;
  game.clock.stop();
  game.phase = 'over';
  el.arrival.hidden = true;
  setMode('over');

  let finishBonus = 0;
  if (reason === 'done') {
    finishBonus = Math.round(game.clock.seconds * RULES.finishBonusPerSec);
    game.score.bonus(finishBonus);
  }
  const total = game.score.total;
  const history = game.score.history;
  const best = board.best;
  const rank = total > 0 ? board.submit(game.name, total, history.length) : 0;

  lastOver = {
    reason, total, history, finishBonus, rank,
    isBest: rank === 1 && total > best,
    visited: [...game.visited],
    name: game.name,
  };
  renderOver(lastOver);
  renderBoard(el.boardStart, rank);
  el.overScreen.hidden = false;
  el.againBtn.focus({ preventScroll: true });
}

function renderOver(o) {
  el.overReason.textContent = o.reason === 'done' ? t('over.done', { n: RULES.routes }) : t(`over.${o.reason}`);
  el.overScore.textContent = num(o.total);
  const done = o.history.filter(h => !h.skipped);
  const shortest = done.filter(h => h.shortest).length;
  el.overSub.textContent = o.history.length
    ? t('over.sub', { r: done.length, s: shortest, bonus: o.finishBonus ? num(o.finishBonus) : 0 })
    : t('over.none');
  el.overRank.textContent = o.isBest ? t('over.best') : o.rank ? t('over.rank', { n: o.rank }) : t('over.out');
  el.overRank.classList.toggle('is-best', o.isBest);
  renderBoard(el.boardOver, o.rank);
  el.visitedCaption.textContent = t('over.visited', { n: o.visited.length });
  el.stampsAll.replaceChildren(...o.visited.map((c, i) => makeStamp(c, { n: i + 1 }, false)));
  el.mrz.textContent = mrz(o.name, o.total, done.length, o.visited.length);
  renderChart(o.history);
}

/** Machine-readable-zone style summary, 44 characters per line like a real passport. */
function mrz(name, score, routes, countries) {
  const clean = (name || 'TRAVELLER').toLocaleUpperCase('en').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '<');
  const l1 = `P<OVL${clean}<<OVERLAND`.padEnd(44, '<').slice(0, 44);
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const l2 = `${String(score).padStart(7, '0')}<<${String(routes).padStart(2, '0')}RT<<${String(countries).padStart(2, '0')}CT<<${stamp}`.padEnd(44, '<').slice(0, 44);
  return `${l1}\n${l2}`;
}

function renderChart(history) {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  chart?.destroy();
  chart = new Chart($('chart'), {
    type: 'bar',
    data: {
      labels: history.map((_, i) => `${i + 1}`),
      datasets: [
        { label: t('chart.yours'), data: history.map(h => h.hops ?? 0), backgroundColor: history.map(h => h.skipped ? '#C9D3DC' : h.shortest ? css('--route') : css('--ink-blue')), borderRadius: 5, maxBarThickness: 26 },
        { label: t('chart.best'), data: history.map(h => h.optimalHops), backgroundColor: 'rgba(11,34,64,.16)', borderRadius: 5, maxBarThickness: 26 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, title: { display: true, text: t('chart.x') } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(11,34,64,.08)' } },
      },
      plugins: {
        legend: { labels: { boxWidth: 12, font: { family: 'Archivo' } } },
        tooltip: {
          callbacks: {
            title: items => { const h = history[items[0].dataIndex]; return h ? `${nameOf(h.from)} → ${nameOf(h.to)}` : ''; },
            afterBody: items => { const h = history[items[0].dataIndex]; return h ? (h.skipped ? t('chart.skipped') : t('chart.points', { p: num(h.points) })) : ''; },
          },
        },
      },
    },
  });
}

function backToMenu() {
  el.overScreen.hidden = true;
  el.hud.hidden = true;
  el.visa.hidden = true;
  el.ctrl.hidden = true;
  el.startScreen.hidden = false;
  setMode('menu');
  game = null;
  lastOver = null;
  globe.set({ start: null, target: null, chain: [], glow: null, solution: null });
  layoutForMenu();
  globe.reset();
  globe.setSpin(true);
}

/* ------------------------------------------------------------ event handlers */
/* Event handler 2: forms and buttons. */
el.startForm.addEventListener('submit', startGame);
el.againBtn.addEventListener('click', () => startGame());
el.menuBtn.addEventListener('click', backToMenu);
el.nextBtn.addEventListener('click', advance);
el.undoBtn.addEventListener('click', undo);
el.skipBtn.addEventListener('click', skip);
el.pauseBtn.addEventListener('click', pause);
el.resumeBtn.addEventListener('click', resume);
el.zoomIn.addEventListener('click', () => globe.zoomBy(1.4));
el.zoomOut.addEventListener('click', () => globe.zoomBy(1 / 1.4));
el.recenter.addEventListener('click', () => game && globe.flyTo([...game.chain.countries, game.route.target], 700));
el.themeBtn.addEventListener('click', toggleTheme);
el.langBtn.addEventListener('click', toggleLanguage);

/* Event handler 3: keyboard play. */
document.addEventListener('keydown', e => {
  if (!game || e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (k === 'p' || k === 'P' || k === 'Escape') { game.phase === 'paused' ? resume() : pause(); return; }
  if (game.phase === 'arrived' && (k === 'Enter' || k === ' ') && document.activeElement !== el.nextBtn) { e.preventDefault(); advance(); return; }
  if (game.phase !== 'route') return;
  const step = 8;
  if (k === 'ArrowLeft') globe.nudge(step, 0);
  else if (k === 'ArrowRight') globe.nudge(-step, 0);
  else if (k === 'ArrowUp') globe.nudge(0, -step);
  else if (k === 'ArrowDown') globe.nudge(0, step);
  else if (k === '+' || k === '=') globe.zoomBy(1.3);
  else if (k === '-') globe.zoomBy(1 / 1.3);
  else if (k === 'Backspace' || k === 'u' || k === 'U') undo();
  else return;
  e.preventDefault();
});

/* Event handler 4: pause automatically when the tab or phone screen is hidden. */
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

