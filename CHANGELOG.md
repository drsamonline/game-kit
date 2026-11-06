## [1.4.0]

Code-audio — the last piece of the kit's core, and the three ways a hand-written
sound engine goes wrong.

### Added
- **`Game.audio.freq("A4")`** — a pitch from a name (`"C#4"`, `"Bb3"`, `"a4"`), a
  number passed through, and **`null`** for anything unreadable. `"H4"` is a typo,
  not a 0 Hz drone that plays as silence and looks like a broken mixer.
- **`Game.audio.waves`** — `sine`, `square`, `saw`, `triangle` and a **seeded**
  `noise`, each a pure function of phase in `[0,1)`. No sample files, so a track
  costs bytes instead of megabytes and works offline.
- **`Game.audio.env({attack, decay, sustain, release})`** — ADSR as a function of
  `(t, dur)` rather than an array, so a note can be stretched without re-rendering.
  It starts at exactly 0, ends at exactly 0, and **the release can never eat the
  note**: it is clamped to half the duration, so a note held past its sustain still
  releases inside itself.
- **`Game.audio.render({sampleRate, duration, notes, seed})`** → `Float32Array`.
  Notes start and end at zero because the renderer enforces a 1.5 ms minimum attack
  and release — *a pattern that asks for a zero attack and a zero release still
  cannot click*. A summed chord is normalised to a peak of 1 instead of wrapping,
  so a busy bar gets quieter rather than tearing. An unreadable pitch renders
  silence, and a `NaN` position or a junk note cannot poison the buffer.
- **`Game.audio.track({bpm, stepsPerBeat, seq})`** — **the grid is the music**. A
  cell is a rest (`null`), a note name, or `{note, len, wave, gain}`; 120 bpm at
  4 steps per beat is 0.125 s a step. A note is 90% of its step by default, so
  repeated notes articulate instead of smearing into one long tone.
- **`Game.audio.stats(buffer)`** — `peak`, `rms`, `nonFinite`, `silent`: "the sound
  is silent" is a count, not a guess.
- **`Game.audio.sfx(name)`** — `blip`, `jump`, `coin`, `hit`, `explode`, written as
  data. An unknown name is `null`, never a random noise burst.
- **`Game.audio.play(ctx, samples)`** — the one browser-dependent function, kept to
  one function: hand it samples and an `AudioContext` and it plays them.

### Verified
`node test-node.js` — **178 assertions, 0 failing** (37 new). Checked to bite five
ways: setting the declick minimum to 0 fails the zero-attack/zero-release test,
removing the normalise fails the summed-chord peak, unclamping the release fails
"a long release cannot silence the middle of the note", removing the 90%
articulation gap fails "a note is shorter than its step", and dropping the octave
offset from the pitch parser fails three (A4 is 440, C4 is 261.63, Bb3).

## [1.3.0]

Sprite batching — the renderer half of the kit, and the three ways a hand-written
one goes wrong.

### Added
- **`Game.atlas({ image, frames })`** — a sprite sheet described once. `frame(name)`
  returns the source rect, `uv(name)` the normalised 0..1 corners, and an unknown
  name returns `null` instead of the whole sheet, which is what draws a hero as a
  wall of tiles.
- **`Game.SpriteBatch({ capacity, atlas })`** — `add()` sprites, `flush()` draw calls.
  Sprites are grouped by the image they come from, so **2,000 sprites cost 4 calls,
  not 2,000**. Quads sort by `z`, then by insertion order — a stable sort spelled
  out, because an unstable one makes a scene flicker frame to frame at equal `z`.
- **A fixed-size buffer never drops the tail.** Past `capacity` the batch *spills*
  into a further call for the same image and `flush().dropped` stays `0`. The last
  50 sprites of a busy level are exactly the ones a naive batcher loses.
- **Culling and misses are counted, not guessed.** `setViewport()` culls a sprite
  that is entirely outside (a straddling one is kept), and `flush()` returns
  `{ calls, quads, culled, spilled, missing, textures, dropped }` so "the screen is
  empty" is a number. A frame the atlas does not have is flagged on its quad and
  counted, never rendered as garbage.
- **`paint(result, fn)`** walks the calls in order, so the drawing loop is one
  `drawImage` per call instead of one per sprite.

### Verified
`node test-node.js` — **141 assertions, 0 failing** (26 new). Checked to bite four
ways: removing the spill fails 3 assertions (the tail is dropped), reversing the
equal-`z` tiebreak fails 2 (the order is not stable), disabling culling fails 2, and
drawing an unknown frame as the full sheet fails 3.

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
