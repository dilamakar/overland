/* =========================================================================
   game.js: rules and state, written as closures. No DOM in here.
   ========================================================================= */

export const RULES = Object.freeze({
  startSeconds: 60,
  routes: 9,
  lives: 3,
  progressBonusSec: 3,     // every crossing that gets you closer to the goal
  shortestBonusSec: 10,    // finishing on the shortest route
  finishBonusPerSec: 30,   // reward for time left after the last route
});

export const LEVELS = [
  { n: 1, multiplier: 1, glow: true, hoverNames: true, distanceHint: true },
  { n: 2, multiplier: 1.5, glow: false, hoverNames: true, distanceHint: true },
  { n: 3, multiplier: 2, glow: false, hoverNames: false, distanceHint: false },
];

export const levelForRoute = i => LEVELS[Math.min(2, Math.floor(i / (RULES.routes / 3)))];

/**
 * Points for one finished route.
 *   100 per crossing on the shortest route, +300 if you matched it,
 *   −60 per extra crossing (but never below 40 per shortest crossing),
 *   speed bonus up to 300 (−4 per second), all × the level multiplier.
 */
export function scoreRoute({ hops, optimalHops, seconds, level }) {
  const extra = Math.max(0, hops - optimalHops);
  const route = extra === 0
    ? optimalHops * 100 + 300
    : Math.max(optimalHops * 40, optimalHops * 100 - extra * 60);
  const speed = Math.max(0, Math.round(300 - seconds * 4));
  return {
    route, speed, extra,
    shortest: extra === 0,
    multiplier: level.multiplier,
    points: Math.round((route + speed) * level.multiplier),
  };
}

/** Countdown clock. Remaining time and the animation frame live only in this closure. */
export function createClock(seconds, { onTick, onExpire }) {
  let remaining = seconds * 1000;
  let running = false;
  let last = 0;
  let raf = 0;

  function frame(now) {
    if (!running) return;
    remaining -= now - last;
    last = now;
    if (remaining <= 0) {
      remaining = 0;
      running = false;
      onTick(0);
      onExpire();
      return;
    }
    onTick(remaining / 1000);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running || remaining <= 0) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    add(sec) { remaining += sec * 1000; onTick(remaining / 1000); },
    get seconds() { return remaining / 1000; },
    get running() { return running; },
  };
}

/** Running total + history of finished routes. */
export function createScoreKeeper() {
  let total = 0;
  const history = [];
  return {
    add(entry) { total += entry.points; history.push(entry); return total; },
    bonus(points) { total += points; return total; },
    get total() { return total; },
    get history() { return history.slice(); },
  };
}

/** Lives with a change callback. */
export function createLives(count, onChange) {
  let left = count;
  onChange(left, count);
  return {
    lose() { left = Math.max(0, left - 1); onChange(left, count); return left; },
    get left() { return left; },
  };
}

/** The player's chain for the current route: start → … → target. */
export function createChain(start, target) {
  const list = [start];
  return {
    /**
     * Tries to step into `country`.
     * @returns {'added'|'arrived'|'backtrack'|'same'|'not-neighbour'}
     */
    step(country) {
      const last = list[list.length - 1];
      if (country === last) return 'same';
      const at = list.indexOf(country);
      if (at >= 0) { list.length = at + 1; return 'backtrack'; }
      if (!last.neighbours.has(country)) return 'not-neighbour';
      list.push(country);
      return country === target ? 'arrived' : 'added';
    },
    undo() { if (list.length > 1) list.pop(); return list.length; },
    get countries() { return list.slice(); },
    get last() { return list[list.length - 1]; },
    get hops() { return list.length - 1; },
  };
}

/** Top-10 table in localStorage (wrapped: storage can be blocked in private mode). */
export function createLeaderboard(key = 'overland.highscores.v1', size = 10) {
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(key)) || []; } catch { rows = []; }
  const save = () => { try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* ignore */ } };
  return {
    submit(name, score, routes) {
      const row = { name: name || 'Traveller', score, routes, date: Date.now() };
      rows.push(row);
      rows.sort((a, b) => b.score - a.score);
      rows = rows.slice(0, size);
      save();
      return rows.indexOf(row) + 1;
    },
    get rows() { return rows.slice(); },
    get best() { return rows[0]?.score ?? 0; },
  };
}
