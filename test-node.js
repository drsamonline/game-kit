/* Node test for game-kit: fixed-timestep loop, scenes, save, maths helpers. */
require(require("path").join(__dirname, "game-kit.js"));
const G = global.Game;

let pass = 0, fail = 0;
function ok(name, cond) { cond ? (pass++, console.log("PASS  " + name)) : (fail++, console.log("FAIL  " + name)); }

// fixed-timestep loop (maxFrame raised so a whole second is simulated)
let updates = 0;
const loop = G.loop({ step: 1 / 60, maxFrame: 10, update: () => updates++ });
let steps = loop.tick(1.0);          // one second -> 60 steps
ok("1.0s runs 60 fixed steps", steps === 60 && updates === 60);

updates = 0;
loop.tick(0.01);                      // less than one step
ok("a sub-step frame runs 0 updates", updates === 0);

updates = 0;
for (let i = 0; i < 60; i++) loop.tick(1 / 60);   // 60 frames of exactly one step
ok("60 frames of 1/60 run 60 updates", updates === 60);

// maxFrame clamp: a huge dt must not spiral
updates = 0;
const clampLoop = G.loop({ step: 1 / 60, update: () => updates++ });   // default maxFrame 0.25
const stepsBig = clampLoop.tick(10);  // clamped to 0.25s -> 15 steps
ok("a huge dt is clamped (no spiral)", stepsBig === 15 && updates === 15);

// scenes
const sc = G.Scenes();
let entered = null, ticked = 0;
sc.add("a", { enter: (d) => entered = d, update: () => ticked++ }).go("a", 42);
ok("scene enter receives data", entered === 42 && sc.current() === "a");
sc.update(1 / 60);
ok("scene update runs", ticked === 1);

// save (fake storage)
const store = (() => { const m = {}; return { get: (k, f) => (k in m ? m[k] : f), set: (k, v) => m[k] = v, remove: (k) => delete m[k] }; })();
const save = G.save(store, "slot1");
save.write({ level: 3 });
ok("save round-trip", save.read(null).level === 3);
save.clear();
ok("save clear", save.read("none") === "none");

// helpers
ok("clamp", G.clamp(5, 0, 3) === 3 && G.clamp(-1, 0, 3) === 0);
ok("lerp", Math.abs(G.lerp(0, 10, 0.5) - 5) < 1e-9);
ok("dist", Math.abs(G.dist(0, 0, 3, 4) - 5) < 1e-9);
ok("aabb overlap", G.aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) === true);
ok("aabb miss", G.aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }) === false);
ok("randInt in range", (() => { for (let i = 0; i < 50; i++) { const n = G.randInt(2, 4); if (n < 2 || n > 4) return false; } return true; })());


/* ---- v2: seeded RNG ---- */
const r1 = G.rng(7), r2 = G.rng(7), r3 = G.rng(8);
const seq1 = [r1(), r1(), r1()], seq2 = [r2(), r2(), r2()], seq3 = [r3(), r3(), r3()];
ok("rng: same seed gives the same sequence", JSON.stringify(seq1) === JSON.stringify(seq2));
ok("rng: a different seed differs", JSON.stringify(seq1) !== JSON.stringify(seq3));
ok("rng: values are in [0,1)", seq1.every((v) => v >= 0 && v < 1));
const ri = G.rng(1);
ok("rngInt in range", (() => { for (let i = 0; i < 50; i++) { const n = G.rngInt(ri, 2, 4); if (n < 2 || n > 4) return false; } return true; })());
ok("rngPick returns an element", ["a", "b", "c"].indexOf(G.rngPick(G.rng(2), ["a", "b", "c"])) !== -1);

/* ---- v2: ECS ---- */
const w = G.ECS();
const e1 = w.create({ pos: { x: 0 }, vel: { x: 1 } });
const e2 = w.create({ pos: { x: 10 } });
ok("ecs: create + has", w.has(e1, "pos") && w.has(e1, "vel") && !w.has(e2, "vel"));
ok("ecs: get returns the component", w.get(e1, "pos").x === 0);
const order = [];
w.system(["pos", "vel"], (id, e) => { order.push("move" + id); e.pos.x += e.vel.x; });
w.system(["pos"], (id) => { order.push("draw" + id); });
w.update(1);
ok("ecs: a system runs only on entities with its components", order.indexOf("move2") === -1 && order.indexOf("move1") !== -1);
ok("ecs: systems run in registration order", order[0].indexOf("move") === 0 && order[order.length - 1].indexOf("draw") === 0);
ok("ecs: a system mutates the component", w.get(e1, "pos").x === 1);
w.destroy(e2);
ok("ecs: destroy removes the entity", w.count() === 1 && w.get(e2, "pos") === undefined);

/* ---- v2: state machine ---- */
const m = G.Machine({ initial: "boot", transitions: { boot: { start: "menu" }, menu: { play: "play" }, play: { over: "game-over" } } });
ok("machine: starts in the initial state", m.state() === "boot");
ok("machine: can() reports an allowed event", m.can("start") === true && m.can("play") === false);
ok("machine: an invalid event is refused", m.send("over") === false && m.state() === "boot");
ok("machine: a valid event transitions", m.send("start") === true && m.state() === "menu");
ok("machine: the next state's events apply", m.can("play") === true && m.can("start") === false);

