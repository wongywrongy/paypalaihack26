# Rally submission video

Remotion project for the Devpost video. Nothing in `frontend/` or `backend/` imports it, and it is not part of the app build or CI.

| Command | What it does |
| --- | --- |
| `npm run studio` | Remotion Studio. Allows placeholders. |
| `npm run preview` | 720p `out/preview.mp4`. Allows placeholders. |
| `npm run render` | Final 1080p `out/rally.mp4` and `out/captions.srt`. Refuses placeholders. |
| `npm run stills` | One PNG per scene at its midpoint, in `out/stills/`. |
| `npm run voice` | Kokoro narration, spoken locally, one WAV per line in `run/voice/`. The timeline is laid out from their lengths. |
| `npm test` | Timeline, schema and render-gate tests. |

Every command needs `run/run.json`, `run/order.json` and `run/receipt.json` first. There are no stand-in values: without them the build stops and says which file or field is missing. `video/run/` is git-ignored because `order.json` holds a shop's private lowest prices and this repository is public. Keep it out of commits.

## Record the 7 clips (owner checklist)

Record one genuine hosted run, in order, in **one browser window** signed in as Haneul Beauty with the judge writer, so the receipt shows "Your shop bid on this order". Save to `run/clips/` with the exact names below.

- Window 1440×900, browser zoom 100%, 2× device pixel ratio (a 2880×1800 file), browser chrome hidden. Any other size stops the build. The camera zooms up to 1.8× over full-bleed footage, and 2× keeps that text sharp.
- **Cursor hidden.** Headless Chrome draws none; in a normal browser, hide it in the recorder.
- Use the deployed app, not the Rootlane review.
- Keep passwords, the PayPal login, tokens, cookies and account emails out of every frame. Cut the login screen from clip 05.
- Cut waits and page loads with the recorder's pause, or with each shot's `in`/`out` in `timeline.ts`. Nothing is labelled sped up: a span longer than its shot ramps 1× → up to 3× → 1×, and the test fails past 3×.
- **The bag.** Low-pH Gel Cleanser (Bada, Haneul), Cica Barrier Cream (Bada, Haneul), Rice Toner (all three shops), Volcanic Clay Mask (only Bada, so the box always comes from at least two shops).

| File | Do this | Keep out of frame |
| --- | --- | --- |
| `02-products-edit.mp4` | Products, Cica Barrier Cream's row centred: edit Lowest price (USD), press Enter, show it saved | Every lowest and cost value: covered by `private` redactions |
| `03-agent-goal.mp4` | Agent: tap the "Win two-item bundles" chip, press Review rules, show the "From your goal" tags, press Apply | |
| `04-storefront-bag.mp4` | Starts on the storefront: add the four products, open the bag, tick Bundles, scroll until "Total, all in" sits above the PayPal button | The PayPal button's mark |
| `05-paypal-hold.mp4` | Approve in PayPal sandbox | The login screen, buyer email, PayPal marks |
| `06-bidding.mp4` | The live board from start to award. Don't refresh. Only its first seconds are shown | |
| `07-receipt.mp4` | Receipt: You paid, held, charged and released, "One box from N shops", "Duties included", "Your shop bid on this order" | |
| `08-handoff-payout.mp4` | Hand off in Rally for shops, keep carrier Rally pickup, press Record hand-off, wait for Won · Handed off · Payout sent · Paid. Cut the wait. Stay scrolled to the top | "Your lowest" under "How your agent bid" |

**No logos, including PayPal's.** PayPal is named in text only; its marks are blurred with `redact` entries.

**No private prices, ever.** A `private` redaction covers a value with a lock and "Private" from the first frame it could show, so the viewer sees that a price is set and locked, never the number.

## Save the run data

Use the same order as the clips.

**`run/order.json`:** signed in as Haneul Beauty, open `/api/shops/haneul/orders`, find that order in `orders`, and save only that one object. Haneul's response includes the order even if it was outbid.

