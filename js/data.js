/* =========================================================================
   data.js: countries, land borders and route finding
   Source: Natural Earth 1:50m admin-0 countries, as TopoJSON (world-atlas).
   Land neighbours come from the topology itself: two countries are
   neighbours when their polygons share an arc (topojson.neighbors).
   ========================================================================= */

const WORLD_URL = 'data/countries-50m.json';
const NAMES_TR_URL = 'data/names-tr.json';
const EARTH_R = 6371;

/** Short Natural Earth names → names players recognise. */
const NAME_FIX = {
  'United States of America': 'United States',
  'Turkey': 'Türkiye',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Eq. Guinea': 'Equatorial Guinea',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'Dominican Rep.': 'Dominican Republic',
  'N. Cyprus': 'Northern Cyprus',
  'Macedonia': 'North Macedonia',
};

/** Overseas territories make some "borders" you can't walk across. */
const BLOCKED_EDGES = [['France', 'Brazil'], ['France', 'Suriname']];

/** Walkable, but never used as a start or a goal (disputed or not a country). */
const NOT_ENDPOINTS = new Set(['Western Sahara', 'Somaliland', 'Northern Cyprus', 'Palestine', 'Kosovo', 'Hong Kong', 'Macao']);

/** Anything smaller can't be tapped even fully zoomed in (Vatican, Monaco, Macao…). */
const TINY_KM2 = 50;

/** Route lengths (in border crossings) for each level. */
export const HOPS = { 1: [5, 7], 2: [8, 11], 3: [12, 18] };

function mainCentroid(feature) {
  const g = feature.geometry;
  if (g.type !== 'MultiPolygon') return d3.geoCentroid(feature);
  let best = null, bestA = -1;
  for (const coords of g.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords };
    const a = d3.geoArea(poly);
    if (a > bestA) { bestA = a; best = poly; }
  }
  return d3.geoCentroid(best);
}

/** How hard a country is to spot: tiny ones score high. */
function smallness(c) {
  if (c.areaKm2 < 1000) return 4;
  if (c.areaKm2 < 12000) return 3;
  if (c.areaKm2 < 35000) return 2;
  if (c.areaKm2 < 110000) return 1;
  return 0;
}