/* ---- v2: collision ---- */
ok("circle: overlap", G.circleHit({ x: 0, y: 0, r: 5 }, { x: 6, y: 0, r: 5 }) === true);
ok("circle: miss", G.circleHit({ x: 0, y: 0, r: 5 }, { x: 20, y: 0, r: 5 }) === false);
ok("circle vs aabb: touching", G.circleAabb({ x: 0, y: 0, r: 6 }, { x: 5, y: -5, w: 10, h: 10 }) === true);
ok("circle vs aabb: apart", G.circleAabb({ x: 0, y: 0, r: 2 }, { x: 50, y: 50, w: 10, h: 10 }) === false);

/* ---- v2: physics resolution ---- */
const pa = { x: 0, y: 0, w: 10, h: 10, vx: 0, vy: 5 };
const pb = { x: 0, y: 9, w: 10, h: 10, vx: 0, vy: 0 };
const hit = G.resolve(pa, pb, { restitution: 0.5 });
ok("physics: reports the contact axis", !!hit && hit.axis === "y");
ok("physics: separates the boxes", G.aabb(pa, pb) === false);
ok("physics: bounces a falling box (velocity reverses x restitution)", pa.vy === -2.5);
ok("physics: no overlap -> null", G.resolve({ x: 0, y: 0, w: 5, h: 5 }, { x: 100, y: 100, w: 5, h: 5 }) === null);

/* ===========================================================================
   v3: text layout, percentage layout, and audit helpers.
   Each of these exists because a shipped game got it wrong first.
   =========================================================================== */

/* a monospace-ish measure: 6px per character at scale 1 */
const m6 = (s, sc) => String(s).length * 6 * (sc || 1);

/* --- wrapping by measurement, not character count --- */
const wrapped = G.text.wrap("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG", 120, m6);
ok("text.wrap: every line fits the width", wrapped.every(l => m6(l) <= 120));
ok("text.wrap: nothing is lost", wrapped.join(" ").replace(/\s+/g, " ") === "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG");
ok("text.wrap: produces more than one line", wrapped.length > 1);

/* the bug: a 26-character line is wider than a 142px column */
ok("text.wrap: a 26-char line is wider than 142px at 6px/char", m6("A".repeat(26)) > 142);
ok("text.wrap: but the wrapper never emits one", G.text.wrap("A".repeat(26), 142, m6).every(l => m6(l) <= 142));

/* a single word longer than the column must be split, not overflow */
const longWord = G.text.wrap("OVERCHARGE", 49, m6);
ok("text.wrap: splits an over-long word", longWord.length > 1 && longWord.every(l => m6(l) <= 49));

/* --- fit scale --- */
ok("text.fitScale: shrinks to fit", G.text.fitScale("COMMANDO", 220, m6, 5, 1) === 4);
ok("text.fitScale: keeps the max when it fits", G.text.fitScale("HI", 200, m6, 5, 1) === 5);
ok("text.fitScale: never below the minimum", G.text.fitScale("X".repeat(500), 100, m6, 5, 1) === 1);

/* --- glyph coverage: the "?2" bug --- */
ok("text.missing: finds a glyph the font lacks", G.text.missing(["X2", "\u00D72"], "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789").join("") === "\u00D7");
ok("text.missing: clean text reports nothing", G.text.missing(["SCORE 001"], "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789").length === 0);

/* --- lines that fit --- */
ok("text.linesThatFit: floors the space", G.text.linesThatFit(50, 12) === 4);
ok("text.linesThatFit: never zero", G.text.linesThatFit(3, 12) === 1);

/* --- percentage layout --- */
ok("layout.pct: half of 400 is 50%", G.layout.pct(200, 400) === 50);
ok("layout.px: 50% of 400 is 200", G.layout.px(50, 400) === 200);
ok("layout: round trip survives a resize", G.layout.px(G.layout.pct(200, 400), 390) === 195);
ok("layout.clampPct: bounds the value", G.layout.clampPct(-40, -6, 96) === -6);

/* --- audit helpers --- */
const box = { x: 10, y: 10, w: 100, h: 40 };
ok("audit.inside: a contained box passes", G.audit.inside(box, { x1: 12, x2: 60, y1: 12, y2: 20 }));
ok("audit.inside: an overflowing box fails", G.audit.inside(box, { x1: 12, x2: 130, y1: 12, y2: 20 }) === false);
const recs = [
  { str: "IN", x1: 12, x2: 60, y1: 12, y2: 19 },
  { str: "OUT", x1: 12, x2: 200, y1: 12, y2: 19 }
];
ok("audit.overflow: reports only the offender", G.audit.overflow(recs, box).length === 1 &&
   G.audit.overflow(recs, box)[0].str === "OUT");
ok("audit.overlap: detects colliding panels", G.audit.overlap({ x: 0, y: 0, w: 100, h: 20 }, { x: 90, y: 0, w: 100, h: 20 }));
ok("audit.overlap: separated panels are fine", G.audit.overlap({ x: 0, y: 0, w: 84, h: 20 }, { x: 163, y: 0, w: 50, h: 20 }) === false);

/* --- the loop guard --- */
let threw = 0, captured = null;
const guardLoop = G.loop({
  step: 1 / 60,
  update: () => { threw++; throw new Error("frame blew up"); },
  onError: (e) => { captured = e.message; }
});
const rafCalls = [];
const realRaf = global.requestAnimationFrame;
global.requestAnimationFrame = (fn) => { rafCalls.push(fn); return rafCalls.length; };
try {
  guardLoop.start();
  /* the first frame has no dt to measure (there is no previous timestamp), so
     it is a no-op by design — drive a second frame to reach the update */
  rafCalls[0](1000);
  rafCalls[1](1020);                // 20ms -> at least one 16.7ms step -> update throws
  ok("loop: an error in update is contained", captured === "frame blew up");
  ok("loop: the next frame is still booked", rafCalls.length === 3);
  ok("loop: it kept running", guardLoop.isRunning());
} finally {
  global.requestAnimationFrame = realRaf;
  guardLoop.stop();
}

