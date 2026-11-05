# Rally submission video

Remotion project for the Devpost video. Nothing in `frontend/` or `backend/` imports it, and it is not part of the app build or CI.

| Command | What it does |
| --- | --- |
| `npm run studio` | Remotion Studio. Allows placeholders. |
| `npm run preview` | 720p `out/preview.mp4`. Allows placeholders. |
| `npm run render` | Final 1080p `out/rally.mp4` and `out/captions.srt`. Refuses placeholders. |
| `npm run stills` | One PNG per scene at its midpoint, in `out/stills/`. |
| `npm run voice` | Kokoro narration into `run/voiceover.wav`, spoken locally, one clip per cue. |
| `npm test` | Timeline, schema and render-gate tests. |

Every command needs `run/run.json` and `run/order.json` first. There are no stand-in values: without them the build stops and says which file or field is missing. `video/run/` is git-ignored because `order.json` holds a shop's private lowest prices and this repository is public. Keep it out of commits.

## Record the 9 clips

The ribbon follows Home's five steps: Set your prices, Give your agent a goal, Win a Rally order, Hand off the parcel, Get paid by PayPal.

Record one genuine hosted run, in order, in **one browser window** signed in as Haneul Beauty with the judge writer, so the receipt shows "Your shop bid on this order". Save to `run/clips/` with the exact names below.

- Window 1440×900 at 100% zoom, with browser chrome hidden. Record at 2× device pixel ratio (a 2880×1800 file) if you can: the camera pushes in up to 1.6×, and 2× keeps text sharp. Any other size stops the build.
- Use the deployed app, not the Rootlane review.
- Keep passwords, the PayPal login, tokens, cookies and account emails out of every frame. Cut the login screen from clip 05.
- Trim each clip to its action, starting on the first frame that matters.

| File | Scene time | Do this | Keep out of frame |
| --- | --- | --- | --- |
| `01-home-guide.mp4` | 5 s | Home: "Get your first Rally payout" at 0 of 5, on step 1 "Set your prices" | The sign-in screen |
| `02-products-edit.mp4` | 12 s | Products: edit Cica Barrier Cream's Lowest price (USD) within bounds, press Enter, show it saved | Other shops' data |
| `03-agent-goal.mp4` | 11 s | Agent: tap the "Win two-item bundles" chip, press Review rules, show the "From your goal" tags, press Apply | |
| `04-storefront-bag.mp4` | 12 s | Home step 3 "Win a Rally order": press Open your storefront, add cleanser and cream, tick Bundles, scroll until "Total, all in" sits above the PayPal button | |
| `05-paypal-hold.mp4` | 8 s | Approve in PayPal sandbox | The login screen and buyer email |
| `06-bidding.mp4` | 40 s | The whole live board from start to award. Don't refresh | |
| `07-receipt.mp4` | 12 s | Receipt: held, charged and released, "One box from N shops", "Duties included", "Your shop bid on this order" | |
| `08-handoff-payout.mp4` | 10 s | Hand off in Rally for shops, keep carrier Rally pickup, press Record hand-off, wait for the stepper Won · Handed off · Payout sent · Paid. Cut the wait. Stay scrolled to the top | "Your lowest" prices under "How your agent bid" |
| `09-home-done.mp4` | 4 s | Home at 5 of 5 ("You’re set up on Rally") | |

A clip longer than its shot plays faster and shows a "Sped up" tag, so nothing is accelerated silently. A shorter clip holds its last frame. Clip 06 follows the board's own pacing (see "Re-time") and shows "Slowed" when it plays slower than life.

**No logos, including PayPal's.** PayPal is named in text only. Blur its mark in clips 04 and 05 with `redact` entries. The PayPal button in the bag measures about `x 490, y 645, width 460, height 44` once scrolled, but check it against your footage.

**No private floors in the Orders view.** With real data the Orders page prints "Your lowest" under each of the shop's lanes in "How your agent bid", which starts near `y 600`. Clip 08 must not show it. Stay scrolled to the top, and add this entry to be safe, with `to` set to the clip's length in seconds:

```json
{ "clip": "08-handoff-payout", "from": 0, "to": 30, "rect": { "x": 600, "y": 600, "width": 800, "height": 300 } }
```

## Save the run data

