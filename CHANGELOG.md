# Changelog

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
