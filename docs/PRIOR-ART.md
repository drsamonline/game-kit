# Prior art

What [awesome-open-source-games](https://github.com/michelpereira/awesome-open-source-games)
(439 entries, 30 sections, read 2026-11-22) says a small browser game needs — and what
this kit does about it.

## How this was made, and what it is not

The catalogue is a list, not a codebase. Each entry is a name, a link and one or two
sentences describing the game. So this is a survey of **what the catalogue says games
need**, not an audit of 439 repositories, and nothing here is copied code: every module
below is reimplemented from the idea, in this kit's own idiom, with its own tests.

Where a rule comes from a specific project it is named, so the claim can be checked
against the link. Where a rule comes from this family's own shipped bugs, the playbook
number is given instead (`docs/PLAYBOOK.md`).

What the catalogue is good for is exactly this: it shows the *recurring* problems. Forty
puzzles, forty-four strategies, thirty-six browser arcade games and sixty-eight engines
are not 200 different problems. They are about fifteen, and the fifteen are what a shared
core should hold.

## The recurring problems, and where each one lives now

| The problem | The catalogue shows it in | Here |
| --- | --- | --- |
| A view onto a world bigger than the screen | every platformer, racer and shooter in the list; `Ski Free`, `Arashi`, `Survivor` | `Game.camera` *(1.10)* |
| Which frame of the walk cycle is this | `Solarus`, `Flare`, `OpenRTS` — all tile-and-sprite engines | `Game.anim` *(1.10)* |
| Getting an agent to an arbitrary point | `OpenRTS`, `Command & Conquer` (the HTML5 port), `Freeciv-web`, every tower defence | `Game.astar` *(1.10)*; `Game.flowField` *(1.9)* for the many-chasers-one-target case |
| Sparks, smoke, blood, confetti | `Chromacore`, `Fluid Table Tennis`, every arcade entry | `Game.particles` *(1.10)*, on top of `Game.pool` *(1.9)* |
| "Play that back exactly" — ghosts, speedruns, bug reports | `Tassadar` (a StarCraft II replay parser), `osu-framework`, `Bemuse` | `Game.replay` *(1.10)*, which only works because of the fixed step and the seeded RNG |
| One deterministic step, whatever the frame rate | `osu-framework`, `Godot`, `MonoGame` | `Game.loop` *(v1)* |
| Entities as data, behaviour as systems | `EntityJS`, an HTML5 engine built on the entity-component design | `Game.ECS` *(v2)* |
| Menu → play → pause → game over, with no illegal jumps | every entry with a menu | `Game.Machine`, `Game.Scenes` *(v2)* |
| A level from a number | `Cubyz`, `Wurfel Engine`, `GenesisEngine` (procedural planets), `Room for Change` (randomly generated RPG) | `Game.rng`, `Game.noise2/3`, `Game.terrain` *(v2 / 1.2)* |
| A tilemap authored in a real editor | `Tiled` — the editor half the catalogue uses | `Game.tiled` *(1.2)* |
| Blocks, and not 1,536 faces per chunk | `Cubyz`, `BananaBread`, `Wurfel Engine` | `Game.VoxelWorld` with greedy meshing *(1.2)* |
| 2,000 sprites without 2,000 draw calls | `pixi.js`, `Phaser`, `melonJS`, `panda.js` | `Game.atlas` + `Game.SpriteBatch` *(1.3)* |
| Sound with no sound files | `Bfxr` (the Sfxr SFX generator), `Bemuse`, `osu-framework` | `Game.audio` code-audio *(1.4)*, `Game.audio.gen` *(1.9)* |
| A parent that carries its children | `Starling`'s display tree, `EaselJS`, `pixi.js` | `Game.Node` scene graph *(1.5)* |
| Text that fits its box, in any font | `Ren'Py`, every visual novel | `Game.text`, `Game.audit` *(1.1)* |
| A floor plan you can read at a glance | `Command & Conquer`, `OpenRTS` | `Game.minimap` *(1.9)* |
| Save, resume, no account | `A Dark Room`, `Pip`, every PWA in the list | `Game.save` *(v1)* |
| A menu that is not a canvas | `Ren'Py`, `ChoiceScript` | `web-kit` + `widgets-kit`, deliberately outside this kit |

## What the five new modules took from where

**`Game.camera`** — `Ski Free` and `Arashi` are the two clearest cases of a fixed-screen
game in the list; everything that scrolls (`Survivor`, `Arashi`, the
`game-off-2013` entries) needs a view. The dead zone is not in the catalogue's words anywhere, it is in every game you
have played: following a character exactly makes the world tremble at walking speed. The
rule that costs the most to learn is the clamp-after-follow one — a level narrower than
the screen, clamped naively, oscillates every frame.

**`Game.anim`** — `Solarus`, `Flare` and `OpenRTS` are all engines whose whole job is
"sprite, tile, clip, event". The events half is the part nobody writes until a footstep
needs to land on a frame rather than on a timer. `Art.anim` in `art-kit` answers a
different question (which frame at time *t*, pure); this one owns the state — what is
playing, whether it finished, what it fired.

**`Game.astar`** — `OpenRTS`, the HTML5 `Command & Conquer`, `Freeciv-web` and `Spring`
are all RTS: many agents, arbitrary targets, a map with walls. `flowField` already covers
the "everyone chases the player" case cheaper than any per-agent search; A\* covers the
rest. The corner-cutting rule is the one that shows up as a visible bug in every RTS ever
written — units slipping diagonally between two blocks that touch at a point.

**`Game.particles`** — `Chromacore` and `Fluid Table Tennis` are the entries that make it
obvious a game is mostly small effects. It is a thin, opinionated layer over `Game.pool`:
the pool gives you the cap and the reuse, this gives you birth, life, gravity, drag and
the rule that the *oldest* particle dies when the budget is full.

**`Game.replay`** — `Tassadar` (a replay parser) and `osu-framework` (a game whose entire
competitive scene is replays) are the argument that a replay format is part of a game
core, not a bolt-on. This kit could not have shipped it before v1.10: a replay needs a
fixed step (`Game.loop`, v1) and a seeded RNG (`Game.rng`, v2) or it is a recording of a
different game. It is the one module in this release that is *only possible* because of
what was already there.

## Deliberately not taken

- **A 3D renderer.** `Three.js`, `Babylon.js`, `PlayCanvas` and `bgfx` are in the list and
  all of them are a better answer than anything this kit could grow into. `neon-engine`
  uses Three.js; the kit stays 2D and stays one file.
- **A rigid-body physics engine.** `Matter.js`, `Chipmunk`, `Ammo.js`, `Oimo.js` exist.
  `Game.resolve` separates two boxes and bounces them, which is what a platformer needs
  and what a physics engine is not worth being for.
- **Netcode.** `Lichess`, `Chessmata`, `PlayHex` and `XPilot TNG` all show that real-time
  multiplayer is a different product. `lan-kit` is the family's answer, and it is not this.
- **An asset pipeline.** The catalogue's biggest entries ship art; this family ships
  code. `art-kit` generates the sprites and `audio-kit` the sound; a loader would be a
  dependency on files that do not exist here.
- **A level editor.** `Tiled` is in the list, is better than anything written here, and
  `Game.tiled` already reads its output.

## Worth actually reading

Not because they are the best games, but because they are the clearest statements of a
problem this kit has an opinion about:

| Entry | Read it for |
| --- | --- |
| [Tiled](https://github.com/mapeditor/tiled) | the map format `Game.tiled` parses |
| [Cubyz](https://github.com/PixelGuys/Cubyz) | chunked voxels done at scale |
| [Wurfel Engine](https://github.com/BSVogler/WurfelEngineSDK) | isometric block worlds |
| [Solarus](https://github.com/solarus-games/solarus) | a 2D action-RPG engine, small enough to read |
| [Flare](https://github.com/clintbellanger/flare-engine) | the same, with a data-driven skill system |
| [osu-framework](https://github.com/ppy/osu-framework) | timing, replay and a fixed step, taken seriously |
| [Bemuse](https://github.com/bemusic/bemuse) | rhythm timing in a browser, with a BMS parser |
| [Bfxr](https://github.com/increpare/bfxr) | synthesised SFX as data — the idea behind `Game.audio.sfx` |
| [EntityJS](https://github.com/bendangelo/entityjs) | an ECS in a browser, before it was fashionable |
| [Backdooms](https://github.com/Kuberwastaken/backdooms) | a DOOM-like small enough to fit in a QR code: the size discipline this family shares |
| [pixi.js](https://github.com/pixijs/pixijs) / [Phaser](https://github.com/phaserjs/phaser) | what batching and atlases are for, if `Game.SpriteBatch` is ever too small |
| [Ren'Py](https://github.com/renpy/renpy) | text layout and dialogue — the thing `Game.text` measures |