Use the same order as the clips.

**`run/order.json`:** signed in as Haneul Beauty, open `/api/shops/haneul/orders`, find that order in `orders`, and save only that one object. Haneul's response includes the order even if it was outbid.

**`run/run.json`:** type this in from the receipt and Rally for shops. The build checks it against `order.json` and stops on any mismatch.

```json
{
  "order_id": "the order's id",
  "currency": "USD",
  "held_minor": 0,
  "charged_minor": 0,
  "payout_usd_cents": 0,
  "payout_status": "completed",
  "payout_shop": "haneul",
  "winners": { "product-id": { "shop": "haneul", "unit": 0 } },
  "redact": []
}
```

- Amounts are integer minor units: `11882` is $118.82.
- `winners` is copied from the order's `award` event: item id, `shop` and `unit`.
- `payout_shop` is the shop whose hand-off is in clip 08. This one field is an addition to the agreed list, because a split order has more than one winner and `order.json` only shows Haneul's payout.
- `payout_status` is the payment operation's status. The final render requires `completed`.
- `redact` is required, so use `[]` if there is nothing to hide. Each entry blurs a rectangle in clip pixels (1440×900), between two times in seconds of the source clip:

```json
{ "clip": "05-paypal-hold", "from": 0, "to": 7, "rect": { "x": 60, "y": 40, "width": 180, "height": 60 } }
```

`npm run render` also refuses an order that isn't `CHARGED`, a payout that isn't `completed`, any `FIXTURE` event, an order where no bid was chosen by a model, and an order whose award says `agents.written` is 0: the video tells the story of shop agents writing their own bids, so a run where they only picked options can't be used.

If Haneul is outbid, keep going. Captions change to say so and the payout scene uses `payout_shop`. Record clip 08 as that shop.

## Audio

- `run/voiceover.wav` is optional and starts at 0:00. Without it the video has captions only, and the build says so.
- `npm run voice` speaks every cue with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) on this machine, nothing sent anywhere, and places each clip at its cue's start. It also writes `run/voiceover.json` with how long each line is spoken, so captions leave with the voice. Set it up once:

  ```sh
  python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
  mkdir -p models && cd models
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  ```

  The voice is `af_heart` at speed 1.0; `KOKORO_VOICE=am_michael npm run voice` tries the other one. The voice is never sped up: if a line runs past its cue's `dur`, the command fails and lists it, and the fix is a longer cue or fewer words in `timeline.ts`. Run it again whenever the run data changes, because the numbers are spoken.
- `MUSIC_PATH=/path/to/licensed-track.mp3 npm run render` adds music, at −24 dB under the voice. There is none by default.
- Captions are burned in and also written to `out/captions.srt`.

## Re-time

`src/timeline.ts` is the only place timings live: scene `start` and `duration`, then `at` and `dur` for caption cues, shots and callouts, all relative to the scene. Keep scenes back to back. `npm test` fails above 175 s.

1. Record the voiceover from `script.md`.
2. Change the numbers in `timeline.ts` to match it.
3. Run any npm script to regenerate `script.md` and `captions.srt`. Edit caption words in `timeline.ts` too, never in `script.md`.

**Callouts need one pass against real footage.** `x`/`y` is where the line lands and `px`/`py` is the pill, as fractions of the clip. They were measured from the app's real layout at 1440×900 with test data, so confirm them on real footage. The same goes for each shot's `focus` rect, in 1440×900 window pixels.

**The bidding scene paces itself from the events.** `FROM` and `UNTIL` in `src/scenes/Bidding.tsx` are the stretch of scene the auction is spread across. Each agent-written bid holds at least 1.2 s (2 s when there is room), and the first rejection lands near `REJECT_AT` in `timeline.ts`, where its narration line starts. Clip 06 is played through the same time map, so the footage and the rebuilt board stay in step; it starts on the first frame of bidding. If the holds can't fit, rounds 2 and 3 play at 2× and say so on screen.

`STEPS` in `timeline.ts` holds the ribbon's five labels, word for word from Home. `npm test` fails if the app's strings, the ribbon or this checklist drift apart.

## Fonts

Schibsted Grotesk and IBM Plex Mono are copied from `frontend/public/fonts`, with their OFL notices in `public/fonts/`.
