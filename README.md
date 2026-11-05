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

Every one of those exists because a shipped game got it wrong first. The stories are in
[**docs/PLAYBOOK.md**](docs/PLAYBOOK.md) — ten rules, each tied to the bug that taught it.

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

## Verified

```
node test-node.js
38 passed, 0 failed
```

Covers the loop's step counts, the `maxFrame` clamp, sub-step frames, scenes,
save/load, every maths helper, and the v2 surface: RNG reproducibility, ECS
(component filtering and **update order**), the state machine, a collision case
per primitive, and a physics resolution case — all headless, no browser.

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
| Ko-fi | [ko-fi.com/matneo](https://ko-fi.com/matneo) |
| PayPal | [paypal.me/drsohilmomin](https://paypal.me/drsohilmomin?locale.x=en_GB&country.x=IN) |
| My books | [Amazon author store](https://www.amazon.com/stores/author/B08ZT331LY/allbooks?ccs_id=aed72b9f-71d9-41dc-adee-e9368a317acc) |
| More apps | [drsamonline.github.io](https://drsamonline.github.io/) |
| Email | [sohilmomin2000@gmail.com](mailto:sohilmomin2000@gmail.com) |

Nothing is gated behind it: no accounts, no tracking, no network requests.

## Licence

MIT. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