**`run/receipt.json`:** the shopper's side of the same order, from `/api/orders/{id}` in the same session: save `breakdown` and `lines`. The board adds the winning prices and "shipping, duties, tax and fee" up to the charged total, so the build stops unless the breakdown's terms sum to its total, its total is the charged amount and its lines are the award's winners.

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
  "goal": "Haneul's goal exactly as typed in clip 03",
  "redact": []
}
```

- Amounts are integer minor units: `11882` is $118.82.
- `winners` is copied from the order's `award` event: item id, `shop` and `unit`.
- `payout_shop` is the shop whose hand-off is in clip 08. This one field is an addition to the agreed list, because a split order has more than one winner and `order.json` only shows Haneul's payout.
- `payout_status` is the payment operation's status. The final render requires `completed`.
- `goal` is quoted (first sentence only) beside Haneul's lane when her bid does what it asked.
- `redact` is required, so use `[]` if there is nothing to hide. Each entry covers a rectangle in clip pixels (1440×900), between two times in seconds of the source clip. `style` is `blur` (the default, for logos) or `private` (for prices):

```json
{ "clip": "05-paypal-hold", "from": 0, "to": 7, "rect": { "x": 60, "y": 40, "width": 180, "height": 60 } }
{ "clip": "02-products-edit", "from": 0, "to": 7, "rect": { "x": 753, "y": 422, "width": 200, "height": 55 }, "style": "private" }
```

`npm run render` also refuses an order that isn't `CHARGED`, a payout that isn't `completed`, any `FIXTURE` event, an order where no bid was chosen by a model, and an order whose award says `agents.written` is 0: the video tells the story of shop agents writing their own bids, so a run where they only picked options can't be used.

If Haneul is outbid, captions change to say so and the payout scene uses `payout_shop`, but the story is built around Haneul winning: record another order. Her rules cap each round's cut at the goal's percentage off her listed price, so with this bag her listed prices have to be competitive with Bada's for her to win anything.

## Audio

- `npm run voice` speaks every line with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) on this machine, nothing sent anywhere, into one trimmed WAV per line in `run/voice/`, and writes `run/voiceover.json` with each line's spoken length. Lines already spoken are reused. Without it the build uses estimated lengths and has no narration, and says so. Set it up once:

  ```sh
  python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
  mkdir -p models && cd models
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  ```

  The voice is `af_heart` at speed 1.0, never sped up; `KOKORO_VOICE=am_michael npm run voice` tries the other one. Run it again whenever the run data changes, because the numbers are spoken.
- `MUSIC_PATH=/path/to/licensed-track.mp3 npm run render` adds music, at −24 dB under the voice. There is none by default.
- Captions are burned in (one style: bottom centre, 40 px, two lines at most, over a steady scrim) and also written to `out/captions.srt`.

## Re-time

**The voice drives the timeline.** `src/timeline.ts` holds the lines, shots and camera keys, but no scene or cue times: every line starts `GAP` (0.3 s) after the previous one ends, and each scene is its lines plus half a second. `npm test` fails on any silence over 0.6 s, except the planned 1 s pause before the close, and on a video over 175 s.

- A shot starts on a line (`cue`, the scene's line index) and plays its clip from `in` to `out`. A camera key fires at a line's start (plus `delay`) or at a clip second, and centres a point of the 1440×900 window at a zoom from 1 to 1.8. Every key drifts 4% closer while it holds, so nothing sits still.
- The bidding board is item first, like the app's Deal screen: a row per item, a price chip per shop, the lowest filled. It pins each event to the line about it: the first rejection (its replacement lands as the line ends), the first agent-written bid, Haneul's bundle (a bracket with her goal), and the award, after which each row keeps only its winner and the sum appears. If a winner is not its row's lowest single price, a line explains that the cheapest whole box wins and the cheaper chip comes back beside it. Time runs evenly between pins.
- A shot's `spots` dim everything but one rectangle, so one row or one rule is all there is to read. A `bag` shot is the shopper's bag rebuilt from the run, since the app's bag page does not name the shops; its items fly into the board's rows.
- A line whose run fact is empty (no rejection, say) is dropped, and the scene closes up around it.
- `script.md` and `out/captions.srt` are regenerated by every npm script. Edit words in `timeline.ts`, never in `script.md`.

**Shared elements carry the eye across cuts:** the bag's items fly into the board's rows and its total into the board's header; the final total flies into the receipt's "You paid"; Haneul's winning lane shrinks into her order's row; the Seoul pin becomes the shop's role tag. Their clip positions are measured on the recorded run (`ClipScene.tsx`, `Bidding.tsx`); re-check them after a re-record.

## Fonts

Schibsted Grotesk and IBM Plex Mono are copied from `frontend/public/fonts`, with their OFL notices in `public/fonts/`.
