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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