/* ---------- v1.2: the voxel layer ---------- */

// chunked storage
{
  const w = G.VoxelWorld({ chunkSize: 16 });
  ok("voxel: an empty world allocates no chunks", w.chunkCount() === 0);
  ok("voxel: reading empty space is 0", w.get(0, 0, 0) === 0);
  w.set(3, 4, 5, 7);
  ok("voxel: set/get round-trips", w.get(3, 4, 5) === 7);
  ok("voxel: one block allocates exactly one chunk", w.chunkCount() === 1);
  w.set(3, 4, 5, 0);
  ok("voxel: emptying a chunk drops it again", w.chunkCount() === 0);

  // negative coordinates are the classic off-by-one: floor(-1/16) is -1, not 0
  w.set(-1, -1, -1, 5);
  ok("voxel: negative coordinates round-trip", w.get(-1, -1, -1) === 5);
  ok("voxel: and do not alias their neighbours", w.get(0, 0, 0) === 0);
  ok("voxel: a block far away lands in its own chunk", (w.set(100, 0, 0, 1), w.chunkCount() === 2));

  // the chunk boundary itself: -1 and 15 are one block apart on the number line
  // but in DIFFERENT chunks, and truncating the division instead of flooring it
  // aliases them onto the same cell
  const edge = G.VoxelWorld({ chunkSize: 16 });
  edge.set(-1, 0, 0, 4);
  edge.set(15, 0, 0, 8);
  ok("voxel: -1 and 15 do not alias", edge.get(-1, 0, 0) === 4 && edge.get(15, 0, 0) === 8);
  ok("voxel: they sit in two chunks", edge.chunkCount() === 2);
}

// greedy meshing
{
  const w = G.VoxelWorld({ chunkSize: 16 });
  w.set(0, 0, 0, 1);
  const one = w.mesh(0, 0, 0);
  ok("mesh: a single block is 6 quads", one.count === 6, one.count + " quads");

  const solid = G.VoxelWorld({ chunkSize: 16 });
  solid.fill(0, 0, 0, 15, 15, 15, 1);
  const m = solid.mesh(0, 0, 0);
  ok("mesh: a solid 16^3 chunk is 6 quads, not 1536 faces", m.count === 6, m.count + " quads");
  ok("mesh: and its 6 quads cover 1536 faces of area",
     m.quads.reduce((s, q) => s + q.area, 0) === 1536);
  ok("mesh: the raw face count agrees", solid.faceCount() === 1536);
  ok("mesh: the saving is 256x", solid.faceCount() / m.count === 256);

  const bar = G.VoxelWorld({ chunkSize: 16 });
  bar.fill(0, 0, 0, 3, 0, 0, 2);
  const bm = bar.mesh(0, 0, 0);
  ok("mesh: a 4x1x1 bar is 6 quads", bm.count === 6, bm.count + " quads");
  // the top quad spans the bar's length on whichever axis is u or v for y
  ok("mesh: the four top faces merged into one quad of area 4",
     bm.quads.filter(q => q.axis === "y" && q.dir === 1 && q.area === 4).length === 1);
  ok("mesh: total area equals the bar's surface, 18",
     bm.quads.reduce((s, q) => s + q.area, 0) === 18);

  // two ids must NOT merge, or a two-coloured wall loses its pattern
  const two = G.VoxelWorld({ chunkSize: 16 });
  two.fill(0, 0, 0, 1, 0, 0, 1);
  two.set(2, 0, 0, 2);
  const tm = two.mesh(0, 0, 0);
  ok("mesh: different block ids stay separate quads",
     tm.quads.filter(q => q.axis === "y" && q.dir === 1).length === 2);
}

// edit operations
{
  const w = G.VoxelWorld({ chunkSize: 8 });
  ok("edit: fill writes every cell", w.fill(0, 0, 0, 1, 1, 1, 3) === 8);
  ok("edit: and they are all there", w.get(1, 1, 1) === 3);
  ok("edit: hollow leaves the interior alone",
     (w.hollow(0, 0, 0, 2, 2, 2, 4) === 26, w.get(1, 1, 1) === 3 && w.get(2, 2, 2) === 4));

  const s = G.VoxelWorld({ chunkSize: 16 });
  const n = s.sphere(0, 0, 0, 2, 9);
  ok("edit: a sphere of radius 2 has 33 cells", n === 33, n + " cells");
  ok("edit: its centre is filled", s.get(0, 0, 0) === 9);
  ok("edit: its corner is not", s.get(2, 2, 2) === 0);

  const c = G.VoxelWorld({ chunkSize: 16 });
  ok("edit: a cylinder of radius 1 over 3 rows has 15 cells",
     c.cylinder(0, 0, 0, 2, 1, 6) === 15);

  // copy/paste is the building half of a building game
  const src = G.VoxelWorld({ chunkSize: 8 });
  src.fill(0, 0, 0, 1, 1, 0, 5);
  const schem = src.copy(0, 0, 0, 1, 1, 0);
  ok("schematic: size is recorded", schem.size.join(",") === "2,2,1");
  ok("schematic: versioned for a future format", schem.version === 1);
  const dst = G.VoxelWorld({ chunkSize: 8 });
  dst.paste(schem, 10, 0, 0);
  ok("schematic: paste lands at the offset", dst.get(11, 1, 0) === 5);
  ok("schematic: and nothing landed at the origin", dst.get(0, 0, 0) === 0);
}

