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
  var G = { version: "1.5.0" };

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
    var next = 1, entities = {}, systems = [], queue = [], flushing = false;
    /* Change detection: a write stamps the component with the current tick, so a
       renderer or a network layer can ask "what changed since tick N" instead of
       diffing every value. The tick advances once per update(). */
    var tick = 0, stamps = {};   /* stamps[id][name] = tick of the last write */
    /* Structural changes made while a system is running are queued, not applied:
       destroying an entity mid-iteration used to mean the caller stepped its own
       index backwards. flush() applies them in order, once, between systems. */
    function apply(cmd) {
      if (cmd.op === "spawn") { api.create(cmd.comps); return; }
      if (cmd.op === "destroy") { delete entities[cmd.id]; delete stamps[cmd.id]; return; }
      if (cmd.op === "add") { api.add(cmd.id, cmd.name, cmd.data); return; }
      if (cmd.op === "remove") { api.remove(cmd.id, cmd.name); }
    }
    /* Sorted, so iteration order does not depend on the engine's key order. A
       replay then steps the same entities in the same order every run. */
    function sortedIds() {
      return Object.keys(entities).map(Number).sort(function (a, b) { return a - b; });
    }
    var api = {
      create: function (comps) {
        var id = next++;
        entities[id] = {};
        if (comps) {
          stamps[id] = {};
          Object.keys(comps).forEach(function (k) {
            entities[id][k] = comps[k];
            stamps[id][k] = tick;      /* a create is a write */
          });
        }
        return id;
      },
      destroy: function (id) { delete entities[id]; delete stamps[id]; return api; },
      add: function (id, name, data) {
        (entities[id] = entities[id] || {})[name] = data === undefined ? {} : data;
        (stamps[id] = stamps[id] || {})[name] = tick;
        return api;
      },
      /* Write a component and stamp it. add() does the same; set() is the name to
         use for a value that changes every frame. */
      set: function (id, name, data) {
        return api.add(id, name, data);
      },
      /* True if this component was written at or after `since` (default: this tick). */
      changed: function (id, name, since) {
        var s = stamps[id];
        if (!s || !(name in s)) return false;
        var from = since === undefined ? tick : since;
        return s[name] >= from;
      },
      /* The components written since `since`, as { id: [names] }. */
      changes: function (since) {
        var from = since === undefined ? tick : since;
        var out = {};
        Object.keys(stamps).forEach(function (id) {
          var names = Object.keys(stamps[id]).filter(function (n) { return stamps[id][n] >= from; });
          if (names.length) out[id] = names;
        });
        return out;
      },
      tick: function () { return tick; },
      get: function (id, name) { var e = entities[id]; return e ? e[name] : undefined; },
      has: function (id, name) { var e = entities[id]; return !!(e && name in e); },
      remove: function (id, name) {
        var e = entities[id];
        if (e) delete e[name];
        if (stamps[id]) delete stamps[id][name];
        return api;
      },
      ids: function () { return sortedIds(); },
      count: function () { return Object.keys(entities).length; },
      system: function (required, fn) { systems.push({ required: required, fn: fn }); return api; },

      /* Queue a structural change for the end of the current system. */
      commands: {
        spawn: function (comps) { queue.push({ op: "spawn", comps: comps }); return api.commands; },
        destroy: function (id) { queue.push({ op: "destroy", id: id }); return api.commands; },
        add: function (id, name, data) { queue.push({ op: "add", id: id, name: name, data: data }); return api.commands; },
        remove: function (id, name) { queue.push({ op: "remove", id: id, name: name }); return api.commands; },
        pending: function () { return queue.length; }
      },
      flush: function () {
        if (flushing) return api;      /* a command that queues a command is applied next time */
        flushing = true;
        while (queue.length) apply(queue.shift());
        flushing = false;
        return api;
      },

      update: function (dt) {
        tick++;
        systems.forEach(function (s) {
          var ids = sortedIds();          /* a snapshot: spawns land after this system */
          for (var n = 0; n < ids.length; n++) {
            var id = ids[n];
            if (!entities[id]) continue;  /* destroyed earlier in this pass */
            var all = true;
            for (var i = 0; i < s.required.length; i++) { if (!api.has(id, s.required[i])) { all = false; break; } }
            if (all) s.fn(id, entities[id], dt);
          }
          api.flush();                    /* between systems, never during one */
        });
        return api;
      }
    };
    return api;
  };;

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



  /* ---------- scene graph (v1.5) ----------
     A hierarchy of transforms, because every 2-D game eventually needs one:
     a gun that follows a hand that follows a body that follows a camera. Doing
     it by hand means adding the parent's position at every draw call and then
     forgetting the rotation — so the parts drift apart as soon as anything
     turns.

     Three things this is built around, all of them failure modes:

     1. A WORLD TRANSFORM IS CACHED AND INVALIDATED, not recomputed per query.
        Moving one node marks its subtree dirty; asking for a world transform
        composes from the nearest clean ancestor. Dragging a 5,000-node level
        around does not cost 5,000 matrix multiplies per frame.
     2. A CYCLE IS REFUSED AT THE DOOR. `append` will not make a node its own
        ancestor, because a cycle does not throw — it hangs the walk and the
        game freezes on its last frame, which is the hardest kind of bug to
        see. Refused, the tree is simply unchanged.
     3. NOTHING RECURSES. `walk`, the dirty sweep and the bounds pass use an
        explicit stack, so a 20,000-deep chain is slow, not a stack overflow.
        The recursive version works beautifully until someone builds a rope.

     A node with a zero scale has no inverse, so `localPoint` returns null
     rather than a world of Infinity/NaN that silently poisons every later
     number it touches.
  */
  G.Node = function (props) {
    this.name = null;
    this.tag = null;
    this.x = 0; this.y = 0; this.rot = 0; this.sx = 1; this.sy = 1;
    this.w = 0; this.h = 0;
    this.visible = true;
    this.parent = null;
    this.children = [];
    this.data = null;
    this._w = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
    this._dirty = true;
    if (props) this.set(props);
  };

  G.Node.prototype = {
    /* set() is the only way in: it rejects a non-finite number instead of
       letting one NaN destroy every transform below it */
    set: function (props) {
      if (!props) return this;
      var keys = ["x", "y", "rot", "sx", "sy", "w", "h"];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (props[k] === undefined) continue;
        var v = props[k];
        if (typeof v !== "number" || !isFinite(v)) continue;
        this[k] = v;
      }
      if (props.name !== undefined) this.name = props.name;
      if (props.tag !== undefined) this.tag = props.tag;
      if (props.visible !== undefined) this.visible = !!props.visible;
      if (props.data !== undefined) this.data = props.data;
      this.touch();
      return this;
    },

    /* mark this node and everything under it stale */
    touch: function () {
      var stack = [this], guard = 0, max = 1e7;
      while (stack.length) {
        var n = stack.pop();
        n._dirty = true;
        if (++guard > max) break;
        for (var i = 0; i < n.children.length; i++) stack.push(n.children[i]);
      }
      return this;
    },

    append: function (child) {
      if (!child || child === this) return false;
      /* walking up from `this` — if the child is an ancestor, this would close
         a loop, and a loop is a freeze rather than an exception */
      for (var p = this; p; p = p.parent) if (p === child) return false;
      if (child.parent === this) {
        /* already here: move it to the end, never duplicate it */
        var at = this.children.indexOf(child);
        if (at >= 0) this.children.splice(at, 1);
      } else if (child.parent) {
        child.parent.remove(child);
      }
      child.parent = this;
      this.children.push(child);
      child.touch();
      return true;
    },

    remove: function (child) {
      if (!child) return false;
      var at = this.children.indexOf(child);
      if (at < 0) return false;
      this.children.splice(at, 1);
      child.parent = null;
      child.touch();
      return true;
    },

    detach: function () { return this.parent ? this.parent.remove(this) : false; },
    clear: function () {
      for (var i = 0; i < this.children.length; i++) { this.children[i].parent = null; this.children[i].touch(); }
      this.children = [];
      return this;
    },

    root: function () { var n = this; while (n.parent) n = n.parent; return n; },
    depth: function () { var d = 0, n = this; while (n.parent) { n = n.parent; d++; } return d; },

    world: function () {
      if (!this._dirty) return this._w;
      /* collect the dirty run up to the nearest clean ancestor, then compose
         back down — iterative, so depth cannot overflow the stack */
      var chain = [], n = this;
      while (n && n._dirty) { chain.push(n); n = n.parent; }
      var base = n ? n._w : { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
      for (var i = chain.length - 1; i >= 0; i--) {
        var c = chain[i], cw = Math.cos(base.rot), sw = Math.sin(base.rot);
        var lx = c.x * base.sx, ly = c.y * base.sy;
        c._w = {
          x: base.x + cw * lx - sw * ly,
          y: base.y + sw * lx + cw * ly,
          rot: base.rot + c.rot,
          sx: base.sx * c.sx,
          sy: base.sy * c.sy
        };
        c._dirty = false;
        base = c._w;
      }
      return this._w;
    },

    worldPoint: function (lx, ly) {
      var w = this.world();
      var x = lx * w.sx, y = ly * w.sy, c = Math.cos(w.rot), s = Math.sin(w.rot);
      return { x: w.x + c * x - s * y, y: w.y + s * x + c * y };
    },

    /* the inverse. A zero (or non-finite) scale has no inverse, so this says
       null instead of handing back Infinity that spreads into the next sum */
    localPoint: function (wx, wy) {
      var w = this.world();
      if (!(Math.abs(w.sx) > 1e-9) || !(Math.abs(w.sy) > 1e-9)) return null;
      var dx = wx - w.x, dy = wy - w.y;
      var c = Math.cos(-w.rot), s = Math.sin(-w.rot);
      var rx = c * dx - s * dy, ry = s * dx + c * dy;
      return { x: rx / w.sx, y: ry / w.sy };
    },

    /* depth-first, parents before children, in insertion order. fn(node, depth)
       may return false to prune that subtree.

       A callback that removes a sibling, or appends one, cannot make the walk
       skip or invent anything — the children of a node are all QUEUED before
       any callback for that level runs, so the queue is the snapshot. (That is
       why there is no children.slice() here: it was doing nothing except
       allocating once per node.) Nodes removed mid-walk are still visited
       once, the way a DOM NodeIterator behaves.

       The node cap is the last line of defence. `parent` is a public field, so
       a caller can close a loop by assignment and bypass append's refusal —
       and a loop does not throw, it spins. The walk stops at `maxNodes` and
       reports the count it reached instead of freezing the tab. */
    walk: function (fn, opts) {
      opts = opts || {};
      var max = opts.maxNodes > 0 ? opts.maxNodes : 1e6;
      var count = 0, stack = [{ n: this, d: 0 }];
      while (stack.length && count < max) {
        var top = stack.pop(), n = top.n, d = top.d;
        if (!opts.includeHidden && !n.visible) continue;
        count++;
        if (fn && fn(n, d) === false) continue;
        for (var i = n.children.length - 1; i >= 0; i--) stack.push({ n: n.children[i], d: d + 1 });
      }
      return count;
    },

    find: function (name) {
      var hit = null;
      this.walk(function (n) { if (n.name === name) { hit = n; return false; } }, { includeHidden: true });
      return hit;
    },

    byTag: function (tag) {
      var out = [];
      this.walk(function (n) { if (n.tag === tag) out.push(n); }, { includeHidden: true });
      return out;
    },

    /* the axis-aligned box of everything visible below (and including) this
       node, in world space — rotation and scale applied to each corner, not
       just to the origin. null when there is nothing visible. */
    bounds: function (opts) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
      this.walk(function (n) {
        var w = n.world();
        var hw = (n.w || 0) / 2, hh = (n.h || 0) / 2;
        var pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        for (var i = 0; i < 4; i++) {
          var p = n.worldPoint(pts[i][0], pts[i][1]);
          if (!isFinite(p.x) || !isFinite(p.y)) return true;
          any = true;
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return true;
      }, opts);
      return any ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
    },

    /* every node whose own world box overlaps a world rectangle. One walk, one
       transform per node — asking each node for its subtree bounds here would
       be quadratic on a wide tree, which is exactly the sort of thing that
       ships and then gets noticed at 3,000 nodes. */
    query: function (rect) {
      var out = [];
      if (!rect) return out;
      this.walk(function (n) {
        var b = n.box();
        if (!b) return true;
        if (b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y) out.push(n);
        return true;
      });
      return out;
    },

    /* this node's own box in world space (no children), or null if the
       transform is not finite */
    box: function () {
      var hw = (this.w || 0) / 2, hh = (this.h || 0) / 2;
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      for (var i = 0; i < 4; i++) {
        var p = this.worldPoint(pts[i][0], pts[i][1]);
        if (!isFinite(p.x) || !isFinite(p.y)) return null;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  };

  G.node = function (props) { return new G.Node(props); };


  /* ---------- code-audio (v1.4) ----------
     Game music is PATTERNS, not files. A pattern is data — a wave, a list of
     steps, a pitch — and this module turns it into samples with plain
     arithmetic, so all of it is testable headless: no AudioContext, no .wav,
     no asset to 404, and a track costs bytes instead of megabytes.

     The three bugs it refuses to have:
       1. A CLICK. Every note starts at exactly 0 and ends at exactly 0, because
          the envelope is evaluated per sample and the renderer enforces a
          minimum attack and release. "The sound is crunchy" is a missing 3 ms.
       2. A WRAPPING SUM. Notes are summed in float and the buffer is normalised
          to a peak of 1, so a busy bar gets quieter instead of folding over into
          a tearing noise.
       3. A NOTE THAT NEVER RELEASES. A note held past its sustain releases
          inside its own duration and is silent at the last sample. Getting this
          wrong is what "the last note of the level is cut off" sounds like.
  */
  G.audio = (function () {
    var TWO_PI = Math.PI * 2;
    var SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

    /* a pitch from a name: "A4" -> 440, "C#4", "Bb3", "a4"; a number passes
       through; anything unreadable is null, never NaN or a 0 Hz drone */
    function freq(name) {
      if (typeof name === "number") return name > 0 && isFinite(name) ? name : null;
      if (typeof name !== "string") return null;
      var m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
      if (!m) return null;
      var semi = SEMI[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
      var midi = (parseInt(m[3], 10) + 1) * 12 + semi;
      return 440 * Math.pow(2, (midi - 69) / 12);
    }
    function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

    /* waves are pure functions of phase in [0,1) plus a seeded rng, so a hit
       sounds the same in the test and in the game */
    var waves = {
      sine: function (p) { return Math.sin(TWO_PI * p); },
      square: function (p) { return p < 0.5 ? 1 : -1; },
      saw: function (p) { return 2 * p - 1; },
      triangle: function (p) { return 1 - 4 * Math.abs(p - 0.5); },
      noise: function (p, rnd) { return rnd() * 2 - 1; }
    };

    /* ADSR as a function of (t, dur), not an array: a note is asked for its
       level at a time, so a note can be stretched without re-rendering */
    function env(o) {
      o = o || {};
      var a = o.attack == null ? 0.005 : Math.max(0, o.attack);
      var d = o.decay == null ? 0.05 : Math.max(0, o.decay);
      var s = o.sustain == null ? 0.7 : Math.max(0, Math.min(1, o.sustain));
      var r = o.release == null ? 0.06 : Math.max(0, o.release);
      return function (t, dur) {
        if (!(dur > 0) || !(t >= 0) || t >= dur) return 0;
        var rel = Math.min(r, dur * 0.5);        // the release can never eat the note
        var held = dur - rel;                     // the sustain ends here
        var att = Math.min(a, held);
        var dec = Math.min(d, held - att);
        if (att > 0 && t < att) return t / att;   // starts at exactly 0
        if (dec > 0 && t < att + dec) return 1 - (1 - s) * ((t - att) / dec);
        if (t < held) return s;
        return s * (1 - (t - held) / rel);        // ends at exactly 0
      };
    }

    /* render a pattern to samples. opts: { sampleRate, duration, notes, seed }.
       A note is { freq|note, at, dur, wave, gain, attack, decay, sustain,
       release, glide } where glide is the pitch RATIO at the end of the note. */
    function render(opts) {
      opts = opts || {};
      var sr = opts.sampleRate > 0 ? opts.sampleRate : 44100;
      var notes = opts.notes || [];
      var duration = opts.duration > 0 ? opts.duration : 0;
      var i, k;
      if (!duration) {
        for (i = 0; i < notes.length; i++) {
          var end = (notes[i] && notes[i].at > 0 ? notes[i].at : 0) +
                    (notes[i] && notes[i].dur > 0 ? notes[i].dur : 0);
          if (end > duration) duration = end;
        }
      }
      if (!(duration > 0)) duration = 0.001;
      var n = Math.max(1, Math.round(duration * sr));
      var buf = new Float32Array(n);
      var seed = opts.seed == null ? 1 : opts.seed;
      var minEdge = Math.min(0.0015, duration / 8);   // 1.5 ms of declick

      for (k = 0; k < notes.length; k++) {
        var note = notes[k];
        if (!note || typeof note !== "object") continue;
        var f0 = note.freq != null ? freq(note.freq) : freq(note.note);
        if (!(f0 > 0)) continue;                       // unreadable pitch is silent
        var dur = note.dur > 0 && isFinite(note.dur) ? note.dur : 0.2;
        var at = note.at > 0 && isFinite(note.at) ? note.at : 0;
        var gain = note.gain == null ? 0.5 : Math.max(0, note.gain);
        var wave = waves[note.wave] || waves.sine;
        var f1 = note.glide > 0 ? f0 * note.glide : f0;
        var level = env({
          attack: Math.max(note.attack == null ? 0.005 : note.attack, minEdge),
          decay: note.decay == null ? 0.05 : note.decay,
          sustain: note.sustain,
          release: Math.max(note.release == null ? 0.06 : note.release, minEdge)
        });
        var s0 = Math.round(at * sr);
        var len = Math.round(dur * sr);
        var rnd = G.rng(seed + k * 7919);
        var phase = 0;
        for (var j = 0; j < len; j++) {
          var idx = s0 + j;
          if (idx >= n) break;
          var t = j / sr;
          var f = f1 === f0 ? f0 : f0 * Math.pow(f1 / f0, dur > 0 ? t / dur : 1);
          phase += f / sr;
          if (phase >= 1) phase -= Math.floor(phase);
          buf[idx] += wave(phase, rnd) * level(t, dur) * gain;
        }
      }

      /* never wrap: normalise to a peak of 1, and a NaN can never leave here */
      var peak = 0, q, v, av;
      for (q = 0; q < n; q++) {
        v = buf[q];
        if (!isFinite(v)) { buf[q] = 0; continue; }
        av = v < 0 ? -v : v;
        if (av > peak) peak = av;
      }
      if (peak > 1) { var scale = 1 / peak; for (q = 0; q < n; q++) buf[q] *= scale; }
      return buf;
    }

    /* the numbers a test (or a HUD) can assert on: "the screen is empty" and
       "the sound is silent" should both be counts, not guesses */
    function stats(buf) {
      var peak = 0, sum = 0, bad = 0, i, v, av;
      var len = buf && buf.length ? buf.length : 0;
      for (i = 0; i < len; i++) {
        v = buf[i];
        if (!isFinite(v)) { bad++; continue; }
        av = v < 0 ? -v : v;
        if (av > peak) peak = av;
        sum += v * v;
      }
      return {
        samples: len,
        seconds: len ? len / 44100 : 0,
        peak: peak,
        rms: len ? Math.sqrt(sum / len) : 0,
        nonFinite: bad,
        silent: peak === 0
      };
    }

    /* a pattern -> notes. A cell is null (a rest), a note name, or an object
       { note|freq, len, wave, gain, dur }. The grid is the music. */
    function track(o) {
      o = o || {};
      var bpm = o.bpm > 0 ? o.bpm : 120;
      var per = o.stepsPerBeat > 0 ? o.stepsPerBeat : 4;
      var stepDur = 60 / bpm / per;
      var seq = o.seq || [];
      var notes = [];
      for (var i = 0; i < seq.length; i++) {
        var cell = seq[i];
        if (!cell) continue;                                  // a rest is a rest
        if (typeof cell === "string" || typeof cell === "number") cell = { note: cell };
        var f = cell.freq != null ? freq(cell.freq) : freq(cell.note);
        if (!(f > 0)) continue;
        var len = cell.len > 0 ? cell.len : 1;
        notes.push({
          freq: f,
          at: i * stepDur,
          dur: cell.dur > 0 ? cell.dur : stepDur * len * 0.9,   // a gap, so repeated notes articulate
          wave: cell.wave || o.wave || "square",
          gain: cell.gain == null ? (o.gain == null ? 0.4 : o.gain) : cell.gain,
          attack: cell.attack,
          decay: cell.decay,
          sustain: cell.sustain,
          release: cell.release
        });
      }
      return {
        bpm: bpm,
        stepsPerBeat: per,
        stepDur: stepDur,
        duration: seq.length * stepDur,
        notes: notes
      };
    }

    /* the five sounds every small game needs, written as data — an unknown
       name is null, never a random noise burst */
    var presets = {
      blip: function () {
        return { duration: 0.09, notes: [{ note: "A5", dur: 0.07, wave: "square", gain: 0.35 }] };
      },
      jump: function () {
        return { duration: 0.18, notes: [{ note: "C5", dur: 0.16, wave: "square", gain: 0.35, glide: 2 }] };
      },
      coin: function () {
        return { duration: 0.2, notes: [
          { note: "B5", at: 0, dur: 0.06, wave: "square", gain: 0.3 },
          { note: "E6", at: 0.06, dur: 0.12, wave: "square", gain: 0.3 }
        ] };
      },
      hit: function () {
        return { duration: 0.12, notes: [
          { freq: 140, dur: 0.1, wave: "noise", gain: 0.5, decay: 0.03, sustain: 0.1, release: 0.05 }
        ] };
      },
      explode: function () {
        return { duration: 0.7, notes: [
          { freq: 90, dur: 0.65, wave: "noise", gain: 0.6, decay: 0.1, sustain: 0.5, release: 0.3 },
          { freq: 60, dur: 0.5, wave: "sine", gain: 0.4, glide: 0.5 }
        ] };
      }
    };
    function sfx(name) { return presets[name] ? presets[name]() : null; }

    /* the only browser-dependent part, kept to one function: hand it samples
       and a context and it plays them */
    function play(ctx, samples, opts) {
      if (!ctx || typeof ctx.createBuffer !== "function" || !samples || !samples.length) return null;
      opts = opts || {};
      var sr = opts.sampleRate > 0 ? opts.sampleRate : (ctx.sampleRate > 0 ? ctx.sampleRate : 44100);
      var b = ctx.createBuffer(1, samples.length, sr);
      b.getChannelData(0).set(samples);
      var src = ctx.createBufferSource();
      src.buffer = b;
      if (src.connect) src.connect(opts.destination || ctx.destination);
      if (src.start) src.start(opts.when || 0);
      return src;
    }

    return {
      freq: freq,
      midi: midi,
      waves: waves,
      env: env,
      render: render,
      stats: stats,
      track: track,
      sfx: sfx,
      presets: presets,
      play: play
    };
  })();

  root.Game = G;
})(typeof globalThis !== "undefined" ? globalThis : this);
