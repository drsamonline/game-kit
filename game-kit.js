/* game-kit — the shared game core for drsamonline apps. Zero dependencies.
 *
 * The common engine every small browser game was re-implementing: a
 * fixed-timestep loop, an input manager, a tiny scene/state machine, save/load,
 * and maths helpers. Renders with plain canvas; no framework.
 *
 * MIT License. (c) 2026 Dr Sohil Momin.
 */
(function (root) {
  "use strict";
  var G = { version: "0.1.0" };

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

  root.Game = G;
})(typeof globalThis !== "undefined" ? globalThis : this);