// noise and terrain
{
  const a = G.noise3(42), b = G.noise3(42), c = G.noise3(43);
  let same = true, ranged = true;
  for (let i = 0; i < 50; i++) {
    const v = a(i * 0.37, i * 0.11, i * 0.73);
    if (v !== b(i * 0.37, i * 0.11, i * 0.73)) same = false;
    if (!(v >= 0 && v < 1)) ranged = false;
  }
  ok("noise: the same seed gives the same value", same);
  ok("noise: every sample is in [0,1)", ranged);
  ok("noise: a different seed gives a different world", a(1.5, 2.5, 3.5) !== c(1.5, 2.5, 3.5));

  const w1 = G.VoxelWorld({ chunkSize: 16 }), w2 = G.VoxelWorld({ chunkSize: 16 });
  const t1 = G.terrain(w1, { seed: 11, size: 16, base: 3, amp: 6 });
  const t2 = G.terrain(w2, { seed: 11, size: 16, base: 3, amp: 6 });
  let identical = true;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    if (t1.heightAt(x, z) !== t2.heightAt(x, z)) identical = false;
  }
  ok("terrain: the same seed rebuilds the same world", identical);
  ok("terrain: heights stay inside base..base+amp",
     t1.heights.every(h => h >= 3 && h <= 9));
  ok("terrain: the surface block is the top id", w1.get(0, t1.heightAt(0, 0), 0) === 2);
  ok("terrain: and the block below is ground", w1.get(0, t1.heightAt(0, 0) - 1, 0) === 1);
  const t3 = G.terrain(G.VoxelWorld({ chunkSize: 16 }), { seed: 99, size: 16, base: 3, amp: 6 });
  ok("terrain: a different seed gives a different surface",
     t3.heights.join(",") !== t1.heights.join(","));

  const map = G.voxelToMap(w1, { w: 16, d: 16, maxY: 32 });
  ok("map: the top-down view shows the surface block", map.at(0, 0) === 2);
  ok("map: it is the map's own size", map.width === 16 && map.height === 16);
}

/* ---------- v1.2: Tiled JSON ---------- */
{
  const map = {
    width: 4, height: 3, tilewidth: 16, tileheight: 16,
    tilesets: [{ firstgid: 1, name: "tiles" }],
    layers: [
      { name: "floor", type: "tilelayer", width: 4, height: 3,
        data: [1, 1, 1, 1,
               1, 1, 1, 1,
               1, 1, 1, 1] },
      { name: "walls", type: "tilelayer", width: 4, height: 3,
        data: [0, 0, 0, 0,
               0, 2, 2, 0,
               0, 0, 0, 0] }
    ]
  };
  const t = G.tiled.parse(map);
  ok("tiled: the map size is read", t.width === 4 && t.height === 3);
  ok("tiled: the tile size is read", t.tilewidth === 16);
  ok("tiled: both layers are read", t.layers.length === 2);
  ok("tiled: a gid comes back by name and cell", t.gidAt("walls", 1, 1) === 2);
  ok("tiled: an empty cell is 0", t.gidAt("walls", 0, 0) === 0);
  ok("tiled: out of bounds is 0, not a crash", t.gidAt("walls", 9, 9) === 0);
  ok("tiled: a missing layer is 0", t.gidAt("nope", 0, 0) === 0);
  ok("tiled: a layer without data is refused loudly", (function () {
    try { G.tiled.parse({ width: 1, height: 1, layers: [{ name: "x" }] }); return false; }
    catch (e) { return /no data/.test(e.message); }
  })());

  const rects = t.collisionRects("floor");
  ok("tiled: a solid floor becomes ONE body, not 12", rects.length === 1, rects.length + " rects");
  ok("tiled: and it covers the whole layer", rects[0].w === 4 && rects[0].h === 3);

  const wall = t.collisionRects("walls");
  ok("tiled: two adjacent wall tiles merge into one 2x1 body",
     wall.length === 1 && wall[0].w === 2 && wall[0].h === 1, JSON.stringify(wall));

  const custom = t.collisionRects("walls", g => g === 2);
  ok("tiled: a custom solid test is honoured", custom.length === 1);
}