export async function loadWorld() {
  const [topo, namesTr] = await Promise.all([
    fetch(WORLD_URL).then(r => { if (!r.ok) throw new Error(`World data answered ${r.status}`); return r.json(); }),
    fetch(NAMES_TR_URL).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);

  const geoms = topo.objects.countries.geometries;
  const neighbourIdx = topojson.neighbors(geoms);
  const fc = topojson.feature(topo, topo.objects.countries);

  const countries = fc.features.map((f, i) => {
    const raw = f.properties.name;
    const name = NAME_FIX[raw] ?? raw;
    return {
      idx: i,
      id: f.id,
      name,
      names: { en: name, tr: namesTr[raw] || name },
      feature: f,
      centroid: mainCentroid(f),
      areaKm2: d3.geoArea(f) * EARTH_R * EARTH_R,
      neighbours: new Set(),
    };
  });

  const blocked = new Set(BLOCKED_EDGES.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const playable = c => c.areaKm2 >= TINY_KM2 && c.name !== 'Siachen Glacier';

  neighbourIdx.forEach((list, i) => {
    const a = countries[i];
    if (!playable(a)) return;
    for (const j of list) {
      const b = countries[j];
      if (!playable(b) || blocked.has(`${a.name}|${b.name}`)) continue;
      a.neighbours.add(b);
    }
  });

  const borders = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const world = { countries, borders, fc };
  buildIndex(world);
  return world;
}

/**
 * All-pairs breadth-first search over the border graph (≈170 connected countries,
 * so this takes a few milliseconds). For every source we keep the distance in
 * crossings and how many different shortest routes exist.
 */
function buildIndex(world) {
  const nodes = world.countries.filter(c => c.neighbours.size > 0);
  const table = new Map();
  for (const s of nodes) {
    const dist = new Map([[s, 0]]);
    const ways = new Map([[s, 1]]);
    const queue = [s];
    while (queue.length) {
      const cur = queue.shift();
      const d = dist.get(cur);
      for (const n of cur.neighbours) {
        if (!dist.has(n)) { dist.set(n, d + 1); ways.set(n, ways.get(cur)); queue.push(n); }
        else if (dist.get(n) === d + 1) ways.set(n, ways.get(n) + ways.get(cur));
      }
    }
    table.set(s, { dist, ways });
  }
  world.hops = (a, b) => table.get(a)?.dist.get(b) ?? Infinity;
  world.ways = (a, b) => table.get(a)?.ways.get(b) ?? 0;
  world.nodes = nodes;
}

/** Fewest border crossings from a to b, as a list of countries (null if unreachable). */
export function shortestPath(a, b) {
  if (a === b) return [a];
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of cur.neighbours) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === b) {
        const path = [b];
        let p = cur;
        while (p) { path.unshift(p); p = prev.get(p); }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/**
 * Difficulty of a route:
 *  - length in crossings
 *  - small, easy-to-miss countries at the ends and along the way
 *  - how winding it is: walked distance vs. the straight line between the ends
 *  - how few different shortest routes there are (one single way is hardest)
 */
function difficulty(world, a, b, path) {
  const hops = path.length - 1;
  let walked = 0;
  for (let i = 1; i < path.length; i++) walked += d3.geoDistance(path[i - 1].centroid, path[i].centroid);
  const direct = Math.max(0.02, d3.geoDistance(a.centroid, b.centroid));
  const detour = Math.min(4, walked / direct);
  const smallEnds = smallness(a) + smallness(b);
  const smallPath = path.slice(1, -1).reduce((s, c) => s + smallness(c), 0);
  const ways = world.ways(a, b);
  return hops * 3 + smallEnds * 2.5 + smallPath * 1.2 + (detour - 1) * 5 + (ways === 1 ? 4 : ways <= 3 ? 2 : 0);
}

/**
 * Picks one of the hardest routes for a level. All pairs whose shortest route
 * falls in the level's length band are scored; one is drawn at random from the
 * top slice so games stay varied. Start/goal countries already used in this game are
 * skipped, and routes through countries seen on earlier routes are ranked lower.
 */
export function pickRoute(world, level, used = new Set(), seen = new Set()) {
  const [lo, hi] = HOPS[level];
  const ends = world.nodes.filter(c => !NOT_ENDPOINTS.has(c.name) && !used.has(c));
  const scored = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const h = world.hops(ends[i], ends[j]);
      if (h >= lo && h <= hi) scored.push([ends[i], ends[j]]);
    }
  }
  if (!scored.length) throw new Error('No route of that length left');

  // Score a random sample (keeps it fast and adds variety), then take the hardest slice.
  const sample = scored.length > 900 ? d3.shuffle(scored.slice()).slice(0, 900) : scored;
  const ranked = sample.map(([a, b]) => {
    const path = shortestPath(a, b);
    // Routes that reuse countries from earlier routes in this game score lower, for variety.
    const overlap = path.reduce((n, c) => n + (seen.has(c) ? 1 : 0), 0);
    return { a, b, path, score: difficulty(world, a, b, path) - overlap * 3 };
  }).sort((x, y) => y.score - x.score);
  const top = ranked.slice(0, Math.max(8, Math.round(ranked.length * 0.08)));
  const pick = top[Math.floor(Math.random() * top.length)];
  const [start, target] = Math.random() < 0.5 ? [pick.a, pick.b] : [pick.b, pick.a];
  const optimal = start === pick.a ? pick.path : pick.path.slice().reverse();
  return { start, target, optimal, hops: optimal.length - 1, score: pick.score };
}
