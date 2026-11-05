## [1.2.0]

The voxel layer and the Tiled reader. Both are pure arithmetic, so both are proved headless.

### Added
- **`Game.VoxelWorld`** — chunked, sparse voxel storage. A world is a map of fixed-size
  chunks, so empty space costs nothing and a chunk that empties is dropped. Negative
  coordinates land in the right chunk (flooring the division, not truncating it).
- **Greedy meshing** — `world.mesh(cx, cy, cz)` merges adjacent faces that share a block id
  into one quad. A solid 16³ chunk is **6 quads instead of 1,536 faces**, a 256× saving;
  `world.faceCount()` returns the unmerged count so the saving is a number, not a claim.
- **Edit operations** — `fill`, `hollow`, `sphere`, `cylinder`, `copy` (to a versioned
  schematic) and `paste` at an offset. The building half of a building game.
- **`Game.noise3` / `Game.noise2` / `Game.fbm2`** — seeded value noise with a smoothstep
  fade and fractal octaves. The same seed gives the same world, which is what a level
  editor depends on.
- **`Game.terrain(world, opts)`** — a heightmap world from fractal noise, returning
  `heights` and `heightAt(x, z)`.
- **`Game.voxelToMap(world, box)`** — a world rendered top-down as tiles (the Overviewer
  technique), with pan and zoom left to the viewer.
- **`Game.tiled.parse(map)`** — reads the **Tiled editor's JSON** rather than inventing a
  map format, so a level made in a real editor loads unchanged. `gidAt(layer, x, y)` is
  bounds-safe, and `collisionRects(layer, solid)` merges solid tiles into as few bodies as
  possible — a solid 4×3 floor becomes **one** body, not twelve.

### Verified
`node test-node.js` — **115 assertions, 0 failing**. Checked to bite three ways: removing
the horizontal merge fails 3 mesh assertions, truncating the chunk division instead of
flooring it fails 2 boundary assertions, and dropping the seed from the hash fails 2 noise
assertions.

## [1.1.0]

Three modules and a hardened loop, all extracted from bugs that shipped in real games.

### Added
- **`Game.text`** — `wrap()` breaks by measured pixel width (and splits a word wider than the
  column), `fitScale()` shrinks a heading until it fits, `linesThatFit()`, and `missing()` which
  reports characters your bitmap font cannot draw.
- **`Game.layout`** — `pct()`/`px()` for percentage positioning, `apply()` for a saved
  `{x, y, scale, opacity}` box, and `draggable()` for building a touch-pad editor. Percentages
  survive rotation, resize and a collapsing mobile address bar; pixels do not.
- **`Game.audit`** — `record()`, `inside()`, `overflow()` and `overlap()`. A viewport check cannot
  catch text spilling out of its panel, because the text is still on screen.
- **`docs/PLAYBOOK.md`** — ten rules, each tied to the concrete bug that taught it.

### Changed
- **`Game.loop` schedules `requestAnimationFrame` before the frame body**, not after, and wraps
  the body in a guard with an `onError` hook. An uncaught error used to skip the next frame and
  freeze the game permanently on its last image — Eon Commando shipped that for two releases.
- `VERSION` and the in-code version had drifted (1.0.0 vs 0.2.0); both are 1.1.0 now.

# Changelog

## 1.0.0 — 2026-10-25

- **Licence: PolyForm Noncommercial 1.0.0.** Every repository now carries the canonical text
  from polyformproject.org with the Required Notice line, and the four places a repo states
  its licence agree: LICENSE, the SPDX headers, the README and package.json.
- **The public demo is the app.** A build now fails if `docs/play/index.html` is not the app,
  because a demo running older code is two code paths for one program.