/* ---------- v1.3: atlas + sprite batching ---------- */
{
  const atlas = G.atlas({
    image: { w: 64, h: 64 },
    frames: {
      grass: [0, 0, 16, 16],
      wall: { x: 16, y: 0, w: 16, h: 32 }
    }
  });

  const uv = atlas.uv("grass");
  ok("atlas: a frame normalises to 0..1 corners",
     uv.u0 === 0 && uv.v0 === 0 && Math.abs(uv.u1 - 0.25) < 1e-9 && Math.abs(uv.v1 - 0.25) < 1e-9,
     JSON.stringify(uv));
  ok("atlas: the object frame form is accepted", atlas.frame("wall").h === 32);
  ok("atlas: an unknown frame is null, not garbage", atlas.frame("nope") === null && atlas.uv("nope") === null);
  ok("atlas: names() lists every frame", atlas.names().sort().join(",") === "grass,wall");

  // one call per texture, not per sprite
  const b = G.SpriteBatch({ capacity: 1024, atlas });
  b.add({ texture: "tiles", frame: "grass", x: 0, y: 0, w: 16, h: 16 });
  b.add({ texture: "tiles", frame: "wall", x: 16, y: 0, w: 16, h: 16 });
  b.add({ texture: "hero", frame: "grass", x: 32, y: 0, w: 16, h: 16 });
  ok("batch: three sprites from two images make TWO draw calls", b.count() === 3);
  let r = b.flush();
  ok("batch: two textures -> two calls", r.calls.length === 2 && r.textures === 2, r.calls.length + " calls");
  ok("batch: every sprite is in a call", r.quads === 3);
  ok("batch: NOTHING is dropped", r.dropped === 0);
  ok("batch: the atlas UV is carried onto the quad",
     Math.abs(r.calls[0].quads[0].u1 - 0.25) < 1e-9);
  ok("batch: flush empties the buffer", b.count() === 0 && b.flush().quads === 0);

  // the fixed-size buffer must not drop the tail
  const big = G.SpriteBatch({ capacity: 100 });
  for (let i = 0; i < 250; i++) big.add({ texture: "tiles", x: i, y: 0, w: 8, h: 8 });
  const bigR = big.flush();
  ok("batch: 250 sprites over capacity 100 still all arrive", bigR.quads === 250, bigR.quads + " quads");
  ok("batch: over capacity it SPILLS into more calls", bigR.calls.length === 3 && bigR.spilled === 2);
  ok("batch: and reports zero dropped", bigR.dropped === 0);

  // draw order: z, then insertion order
  const ord = G.SpriteBatch();
  ord.add({ texture: "t", x: 0, y: 0, w: 1, h: 1, z: 5, frame: null });
  ord.add({ texture: "t", x: 1, y: 0, w: 1, h: 1, z: 1 });
  ord.add({ texture: "t", x: 2, y: 0, w: 1, h: 1, z: 1 });
  const ordR = ord.flush();
  ok("batch: quads sort by z", ordR.calls[0].quads[0].z === 1 && ordR.calls[0].quads[2].z === 5);
  ok("batch: equal z keeps insertion order (a stable sort)",
     ordR.calls[0].quads[0].x === 1 && ordR.calls[0].quads[1].x === 2,
     JSON.stringify(ordR.calls[0].quads.map(q => q.x)));

  // a frame the atlas does not have is counted, never drawn as garbage
  const miss = G.SpriteBatch({ atlas });
  miss.add({ texture: "tiles", frame: "typo", x: 0, y: 0, w: 16, h: 16 });
  miss.add({ texture: "tiles", frame: "grass", x: 16, y: 0, w: 16, h: 16 });
  const missR = miss.flush();
  ok("batch: a missing frame is COUNTED", missR.missing === 1 && miss.stats().missingFrames === 1);
  ok("batch: the missing one is flagged on its quad", missR.calls[0].quads.some(q => q.missing === true));
  const noAtlas = G.SpriteBatch();
  noAtlas.add({ texture: "t", frame: "grass", x: 0, y: 0, w: 4, h: 4 });
  ok("batch: a frame name with no atlas is missing, not silently full-sheet",
     noAtlas.flush().missing === 1);

  // bad input is refused and counted, never rendered
  const bad = G.SpriteBatch();
  bad.add({ texture: "t", x: NaN, y: 0, w: 4, h: 4 });
  bad.add({ texture: "t", x: 0, y: 0, w: 0, h: 4 });
  bad.add({ texture: "t", x: 0, y: 0, w: 4, h: 4, visible: false });
  bad.add(null);
  bad.add({ texture: "t", x: 0, y: 0, w: 4, h: 4, alpha: 5 });
  const badR = bad.flush();
  ok("batch: a non-finite position is rejected", bad.stats().rejected === 3, JSON.stringify(bad.stats()));
  ok("batch: a hidden sprite is not drawn but is counted", badR.quads === 1 && bad.stats().hidden === 1);
  ok("batch: alpha is clamped to 1", badR.calls[0].quads[0].alpha === 1);

  // viewport culling is reported, and keeps the partial
  const cul = G.SpriteBatch();
  cul.add({ texture: "t", x: 0, y: 0, w: 10, h: 10 });       // inside
  cul.add({ texture: "t", x: 95, y: 0, w: 10, h: 10 });      // straddles the edge
  cul.add({ texture: "t", x: 500, y: 500, w: 10, h: 10 });   // off screen
  cul.setViewport({ x: 0, y: 0, w: 100, h: 100 });
  const culR = cul.flush();
  ok("batch: an off-screen sprite is culled, a straddling one is kept",
     culR.quads === 2 && culR.culled === 1, JSON.stringify({ q: culR.quads, c: culR.culled }));
  ok("batch: culling accumulates in stats", cul.stats().culled === 1);

  // the point of the module: many sprites, few calls
  const many = G.SpriteBatch({ capacity: 4096 });
  const names = ["tiles", "hero", "fx", "ui"];
  for (let i = 0; i < 2000; i++) many.add({ texture: names[i % 4], x: i, y: 0, w: 8, h: 8 });
  const manyR = many.flush();
  ok("batch: 2,000 sprites cost 4 draw calls, not 2,000",
     manyR.calls.length === 4 && manyR.quads === 2000, manyR.calls.length + " calls");

  // paint walks every quad, in call order
  let visited = 0;
  const callsSeen = many.paint(manyR, () => visited++);
  ok("batch: paint visits every quad", visited === 2000 && callsSeen === 4);

  const cl = G.SpriteBatch();
  cl.add({ texture: "t", x: 0, y: 0, w: 1, h: 1 });
  cl.clear();
  ok("batch: clear drops what was pending", cl.count() === 0);
}

