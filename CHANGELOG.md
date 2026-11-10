# Changelog

## 1.1.0 — 2026-11-10

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
