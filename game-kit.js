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
  var G = { version: "1.3.0" };

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
      /* Book the next frame BEFORE doing any work. If the body throws and the
         guard below is itself somehow broken, the game still gets another
         frame instead of freezing on its last image — which is exactly how
         Eon Commando shipped a permanent freeze for two releases. */
      raf = root.requestAnimationFrame ? root.requestAnimationFrame(frame) : null;
      var dt = last ? (t - last) / 1000 : 0; last = t;
      try {
        tick(dt);
      } catch (err) {
        acc = 0;
        if (opts.onError) { try { opts.onError(err); } catch (e) {} }
        else if (root.console) { try { console.error("[game-kit] frame error:", err); } catch (e) {} }
      }
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


  /* =========================================================================
     G.text — layout that measures instead of assuming.

     Every layout bug in Eon Commando came from the same mistake: wrapping by
     character count. "26 characters" is only correct for one font at one size
     in one panel width; change any of the three and the line runs past the box.
     Measure the string, then break it.
     ========================================================================= */
  G.text = {
    /* wrap a string to a pixel width.
       measure(str) must return the rendered width in pixels. */
    wrap: function (str, maxPx, measure) {
      var words = String(str == null ? "" : str).split(/\s+/);
      var lines = [], cur = "";
      for (var i = 0; i < words.length; i++) {
        if (!words[i]) continue;
        var t = cur ? cur + " " + words[i] : words[i];
        if (measure(t) > maxPx && cur) { lines.push(cur); cur = words[i]; }
        else cur = t;
      }
      if (cur) lines.push(cur);
      /* a single word wider than the column: split it rather than overflow */
      for (var j = 0; j < lines.length; j++) {
        if (measure(lines[j]) <= maxPx) continue;
        var parts = [], buf = "";
        for (var k = 0; k < lines[j].length; k++) {
          var next = buf + lines[j][k];
          if (measure(next) > maxPx && buf) { parts.push(buf); buf = lines[j][k]; }
          else buf = next;
        }
        if (buf) parts.push(buf);
        lines.splice.apply(lines, [j, 1].concat(parts));
        j += parts.length - 1;
      }
      return lines;
    },

    /* the largest integer scale in [min, max] at which str fits maxPx */
    fitScale: function (str, maxPx, measure, max, min) {
      max = max || 4; min = min || 1;
      for (var sc = max; sc > min; sc--) { if (measure(str, sc) <= maxPx) return sc; }
      return min;
    },

    /* how many lines of `lineH` fit in `height`, at least 1 */
    linesThatFit: function (height, lineH) {
      return Math.max(1, Math.floor(height / lineH));
    },

    /* Glyph coverage. A bitmap font silently renders a missing character as a
       box or a question mark — Eon drew "?2" for weeks because U+00D7 was not
       in its 5x7 set. Pass the set of characters your font can draw. */
    missing: function (strings, charset) {
      var have = {}, out = [];
      for (var i = 0; i < charset.length; i++) have[charset[i]] = true;
      var seen = {};
      for (var s = 0; s < strings.length; s++) {
        var str = String(strings[s] || "");
        for (var c = 0; c < str.length; c++) {
          var ch = str[c];
          if (have[ch] || seen[ch] || /\s/.test(ch)) continue;
          seen[ch] = true;
          out.push(ch);
        }
      }
      return out;
    }
  };

  /* =========================================================================
     G.layout — percentage placement, so a control survives rotation, resize
     and the mobile address bar collapsing. Pixel positions survive none of
     those.
     ========================================================================= */
  G.layout = {
    pct: function (px, total) { return total ? (px / total) * 100 : 0; },
    px: function (pct, total) { return (pct / 100) * total; },
    clampPct: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

    /* apply a saved {x, y, scale, opacity} (x/y in percent) to an element */
    apply: function (el, box) {
      if (!el || !box) return;
      el.style.left = box.x + "%";
      el.style.top = box.y + "%";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transformOrigin = "top left";
      el.style.transform = "scale(" + (box.scale == null ? 1 : box.scale) + ")";
      if (box.opacity != null) el.style.opacity = box.opacity;
    },

    /* drag an element, reporting percentage positions as it moves.
       onChange({x, y}) is called on every move and once on release. */
    draggable: function (el, onChange, opts) {
      opts = opts || {};
      if (!el || !el.addEventListener) return function () {};
      var drag = null;
      function down(e) {
        if (opts.enabled && !opts.enabled()) return;
        var r = el.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        if (el.setPointerCapture && e.pointerId != null) el.setPointerCapture(e.pointerId);
        if (e.preventDefault) e.preventDefault();
      }
      function move(e) {
        if (!drag) return;
        var vw = root.innerWidth || 1, vh = root.innerHeight || 1;
        var x = G.layout.clampPct(((e.clientX - drag.dx) / vw) * 100, -6, 96);
        var y = G.layout.clampPct(((e.clientY - drag.dy) / vh) * 100, 2, 96);
        el.style.left = x + "%"; el.style.top = y + "%";
        el.style.right = "auto"; el.style.bottom = "auto";
        drag.x = x; drag.y = y;
        if (onChange) onChange({ x: x, y: y, done: false });
      }
      function up() {
        if (!drag) return;
        var d = drag; drag = null;
        if (onChange) onChange({ x: d.x, y: d.y, done: true });
      }
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      return function detach() {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
    }
  };

  /* =========================================================================
     G.audit — test-time checks for the things a screenshot will not catch.

     A viewport check cannot catch a box overflow: text can be perfectly on
     screen while spilling out of its panel. Eon's first overflow audit passed
     for that reason. These helpers assert against the box.
     ========================================================================= */
  G.audit = {
    /* record every string drawn through `drawText` for one frame.
       drawText(g, str, x, y, scale, align, widthFn) */
    record: function (drawText, frameFn) {
      var seen = [];
      var wrapped = function (g, str, x, y, scale, align, widthFn) {
        scale = scale || 1;
        var w = widthFn ? widthFn(str, scale) : 0;
        var left = align === "center" ? x - w / 2 : (align === "right" ? x - w : x);
        seen.push({ str: String(str), x1: left, x2: left + w, y1: y, y2: y + 7 * scale });
        return drawText.apply(null, arguments);
      };
      frameFn(wrapped);
      return seen;
    },

    inside: function (rect, r, tol) {
      tol = tol || 1.5;
      return r.x1 >= rect.x - tol && r.x2 <= rect.x + rect.w + tol &&
             r.y1 >= rect.y - tol && r.y2 <= rect.y + rect.h + tol;
    },

    /* every recorded string that falls outside `rect` */
    overflow: function (records, rect, tol) {
      var out = [];
      for (var i = 0; i < records.length; i++) {
        if (!G.audit.inside(rect, records[i], tol)) out.push(records[i]);
      }
      return out;
    },

    /* two rectangles must not overlap */
    overlap: function (a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
  };


  /* =========================================================================
     G.VoxelWorld — chunked voxel storage, greedy meshing, edit operations.

     A world is a SPARSE MAP OF FIXED-SIZE CHUNKS, not one giant array: that is
     what makes an editable 3-D world possible in a browser. An empty chunk
     costs nothing, and a chunk that is emptied is dropped.

     Greedy meshing merges adjacent faces that share a block id into one quad,
     so a solid 16^3 chunk costs 6 quads instead of 1,536. Without it voxel
     rendering is unusable; with it a field is a handful of polygons.
     (Technique from cuberite / TrueCraft / WorldEdit, all read for the
     algorithm only — no code copied.)
     ========================================================================= */
  G.VoxelChunk = function (size) {
    size = size || 16;
    return { size: size, blocks: new Uint16Array(size * size * size), count: 0 };
  };

  G.VoxelWorld = function (opts) {
    opts = opts || {};
    var S = opts.chunkSize || 16;
    var chunks = {};
    var chunkCount = 0;

    function key(cx, cy, cz) { return cx + "," + cy + "," + cz; }
    function floorDiv(a, b) { return Math.floor(a / b); }
    function mod(a, b) { var r = a % b; return r < 0 ? r + b : r; }
    function idx(x, y, z) { return (mod(y, S) * S + mod(z, S)) * S + mod(x, S); }

    var W = {
      chunkSize: S,

      get: function (x, y, z) {
        var c = chunks[key(floorDiv(x, S), floorDiv(y, S), floorDiv(z, S))];
        return c ? c.blocks[idx(x, y, z)] : 0;
      },

      set: function (x, y, z, id) {
        var cx = floorDiv(x, S), cy = floorDiv(y, S), cz = floorDiv(z, S);
        var k = key(cx, cy, cz), c = chunks[k];
        if (!c) {
          if (!id) return W;
          c = G.VoxelChunk(S);
          chunks[k] = c;
          chunkCount++;
        }
        var i = idx(x, y, z);
        var was = c.blocks[i];
        if (was === id) return W;
        c.blocks[i] = id;
        c.count += (id ? 1 : 0) - (was ? 1 : 0);
        if (c.count <= 0) { delete chunks[k]; chunkCount--; }
        return W;
      },

      chunkCount: function () { return chunkCount; },

      /* the chunks that exist, as [{cx, cy, cz, count}] — nothing is allocated
         for empty space, so this is the whole world */
      chunkKeys: function () {
        var out = [];
        for (var k in chunks) {
          if (!Object.prototype.hasOwnProperty.call(chunks, k)) continue;
          var p = k.split(",");
          out.push({ cx: +p[0], cy: +p[1], cz: +p[2], count: chunks[k].count });
        }
        return out;
      },

      /* ---------- edit operations (WorldEdit's vocabulary, reimplemented) ---------- */
      fill: function (x0, y0, z0, x1, y1, z1, id) {
        var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
        var ya = Math.min(y0, y1), yb = Math.max(y0, y1);
        var za = Math.min(z0, z1), zb = Math.max(z0, z1);
        var n = 0;
        for (var y = ya; y <= yb; y++)
          for (var z = za; z <= zb; z++)
            for (var x = xa; x <= xb; x++) { W.set(x, y, z, id); n++; }
        return n;
      },

      /* a hollow shell: the same box with its interior left alone */
      hollow: function (x0, y0, z0, x1, y1, z1, id) {
        var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
        var ya = Math.min(y0, y1), yb = Math.max(y0, y1);
        var za = Math.min(z0, z1), zb = Math.max(z0, z1);
        var n = 0;
        for (var y = ya; y <= yb; y++)
          for (var z = za; z <= zb; z++)
            for (var x = xa; x <= xb; x++) {
              var edge = x === xa || x === xb || y === ya || y === yb || z === za || z === zb;
              if (edge) { W.set(x, y, z, id); n++; }
            }
        return n;
      },

      sphere: function (cx, cy, cz, r, id) {
        var n = 0, r2 = r * r;
        for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
          for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
            for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
              var dx = x - cx, dy = y - cy, dz = z - cz;
              if (dx * dx + dy * dy + dz * dz <= r2) { W.set(x, y, z, id); n++; }
            }
        return n;
      },

      /* a vertical cylinder: useful for pillars, wells and tree trunks */
      cylinder: function (cx, cz, y0, y1, r, id) {
        var n = 0, r2 = r * r;
        var ya = Math.min(y0, y1), yb = Math.max(y0, y1);
        for (var y = ya; y <= yb; y++)
          for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
            for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
              var dx = x - cx, dz = z - cz;
              if (dx * dx + dz * dz <= r2) { W.set(x, y, z, id); n++; }
            }
        return n;
      },

      /* copy a box out as a schematic: {version, size:[w,h,d], origin, blocks} */
      copy: function (x0, y0, z0, x1, y1, z1) {
        var xa = Math.min(x0, x1), ya = Math.min(y0, y1), za = Math.min(z0, z1);
        var w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1, d = Math.abs(z1 - z0) + 1;
        var blocks = new Array(w * h * d);
        var i = 0;
        for (var y = 0; y < h; y++)
          for (var z = 0; z < d; z++)
            for (var x = 0; x < w; x++) blocks[i++] = W.get(xa + x, ya + y, za + z);
        return { version: 1, size: [w, h, d], origin: [xa, ya, za], blocks: blocks };
      },

      /* paste a schematic at an offset; returns the number of cells written */
      paste: function (schem, dx, dy, dz) {
        dx = dx || 0; dy = dy || 0; dz = dz || 0;
        var w = schem.size[0], h = schem.size[1], d = schem.size[2];
        var i = 0, n = 0;
        for (var y = 0; y < h; y++)
          for (var z = 0; z < d; z++)
            for (var x = 0; x < w; x++) { W.set(dx + x, dy + y, dz + z, schem.blocks[i++]); n++; }
        return n;
      },

      /* ---------- greedy meshing ---------- */
      /* returns {quads, count, tris}. Each quad is
         {axis:'x'|'y'|'z', dir:1|-1, block, x, y, z, u, v, uw, vh, area}
         where (x,y,z) is the minimum corner, u/v name the two axes the quad
         spans, and uw/vh are its size along them. */
      mesh: function (cx, cy, cz) {
        var ox = cx * S, oy = cy * S, oz = cz * S;
        var quads = [];
        var AX = ["x", "y", "z"];
        var x = [0, 0, 0], q = [0, 0, 0];
        var mask = new Array(S * S);

        for (var d = 0; d < 3; d++) {
          var u = (d + 1) % 3, v = (d + 2) % 3;
          q[0] = q[1] = q[2] = 0; q[d] = 1;

          for (x[d] = -1; x[d] < S; ) {
            var n = 0;
            for (x[v] = 0; x[v] < S; x[v]++) {
              for (x[u] = 0; x[u] < S; x[u]++) {
                var a = x[d] >= 0 ? W.get(ox + x[0], oy + x[1], oz + x[2]) : 0;
                var b = x[d] < S - 1 ? W.get(ox + x[0] + q[0], oy + x[1] + q[1], oz + x[2] + q[2]) : 0;
                mask[n++] = a && !b ? a : (b && !a ? -b : 0);
              }
            }
            x[d]++;

            n = 0;
            for (var j = 0; j < S; j++) {
              for (var i = 0; i < S; ) {
                var c = mask[n];
                if (!c) { i++; n++; continue; }

                var w = 1;
                while (i + w < S && mask[n + w] === c) w++;

                var h = 1, stop = false;
                while (j + h < S && !stop) {
                  for (var k = 0; k < w; k++) {
                    if (mask[n + k + h * S] !== c) { stop = true; break; }
                  }
                  if (!stop) h++;
                }

                var pos = [0, 0, 0];
                pos[d] = x[d]; pos[u] = i; pos[v] = j;

                quads.push({
                  axis: AX[d], dir: c > 0 ? 1 : -1, block: Math.abs(c),
                  x: ox + pos[0], y: oy + pos[1], z: oz + pos[2],
                  u: AX[u], v: AX[v], uw: w, vh: h, area: w * h
                });

                for (var l = 0; l < h; l++)
                  for (var m = 0; m < w; m++) mask[n + m + l * S] = 0;
                i += w; n += w;
              }
            }
          }
        }
        return { quads: quads, count: quads.length, tris: quads.length * 2 };
      },

      /* the unmerged face count, so the saving greedy meshing makes is a
         number rather than a claim */
      faceCount: function () {
        var n = 0;
        for (var k in chunks) {
          if (!Object.prototype.hasOwnProperty.call(chunks, k)) continue;
          var p = k.split(",");
          n += W.mesh(+p[0], +p[1], +p[2]).quads.reduce(function (s, qd) {
            return s + qd.area;
          }, 0);
        }
        return n;
      }
    };

    return W;
  };

  /* ---------- noise, in two and three dimensions ---------- */
  /* Value noise with a smoothstep fade. Deterministic from the seed, so the
     same seed gives the same world — the property a level editor depends on. */
  function hashNoise(ix, iy, iz, seed) {
    var h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) +
            Math.imul(iz | 0, 1274126177) + Math.imul(seed | 0, 2246822519);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function fade(t) { return t * t * (3 - 2 * t); }

  G.noise3 = function (seed) {
    seed = seed || 1;
    return function (x, y, z) {
      var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      var fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
      function c(dx, dy, dz) { return hashNoise(ix + dx, iy + dy, iz + dz, seed); }
      var x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * fx;
      var x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * fx;
      var x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * fx;
      var x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * fx;
      var y0 = x00 + (x10 - x00) * fy;
      var y1 = x01 + (x11 - x01) * fy;
      return y0 + (y1 - y0) * fz;
    };
  };

  G.noise2 = function (seed) {
    var n3 = G.noise3(seed);
    return function (x, y) { return n3(x, y, 0.5); };
  };

  /* fractal sum: several octaves of the same noise, each smaller and fainter */
  G.fbm2 = function (seed, octaves) {
    var n = G.noise2(seed);
    octaves = octaves || 4;
    return function (x, y) {
      var sum = 0, amp = 1, freq = 1, norm = 0;
      for (var o = 0; o < octaves; o++) {
        sum += n(x * freq, y * freq) * amp;
        norm += amp; amp *= 0.5; freq *= 2;
      }
      return sum / norm;
    };
  };

  /* ---------- terrain: a heightmap world from noise ---------- */
  G.terrain = function (world, opts) {
    opts = opts || {};
    var size = opts.size || 32;
    var base = opts.base === undefined ? 4 : opts.base;
    var amp = opts.amp === undefined ? 10 : opts.amp;
    var scale = opts.scale || 0.06;
    var ground = opts.ground === undefined ? 1 : opts.ground;
    var top = opts.top === undefined ? 2 : opts.top;
    var height = G.fbm2(opts.seed || 7, opts.octaves || 4);

    var heights = new Array(size * size);
    for (var z = 0; z < size; z++) {
      for (var x = 0; x < size; x++) {
        var h = base + Math.floor(height(x * scale, z * scale) * amp);
        heights[z * size + x] = h;
        for (var y = 0; y <= h; y++) world.set(x, y, z, y === h ? top : ground);
      }
    }
    return { size: size, heights: heights, heightAt: function (x, z) { return heights[z * size + x]; } };
  };

  /* ---------- a world rendered to a map, the way Overviewer does it ---------- */
  /* Top-down: each column becomes the id of its highest non-empty block.
     Returns {width, height, tiles:[[id]]} — pan and zoom are the viewer's job. */
  G.voxelToMap = function (world, box) {
    box = box || {};
    var x0 = box.x0 || 0, z0 = box.z0 || 0;
    var w = box.w || 32, d = box.d || 32;
    var maxY = box.maxY === undefined ? 255 : box.maxY;
    var tiles = [];
    for (var z = 0; z < d; z++) {
      var row = [];
      for (var x = 0; x < w; x++) {
        var id = 0;
        for (var y = maxY; y >= 0; y--) {
          var b = world.get(x0 + x, y, z0 + z);
          if (b) { id = b; break; }
        }
        row.push(id);
      }
      tiles.push(row);
    }
    return { width: w, height: d, tiles: tiles, at: function (x, z) { return tiles[z] ? tiles[z][x] : 0; } };
  };

  /* =========================================================================
     G.tiled — read the Tiled editor's JSON, rather than inventing a map format.

     Same reasoning as reading the Agent Skills spec instead of defining our
     own: Tiled is the format other people's tools already write, so a level
     made in a real editor loads here unchanged. (melonJS is the reference for
     how a runtime consumes it; MIT.)
     ========================================================================= */
  G.tiled = {
    /* parse(map) -> {width, height, tilewidth, tileheight, layers, tilesets,
                     layer(name), gidAt(layerName, x, y)} */
    parse: function (map) {
      if (!map || typeof map !== "object") throw new Error("tiled: expected the parsed JSON of a map");
      var layers = (map.layers || []).map(function (l) {
        var data = l.data;
        if (!data) throw new Error("tiled: layer '" + l.name + "' has no data (only uncompressed arrays are read)");
        return {
          name: l.name, type: l.type || "tilelayer",
          width: l.width || map.width, height: l.height || map.height,
          data: data, visible: l.visible !== false
        };
      });

      function findLayer(name) {
        for (var i = 0; i < layers.length; i++) if (layers[i].name === name) return layers[i];
        return null;
      }

      return {
        width: map.width, height: map.height,
        tilewidth: map.tilewidth || 16, tileheight: map.tileheight || 16,
        layers: layers,
        tilesets: map.tilesets || [],
        layer: findLayer,
        gidAt: function (name, x, y) {
          var l = findLayer(name);
          if (!l || x < 0 || y < 0 || x >= l.width || y >= l.height) return 0;
          return l.data[y * l.width + x] || 0;
        },
        /* the collision half: merge the solid tiles of a layer into as few
           rectangles as possible, so a platformer gets a handful of bodies
           instead of one per tile */
        collisionRects: function (name, solid) {
          var l = findLayer(name);
          if (!l) return [];
          var isSolid = typeof solid === "function" ? solid : function (g) { return g > 0; };
          var w = l.width, h = l.height;
          var used = new Array(w * h);
          var rects = [];
          for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
              if (used[y * w + x] || !isSolid(l.data[y * w + x])) continue;
              var rw = 1;
              while (x + rw < w && !used[y * w + x + rw] && isSolid(l.data[y * w + x + rw])) rw++;
              var rh = 1, grow = true;
              while (y + rh < h && grow) {
                for (var k = 0; k < rw; k++) {
                  if (used[(y + rh) * w + x + k] || !isSolid(l.data[(y + rh) * w + x + k])) { grow = false; break; }
                }
                if (grow) rh++;
              }
              for (var yy = 0; yy < rh; yy++)
                for (var xx = 0; xx < rw; xx++) used[(y + yy) * w + x + xx] = 1;
              rects.push({ x: x, y: y, w: rw, h: rh });
            }
          }
          return rects;
        }
      };
    }
  };

  /* =========================================================================
     G.atlas + G.SpriteBatch — sprite batching, the thing a hand-written
     renderer gets wrong.

     A canvas `drawImage` per sprite is what makes a small game stutter on a
     phone: 2,000 sprites is 2,000 draw calls. Batching groups the sprites by
     the image they come from, so the same 2,000 sprites cost one call per
     image, and it carries the atlas UVs so a single sprite sheet is enough.

     Four rules, each one a bug this module refuses to have:

     1. A fixed-size buffer NEVER DROPS THE TAIL. Over capacity, the batch
        spills into a second draw call and `flush().dropped` stays 0. A
        renderer that silently loses the last 50 sprites is worse than a slow
        one, because nothing looks broken until the level is busy.
     2. Draw order is deterministic. Quads sort by `z`, then by the order they
        were added — an unstable sort that reorders equal `z` values makes a
        scene flicker frame to frame.
     3. A frame the atlas does not have is COUNTED, not drawn as garbage: it
        comes back on the draw call as `missing` and in `flush().missing`.
     4. Culling is reported. `flush().culled` says how many sprites the
        viewport removed, so "the screen is empty" is a number and not a guess.
     ========================================================================= */
  G.atlas = function (spec) {
    spec = spec || {};
    var img = spec.image || { w: 0, h: 0 };
    var frames = spec.frames || {};

    function frame(name) {
      var f = frames[name];
      if (!f) return null;
      if (Array.isArray(f)) return { x: f[0], y: f[1], w: f[2], h: f[3] };
      return { x: f.x, y: f.y, w: f.w, h: f.h };
    }

    /* normalised 0..1 corners, or null when the name is not in the atlas */
    function uv(name) {
      var f = frame(name);
      if (!f || !img.w || !img.h) return null;
      return {
        u0: f.x / img.w, v0: f.y / img.h,
        u1: (f.x + f.w) / img.w, v1: (f.y + f.h) / img.h
      };
    }

    return {
      image: img,
      frames: frames,
      frame: frame,
      uv: uv,
      names: function () { var out = []; for (var k in frames) if (frames.hasOwnProperty(k)) out.push(k); return out; }
    };
  };

  G.SpriteBatch = function (opts) {
    opts = opts || {};
    var capacity = opts.capacity > 0 ? opts.capacity : 1024;
    var atlas = opts.atlas || null;
    var items = [];
    var seq = 0;
    var view = null;
    var stats = { added: 0, rejected: 0, hidden: 0, culled: 0, missingFrames: 0, spills: 0 };

    function isNum(v) { return typeof v === "number" && isFinite(v); }

    function resetStats() {
      stats = { added: 0, rejected: 0, hidden: 0, culled: 0, missingFrames: 0, spills: 0 };
    }

    var B = {
      atlas: atlas,

      setAtlas: function (a) { atlas = a || null; B.atlas = atlas; return B; },
      setViewport: function (v) {
        view = (v && isNum(v.x) && isNum(v.y) && isNum(v.w) && isNum(v.h) && v.w > 0 && v.h > 0) ? v : null;
        return B;
      },
      capacity: function (c) { if (c > 0) capacity = c; return capacity; },
      count: function () { return items.length; },
      stats: function () { var s = {}; for (var k in stats) s[k] = stats[k]; return s; },
      resetStats: function () { resetStats(); return B; },
      clear: function () { items = []; return B; },
      pending: function () { return items.slice(); },

      /* add({ texture, frame|src, x, y, w, h, z, alpha, flipX, visible }) */
      add: function (r) {
        stats.added++;
        if (!r || typeof r !== "object") { stats.rejected++; return B; }
        if (r.visible === false) { stats.hidden++; return B; }

        var x = r.x, y = r.y, w = r.w, h = r.h;
        if (!isNum(x) || !isNum(y) || !isNum(w) || !isNum(h) || w <= 0 || h <= 0) {
          stats.rejected++;
          return B;
        }

        var q = {
          texture: r.texture == null ? "" : String(r.texture),
          frame: r.frame == null ? null : r.frame,
          x: x, y: y, w: w, h: h,
          z: isNum(r.z) ? r.z : 0,
          alpha: isNum(r.alpha) ? G.clamp(r.alpha, 0, 1) : 1,
          flipX: !!r.flipX,
          u0: 0, v0: 0, u1: 1, v1: 1,
          missing: false,
          i: seq++
        };

        var src = r.src || (r.frame != null && atlas ? atlas.frame(r.frame) : null);
        if (src) {
          var iw = atlas && atlas.image ? atlas.image.w : 0;
          var ih = atlas && atlas.image ? atlas.image.h : 0;
          if (isNum(src.x) && isNum(src.y) && isNum(src.w) && isNum(src.h) && iw > 0 && ih > 0) {
            q.u0 = src.x / iw; q.v0 = src.y / ih;
            q.u1 = (src.x + src.w) / iw; q.v1 = (src.y + src.h) / ih;
          } else {
            q.missing = true;
            stats.missingFrames++;
          }
        } else if (r.frame != null) {
          /* a frame name with no atlas to resolve it against */
          q.missing = true;
          stats.missingFrames++;
        }

        items.push(q);
        return B;
      },

      /* turn what was added into draw calls, then empty the buffer.
         returns { calls, quads, culled, spilled, missing, textures, dropped } */
      flush: function () {
        var live = [], culled = 0, missing = 0;
        for (var n = 0; n < items.length; n++) {
          var q = items[n];
          if (view && (q.x >= view.x + view.w || q.x + q.w <= view.x ||
                       q.y >= view.y + view.h || q.y + q.h <= view.y)) {
            culled++;
            continue;
          }
          live.push(q);
        }

        /* group by texture, in the order each texture first appears, so the
           draw-call order is stable across frames */
        var order = [], groups = {};
        for (var m = 0; m < live.length; m++) {
          var t = live[m].texture;
          if (!groups[t]) { groups[t] = []; order.push(t); }
          groups[t].push(live[m]);
        }

        var calls = [], quads = 0, spilled = 0;
        for (var o = 0; o < order.length; o++) {
          var g = groups[order[o]];
          /* z first, then insertion order: a stable sort, spelled out */
          g.sort(function (a, b) { return (a.z - b.z) || (a.i - b.i); });
          var missInTexture = 0;
          for (var k = 0; k < g.length; k++) if (g[k].missing) missInTexture++;
          for (var s = 0; s < g.length; s += capacity) {
            var slice = g.slice(s, s + capacity);
            if (s > 0) spilled++;
            calls.push({
              texture: order[o],
              quads: slice,
              missing: missInTexture
            });
            quads += slice.length;
          }
        }

        missing = 0;
        for (var d = 0; d < live.length; d++) if (live[d].missing) missing++;

        stats.culled += culled;
        stats.spills += spilled;
        items = [];

        return {
          calls: calls,
          quads: quads,
          culled: culled,
          spilled: spilled,
          missing: missing,
          textures: order.length,
          dropped: live.length - quads
        };
      },

      /* walk the draw calls in order — one function per texture, not per sprite.
         paint(result, (call, quad) => ...) */
      paint: function (result, fn) {
        var res = result || { calls: [] };
        for (var i = 0; i < res.calls.length; i++) {
          var call = res.calls[i];
          for (var j = 0; j < call.quads.length; j++) fn(call, call.quads[j], i, j);
        }
        return res.calls.length;
      }
    };

    return B;
  };

  root.Game = G;
})(typeof globalThis !== "undefined" ? globalThis : this);
