# Rally submission video

Remotion project for the Devpost video. Nothing in `frontend/` or `backend/` imports it, and it is not part of the app build or CI.

| Command | What it does |
| --- | --- |
| `npm run studio` | Remotion Studio. Allows placeholders. |
| `npm run preview` | Half-size 60 fps `out/preview.mp4`. Allows placeholders. |
| `npm run render` | Final 60 fps `out/rally-1080p.mp4` (12 Mbps) and `out/rally-4k.mp4` (40 Mbps), both h264 slow preset, AAC 320 kbps (CRF 16 gave only 3.4 Mbps on this mostly flat dark film), and `out/captions.srt`; prints bitrate, frame rate and duration, and fails below 10 Mbps at 1080p or 25 Mbps at 4K. Refuses placeholders. |
| `npm run stills` | One PNG per scene at its midpoint, in `out/stills/`. |
| `npm run voice` | Kokoro narration, spoken locally, one WAV per line in `run/voice/`. The timeline is laid out from their lengths. |
| `npm test` | Timeline, schema and render-gate tests. |

The look is in `STYLE.md`, designed from a reference clip in `reference/` (git-ignored, never shipped). Every product moment is drawn natively in `src/ui/panels.tsx` from the run's data, as glass panels on a near-black canvas, so it is sharp at any size. The real recordings appear only as short full-frame proof cuts (`proofs` in `timeline.ts`) on the app's light canvas, labelled "Screen recording · PayPal sandbox", cropped to the region that matters and never shown above their own pixels: the PayPal approval (2 s, logos blurred), the live board landing on its final total (2 s) and the payout stepper turning to Paid (2 s), each cut in and out hard. `npm test` fails if any of the three is missing.

Every command needs `run/run.json`, `run/order.json` and `run/receipt.json` first. There are no stand-in values: without them the build stops and says which file or field is missing. `video/run/` is git-ignored because `order.json` holds a shop's private lowest prices and this repository is public. Keep it out of commits.

## Record the 3 proof clips (owner checklist)

Record one genuine hosted run, in order, in **one browser window** signed in as Haneul Beauty with the judge writer. Save to `run/clips/` with the exact names below. Everything else in the film is drawn from that run's data.

- Window 1440×900, browser zoom 100%, 2× device pixel ratio (a 2880×1800 file), browser chrome hidden, cursor hidden. Any other size stops the build.
- Use the deployed app. Keep passwords, the PayPal login, tokens and account emails out of every frame.
- **The bag.** Low-pH Gel Cleanser (Bada, Haneul), Cica Barrier Cream (Bada, Haneul), Rice Toner (all three shops), Volcanic Clay Mask (only Bada, so the box always comes from at least two shops).
- Before the order: on Products, set a lowest price; on Agent, tap "Win two-item bundles", press Review rules, check the "From your goal" tags, press Apply. Type the two rules it shows into `run.json` `rules`.

| File | Do this | Keep out of frame |
| --- | --- | --- |
| `05-paypal-hold.mp4` | Approve in PayPal sandbox | The login screen, buyer email, PayPal marks |
| `06-bidding.mp4` | The live board from start to award. Don't refresh | |
| `08-handoff-payout.mp4` | Hand off in Rally for shops, keep carrier Rally pickup, press Record hand-off, wait for Won · Handed off · Payout sent · Paid. Cut the wait. Stay scrolled to the top | "Your lowest" under "How your agent bid" |

The receipt's "Your shop bid on this order" and "Duties included" lines, and the shop's Home, are not filmed.

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

  The voice is `af_heart` at speed 1.12 (`VOICE_SPEED` in `src/timeline.ts`; override with `KOKORO_SPEED`); `KOKORO_VOICE=am_michael npm run voice` tries the other one. Run it again whenever the run data changes, because the numbers are spoken.
