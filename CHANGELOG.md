# Changelog

## 1.10.0 — 2026-11-22

Five modules taken from a survey of the open-source game world rather than from one more
shipped game. The survey — 439 entries of
[awesome-open-source-games](https://github.com/michelpereira/awesome-open-source-games),
and what was deliberately *not* taken — is [docs/PRIOR-ART.md](docs/PRIOR-ART.md).

**`Game.camera`** — a view onto a world bigger than the screen.

| Rule | Why |
| --- | --- |
| The shake is an offset, never written into `x`/`y` | Added to the position it leaves a residual that never comes back; the level drifts a pixel per explosion |
| The dead zone is a box, not a point | Following the target exactly trembles the whole world at walking speed |
| Clamp after follow; centre a world smaller than the view | Clamping a 320 px level into an 800 px view gives a negative range and the level will not sit still |
| Smoothing is dt-corrected | `1-(1-k)^(dt*60)` is the same curve at 30 fps and at 144 fps |
| A NaN target is ignored | One NaN survives every lerp after it, and the camera is lost for the session |

**`Game.anim`** — a clip player over the frame names an atlas already knows. `fps: 0` freezes
instead of dividing by zero; re-playing the clip you are in keeps its phase (`{ restart: true }`
says you mean it); `once` holds the last frame and reports `done()`; an event fires when the
clip *enters* a frame, not once per update.

**`Game.astar`** — an arbitrary target, the other half of `Game.flowField`. Unreachable is
`null`, not `[]`; a diagonal may not cut the corner between two walls; the tie-break is the
cell index so a replay re-paths identically; and a node `budget` returns `null` with
`exhausted` instead of hitching the frame.

**`Game.particles`** — pooled, seeded, capped. When the cap is reached the *oldest* particle
dies, so a fresh muzzle flash is not swallowed by old smoke, and a recycled particle is born
at the burst rather than where the last one died.

**`Game.replay`** — one input snapshot per fixed step, run-length encoded, with the step and
the seed travelling with the file and checkpoints to catch a desync where it happens. It
could not exist before this release: it needs the fixed step (v1) and the seeded RNG (v2).

**Also** — `Game.version` in the source now matches `VERSION` (it had drifted to `1.5.0`);
`docs/API.md` had drifted to 1.8.0 and is now 1.10.0.

**Tests** — 57 new assertions, 314 total: the camera's dead zone, clamp, small-world centring,
shake determinism, picking during a shake and 60 fps vs 30 fps; the clip player's wrap,
`once`, `pingpong`, frozen `fps: 0`, events on entry and no-restart; A* around a wall, a
sealed goal, a refused corner cut, the budget and the same path twice; particles' gravity,
life, cap and seed; replays' run collapsing, copying, step mismatch, checkpoints and a
truncated tape.


## 1.9.0 — 2026-11-21

Four things extracted from a shipped game (HELLGATE) that every game re-writes badly.

**`Game.flowField`** — grid navigation for anything that chases. BFS from the target once, then every
agent asks `step(x, z)` and walks downhill.

| Rule | Why |
| --- | --- |
| Built from the target, not the agent | One build serves every chaser, and an agent that spawns later is already in the field |
| Unreachable is `-1`, not `0` | `0` means "you are at the target"; an agent reading it as unreachable walks into a wall |
| `step` never points into a blocked cell | Every neighbour uphill returns `null`, so the caller can wander instead of grinding |
| Height is optional | `blocked(x, z, fromX, fromZ)` lets a cell be walkable but not enterable from one side |

**`Game.pool`** — bullets, particles, corpses. A hard `cap`, reuse before allocation, `reset` on release,
and `stats()` reporting made / misses / free / live so you size it from evidence.

**`Game.minimap`** — the floor plan prerendered once into an offscreen canvas, then a blit plus a marker
callback. It knows nothing about your game: `cellAt(wx, wz)` and `scale` are the whole contract.

**`Game.audio.gen`** — generative music. A minor pentatonic (any note in it belongs), a tempo, and a rule
for the next note, with `setIntensity(0..1)` and `drain()` so the caller plays and forgets. The existing
sequencer plays what you wrote; this writes it.

**Tests** — 23 new assertions, 257 total: a walled cell is `-1` and an agent walking the field arrives;
the pool refuses past its cap and reuses a released object without remaking it; the minimap maps a world
point into the canvas; the generator queues notes in the future and nothing when stopped.


## 1.8.0 — 2026-11-10

### Added
- `Machine` parity tests against `raylib-starter`'s C port: same three states, same two
  transitions, same trace asserted in both suites
- `tools/check-claims.js`, run in CI, which fails the build when the README's stated count drifts
  from the suite

### Verified
- 234 assertions

## 1.7.0 — 2026-11-10

### Added
- change detection: every write stamps its component with the current tick, `world.set()` is the
  write for a value that changes per frame, and `world.changed(id, name, since)` /
  `world.changes(since)` answer what moved. `create()` counts as a write; `remove()` and
  `destroy()` clear the stamp.

### Verified
- 226 assertions, including a stamp visible from an earlier tick, a cleared stamp after removal,
  and an empty `changes()` after an idle tick.

## 1.6.0 — 2026-11-10

### Added
- `world.commands.spawn/destroy/add/remove`, queued and applied between systems by `update()`, so a system can change structure while the world is being iterated
- `world.flush()` to drain the queue by hand, and `commands.pending()`

### Changed
- `ids()` returns ids in numeric order, so iteration does not depend on `Object.keys` order and a replay is deterministic

### Verified
- 214 assertions, including a system that destroys the entity it is visiting, a spawn that lands in the next pass, and a full queue

### Note
- Generation counters were considered and rejected: ids are never recycled here, so there is nothing to disambiguate. They would matter only if slots were reused to keep the array dense.

## 1.0.0 — 2026-10-25

- **Licence: PolyForm Noncommercial 1.0.0.** Every repository now carries the canonical text
  from polyformproject.org with the Required Notice line, and the four places a repo states
  its licence agree: LICENSE, the SPDX headers, the README and package.json.
- **The public demo is the app.** A build now fails if `docs/play/index.html` is not the app,
  because a demo running older code is two code paths for one program.
