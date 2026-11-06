# Field notes

Every rule here was paid for by a shipped bug in [Eon Commando](https://github.com/drsamonline/eon-commando)
or [neon-runner](https://github.com/drsamonline/neon-runner). They are the things that were
*not* obvious, and that a screenshot or a syntax check will not catch.

## 1. Schedule the next frame before doing any work

```js
function frame(t) {
  requestAnimationFrame(frame);   // <- first, always
  try { tick(t); } catch (err) { report(err); }
}
```

An uncaught error inside a frame skips the `requestAnimationFrame` call at the end of it, and the
loop never restarts. The game freezes on its last rendered image with no way back and no error
visible to the player.

Eon Commando shipped this for **two releases**. The trigger was a one-character typo — a damage
function referenced `amount` where the parameter was `dmg` — so every hit threw, and the game
froze the first time you were hit. Reported as "stucks sometimes during a boss fight".

Booking the next frame first means the worst case is one skipped frame.

## 2. Never wrap text by character count

`wrap(str, 26)` is correct for exactly one font, at one size, in one panel width. Change any of
the three and the line runs past its box.

Eon wrapped its cutscenes at 26 characters. On a 220 px portrait view the dialogue column is
about 142 px and a 26-character line is about 156 px, so text spilled out of the panel — visible
only on a phone.

Measure, then break:

```js
const lines = Game.text.wrap(str, columnWidthPx, s => ctx.measureText(s).width);
```

And handle the word wider than the column on its own — `OVERCHARGE` in a 49 px card — by splitting
it, because a word-break wrapper alone cannot.

## 3. Check text against its box, not against the screen

The first overflow audit instrumented `drawText` and flagged anything outside the viewport. It
passed, while text was spilling out of its panel — because everything was *on screen*. A viewport
check structurally cannot catch a box overflow.

Assert against the rectangle:

```js
const recs = Game.audit.record(drawText, draw => draw(ctx));
const bad = Game.audit.overflow(recs, panelRect);
```

Map coordinates through `ctx.getTransform()` before comparing, or world-space text and text inside
translated HUD contexts produce false positives — Eon's first attempt reported 30 of them.

## 4. A syntax check is not a correctness check

`node --check` passes happily on a reference to a variable that does not exist. ESLint's
`no-undef` catches it in a second:

```json
{ "env": { "browser": true }, "rules": { "no-undef": "error", "no-dupe-keys": "error",
  "no-unreachable": "error", "no-fallthrough": "error", "no-self-compare": "error" } }
```

Run it over the **built** bundle, not the sources — that is what ships.

## 5. Your bitmap font does not have the glyph you typed

Eon's HUD showed `?2` for weeks because `\u00D7` (×) is not in its 5×7 set. Nothing warned; the
renderer just drew the fallback.

```js
Game.text.missing(["X2", "SCORE 001"], FONT_CHARSET);   // -> ["\u00D7"]
```

Run it over every user-facing string in a test.

## 6. Layout by measurement, not by constants

A fixed 250 px boss bar overflows a 220 px portrait view. A three-column perk layout leaves ~49 px
of text per card — narrower than the word `OVERCHARGE`. Panels sized by constants break at the
sizes you did not test.

Size the container from its contents, and pick a different *layout* for narrow screens rather than
shrinking the same one.

## 7. Store control positions as percentages

Pixels break on rotation, on resize, and when a mobile address bar collapses mid-game. Percentages
survive all three. `Game.layout.pct` / `Game.layout.px` round-trip cleanly across a viewport change.

## 8. Determinism buys replay *and* netcode

A fixed timestep plus a seeded RNG plus 9-bit input masks gave Eon Commando both: a 900-frame
replay compressed to **196 characters**, and LAN co-op that sends **no world state** — only inputs,
in lockstep. The second feature cost almost nothing because the first already existed.

Build the mask, not the state.

## 9. Measure before you optimise

neon-runner caches sprites to offscreen canvases and pools its bullets. Eon's arrays measured
bounded — particles peak 89, bullets 10 — so copying the pools would have added complexity for
nothing. Count the thing you are optimising, or you are guessing.

## 10. Assert the invariant, not the diagnostics

Three bugs in one session were caught only because a test asserted something *negative*: "no
exceptions", "no overflow", "no duplicate keys". A test that records failures and prints them will
happily report none while the feature is broken.

## 11. A click is a missing 3 ms

Every note that starts or ends at a non-zero amplitude clicks, and every hand-written
sound engine starts that way. The cure is not "add a fade" in the caller — it is the
renderer refusing to output a hard edge: `Game.audio.render` enforces a 1.5 ms minimum
attack and release, so a pattern that asks for `attack: 0, release: 0` still cannot
click. Enforce the invariant where the samples are made, not where they are asked for.
