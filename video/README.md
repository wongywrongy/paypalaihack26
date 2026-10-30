# Rally submission video

Remotion project for the Devpost video. Nothing in `frontend/` or `backend/` imports it, and it is not part of the app build or CI.

| Command | What it does |
| --- | --- |
| `npm run studio` | Remotion Studio. Allows placeholders. |
| `npm run preview` | 720p `out/preview.mp4`. Allows placeholders. |
| `npm run render` | Final 1080p `out/rally.mp4` and `out/captions.srt`. Refuses placeholders. |
| `npm run stills` | One PNG per scene at its midpoint, in `out/stills/`. |
| `npm test` | Timeline, schema and render-gate tests. |

Every command needs `run/run.json` and `run/order.json` first. There are no stand-in values: without them the build stops and says which file or field is missing. `video/run/` is git-ignored because `order.json` holds a shop's private lowest prices and this repository is public. Keep it out of commits.

## Record the 9 clips

Record one genuine hosted run, in order. Save to `run/clips/` with the exact names below.

- Window 1440×900 at 100% zoom, with browser chrome hidden. A clip of any other size stops the build.
- Use the deployed app, not the Rootlane review.
- Keep passwords, the PayPal login, tokens, cookies and account emails out of every frame. Cut the login screen from clip 05.
- Use a separate private window for Rally for shops, as the root README says.
- Trim each clip to its action, starting on the first frame that matters.

| File | Scene time | Do this | Keep out of frame |
| --- | --- | --- | --- |
| `01-home-guide.mp4` | 7 s | Rally for shops Home, setup guide at step 1 | The sign-in screen |
| `02-products-edit.mp4` | 11 s | In the grid, edit Cica Barrier Cream's lowest price within bounds, press Enter, show it saved | Other shops' data |
| `03-agent-goal.mp4` | 12 s | Click a suggestion chip, Review rules, show changed rules outlined, Apply | |
| `04-storefront-bag.mp4` | 11 s | Open your storefront, add cleanser and cream, enable Bundles, show the bag's all-in total | |
| `05-paypal-hold.mp4` | 7 s | Approve in PayPal sandbox | The login screen and buyer email |
| `06-bidding.mp4` | 40 s | The whole live board from start to award. Don't refresh | |
| `07-receipt.mp4` | 9 s | Receipt: held, charged, released, the one box card, "Your shop bid on this order" | |
| `08-handoff-payout.mp4` | 9 s | Hand off, Record hand-off, wait until the payout timeline reaches Paid. Cut the wait | Winning shop's writer password |
| `09-home-done.mp4` | 4 s | Home guide at 5 of 5 | |

A clip longer than its shot plays faster and shows a "Sped up" tag, so nothing is accelerated silently. A shorter clip holds its last frame. Clip 06 always stretches to the full scene, so the board on the right stays aligned with it, and it shows "Sped up" or "Slowed" when the speed changes noticeably.

**No logos, including PayPal's.** Clips 04 and 05 will probably show PayPal's mark. Blur each one with a `redact` entry.

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

`npm run render` also refuses an order that isn't `CHARGED`, a payout that isn't `completed`, any `FIXTURE` event, and an order where no bid was chosen by a model.

If Haneul is outbid, keep going. Captions change to say so and the payout scene uses `payout_shop`. Record clip 08 as that shop.

## Audio

- `run/voiceover.wav` is optional and starts at 0:00. Without it the video has captions only, and the build says so.
- `MUSIC_PATH=/path/to/licensed-track.mp3 npm run render` adds music. There is none by default.

## Re-time

`src/timeline.ts` is the only place timings live: scene `start` and `duration`, then `at` and `dur` for caption cues, shots and callouts, all relative to the scene. Keep scenes back to back. `npm test` fails above 175 s.

1. Record the voiceover from `script.md`.
2. Change the numbers in `timeline.ts` to match it.
3. Run any npm script to regenerate `script.md` and `captions.srt`. Edit caption words in `timeline.ts` too, never in `script.md`.

**Callouts need one pass against real footage.** `x`/`y` is where the line lands and `px`/`py` is the pill, as fractions of the clip. They are estimates until the clips exist. The bidding board's event window is `FROM` and `UNTIL` in `src/scenes/Bidding.tsx`.

`STEPS` in `timeline.ts` holds the ribbon's five labels. Match them to the Home guide's wording.

## Fonts

Schibsted Grotesk and IBM Plex Mono are copied from `frontend/public/fonts`, with their OFL notices in `public/fonts/`.
