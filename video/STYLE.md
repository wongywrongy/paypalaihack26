# Rally video style

Designed from one reference: `reference/cluelyreference.mp4` (Cluely's product video, 2:25, 1920×1080, 23.98 fps). The clip is git-ignored and never shipped; timestamps below are into it.

## What the reference does

| Element | What it does | Where |
| --- | --- | --- |
| Palette | Pure black canvas around every product shot. Light UI (white, warm grey) only when showing a light app. No tinted gradient fields in this clip. Colour comes from the UI itself. | 0:02, 0:10, 1:25 |
| Type | A geometric sans for the title and tagline, the tagline small and grey under a large wordmark. Product text is the product's own. | 0:03, 2:22 |
| Title motion | Words slide in with heavy motion blur and fade: "…es what you hear" smears in from the right. | 0:04 |
| Panels | The product is a translucent dark window floating over the meeting. When it is the subject, it is pulled forward, tilted in 3D, with a soft light rim and a glow at the edge, and everything behind it falls out of focus. | 0:14, 0:26, 0:50, 0:58 |
| Depth of field | Background layers blur 6–10 px and darken while one panel is sharp. | 0:26, 0:52, 1:24 |
| Spotlight | On light UI, the page dims and one block stays bright with a soft white bloom around it. | 1:25, 1:36, 1:46 |
| Camera | Slow continuous push-ins and drifts, then large 3D moves: rotate toward a panel, push to a close-up where UI text is 50–60 px tall, pull back out. Almost no hard cuts. | 0:14–0:30, 1:20, 1:28 |
| Cuts | Scene-change detection finds only five hard cuts in 2:25, all in the dashboard section. Everything else is a continuous camera move or a blur dissolve. | cuts at 1:38.7, 1:41.7, 1:46.3, 1:49.4, 1:50.5 |
| Keycaps | Real shortcuts shown as small keycaps inline in the UI (⌘ ↵, ⌘ \\). | 0:14, 0:18 |
| Interactions | A real cursor clicks the thing being explained; a press state on the button. | 0:16, 1:13 |
| Captions | White, about 44 px, short chunks of 4–7 words, on a full-width dark translucent bar. | 0:10 onward |
| Sound | A quiet electronic bed under the title and between lines (about −19 dBFS on the title, −26 dBFS on the end card), voice on top. The mix is voice-led; tempo is not measurable from the mixed track. | 0:02, 2:21 |
| End | Wordmark and tagline on black, then on white. | 2:21–2:25 |

## What Rally takes

- **Canvas:** near-black `#0B0B0F`, like the reference's black, with two or three large, very soft colour fields drifting behind: Rally raspberry, a cool blue-grey, and a faint green that only appears in money moments. These are Rally's, not Cluely's: the reference has none (it gets colour from the meeting footage), and without footage behind the panels the fields give the glass something to blur. 2–3% grain over everything, so the fields don't band.
- **Panels:** the reference's floating window, drawn natively. Dark glass at 24 px radius, 1 px inner border at white 12%, backdrop blur of the fields, two-layer shadow. A panel enters tilted (rotateX 8°, perspective 1600 px) and eases flat as it becomes the subject, as at 0:26.
- **Depth of field:** at most one panel in focus; the rest at 40% opacity with 8 px blur, as at 0:26 and 0:52.
- **Camera:** locked. Constant push-ins read as cheap and pushed layouts into each other, so the frame stays still and motion comes from elements. Two deliberate moves only, both map pull-backs (Korea to California, Seoul to the world), each one ease-in-out. The colour fields still drift behind everything. No large 3D swings: the reference's swings serve 30 s product walkthroughs, and Rally's shots are 3–8 s.
- **Text:** the app's display font (Schibsted Grotesk), headlines 96–140 px at −2% tracking. Words reveal one at a time from 8 px blur and 14 px below, three frames apart at 60 fps: the reference's motion-blur entrance (0:04), made calmer.
- **Numbers:** the app's mono (IBM Plex Mono), tabular. Totals roll like an odometer and only roll down; the final price gets the one shimmer.
- **Keycaps and cursor:** keycaps only while the goal is typed (real keystrokes); a drawn cursor on curved paths with a click ripple only on Add to bag, Approve, Apply and Record hand-off, as at 0:16.
- **Transitions:** shared-element morphs inside an act; a 12-frame blur dissolve between acts. No hard cuts at all: the reference keeps them for its dashboard tour, and Rally has none.

## Where Rally deliberately differs

- **Captions have no box.** The reference uses a dark bar (0:10). Rally's canvas is already dark, so white at 92% reads without one; 38 px, phrase chunks of at most seven words, the spoken word slightly brighter; dark over a proof cut's light canvas.
- **Colour fields.** Not in the reference; see Canvas above.
- **No live footage in the main frame.** The reference is all real recording. Rally rebuilds product moments natively for sharpness and shows the real recordings as short full-frame proof cuts on the app's warm light canvas, cropped to the relevant region, never upscaled, framed by a thin line and labelled "Screen recording · PayPal sandbox".
- **No PayPal interface.** The hold is drawn abstractly (a bracket and a ceiling line); the real PayPal window appears only as a 2 s proof cut with its marks blurred.
- **Music.** None ships with this repository: no track with a licence that allows a public competition submission has been provided. Sound effects are synthesised for this project (`sfx/`).

## Palette

| Token | Value | Meaning |
| --- | --- | --- |
| Canvas | `#0B0B0F` | Background |
| Ink | `rgba(255,255,255,.94)` | Text |
| Muted | `rgba(255,255,255,.62)` | Secondary text |
| Glass | `rgba(255,255,255,.06)`, border `rgba(255,255,255,.12)` | Panels |
| Raspberry | `#B4235A` field, `#F0679B` on dark text | Rally and the shops |
| Green | `#2BB673` field, `#5BE3A2` on dark text | Money released or paid |
| Blue-grey | `#3A4A66` | Neutral field |
| Light canvas | `#F7F4F0` | Proof cuts only (the app's ground) |