/* ---- v1.4: code-audio — patterns to samples, headless ---- */
(function audioTests() {
  const A = G.audio;

  // pitch: a name, not a lookup table that is wrong past one octave
  ok("audio: A4 is 440", A.freq("A4") === 440);
  ok("audio: C4 is 261.63", Math.abs(A.freq("C4") - 261.6255653005986) < 1e-9);
  ok("audio: a sharp and its flat are the same pitch",
     Math.abs(A.freq("C#4") - A.freq("Db4")) < 1e-9);
  ok("audio: a flat below C is read as B of the octave below",
     Math.abs(A.freq("Bb3") - 233.08188075904496) < 1e-9);
  ok("audio: an unreadable name is null, never NaN or a 0 Hz drone",
     A.freq("H4") === null && A.freq("") === null && A.freq(null) === null && A.freq(0) === null);
  ok("audio: midi 69 is A4", A.midi(69) === 440);

  // waves are pure and bounded
  ok("audio: square is +-1", A.waves.square(0.25) === 1 && A.waves.square(0.75) === -1);
  ok("audio: saw runs -1..1", A.waves.saw(0) === -1 && Math.abs(A.waves.saw(0.999) - 0.998) < 1e-9);
  ok("audio: triangle peaks at half phase", A.waves.triangle(0.5) === 1 && A.waves.triangle(0) === -1);
  ok("audio: sine quarter phase is 1", Math.abs(A.waves.sine(0.25) - 1) < 1e-9);

  // the click: a note starts at 0 and ends at 0
  const sr = 8000;
  const one = A.render({ sampleRate: sr, duration: 0.2,
    notes: [{ note: "A4", dur: 0.19, wave: "square", gain: 0.5 }] });
  ok("audio: a note starts at exactly 0 (no click)", one[0] === 0);
  ok("audio: a note is silent at its last sample (no click)",
     Math.abs(one[one.length - 1]) < 1e-6 && Math.abs(one[one.length - 2]) < 1e-3,
     one[one.length - 1]);

  // the renderer enforces the edges itself: a pattern that asks for a zero
  // attack and a zero release still cannot click
  const raw = A.render({ sampleRate: sr, duration: 0.2,
    notes: [{ note: "A4", dur: 0.19, wave: "square", gain: 0.9, attack: 0, release: 0 }] });
  ok("audio: a zero attack and a zero release are still declicked",
     raw[0] === 0 && Math.abs(raw[raw.length - 1]) < 1e-6,
     raw[0] + " / " + raw[raw.length - 1]);

  // the envelope is a function of (t, dur), and it ends at 0 inside the note
  const e = A.env({ attack: 0.01, decay: 0.02, sustain: 0.5, release: 0.05 });
  ok("audio: envelope starts at 0 and peaks at the attack", e(0, 0.2) === 0 && Math.abs(e(0.01, 0.2) - 1) < 1e-9);
  ok("audio: envelope is 0 at and past the note's end", e(0.2, 0.2) === 0 && e(0.3, 0.2) === 0);
  ok("audio: a note held past its sustain still releases inside itself",
     e(0.1999, 0.2) < 0.01 && e(0.19, 0.2) > 0 && e(0.19, 0.2) < 0.5);
  ok("audio: a long release cannot silence the middle of the note",
     A.env({ attack: 0.001, decay: 0.001, sustain: 0.8, release: 5 })(0.1, 0.2) > 0.25,
     A.env({ release: 5 })(0.1, 0.2));

  // a busy bar gets quieter, it does not fold over
  const loud = A.render({ sampleRate: sr, duration: 0.3, notes: [
    { note: "C3", dur: 0.28, gain: 0.9 }, { note: "E3", dur: 0.28, gain: 0.9 },
    { note: "G3", dur: 0.28, gain: 0.9 }, { note: "C4", dur: 0.28, gain: 0.9 },
    { note: "E4", dur: 0.28, gain: 0.9 }, { note: "G4", dur: 0.28, gain: 0.9 },
    { note: "C5", dur: 0.28, gain: 0.9 }, { note: "E5", dur: 0.28, gain: 0.9 }] });
  const loudStats = A.stats(loud);
  ok("audio: a summed chord never exceeds a peak of 1", loudStats.peak <= 1 + 1e-6 && loudStats.peak > 0.99,
     loudStats.peak);
  ok("audio: no sample is NaN or infinite", loudStats.nonFinite === 0);
  const quiet = A.render({ sampleRate: sr, duration: 0.2, notes: [{ note: "A4", dur: 0.18, gain: 0.2 }] });
  ok("audio: a quiet note is not silently boosted to full scale", A.stats(quiet).peak < 0.25);

  // bad input is silence, not a crash and not noise
  const badPitch = A.render({ sampleRate: sr, duration: 0.1, notes: [{ note: "nope", dur: 0.09 }] });
  ok("audio: an unreadable pitch renders silence", A.stats(badPitch).silent === true);
  const badAt = A.render({ sampleRate: sr, duration: 0.1,
    notes: [{ note: "C4", at: NaN, dur: NaN }, null, "not a note"] });
  ok("audio: a NaN position or a junk note does not poison the buffer",
     A.stats(badAt).nonFinite === 0);

  // the sample count is arithmetic, not a guess
  ok("audio: 0.5s at 8000 Hz is 4000 samples",
     A.render({ sampleRate: sr, duration: 0.5, notes: [] }).length === 4000);
  ok("audio: duration is derived from the notes when not given",
     A.render({ sampleRate: sr, notes: [{ note: "C4", at: 0.1, dur: 0.1 }] }).length === Math.round(0.2 * sr));

  // the grid is the music
  const t = A.track({ bpm: 120, stepsPerBeat: 4, seq: ["C4", null, "E4", { note: "G4", len: 2 }] });
  ok("audio: a 120 bpm 1/16 step is 0.125s", Math.abs(t.stepDur - 0.125) < 1e-12);
  ok("audio: a rest is a rest and a note lands on its step",
     t.notes.length === 3 && t.notes[0].at === 0 && Math.abs(t.notes[1].at - 0.25) < 1e-12);
  ok("audio: a note is shorter than its step, so repeats articulate",
     t.notes[0].dur < t.stepDur);
  ok("audio: a two-step note is longer than a one-step note",
     t.notes[2].dur > t.notes[0].dur);
  ok("audio: the track renders to its own length",
     Math.abs(A.stats(A.render({ sampleRate: sr, duration: t.duration, notes: t.notes })).samples -
              Math.round(t.duration * sr)) === 0);

  // determinism: the same seed is the same hit, twice
  const n1 = A.render({ sampleRate: sr, duration: 0.1, seed: 9, notes: [{ freq: 100, dur: 0.09, wave: "noise" }] });
  const n2 = A.render({ sampleRate: sr, duration: 0.1, seed: 9, notes: [{ freq: 100, dur: 0.09, wave: "noise" }] });
  const n3 = A.render({ sampleRate: sr, duration: 0.1, seed: 10, notes: [{ freq: 100, dur: 0.09, wave: "noise" }] });
  ok("audio: seeded noise is the same twice", JSON.stringify(Array.from(n1)) === JSON.stringify(Array.from(n2)));
  ok("audio: a different seed is a different hit",
     JSON.stringify(Array.from(n1)) !== JSON.stringify(Array.from(n3)));

  // glide is a pitch change, and it is measurable
  const gl = A.render({ sampleRate: sr, duration: 0.5,
    notes: [{ note: "A3", dur: 0.5, wave: "sine", glide: 4, gain: 0.5 }] });
  let firstHalf = 0, secondHalf = 0;
  for (let i = 1; i < gl.length; i++) {
    if ((gl[i - 1] < 0) !== (gl[i] < 0)) { i < gl.length / 2 ? firstHalf++ : secondHalf++; }
  }
  ok("audio: a glide upwards crosses zero more often later", secondHalf > firstHalf * 1.5,
     firstHalf + " -> " + secondHalf);

  // the presets are data
  const coinNotes = A.sfx("coin").notes;
  ok("audio: coin is two rising notes",
     coinNotes.length === 2 && A.freq(coinNotes[1].note) > A.freq(coinNotes[0].note));
  ok("audio: an unknown sfx is null, never a random noise burst", A.sfx("nope") === null);
  const coin = A.render(Object.assign({ sampleRate: sr }, A.sfx("coin")));
  ok("audio: every preset renders audible, unclipped sound",
     !A.stats(coin).silent && A.stats(coin).peak <= 1 + 1e-6 &&
     Object.keys(A.presets).every(k => {
       const r = A.stats(A.render(Object.assign({ sampleRate: sr }, A.sfx(k))));
       return !r.silent && r.peak <= 1 + 1e-6;
     }));

  // the one browser-dependent function, against a stub context
  const fake = {
    sampleRate: 44100,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ connect() {}, start(when) { this.at = when; } }),
    destination: {}
  };
  const src = A.play(fake, coin);
  ok("audio: play hands the samples to a context", src && src.at === 0);
  ok("audio: play with no context is null, not a crash", A.play(null, coin) === null);
})();

