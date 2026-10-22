# game-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/game-kit/)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**The shared game core for drsamonline apps.** Zero dependencies. The common
engine every small browser game was re-implementing, extracted once from
`neon-engine` and `Aethelgard-Engine`.

- a **fixed-timestep loop** (deterministic, testable, no spiral-of-death);
- an **input** manager (keyboard);
- a tiny **scene / state machine**;
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
```

## Why a fixed timestep

Physics and game logic must advance in equal steps or behaviour changes with frame
rate. The loop accumulates real time and runs whole `step`s, and **clamps a huge
frame** so a backgrounded tab does not spiral into thousands of updates.

## Verified

```
node test-node.js
14 passed, 0 failed
```

Covers the loop's step counts, the `maxFrame` clamp, sub-step frames, scenes,
save/load, and every maths helper — all headless, no browser.

## Games built with game-kit

Every game in the family is collected in one gallery: [`games/`](games/).

- **Games:** neon-games, neon-runner, retro-strike, idle-city-ages-of-growth,
  dance-fight, aethelgard-games, AethelgardVN
- **Engines** game-kit was extracted from: neon-engine, Aethelgard-Engine

The data behind the gallery is [`games.json`](games.json) — add a game by adding
an entry there.

## Licence

MIT. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
