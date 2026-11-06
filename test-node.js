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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