/* ---- v1.5: the scene graph ---- */
(() => {
  const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

  // translation composes down the chain
  const root = G.node({ name: "root", x: 100, y: 50 });
  const body = G.node({ name: "body", x: 10, y: 0 });
  const gun = G.node({ name: "gun", x: 5, y: 0 });
  root.append(body);
  body.append(gun);
  ok("scene: a child's world position includes its parents'", near(gun.world().x, 115) && near(gun.world().y, 50));
  ok("scene: depth is counted, not guessed", gun.depth() === 2 && root.depth() === 0);
  ok("scene: root() climbs to the top", gun.root() === root);

  // rotation composes: a parent turned 90 deg carries its child round with it
  root.set({ rot: Math.PI / 2 });
  ok("scene: rotation carries a child", near(gun.world().x, 100, 1e-9) && near(gun.world().y, 65, 1e-9));
  const p = gun.worldPoint(0, 0);
  ok("scene: worldPoint agrees with world()", near(p.x, gun.world().x) && near(p.y, gun.world().y));

  // scale multiplies along the chain
  root.set({ rot: 0, sx: 2, sy: 3 });
  ok("scene: scale multiplies down the chain", near(gun.world().sx, 2) && near(gun.world().sy, 3));
  ok("scene: scaled offset is scaled", near(gun.world().x, 130) && near(gun.world().y, 50));

  // the cache invalidates through the tree, without touching the child
  root.set({ sx: 1, sy: 1 });
  const before = gun.world().x;
  root.set({ x: 200 });
  ok("scene: moving a parent moves the child's cached world", gun.world().x === before + 100);

  // a cycle is refused at the door, not survived at runtime
  const cyc = G.node({ name: "cyc" });
  ok("scene: appending an ancestor is refused", body.append(root) === false);
  ok("scene: a refused cycle leaves the tree alone", root.parent === null && root.children.indexOf(body) === 0);
  ok("scene: a node cannot parent itself", root.append(root) === false);
  const deepWalk = root.walk(() => {});
  ok("scene: the tree still walks after a refused cycle", deepWalk === 3);

  // appending twice moves, never duplicates
  const dup = G.node({ name: "dup" });
  root.append(body); root.append(dup); root.append(body);
  ok("scene: re-appending moves the child to the end", root.children.length === 2 && root.children[1] === body);

  // reparenting detaches from the old parent
  const other = G.node({ name: "other" });
  other.append(body);
  ok("scene: reparenting removes the old edge", root.children.indexOf(body) < 0 && body.parent === other);

  // remove/detach are honest about a miss
  ok("scene: removing a stranger is false, not a throw", root.remove(G.node()) === false);
  ok("scene: detach unhooks the node", body.detach() === true && body.parent === null);

  // a callback that mutates the tree mid-walk must not skip a sibling or
  // invent one: the level is queued before any callback runs
  const wroot = G.node({ name: "w" });
  const seen = [];
  const wk = [0, 1, 2, 3].map((i) => G.node({ name: "k" + i }));
  wk.forEach((k) => wroot.append(k));
  wroot.walk((n) => {
    seen.push(n.name);
    if (n.name === "k0") { wroot.remove(wk[2]); wroot.append(G.node({ name: "late" })); }
  });
  ok("scene: a removal and an append mid-walk neither skip nor invent", seen.join(",") === "w,k0,k1,k2,k3");
  ok("scene: the walk's mutations really happened", wroot.children.length === 4 && wroot.children.indexOf(wk[2]) < 0);

  // parent is a public field: a loop closed by assignment must not freeze the
  // walk (append refuses it, assignment cannot be refused)
  const cycA = G.node({ name: "A" }), cycB = G.node({ name: "B" });
  cycA.append(cycB);
  cycA.parent = cycB;                       // the cycle append would have refused
  cycB.children.push(cycA);                 // ...and this is the loop it prevents
  const capped = cycA.walk(() => {}, { maxNodes: 50 });
  ok("scene: a hand-made cycle is capped, not hung", capped === 50);
  cycA.parent = null; cycB.children.length = 0;

  // 20,000 deep: slow, not a stack overflow (the recursive version dies here)
  const chain = G.node({ x: 0 });
  let tail = chain;
  for (let i = 0; i < 20000; i++) { const n = G.node({ x: 1 }); tail.append(n); tail = n; }
  let walked = 0;
  chain.walk(() => { walked++; });
  ok("scene: a 20,000-deep chain walks without overflowing", walked === 20001);
  ok("scene: the deep chain's world transform is right", tail.world().x === 20000);
  ok("scene: depth() agrees at the bottom of the chain", tail.depth() === 20000);
  let cappedCount = 0;
  const capHit = chain.walk(() => { cappedCount++; }, { maxNodes: 500 });
  ok("scene: walk honours a node cap", capHit === 500 && cappedCount === 500);

  // hidden subtrees are skipped by the walk and by bounds
  const hid = G.node({ name: "hid", x: 1000, y: 1000, w: 10, h: 10 });
  const show = G.node({ name: "show", x: 0, y: 0, w: 10, h: 10 });
  const hroot = G.node({});
  hroot.append(show); hroot.append(hid);
  hid.set({ visible: false });
  ok("scene: a hidden node is skipped by the walk", hroot.walk(() => {}) === 2);
  ok("scene: includeHidden sees it", hroot.walk(() => {}, { includeHidden: true }) === 3);
  const hb = hroot.bounds();
  ok("scene: hidden geometry is out of the bounds", hb && hb.w === 10 && hb.x === -5);
  ok("scene: a fully hidden tree has no bounds", (() => { const r = G.node({ visible: false }); const k = G.node({ w: 4, h: 4, visible: false }); r.append(k); return r.bounds() === null; })());

  // bounds apply rotation to the CORNERS, not just the origin
  const box = G.node({ w: 10, h: 10, rot: Math.PI / 4 });
  const bb = box.bounds();
  ok("scene: a rotated box's bounds grow", near(bb.w, 10 * Math.SQRT2, 1e-9) && near(bb.h, 10 * Math.SQRT2, 1e-9));

  // localPoint is a real inverse, and refuses a singular transform
  const t = G.node({ x: 30, y: 20, rot: 0.7, sx: 2, sy: 4 });
  const wp = t.worldPoint(3, -5);
  const lp = t.localPoint(wp.x, wp.y);
  ok("scene: localPoint inverts worldPoint", near(lp.x, 3, 1e-9) && near(lp.y, -5, 1e-9));
  const flat = G.node({ sx: 0 });
  ok("scene: a zero scale has no inverse — null, not Infinity", flat.localPoint(5, 5) === null);
  ok("scene: a zero scale's world point is still finite", isFinite(flat.worldPoint(5, 5).x));

  // one NaN must not poison the tree
  const nanNode = G.node({ x: 5 });
  nanNode.set({ x: NaN });
  ok("scene: a non-finite set is ignored", nanNode.x === 5 && isFinite(nanNode.world().x));

  // lookup and pruning
  const lroot = G.node({ name: "l" });
  const a = G.node({ name: "a", tag: "enemy", x: 0, y: 0, w: 10, h: 10 });
  const b = G.node({ name: "b", tag: "enemy", x: 100, y: 0, w: 10, h: 10 });
  const c = G.node({ name: "c", tag: "pickup", x: 2, y: 0, w: 4, h: 4 });
  lroot.append(a); lroot.append(b); a.append(c);
  ok("scene: find() by name", lroot.find("c") === c && lroot.find("nope") === null);
  ok("scene: byTag() collects every match", lroot.byTag("enemy").length === 2 && lroot.byTag("pickup")[0] === c);
  const hits = lroot.query({ x: -10, y: -10, w: 20, h: 20 });
  ok("scene: query() returns what overlaps", hits.indexOf(a) >= 0 && hits.indexOf(c) >= 0 && hits.indexOf(b) < 0);
  let pruned = 0;
  const visited = [];
  lroot.walk((n) => { pruned++; visited.push(n.name); if (n === a) return false; });
  ok("scene: returning false prunes a subtree", pruned === 3 && visited.join(",") === "l,a,b" && visited.indexOf("c") < 0);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

