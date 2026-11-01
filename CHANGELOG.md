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
