/* game-kit — the shared game core for drsamonline apps. Zero dependencies.
 *
 * The common engine every small browser game was re-implementing: a
 * fixed-timestep loop, an input manager, a tiny scene/state machine, save/load,
 * and maths helpers. Renders with plain canvas; no framework.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root) {
  "use strict";
  var G = { version: "0.2.0" };

  /* ---------- maths ---------- */
  G.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.rand = function (a, b) { return a + Math.random() * (b - a); };
  G.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  G.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  G.aabb = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
  G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* ---------- fixed-timestep loop ---------- */
  /* tick(dtSeconds) advances the simulation by whole fixed steps and returns how
     many updates ran, so it is deterministic and testable without a browser. */
  G.loop = function (opts) {
    opts = opts || {};
    var step = opts.step || 1 / 60;
    var maxFrame = opts.maxFrame || 0.25;
    var maxSteps = opts.maxSteps || 240;
    var acc = 0, last = 0, raf = null, running = false;

    function tick(dt) {
      if (!(dt > 0)) dt = 0;
      if (dt > maxFrame) dt = maxFrame;
      acc += dt;
      var steps = 0;
      while (acc + 1e-9 >= step && steps < maxSteps) { if (opts.update) opts.update(step); acc -= step; steps++; }
      if (steps >= maxSteps) acc = 0;               // never spiral
      if (opts.render) opts.render(acc / step);      // alpha for interpolation
      return steps;
    }
    function frame(t) {
      if (!running) return;
      var dt = last ? (t - last) / 1000 : 0; last = t;
      tick(dt);
      raf = root.requestAnimationFrame ? root.requestAnimationFrame(frame) : null;
    }
    return {
      tick: tick,
      start: function () { running = true; last = 0; if (root.requestAnimationFrame) raf = root.requestAnimationFrame(frame); },
      stop: function () { running = false; if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf); raf = null; },
      isRunning: function () { return running; }
    };
  };

  /* ---------- scene / state machine ---------- */
  G.Scenes = function () {
    var scenes = {}, current = null, name = null;
    return {
      add: function (id, scene) { scenes[id] = scene; return this; },
      go: function (id, data) {
        if (current && current.exit) current.exit();
        name = id; current = scenes[id] || {};
        if (current.enter) current.enter(data);
        return this;
      },
      update: function (dt) { if (current && current.update) current.update(dt); },
      render: function (a) { if (current && current.render) current.render(a); },
      current: function () { return name; }
    };
  };

  /* ---------- input (browser) ---------- */
  G.input = function (target) {
    target = target || root;
    var down = {}, pressed = {};
    function key(e, v) { var k = e.key; down[k] = v; if (v) pressed[k] = true; }
    var onDown = function (e) { key(e, true); };
    var onUp = function (e) { key(e, false); };
    target.addEventListener("keydown", onDown);
    target.addEventListener("keyup", onUp);
    return {
      isDown: function (k) { return !!down[k]; },
      wasPressed: function (k) { var p = !!pressed[k]; return p; },
      endFrame: function () { pressed = {}; },
      dispose: function () { target.removeEventListener("keydown", onDown); target.removeEventListener("keyup", onUp); }
    };
  };

  /* ---------- save / load (bring your own storage; web-kit fits) ---------- */
  G.save = function (storage, key) {
    key = key || "save";
    return {
      write: function (state) { try { storage.set(key, state); return true; } catch (e) { return false; } },
      read: function (fallback) { try { return storage.get(key, fallback); } catch (e) { return fallback; } },
      clear: function () { try { storage.remove(key); } catch (e) {} }
    };
  };


  /* ---------- seeded RNG (v2) ---------- */
  /* mulberry32: the same seed gives the same sequence, so a level or a spawn is
     reproducible. Use it instead of Math.random anywhere determinism matters. */
  G.rng = function (seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.rngInt = function (rng, a, b) { return Math.floor(a + rng() * (b - a + 1)); };
  G.rngPick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };

  /* ---------- entity-component system (v2) ---------- */
  /* An entity is an id plus a bag of components; behaviour lives in systems that
     run over entities holding the components they name. Systems run in the order
     they were added, and a world steps headless with no canvas - so the sim can
     be tested on its own. */
  G.ECS = function () {
    var next = 1, entities = {}, systems = [];
    var api = {
      create: function (comps) {
        var id = next++;
        entities[id] = {};
        if (comps) Object.keys(comps).forEach(function (k) { entities[id][k] = comps[k]; });
        return id;
      },
      destroy: function (id) { delete entities[id]; return api; },
      add: function (id, name, data) {
        (entities[id] = entities[id] || {})[name] = data === undefined ? {} : data;
        return api;
      },
      get: function (id, name) { var e = entities[id]; return e ? e[name] : undefined; },
      has: function (id, name) { var e = entities[id]; return !!(e && name in e); },
      remove: function (id, name) { var e = entities[id]; if (e) delete e[name]; return api; },
      ids: function () { return Object.keys(entities).map(Number); },
      count: function () { return Object.keys(entities).length; },
      system: function (required, fn) { systems.push({ required: required, fn: fn }); return api; },
      update: function (dt) {
        systems.forEach(function (s) {
          api.ids().forEach(function (id) {
            var all = true;
            for (var i = 0; i < s.required.length; i++) { if (!api.has(id, s.required[i])) { all = false; break; } }
            if (all) s.fn(id, entities[id], dt);
          });
        });
        return api;
      }
    };
    return api;
  };

  /* ---------- state machine (v2) ---------- */
  /* Named states and allowed transitions (boot -> menu -> play -> pause ->
     game-over -> again). send() refuses a transition the table does not allow. */
  G.Machine = function (cfg) {
    cfg = cfg || {};
    var transitions = cfg.transitions || {};
    var handlers = cfg.handlers || {};
    var state = cfg.initial;
    function enter(s, data) { if (handlers[s] && handlers[s].enter) handlers[s].enter(data); }
    enter(state);
    return {
      state: function () { return state; },
      can: function (event) { var t = transitions[state]; return !!(t && t[event]); },
      send: function (event, data) {
        var t = transitions[state];
        if (!t || !t[event]) return false;
        if (handlers[state] && handlers[state].exit) handlers[state].exit(event);
        state = t[event];
        enter(state, data);
        return true;
      }
    };
  };

  /* ---------- collision primitives (v2) ---------- */
  G.circleHit = function (a, b) { return G.dist(a.x, a.y, b.x, b.y) <= (a.r + b.r); };
  G.circleAabb = function (c, box) {
    var cx = G.clamp(c.x, box.x, box.x + box.w), cy = G.clamp(c.y, box.y, box.y + box.h);
    return G.dist(c.x, c.y, cx, cy) <= c.r;
  };

  /* ---------- a minimal 2-D physics step (v2) ---------- */
  /* Separate two overlapping axis-aligned boxes along the axis of least
     penetration, and reflect the mover's velocity along that axis (scaled by
     restitution), damping the other axis by friction. Not a general solver - it
     is the position correction + bounce that every small game rebuilds. */
  G.resolve = function (a, b, opts) {
    opts = opts || {};
    var rest = opts.restitution == null ? 0 : opts.restitution;
    var fric = opts.friction == null ? 0 : opts.friction;
    var acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
    var ox = (a.w + b.w) / 2 - Math.abs(acx - bcx);
    var oy = (a.h + b.h) / 2 - Math.abs(acy - bcy);
    if (ox <= 0 || oy <= 0) return null;
    if (ox < oy) {
      var s = acx < bcx ? -1 : 1;
      a.x += s * ox;
      if ((a.vx || 0) * s < 0) a.vx = -rest * (a.vx || 0);
      a.vy = (a.vy || 0) * (1 - fric);
      return { axis: "x", penetration: ox };
    }
    var sy = acy < bcy ? -1 : 1;
    a.y += sy * oy;
    if ((a.vy || 0) * sy < 0) a.vy = -rest * (a.vy || 0);
    a.vx = (a.vx || 0) * (1 - fric);
    return { axis: "y", penetration: oy };
  };

  root.Game = G;
})(typeof globalThis !== "undefined" ? globalThis : this);
