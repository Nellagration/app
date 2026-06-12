# Sword Quest — A Little Hero Adventure

A tiny NES-Zelda-style learning game for young kids (around age 4–6) who are
learning **colors, shapes, letters, and numbers**.

## How to play

Open `index.html` in any browser — no build step, no dependencies. You can:

- double-click `public/sword-quest/index.html`, or
- run the dev server (`pnpm run dev`) and visit `/sword-quest/index.html`.

## The quest

Walk around a little 3x3 overworld (with classic screen-by-screen sliding).
Four caves hold learning shrines:

| Shrine | Skill |
| --- | --- |
| Northwest cave | Colors ("Touch RED!") |
| Northeast cave | Shapes ("Find the STAR!") |
| Southwest cave | Letters ("Find the letter B!") |
| Southeast cave | Counting ("Count the hearts!") |

Answer 3 little puzzles in a shrine to win a magic gem. Collect all 4 gems and
the big locked door in the north opens — inside, a wise man waits with the
magic sword ("It's dangerous to go alone!"). After that it's free play: swing
the sword (Z key / A button) to cut bushes and find hearts.

## Designed for pre-readers

- Every prompt is **read aloud** with the browser's speech synthesis
  (toggle with the Voice button).
- Wrong answers are gentle: the game names what was touched
  ("That's blue. Find red!") and lets the kid try again.
- No enemies, no damage, no game over.
- Works with arrow keys / WASD or the on-screen touch D-pad (tablet friendly).
- Progress is saved automatically (localStorage); the Start Over button resets.

All graphics, the pixel font, and the chiptune sound effects are generated in
code — the whole game is just `index.html` + `game.js`.
