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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

