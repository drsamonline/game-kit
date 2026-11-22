# Where the games are — and what can actually be taken

An audit of 30 links (checked 2026-11-22), what each one really contains, and the
short list of things worth taking from the wider open-source game world: **art**,
**code**, and the licences that decide which of the two you may have.

## The finding, in one paragraph

All 30 links are **catalogues, feeds or tool lists**. Not one of them ships art. The
sprites live on OpenGameArt, Kenney and itch, which none of the 30 point at; the code
lives inside the games the catalogues name. And this fleet's own rule — one file, no
build step, every texture generated at runtime — means a sprite sheet is not a small
addition here, it is a different product. So the useful output of this pass is not a
folder of PNGs. It is: **which sources are worth keeping an eye on, which assets are
safe to take, and which licences forbid taking them into a kit like this one.**

## 1. The 30 links, and what each one is

| # | Link | What it actually is | Verdict |
|---|---|---|---|
| 1 | `bobeff/open-source-games` | 18.5k★, CC0-licensed list, 458 lines, ~300 games by genre with a `[source]` link each | **Keep.** The cleanest "what exists" list; its CC0 licence means its *text* can be reused too |
| 2, 24 | `open-source-games.com` | "OpenGames": a directory site claiming 2,000+ games, filtered by genre / language / engine, with star counts | Same site as #24. Useful for discovery, nothing to take |
| 3 | Reddit r/opensourcegames | a community list thread | Not fetched here (login wall). No unique data |
| 4, 22 | `trilarion.github.io/opensourcegames` | **OSGL** — the largest of these: 1,536 games counted from its alphabetical index, each tagged active/beta/inactive, with a licence filter on the site | **Keep.** The only one that treats "is it dead?" and "what licence?" as first-class facts |
| 5 | GitHub topic `opensource-game` | 32 repositories | Thin topic; the list repos beat it |
| 6 | Godot forum thread | "We released 24 open-source games for you to dissect" — Godot games with source | **Keep** if you ever build in Godot; nothing for a vanilla-JS kit |
| 7 | `x.com/github/article/…` | an X article — not loadable here | Skip |
| 8 | topic `open-source-game-development` | 10 repositories | Thin |
| 9 | topic `mobile-game` | 1,957 repositories | Too broad to use as a source |
| 10 | topic `video-game` | 2,882 repositories | Too broad |
| 11 | topic `unity3d-game` | (not counted here) | Unity; not this fleet |
| 12 | topic `python-game` | 762 repositories | Useful for `pygame` techniques only |
| 13 | topic `3d-game` | 1,487 repositories | Not this fleet |
| 14 | `gitverse.ru/Progser/open-source-games` | a mirror of the same kind of list on a Russian host | Duplicate of #1/#18 |
| 15 | topic `ludo-game` | 138 repositories | Niche |
| 16 | esotericsoftware forum | a "list of open-source game stuff on GitHub" thread | Stale; duplicates |
| 17 | GitHub `collections/web-games` | GitHub's own curated web-game collection | **Keep** as a curated shortlist |
| 18 | `michelpereira/awesome-open-source-games` | 439 entries, 30 sections, games **plus** 68 engines and 20 utilities | **Keep.** Already surveyed in `PRIOR-ART.md` |
| 19 | `OpenSourceVideoGames/list` | 676 lines, same taxonomy as #18 — looks derived from it; no licence file in the repo | Redundant; and unlicensed text cannot be copied |
| 20 | `opensourcegames.dev` | curated discovery feed: new releases, "rising on GitHub", browser-playable flags | **Keep** for "what shipped this week" |
| 21 | `awesome-repositories.com/…` | an aggregator page over the same lists | Redundant |
| 23 | `can2.github.io/OpenSource-GameList` | a small static list | Redundant |
| 25 | `github.blog/…/beyond-the-engine-10-open-source-projects…` | **the one link with tools in it**: Blockbench, Pencil2D, Pixelorama, Material Maker, LDtk, Tiled, Audacity, Yarn Spinner, Gum, and a tenth | **Keep.** See §3 |
| 26 | Reddit r/learnprogramming | "list of 75 open source games on GitHub" (2015) | Stale |
| 27 | `Zakaria-ouertani/Open_Source_Games_list` | 54★, CC0, a plain list | Redundant |
| 28 | `opensourceprojects.dev/post/…` | a blog post | Not fetched |
| 29 | TechSpot article | "over 1000 open source games free to play" | A news piece over the same lists |
| 30 | `radek-sprta/awesome-game-remakes` | 1.6k★, CC-BY-SA-4.0, actively maintained list of open-source **remakes** | **Keep** — remakes are the best-documented reverse-engineering reading there is |

