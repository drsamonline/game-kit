# game-kit — API reference

**Version 1.10.0.** **The shared game core for drsamonline apps.** Zero dependencies. The common engine every small browser game was re-implementing, extracted once from `neon-engine` and `Aethelgard-Engine`.

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="game-kit.js"></script>
Kit.clamp(...)
// or: const Kit = require('./game-kit.js')
```

## The surface (45 entries)

| Name | Arguments | What it does |
|---|---|---|
| `Kit.clamp` | `(v, lo, hi)` | — |
| `Kit.lerp` | `(a, b, t)` | — |
| `Kit.rand` | `(a, b)` | — |
| `Kit.randInt` | `(a, b)` | — |
| `Kit.dist` | `(ax, ay, bx, by)` | — |
| `Kit.aabb` | `(a, b)` | — |
| `Kit.pick` | `(arr)` | — |
| `Kit.loop` | `(opts)` | — |
| `Kit.Scenes` | `()` | — |
| `Kit.input` | `(target)` | — |
| `Kit.save` | `(storage, key)` | — |
| `Kit.rng` | `(seed)` | — |
| `Kit.rngInt` | `(rng, a, b)` | — |
| `Kit.rngPick` | `(rng, arr)` | — |
| `Kit.ECS` | `()` | — |
| `Kit.Machine` | `(cfg)` | — |
| `Kit.circleHit` | `(a, b)` | — |
| `Kit.circleAabb` | `(c, box)` | — |
| `Kit.resolve` | `(a, b, opts)` | — |
| `Kit.text` | `()` | — |
| `Kit.layout` | `()` | — |
| `Kit.audit` | `()` | — |
| `Kit.VoxelChunk` | `(size)` | — |
| `Kit.VoxelWorld` | `(opts)` | — |
| `Kit.noise3` | `(seed)` | — |
| `Kit.noise2` | `(seed)` | — |
| `Kit.fbm2` | `(seed, octaves)` | fractal sum: several octaves of the same noise, each smaller and fainter |
| `Kit.terrain` | `(world, opts)` | — |
| `Kit.voxelToMap` | `(world, box)` | — |
| `Kit.tiled` | `()` | — |
| `Kit.atlas` | `(spec)` | — |
| `Kit.SpriteBatch` | `(opts)` | — |
| `Kit.flowField` | `(opts)` | grid navigation: BFS from the target, `step(x, z)` walks downhill, `-1` is unreachable |
| `Kit.pool` | `(opts)` | reuse before allocation, hard `cap`, `stats()` reports made / misses / free / live |
| `Kit.minimap` | `(canvas, opts)` | floor plan prerendered once, then a blit plus your markers |
| `Kit.audio.gen` | `(opts)` | generative music: scale, tempo, `setIntensity`, `drain()` |
| `Kit.audio.genScale` | `(octaves)` | the minor pentatonic the generator walks |
| `Kit.camera` | `(opts)` | follow with a dead zone, clamp to the level, a shake that is an offset — `toScreen`/`toWorld` include it |
| `Kit.anim` | `(opts)` | clip player over atlas frames: `loop`/`once`/`pingpong`, per-frame events, `done()` holds the last frame |
| `Kit.astar` | `(opts)` | A* to an arbitrary target: no corner cutting, deterministic tie-break, node `budget`, `null` when unreachable |
| `Kit.particles` | `(opts)` | pooled, seeded emitter: `burst`, `update`, `each`; the oldest particle dies at the cap |
| `Kit.replay` | `(opts)` | record one input snapshot per fixed step; `export()` run-length encodes and carries step + seed |
| `Kit.replay.load` | `(data)` | read a tape back; `ok:false` with a `reason` rather than a repair |
| `Kit.Node` | `(props)` | / |
| `Kit.node` | `(props)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
