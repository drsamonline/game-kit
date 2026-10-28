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
- **maths helpers** (`clamp`, `lerp`, `dist`, `aabb`, `rand`).

## Use it

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

## Licence

MIT. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