**What to actually watch:** #4 (OSGL, for the licence/activity filter), #18 and #1 (the
two best lists), #20 (the weekly feed), #25 (tools), #30 (remakes). The other 24 are
either duplicates, too broad to act on, or a login wall.

## 2. Art: what can be taken, and what cannot

None of the 30 links above ship art. These are the sources that do, with the licence
each one actually uses — checked, not assumed:

| Source | Licence | Take it? |
|---|---|---|
| [Kenney](https://kenney.nl/assets) — 60,000+ sprites, tiles, UI, audio, fonts | **CC0 1.0** on every asset page; no attribution required, commercial use fine | **Yes, unambiguously.** The only source here where the answer is not "it depends" |
| [OpenGameArt](https://opengameart.org) | **per item**: CC0, CC-BY 3.0/4.0, CC-BY-SA 3.0/4.0, OGA-BY, GPL 2.0/3.0 | **CC0 and OGA-BY yes; CC-BY with credit; CC-BY-SA and GPL, no** — see below |
| itch.io free asset packs | per pack, often CC0 or CC-BY | Check each pack; many are Kenney's, which is CC0 |
| A game's own art, from a game's repo | whatever that repo's licence says — often GPL or CC-BY-SA | Only if the licence permits; a GPL game's art is not free to lift into a PolyForm-NC kit |

### The three grades, and why the middle one is where projects get hurt

1. **CC0** — no obligation at all. Take it, ship it, do not credit it. Kenney's whole
   library is this.
2. **CC-BY / OGA-BY** — credit the artist, state the title, link the licence, and say
   what you changed. Both also forbid imposing DRM-like restrictions on redistribution
   (OGA-BY exists specifically to remove that clause). Attribution is a `CREDITS.md`
   and a line in the app, which is cheap — do it.
3. **CC-BY-SA / GPL art** — **do not put these in a kit.** CC-BY-SA makes every
   derivative of the *art* CC-BY-SA, so a recoloured sprite carries the licence with it
   into every game that uses the kit. GPL art is written for GPL projects; the FSF's
   position is that game data and game code can carry different licences, but that is a
   position to take deliberately with a lawyer's eye, not by accident on a Tuesday.

**The rule for this fleet.** A kit in this family is PolyForm Noncommercial 1.0.0, one
file, and — by design — ships no assets at all: `neon-engine` generates every texture,
`audio-kit` generates every sound, `art-kit` generates every sprite from a seed. Putting
a CC0 sprite sheet into a kit would not be a licensing problem; it would be a product
problem, and it would break the one property every app here is sold on. So:

- **Kits: no assets, ever.** CC0 or otherwise. `art-kit`'s `generate()` and
  `generateSet(seed, n)` already rebuild an asset folder from one number.
- **Games: CC0 packs are fine**, vendored per game, with an `ASSETS.json` entry each —
  `tools/check-assets.mjs` in this repo enforces that (see §4).
- **Reference, not bytes:** a pack is also the best palette source there is. Read
  Kenney's palettes into `art-kit`'s `palette()`, do not ship his PNGs.

## 3. Tools: the ten from the GitHub article

The only link in the 30 with something to *use* rather than read. Licences checked
against the repositories:

| Tool | Licence | What it would change here |
|---|---|---|
| [Pixelorama](https://github.com/Orama-Interactive/Pixelorama) | MIT | The pixel-art editor `art-kit` assumes you have. Tileset mode, spritesheet export |
| [LDtk](https://ldtk.io) | MIT | Entity-driven 2D levels with auto-tiling rules. `Game.tiled` reads Tiled; LDtk is the other format a 2D game meets |
| [Tiled](https://github.com/mapeditor/tiled) | custom (GPL-2.0+ for the app) | Already supported: `Game.tiled` |
| [Yarn Spinner](https://github.com/YarnSpinnerTool/YarnSpinner) | MIT | Dialogue as a screenplay. The gap between `saga-vn-engine` and a writer |
| [Gum](https://github.com/vchelaru/Gum) | MIT | In-game UI layout for HUDs and menus |
| [Blockbench](https://github.com/JannisX11/blockbench) | GPL-3.0 | Low-poly 3D with pixel textures — a tool to use, not to link against |
| [Pencil2D](https://github.com/pencil2d/pencil) | GPL-2.0 | Frame-by-frame 2D animation |
| [Material Maker](https://github.com/RodZill4/material-maker) | MIT | Procedural textures — the same idea as `art-kit`'s dither and quantise |
| Audacity | GPL-2.0 | Audio cleanup; `audio-kit` needs none of it (it has no files) |
| (tenth, cut off in the article's excerpt) | — | — |

## 4. Code: what is safe to read, and the only way to take it

The engines and games whose licences allow reading and learning from the source. **Take
the idea, never the file** — every module in this kit is reimplemented in its own idiom,
which is both the licence-safe path and the reason the kit stays small.

| Project | Licence | Read it for |
|---|---|---|
| [Phaser](https://github.com/phaserjs/phaser) | MIT | Batching, atlases, tilemaps at production scale |
| [melonJS](https://github.com/melonjs/melonJS) | MIT | A 2D engine small enough to follow end to end |
| [pixi.js](https://github.com/pixijs/pixijs) | MIT | The renderer everyone else is measured against |
| [Matter.js](https://github.com/liabru/matter-js) | MIT | 2-D rigid bodies, if `Game.resolve` is ever too little |
| [Mindustry](https://github.com/Anuken/Mindustry) | GPL-3.0 | **Read only.** Logistics, pathfinding, a shipped game with a real AI |
| [Cataclysm: DDA](https://github.com/CleverRaven/Cataclysm-DDA) | custom (CC-BY-SA per its docs) | **Read only.** Data-driven content at a scale nothing else matches |
| [osu-framework](https://github.com/ppy/osu-framework) | MIT | Timing, replay, a fixed step taken seriously — the model for `Game.replay` |

## 5. What this actually justifies, repo by repo

- **game-kit** — the only concrete gap this pass found is **LDtk** (§3): a second level
  format, MIT, and the one a 2D game is as likely to meet as Tiled. Not implemented
  here: the JSON shape has to be read from the spec, not from memory, and guessing a
  format is worse than not supporting it.
- **art-kit** — nothing to vendor, one thing to steal: **palettes**. Kenney and
  OpenGameArt packs are the cheapest source of coherent 16-colour ramps in existence,
  and `palette()` takes a list.
- **audio-kit** — nothing. It generates; a pack would only add weight.
- **web-kit** — nothing.
- **widgets-kit** — nothing.
- **Games** — CC0 packs (Kenney first) are the legitimate way to get art into a game
  that is allowed to have art. The manifest rule in §2 is what makes that safe at scale.

## 6. The rule this document exists to state

**A licence is a claim; check it, do not assume it.** Every licence in the tables above
was read from the project's own repository or its own support page on 2026-11-22, not
remembered. Two of them surprised the check: Tiled reports `NOASSERTION` on GitHub
(a mixed GPL/BSD project) and Cataclysm: DDA reports `NOASSERTION` too, so both are
"read the file" rather than "it is MIT". If a licence is not one of CC0, CC-BY, OGA-BY,
MIT, Apache-2.0 or OFL, it does not go into a repository in this family without a
decision written down next to it.
