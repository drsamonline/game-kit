# game-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/game-kit/)
[![test](https://github.com/drsamonline/game-kit/actions/workflows/test.yml/badge.svg)](https://github.com/drsamonline/game-kit/actions/workflows/test.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

**The shared game core for drsamonline apps.** Zero dependencies. The common
engine every small browser game was re-implementing, extracted once from
`neon-engine` and `Aethelgard-Engine`.

- a **fixed-timestep loop** (deterministic, testable, no spiral-of-death);
- an **entity-component system** *(v2)* — an entity is an id plus a bag of components, and behaviour lives in systems that run in order over the entities holding the components they name;
- a **state machine** *(v2)* — named states with allowed transitions (`boot → menu → play → pause → game-over → again`), refusing a transition the table does not allow;
- a **seeded RNG** *(v2)* — reproducible levels and spawns from a seed;
- **collision primitives** *(v2)* — AABB, circle, circle-vs-box;
- a **minimal 2-D physics step** *(v2)* — separate + restitution + friction for AABBs;
- an **input** manager (keyboard);
- a tiny **scene** helper;
- **save / load** (bring your own storage — `web-kit` fits);
- **maths helpers** (`clamp`, `lerp`, `dist`, `aabb`, `rand`);
- **text layout** *(v1.1)* — wrap by measured width, auto-fit headings, glyph-coverage checks;
- **percentage layout** *(v1.1)* — position controls so they survive rotation and resize, with a
  drag helper for building a pad editor;
- **layout auditing** *(v1.1)* — assert text stays inside its box, which a viewport check cannot do.;
- a **chunked voxel world** *(v1.2)* — sparse chunks, **greedy meshing** (a solid 16³ chunk is 6 quads, not 1,536 faces), and `fill` / `hollow` / `sphere` / `cylinder` / `copy` / `paste` edit operations;
- **seeded 3-D noise and terrain** *(v1.2)* — the same seed rebuilds the same world;
- a **Tiled map reader** *(v1.2)* — reads the Tiled editor's own JSON, with `collisionRects()` merging solid tiles into as few bodies as possible;
- a **world-to-map view** *(v1.2)* — a voxel world rendered top-down as tiles.
- **sprite batching** *(v1.3)* — `Game.atlas` + `Game.SpriteBatch`: sprites grouped by image, so 2,000 sprites cost 4 draw calls; a fixed buffer that **spills instead of dropping the tail**, a stable `z` order, and culling/misses you can count.
- **a scene graph** *(v1.5)* — `Game.node`: parent/child transforms composed and **cached** (moving one node dirties only its subtree), a cycle **refused at the door**, a walk that never recurses (20,000 deep is slow, not a stack overflow), and `localPoint` that returns `null` instead of `Infinity` for a zero scale.
- **grid navigation** *(v1.9)* — `Game.flowField`: BFS from the target once, then every chaser asks `step(x, z)` and walks downhill. Unreachable is `-1` (not `0`, which means "you are there"), and `step` never points into a blocked cell.
- **object pooling** *(v1.9)* — `Game.pool`: bullets, particles and corpses that are created and destroyed thousands of times a minute. A hard `cap`, reuse before allocation, and `stats()` so you size the pool from evidence.
- **a minimap** *(v1.9)* — `Game.minimap`: the floor plan prerendered once into an offscreen canvas, then a blit plus your markers. A minimap that redraws every wall every frame costs more than the game.
- **generative music** *(v1.9)* — `Game.audio.gen`: a minor pentatonic, a tempo and a rule for the next note, with an intensity your game feeds in. The sequencer plays what you wrote; this writes it.
- **a camera** *(v1.10)* — `Game.camera`: follow with a **dead zone**, clamp to the level (a world smaller than the view is centred, not clamped), a shake that is an **offset and never written into the position**, and `toScreen`/`toWorld` that include the shake so picking matches what was drawn.
- **sprite animation** *(v1.10)* — `Game.anim`: clips over atlas frame names with `loop` / `once` / `pingpong`, per-frame **events** (a footstep on frame 3), `done()` that holds the last frame, and `fps: 0` that freezes instead of dividing by zero.
- **A\* pathfinding** *(v1.10)* — `Game.astar`: an arbitrary target, no **corner cutting** between two walls, a deterministic tie-break so a replay re-paths identically, and a **node budget** so a hopeless search cannot eat the frame. `null`, never `[]`, when there is no route.
- **particles** *(v1.10)* — `Game.particles`: pooled, seeded and capped. When the budget is full the **oldest** particle dies, so a fresh muzzle flash is not swallowed by old smoke.
- **replays** *(v1.10)* — `Game.replay`: one input snapshot per **fixed step**, run-length encoded, with the seed and the step travelling with the file, and checkpoints so a desync is caught where it happens.
- **code-audio** *(v1.4)* — `Game.audio`: pitches from names, seeded oscillators, ADSR that cannot click, a pattern grid (`bpm` + `seq`) rendered to a `Float32Array`, five SFX presets as data, and `play(ctx, samples)` as the only browser-dependent line. **Game music is patterns, not files.**

Every one of those exists because a shipped game got it wrong first. The stories are in
[**docs/PLAYBOOK.md**](docs/PLAYBOOK.md) — eleven rules, each tied to the bug that taught it.

Where each module sits against the wider open-source game world — and what was
deliberately left out — is [**docs/PRIOR-ART.md**](docs/PRIOR-ART.md), a survey of the
439-entry [awesome-open-source-games](https://github.com/michelpereira/awesome-open-source-games)
catalogue: about fifteen recurring problems behind a few hundred games.

## Scene graph *(v1.5)*

A gun follows a hand that follows a body that follows a camera. Doing that by hand
means adding the parent's position at every draw call — and then forgetting the
rotation, so the parts drift apart the moment anything turns.

```js
const player = Game.node({ x: 100, y: 50 });
const gun    = Game.node({ x: 12, y: 0, w: 8, h: 4 });
player.append(gun);

player.set({ rot: Math.PI / 2 });   // the gun turns with the player
gun.world();                        // { x, y, rot, sx, sy } — composed, and cached
gun.worldPoint(0, 0);               // the muzzle, in world space
gun.localPoint(200, 60);            // ...and back again (null if the scale is 0)
gun.box();                          // this node's world box
player.bounds();                    // the box of everything visible below it
player.query({ x: 0, y: 0, w: 640, h: 480 });   // what overlaps, one walk
```

- **The cache invalidates down the tree.** Moving a parent marks its subtree dirty;
  a world transform composes from the nearest clean ancestor. Dragging a 5,000-node
  level around does not cost 5,000 matrix multiplies per frame.
- **A cycle is refused by `append`.** A loop does not throw — it spins, and the game
  freezes on its last frame. Refused, the tree is simply unchanged. `parent` is a
  public field, so `walk` also carries a node cap as the last line of defence.
- **Nothing recurses.** `walk`, the dirty sweep and the bounds pass use an explicit
  stack: a 20,000-deep chain is slow, not a stack overflow. The recursive version
  works beautifully until someone builds a rope.
- **A callback may mutate the tree.** Children are queued before any callback for
  that level runs, so a node that removes a sibling mid-walk cannot make the walk
  skip or invent one.
- **Hidden subtrees are skipped** by `walk` and excluded from `bounds` — and a
  `NaN` handed to `set` is ignored rather than allowed to poison every transform
  below it.

## Code-audio *(v1.4)*

```js
const ctx = new AudioContext();

// a sound effect is a pattern
const jump = Game.audio.sfx("jump");                       // { duration, notes }
Game.audio.play(ctx, Game.audio.render(jump));

// a level theme is a grid, not a file
const theme = Game.audio.track({
  bpm: 132, stepsPerBeat: 4, wave: "square", gain: 0.35,
  seq: ["C5", null, "E5", "G5", null, "E5", { note: "C5", len: 2 }, null,
        "A4", null, "C5", "E5", null, "C5", { note: "A4", len: 2 }, null]
});
const samples = Game.audio.render({ notes: theme.notes, duration: theme.duration, seed: 3 });
Game.audio.stats(samples);   // { peak: 1, rms, nonFinite: 0, silent: false }

// loop it forever, from bytes you already had
const buffer = ctx.createBuffer(1, samples.length, 44100);
buffer.getChannelData(0).set(samples);
```

Every note starts at 0 and ends at 0, because the renderer enforces a minimum
attack and release even when the pattern asks for none. A summed chord is
normalised to a peak of 1 rather than wrapping, and a long release is clamped so it
cannot silence the note it belongs to. Noise is seeded, so the same seed is the
same hit in the test and in the game.

## Sprite batching *(v1.3)*

```js
const atlas = Game.atlas({ image: { w: 256, h: 256 },
  frames: { grass: [0, 0, 16, 16], hero: [16, 0, 16, 32] } });

const batch = Game.SpriteBatch({ capacity: 1024, atlas });
batch.setViewport({ x: cam.x, y: cam.y, w: 800, h: 600 });   // cull off-screen
batch.add({ texture: "tiles", frame: "grass", x: 32, y: 64, w: 16, h: 16, z: 0 });
batch.add({ texture: "tiles", frame: "hero",  x: 48, y: 64, w: 16, h: 32, z: 1 });

const r = batch.flush();
// r.calls -> one entry per image (and per capacity spill); r.dropped is always 0
r.calls.forEach(c => { ctx.drawImage(sheet[c.texture], 0, 0); c.quads.forEach(q => draw(q)); });
```

A frame the atlas does not have is **counted** (`r.missing`), never drawn as the whole
sheet. Over capacity the batch spills into another call rather than losing the tail.

## Voxels and tilemaps *(v1.2)*

```js
const world = Game.VoxelWorld({ chunkSize: 16 });
Game.terrain(world, { seed: 42, size: 32, base: 4, amp: 10 });

world.set(0, 20, 0, 3);
world.sphere(8, 22, 8, 3, 4);          // a boulder
const schem = world.copy(7, 19, 7, 11, 25, 11);   // versioned, JSON-safe
world.paste(schem, 24, 19, 24);        // build it again, elsewhere

const mesh = world.mesh(0, 0, 0);      // greedy-merged quads, min corner + uw/vh
// mesh.quads -> [{axis:'y', dir:1, block:2, x, y, z, u, v, uw, vh, area}]
```

```js
const t = Game.tiled.parse(await (await fetch("level.json")).json());
t.gidAt("walls", 3, 4);                 // bounds-safe: 0, never a crash
t.collisionRects("walls", g => g > 0);  // [{x, y, w, h}] — merged, not per tile
```

## Use it

```js
// wrap to a pixel column, not a character count
const lines = Game.text.wrap(str, columnWidth, s => ctx.measureText(s).width);

// shrink a heading until it fits
const scale = Game.text.fitScale(title, maxWidth, (s, sc) => measure(s) * sc, 5, 1);

// did the font actually have every glyph?
const missing = Game.text.missing(allUiStrings, FONT_CHARSET);

// controls that survive rotation: store percentages, not pixels
Game.layout.apply(el, { x: 2, y: 62, scale: 1.1, opacity: 0.7 });
Game.layout.draggable(el, box => save(box));

// in a test: does any string leave its panel?
const recs = Game.audit.record(drawText, draw => draw(ctx));
Game.audit.overflow(recs, panelRect);      // [] means clean
```

```js
const game = Game.loop({
  step: 1 / 60,
  update: dt => { /* move things by dt */ },
  render: a => { /* draw, interpolate by a */ }
});
game.start();

const input = Game.input(window);
if (input.isDown("ArrowLeft")) player.x -= speed;
input.endFrame();

const scenes = Game.Scenes().add("menu", menu).add("play", play).go("menu");
const save = Game.save(localStorage, "save");   // or Loom.storage from web-kit
save.write({ level: 3 });

// v2: an ECS world steps headless — the sim has no canvas
const world = Game.ECS();
const e = world.create({ pos: { x: 0 }, vel: { x: 2 } });
world.system(["pos", "vel"], (id, ent, dt) => { ent.pos.x += ent.vel.x * dt; })
     .system(["pos"], (id, ent) => draw(ent.pos));
world.update(1 / 60);

// v2: a seeded level, and a state machine with allowed transitions
const rng = Game.rng(1234);
const machine = Game.Machine({ initial: "boot", transitions: { boot: { start: "menu" }, menu: { play: "play" } } });
machine.send("start");            // -> "menu"; an event not in the table is refused

// v2: separate, bounce and damp
Game.resolve(player, platform, { restitution: 0.4, friction: 0.1 });
```

## Why a fixed timestep

Physics and game logic must advance in equal steps or behaviour changes with frame
rate. The loop accumulates real time and runs whole `step`s, and **clamps a huge
frame** so a backgrounded tab does not spiral into thousands of updates.

## v2 — what's new

The kit absorbed the engine patterns every small browser game rebuilds:

- **ECS** — the game architecture pattern, so a game can be composed rather than subclassed, and the sim can be tested on its own.
- **A seeded RNG** — a level is reproducible from a seed (`Game.rng(seed)`); use it instead of `Math.random` anywhere determinism matters.
- **A state machine** — named states and *allowed* transitions, so `boot → menu → play → pause → game-over → again` is explicit and an illegal jump is refused.
- **Collision primitives** — AABB (already there), plus circle and circle-vs-box.
- **A minimal 2-D physics step** — `Game.resolve(a, b, {restitution, friction})` separates two boxes along the axis of least penetration and bounces them.

Every addition is reimplemented from the idea, not copied.

## Camera, animation, paths, particles, replays *(v1.10)*

Five things every game in the family wrote again, taken from the catalogue of open-source
games rather than from one more game.

```js
const cam = Game.camera({ width: 800, height: 600, seed: 7,
  bounds: { x: 0, y: 0, w: 4000, h: 3000 },
  deadzone: { x: 300, y: 200, w: 200, h: 200 },   // the target may wander inside this box
  smooth: 0.2 });                                  // dt-corrected: same at 30 fps and 144 fps

cam.follow(player.x, player.y, dt);   // from update(), never from render()
cam.shake(6, 0.25);                   // amplitude, seconds — an offset, not a position
cam.update(dt);
cam.apply(ctx);                       // inside save()/restore()
cam.toWorld(mouse.x, mouse.y);        // includes the shake: pick what the player saw

const hero = Game.anim({ clips: {
  idle: { frames: ["i0", "i1"], fps: 4, loop: true },
  walk: { frames: ["w0", "w1", "w2", "w1"], fps: 10, loop: true },
  die:  { frames: ["d0", "d1", "d2"], fps: 8, loop: "once", onEnd: respawn },
  step: { frames: ["w0", "w1", "w2"], fps: 10, loop: true,
          events: { 1: "footstep" }, onEvent: (e) => play("step") }
} });
hero.play("walk");                    // playing "walk" again keeps the phase
hero.update(dt);
draw(atlas, hero.frame());

const route = Game.astar({ width: 64, height: 64, diagonal: true,
  blocked: (x, z) => map.solid(x, z), budget: 20000 }).path(sx, sz, tx, tz);
// -> [{ x, z }, ...] or null. No corner cutting, same path every run.

const sparks = Game.particles({ cap: 256, seed: 3, gravity: 400, drag: 0.9 });
sparks.burst({ x: hit.x, y: hit.y, count: 12, speed: [40, 160], life: [0.2, 0.6], colour: [1, 2, 3] });
sparks.update(dt);
sparks.each((p, alpha) => drawSpark(p, alpha));

const rec = Game.replay({ seed: 42, step: 1 / 60 });
rec.frame(input.snapshot());          // once per fixed update
const tape = rec.export();            // { step, seed, runs, checks }

const play = Game.replay.load(tape);
if (!play.matches({ step: 1 / 60 })) throw new Error("recorded at another step");
const thisFrame = play.next();        // null when the tape ends
```

- **The shake never touches the camera's position.** Added to `x`/`y` it accumulates a
  residual that never comes back, and the level drifts a pixel per explosion.
- **A world smaller than the view is centred.** Clamping a 320 px level into an 800 px
  view gives a negative range, and the level will not sit still.
- **A\* returns `null`, not `[]`,** when there is no route — an empty path reads as
  "you are already there".
- **The oldest particle dies** when the cap is reached, so a new burst is always visible.
- **A replay needs the fixed step and the seed it was recorded with**, which is why it
  could not exist before v1.10.

## Verified

```
node test-node.js
314 passed, 0 failed
```

Covers the loop's step counts, the `maxFrame` clamp, sub-step frames, scenes,
save/load, every maths helper, and the v2 surface: RNG reproducibility, ECS
(component filtering and **update order**), the state machine, a collision case
per primitive, a physics resolution case, the voxel and Tiled layer, sprite
batching (spill, z-order, culling, misses), code-audio (declick, normalise,
articulation) and the scene graph (compose, cache invalidation, refused cycles,
a 20,000-deep chain, mid-walk mutation, singular transforms) — all headless, no
browser. v1.10 adds the camera (dead zone, clamp, a world smaller than the view,
shake determinism, picking during a shake, 60 fps vs 30 fps), the clip player
(wrap, `once`, `pingpong`, frozen `fps: 0`, events on entry, no restart on replay),
A\* (a wall walked around, a sealed goal, no corner cutting, the node budget, the
same path twice), particles (gravity, life, the cap, the same seed) and replays
(collapse, copy, step mismatch, checkpoints, a truncated tape).

## Games built with game-kit

Every game in the family is collected in one gallery: [`games/`](games/).

- **Games:** neon-games, neon-runner, retro-strike, idle-city-ages-of-growth,
  dance-fight, aethelgard-games, AethelgardVN
- **Engines** game-kit was extracted from: neon-engine, Aethelgard-Engine

The data behind the gallery is [`games.json`](games.json) — add a game by adding
an entry there.

## Support

<img src="docs/assets/support-portrait.jpg" width="72" height="72" alt="Dr. Sohil Momin" align="left" style="border-radius:50%;margin-right:1rem">

Free, offline, accountless — and staying that way. If it earned its keep:

| | |
|---|---|
| UPI (India) | `drsohilboi@ybl` — payee Dr. Sohil Momin, open amount, or scan [the QR](docs/assets/upi-qr.svg) |
| GitHub Sponsors | [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) |
| Ko-fi | [ko-fi.com/matneo](https://ko-fi.com/matneo) |
| PayPal | [paypal.me/drsohilmomin](https://paypal.me/drsohilmomin?locale.x=en_GB&country.x=IN) |
| My books | [Amazon author store](https://www.amazon.com/stores/author/B08ZT331LY/allbooks?ccs_id=aed72b9f-71d9-41dc-adee-e9368a317acc) |
| More apps | [drsamonline.github.io](https://drsamonline.github.io/) |
| Email | [sohilmomin2000@gmail.com](mailto:sohilmomin2000@gmail.com) |

Nothing is gated behind it: no accounts, no tracking, no network requests.

## Licence

PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
