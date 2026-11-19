/* =========================================================================
   globe.js: the interactive globe, drawn with d3-geo on a <canvas>.
   Orthographic projection, drag to spin, wheel/pinch to zoom, tap to pick.
   Everything (projection, view state, highlights) is kept in the closure
   returned by createGlobe; the game talks to it through a small API.
   ========================================================================= */

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createGlobe(canvas, world, { onPick, onHover, nameOf = c => c.name } = {}) {
  const ctx = canvas.getContext('2d');
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.4);
  const path = d3.geoPath(projection, ctx);
  const graticule = d3.geoGraticule10();
  const sphere = { type: 'Sphere' };

  const readColors = () => ({
    sea: css('--sea'), seaDeep: css('--sea-deep'), glow: css('--atmo'),
    land: css('--land'), island: css('--land-dim'), border: css('--border-line'),
    route: css('--route'), start: css('--start'), target: css('--target'),
    hint: css('--hint'), danger: css('--danger'), ink: css('--ink'), paper: css('--paper'),
    graticule: css('--graticule'), rim: css('--rim'),
  });
  let C = readColors();

  // Islands and microstates you can't walk to are drawn a shade darker.
  const islands = { type: 'FeatureCollection', features: world.countries.filter(c => c.neighbours.size === 0).map(c => c.feature) };
  const bounds = world.countries.map(c => d3.geoBounds(c.feature));

  let width = 0, height = 0, dpr = 1;
  let insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let baseScale = 300;
  let scale = 300;
  let rotation = [-20, -30, 0];

  // What to highlight
  let state = { start: null, target: null, chain: [], glow: null, solution: null, labels: true };
  let hover = null;
  let flash = null;            // { country, t0 }
  let spin = false;
  let dirty = true;
  let anim = null;             // running d3.timer for fly-to

  /* ---------------------------------------------------------- sizing */
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = r.width; height = r.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const freeW = width - insets.left - insets.right;
    const freeH = height - insets.top - insets.bottom;
    const prevBase = baseScale;
    baseScale = Math.max(120, Math.min(freeW, freeH) * 0.44);
    scale = scale * (baseScale / prevBase);
    dirty = true;
  }

  function applyView() {
    const cx = insets.left + (width - insets.left - insets.right) / 2;
    const cy = insets.top + (height - insets.top - insets.bottom) / 2;
    projection.translate([cx, cy]).scale(scale).rotate(rotation);
  }

  /* ---------------------------------------------------------- drawing */
  function fill(feature, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); path(feature); ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = 1;
  }

  function isVisible(lonlat) {
    const r = projection.rotate();
    return d3.geoDistance(lonlat, [-r[0], -r[1]]) < Math.PI / 2 - 0.08;
  }

  function label(country, text, color, textColor = C.ink) {
    if (!isVisible(country.centroid)) return;
    const [x, y] = projection(country.centroid);
    ctx.font = '650 13px Archivo, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 18;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 24, w, 22, 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x + 5, y - 3); ctx.lineTo(x, y + 3); ctx.fill();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 13);
  }

  function routeLine(countries, color, { dashed = false, width: lw = 2.5 } = {}) {
    if (countries.length < 2) return;
    const line = { type: 'LineString', coordinates: countries.map(c => c.centroid) };
    ctx.beginPath(); path(line);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dashed ? [2, 7] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of countries) {
      if (!isVisible(c.centroid)) continue;
      const [x, y] = projection(c.centroid);
      ctx.beginPath(); ctx.arc(x, y, dashed ? 3 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.seaDeep; ctx.stroke();
    }
  }

  function render(now) {
    applyView();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const [cx, cy] = projection.translate();
    const r = projection.scale();

    // Atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.18);
    halo.addColorStop(0, C.glow);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2); ctx.fill();

    // Ocean with a soft light from the upper left
    const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    sea.addColorStop(0, C.sea);
    sea.addColorStop(1, C.seaDeep);
    ctx.beginPath(); path(sphere); ctx.fillStyle = sea; ctx.fill();

    ctx.beginPath(); path(graticule);
    ctx.strokeStyle = C.graticule; ctx.lineWidth = 1; ctx.stroke();

    fill(world.fc, C.land);
    fill(islands, C.island);

    for (const c of state.chain) fill(c.feature, C.route, 0.8);
    if (state.glow) {
      for (const c of state.glow) fill(c.feature, C.hint);
      ctx.beginPath();
      for (const c of state.glow) path(c.feature);
      ctx.strokeStyle = C.route; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (state.start) fill(state.start.feature, C.start);
    if (state.target) fill(state.target.feature, C.target);
    if (hover && hover !== state.start && hover !== state.target) fill(hover.feature, '#ffffff', 0.45);

    if (flash) {
      const t = (now - flash.t0) / 700;
      if (t >= 1) flash = null;
      else fill(flash.country.feature, flash.color, 1 - t);
    }

    ctx.beginPath(); path(world.borders);
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.7; ctx.stroke();

    // Rim light
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = C.rim; ctx.lineWidth = 1; ctx.stroke();

    // Tiny countries (San Marino, Liechtenstein, Andorra…) get a ring so they can be found.
    const ring = (c, color) => {
      if (c.areaKm2 > 4000 || !isVisible(c.centroid)) return;
      const [x, y] = projection(c.centroid);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
    };
    if (state.glow) for (const c of state.glow) ring(c, C.route);
    for (const c of state.chain) ring(c, C.route);
    if (state.start) ring(state.start, C.start);
    if (state.target) ring(state.target, C.target);

    if (state.solution) routeLine(state.solution, '#ffffff', { dashed: true, width: 2 });
    routeLine(state.chain, C.route);

    if (state.labels) {
      if (state.start) label(state.start, nameOf(state.start), C.start);
      if (state.target) label(state.target, nameOf(state.target), C.target, '#fff');
    }
    if (hover && state.hoverNames && hover !== state.start && hover !== state.target) {
      label(hover, nameOf(hover), C.paper);
    }
  }

  function loop(now) {
    if (spin) { rotation[0] += 0.06; dirty = true; }
    if (dirty || flash) { render(now); dirty = false; }
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------- picking */
  function countryAt(x, y) {
    applyView();
    const ll = projection.invert([x, y]);
    if (!ll || !isVisible(ll)) return null;
    const [lon, lat] = ll;
    for (let i = 0; i < world.countries.length; i++) {
      const [[w, s], [e, n]] = bounds[i];
      if (lat < s || lat > n) continue;
      if (w <= e ? (lon < w || lon > e) : (lon < w && lon > e)) continue;
      if (d3.geoContains(world.countries[i].feature, ll)) return world.countries[i];
    }
    return null;
  }

  /* ---------------------------------------------------------- input */
  const pointers = new Map();
  let downAt = null;
  let moved = 0;
  let pinchStart = null;

  const local = e => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) { downAt = local(e); moved = 0; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), scale };
    }
    stopAnim();
    spin = false;
  });

  canvas.addEventListener('pointermove', e => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      // Plain hover with a mouse
      if (e.pointerType === 'mouse') {
        const c = countryAt(p[0], p[1]);
        if (c !== hover) { hover = c; dirty = true; onHover?.(c); }
        canvas.style.cursor = c ? 'pointer' : 'grab';
      }
      return;
    }
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      scale = clampScale(pinchStart.scale * d / pinchStart.dist);
      moved += 10;
      dirty = true;
      return;
    }
    const dx = p[0] - prev[0], dy = p[1] - prev[1];
    moved += Math.abs(dx) + Math.abs(dy);
    const k = 75 / scale;              // degrees per pixel, smaller when zoomed in
    rotation[0] += dx * k;
    rotation[1] = Math.max(-75, Math.min(75, rotation[1] - dy * k));
    canvas.style.cursor = 'grabbing';
    dirty = true;
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      canvas.style.cursor = 'grab';
      if (moved < 6 && downAt && e.type === 'pointerup') {
        const c = countryAt(downAt[0], downAt[1]);
        onPick?.(c);
      }
      downAt = null;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; dirty = true; onHover?.(null); } });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopAnim();
    scale = clampScale(scale * Math.exp(-e.deltaY * 0.0015));
    dirty = true;
  }, { passive: false });

  const clampScale = s => Math.max(baseScale * 0.85, Math.min(baseScale * 30, s));

  /* ---------------------------------------------------------- fly-to */
  function stopAnim() { if (anim) { anim.stop(); anim = null; } }

  /** Rotates and zooms so all given countries are in view. */
  function flyTo(countries, duration = 1100, fixedScale = null) {
    stopAnim();
    const pts = countries.map(c => c.centroid);
    const center = pts.length === 1 ? pts[0] : d3.geoCentroid({ type: 'MultiPoint', coordinates: pts });
    const spread = Math.max(0.12, ...pts.map(p => d3.geoDistance(center, p)));
    const want = fixedScale ?? clampScale(baseScale * Math.min(6, 0.95 / Math.sin(Math.min(Math.PI / 2, spread + 0.18))));

    const from = rotation.slice();
    const to = [-center[0], -center[1], 0];
    to[0] = from[0] + ((((to[0] - from[0]) % 360) + 540) % 360) - 180; // shortest way round
    const s0 = scale;
    const ease = d3.easeCubicInOut;
    anim = d3.timer(elapsed => {
      const t = Math.min(1, elapsed / duration);
      const k = ease(t);
      rotation = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, 0];
      // dip out a little mid-flight, like a camera pulling back
      const dip = Math.sin(Math.PI * k) * 0.18;
      scale = (s0 + (want - s0) * k) * (1 - dip);
      dirty = true;
      if (t >= 1) stopAnim();
    });
  }

  window.addEventListener('resize', () => { resize(); dirty = true; });
  resize();
  requestAnimationFrame(loop);

  /* ---------------------------------------------------------- public API */
  return {
    set(next) { state = { ...state, ...next }; dirty = true; },
    refreshColors() { C = readColors(); dirty = true; },
    redraw() { dirty = true; },
    flash(country, color = C.danger) { flash = { country, color, t0: performance.now() }; },
    flyTo,
    setSpin(on) { spin = on; },
    setInsets(next) { insets = { ...insets, ...next }; resize(); },
    zoomBy(f) { stopAnim(); scale = clampScale(scale * f); dirty = true; },
    nudge(dLon, dLat) { stopAnim(); rotation[0] += dLon; rotation[1] = Math.max(-75, Math.min(75, rotation[1] + dLat)); dirty = true; },
    reset() { flyTo([{ centroid: [20, 25] }], 900, baseScale); },
  };
}