- **Your own voice (recommended).** A person talking beats any synthetic voice for a judge. `npm run voice` always writes `run/read-this.md`: every line, numbered, filled with this run's numbers. Record each as its own take, `run/recorded/01.wav`, `02.wav` and so on (any mic; a quiet room matters more than the mic). Talk, don't read. Then `RECORDED_DIR=run/recorded npm run voice` trims, levels and measures them, and the timeline lays out from your lengths exactly as it does from Kokoro's.
- `npm run pace -- out/preview.mp4` checks the cut keeps moving (STYLE.md, Pacing). `npm run preview` runs it after rendering. It needs a full ffmpeg on PATH (macOS: `brew install ffmpeg`); Remotion's bundled one lacks the filters.
- `MUSIC_PATH=/path/to/licensed-track.mp3 npm run render` adds music at −22 dB, another 4 dB down under the voice. None is included: use only a track whose licence allows a public competition submission, and put its licence in `music/LICENSE.txt`.
- Sound effects (a click on each cursor click, a whoosh as each demo scene opens, a tick on the final price) are synthesised by `scripts/sfx.py` into `sfx/`, CC0, at −18 dB.
- Captions are burned in, bottom centre, 38 px, white, no box, in phrase chunks of up to seven words (`src/captions.ts`: breaks only after a comma or clause end, or before "and" or "but", never inside an amount or a name) with the spoken word a little brighter, and also written to `out/captions.srt`.

## Re-time

**The story has five acts** (`act` on each scene): the problem in Korea, how Rally works in five steps, the demo, why it matters and where it goes, then one technical line. The five steps are the **step rail** (`STEPS` in `timeline.ts`): act 2 builds it one label at a time, and through the demo it sits at the top with the step being shown filled. Every demo line carries its `step`; `npm test` fails if any demo moment has no step or the wrong one.

**Spoken numbers come from the run.** Captions show amounts as `$93.30`; the voice reads the same amounts as words (`{charged_say}` and friends from `buildFacts`), generated from the numbers, so no amount is typed by hand.

**The voice drives the timeline.** `src/timeline.ts` holds the lines, shots and proof cuts, but no scene or cue times: every line starts `GAP` (0.12 s) after the previous one ends, and each scene is its lines plus `LEAD` and `TAIL` (0.25 s). `npm test` fails on any silence over 0.6 s, except the planned 1 s pause before the close, and on a video over 175 s.

- A shot starts on a line (`cue`, the scene's line index), or on a word of it (`word`, timed like the captions), plus `delay`, and shows its panel until the next shot. A proof cut starts the same way, plays its clip from `in` to `out` at 1×, and cuts in and out hard. Inside a panel, beats land on words too (`word` in `PanelProps`), so a beat comes at least every 2.5 s whatever the voice.
- **The camera is locked.** The frame never zooms or drifts; motion comes from elements (panels enter, numbers roll, chips glide). The only two camera moves are the map pull-backs, Korea to California in act 1 and Seoul to the world in act 4, each one ease-in-out move. `npm test` fails if any other scene transforms its root layer over time.
- The bidding board is item first, like the app's Deal screen: a row per item, a price chip per shop, the lowest filled. It pins each event to the line about it: the first rejection (its replacement lands as the line ends), the first agent-written bid, Haneul's bundle (a bracket with her goal), and the award, after which each row keeps only its winner and the sum appears. If a winner is not its row's lowest single price, a line explains that the cheapest whole box wins and the cheaper chip comes back beside it. Time runs evenly between pins.
- A shot's `spots` dim everything but one rectangle, so one row or one rule is all there is to read. A `bag` shot is the shopper's bag rebuilt from the run, since the app's bag page does not name the shops; its items fly into the board's rows.
- A line whose run fact is empty (no rejection, say) is dropped, and the scene closes up around it.
- `script.md` and `out/captions.srt` are regenerated by every npm script. Edit words in `timeline.ts`, never in `script.md`.

**Shared elements carry the eye across cuts:** the bag's items fly into the board's rows and its total into the board's header; the final total flies into the receipt's "You paid"; Haneul's winning lane shrinks into her order's row; the Seoul pin becomes the shop's role tag. Their clip positions are measured on the recorded run (`ClipScene.tsx`, `Bidding.tsx`); re-check them after a re-record.

## Fonts

Schibsted Grotesk and IBM Plex Mono are copied from `frontend/public/fonts`, with their OFL notices in `public/fonts/`.
