# game-kit — API reference

**Version 1.8.0.** **The shared game core for drsamonline apps.** Zero dependencies. The common engine every small browser game was re-implementing, extracted once from `neon-engine` and `Aethelgard-Engine`.

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="game-kit.js"></script>
Kit.clamp(...)
// or: const Kit = require('./game-kit.js')
```

## The surface (34 entries)

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
| `Kit.Node` | `(props)` | / |
| `Kit.node` | `(props)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
