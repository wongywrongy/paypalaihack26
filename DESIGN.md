---
name: Rally
description: Product-led international shopping. One box, one all-in price, the deal one tap away.
colors:
  ground: "#F7F4F0"
  surface: "#FFFFFF"
  line: "#E4DFD8"
  ink: "#17161A"
  muted: "#5C5A60"
  accent: "#B4235A"
  accent-hover: "#8E1A47"
  accent-tint: "#FBE8EF"
  rule-applied: "#FFE9A8"
  saving: "#0B5A3C"
  saving-tint: "#E2F2EA"
typography:
  display:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-.03em"
  title:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-.015em"
  body:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 600
  money-hero:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "58px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-.025em"
  money:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    letterSpacing: "-.025em"
rounded:
  chip: "999px"
  field: "12px"
  card: "16px"
  button: "16px"
  photo: "10px"
spacing:
  gutter: "20px"
  band: "16px"
  applied-rule: "18px"
  stack: "14px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "14px 18px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  rule-applied-card:
    backgroundColor: "{colors.rule-applied}"
    rounded: "{rounded.card}"
    padding: "{spacing.applied-rule}"
  savings-band:
    backgroundColor: "{colors.saving-tint}"
    textColor: "{colors.saving}"
    rounded: "{rounded.field}"
    padding: "{spacing.band}"
  product-photo:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.photo}"
---

# Design System: Rally

Version 2 (Oct 22, 2026): solo international shopping across three Korean shops. Reference screens in `design/mockup/`. The palette and type choices in the front matter remain the visual authority; layout, typography, elevation, shape and motion rules below carry over from the first design milestone.

## Overview

Rally feels like a calm, product-led shopping app that happens to ship from Seoul. A shopper sees six screens and one sheet: Shop, Ship to, Ask Rally, Bag, Deal, Paid, Track. Each has one primary action and one leading number. It reads as a real product: real shopping words, real order numbers and dates, the real PayPal button, and a single small "Test mode" pill in the header as the only sandbox marker. The agents' work is shown while it happens, on the Deal screen, as prices meeting and items changing; there are no explainer pages. Shops get Rally for shops, a desktop dashboard showing the same deal from their side.

## Colors

### Primary

Berry (`accent`) is the action color for primary buttons, links, checked switches and focus outlines, and the color of Rally's offer on a price track. The wordmark dot also uses berry; keep other uses functional. The PayPal button uses PayPal's own SDK styling, not berry.

### Secondary

Butter (`rule-applied`) appears only when the shopper's own rule changed the order ("Older packaging, same formula. You said that's fine." / "Added a $2 sheet mask. It unlocks free shipping in Korea."). Mint (`saving`, `saving-tint`) marks money saved: an agreed price and the saved stretch of its track, "Deal · −$10.96", "$12.03 less than at checkout", "Saved vs buying from each shop yourself". In Rally for shops it marks what the shop earned over its lowest price. Reserve berry for actions.

### Neutral

Warm off-white ground, white grouped rows and cards, near-black ink. Warm lines separate rows and timelines; most cards have no outer border. Secondary text uses `muted`, with at least 4.5:1 contrast on the ground.

## Typography

Schibsted Grotesk for all text; heavy (800) for main headings, 700 for section titles and product names, 600 for labels and primary actions. Body text defaults to 15 px with a 1.5 line height. Ordinary type uses root-relative units so browser text preferences can enlarge it; decision-bearing metadata stays at least 12 px, product names 14 px and item prices 13 px. Rows grow and wrap rather than truncate product details. IBM Plex Mono for every money amount, with tabular figures. The 58 px hero amount appears on Deal and Paid and is the largest type in the product; its viewport bound keeps the complete amount readable on narrow screens. Local currency symbols (C$, £, €, A$) sit in the same mono face.

## Layout

Mobile first at 390 px with a 20 px gutter. One column; the primary action follows the content and settles at the bottom when space permits, without covering content. Shopper pages remain a comfortable 460 px column on desktop; the shop grid can widen to 3 or 4 columns. Rally for shops uses a 1272 px outer max width, stacks its order and messages columns below 960 px, and puts wide tables in labeled horizontal scroll boxes.

## Elevation & Depth

Flat. Separation comes from white cards on the warm ground, semantic tints and fine dividers. No shadows, gradients or glass. The Ship to sheet may use a scrim over the shop.

## Shapes

Rounded but not bubbly: 12 px fields and bands, 10 px product photos (12 px in the shop grid), 16 px cards and buttons, 18 px shop tiles, full pills for chips and the Test mode marker.

## Components

### Header

Wordmark, "Test mode" pill, bag icon with count. Below it on the shop: a "Ship to United States · USD" chip that opens the Ship to sheet.

### Product tiles and photos

Photo, brand, name, "from $12", "2 shops". Photos sit on a quiet tinted surface in a rounded frame, one art direction across all ~30 products. Product art is fictional and must never show a real brand or logo. Older packaging is shown as its own photo so the shopper sees exactly what they get. Images remain understandable with their text labels.

### Ask Rally

The shopper's words in a dark bubble; the routine as numbered steps (Cleanse, Tone, Treat, Moisturize) with one reason per item and the shop under it; a note when a shop ships only inside Korea; the all-in total and "Add routine to bag".

### Bag and checkout

Items grouped by shop with the shop's city and shipping note ("Ships inside Korea", "Free shipping in Korea"). One line for the box ("One box from Seoul to California · arrives Oct 30 to Nov 2"). The two shopper rules as switches with one-line explanations. "Total, all in" with a "See breakdown" toggle (items, shipping in Korea, shipping to you, duty, tax, Rally fee). The PayPal SDK button, then: "PayPal holds $118.82. You're charged after Rally's deal, never more than this."

### Deal (live)

Opens the moment PayPal approves and plays the negotiation as it happens, about 15 seconds. Top: "Rally is talking to 2 shops" with a pulsing dot and a running clock, then the all-in total counting down, the checkout total struck through once it drops, and one line on the hold ("PayPal is holding $118.82. You pay the final price, never more."). A three-item legend: Rally's offer, Shop's price, You save.

One card per shop: name, city, a status chip (Waiting, Offer sent, Countered, Holding prices, Final offer, Deal · −$10.96). Each item row has a price track under it, from Rally's opening offer to the listed price: Rally's offer is a berry dot with its price below, the shop's price a ring with its price above, both sliding as replies arrive. When they meet, the dots give way to a mint "$19 agreed" pill and the stretch from there to the listed price turns mint. A price the shop won't move loses its track and reads "price held". Swaps and add-ons arrive as rows with a butter tag tied to the bag switch that allowed them ("You allowed older packaging", "You allowed small extras"); a shop's extra (sample kit) arrives as a row priced "Free". Under each shop, the latest message from either agent, one line, in a tinted bubble (berry tint for Rally, warm grey for the shop).

Done: mint "Deal done · 14 seconds", "You pay $106.79. PayPal releases the other $12.03.", primary "See your order", text button "Watch the deal again". The same screen opens from Paid as a replay.

### Paid and Track

Hero "You paid $106.79", the release line, the saved-vs-direct band in mint, items with photos, a breakdown toggle, "Nothing to pay at your door". Track is a vertical timeline (paid, shops shipped to our Seoul hub, packed into one box, leaves Seoul, customs cleared, delivered) with a "You're covered" card listing refund protections.

### Rally for shops

A desktop dashboard: white top bar with the wordmark and "for shops", tabs (Orders, Products, Payouts, Agent settings), the shop's name and the Test mode pill. Orders shows each deal from the shop's side: the same price tracks, now running from the shop's private lowest price (a dashed tick) to the listed price, with Rally's offers and the shop agent's prices as dots, the agreed pill, and the stretch earned over the lowest price in mint; per line "+$3.00 over lowest"; the sample kit with what it costs the shop; the payout and "Mark handed to the hub". Beside it, the messages between Rally and the shop's agent with times. Products is a grid of listed price, lowest price, cost, stock, days on shelf and goal, with a lock line: lowest prices and costs are private. Agent settings are real checkboxes.

### Interaction and motion

Apply Emil Kowalski's purpose and frequency test before adding motion. Primary hover changes only `background-color` over 160 ms with `ease`, and only for a fine pointer that supports hover. Press and keyboard focus feedback are immediate. On the live deal, markers slide (500 ms, ease) as offers arrive, rows slide in when items are added, an agreed track turns mint, and the total counts down to each new amount over about half a second. Each event stays on screen at least 600 ms. With reduced motion, every state appears without sliding or counting. Never animate progress or savings that have not happened; the screen shows events the backend actually streamed. No entrance staggers elsewhere, bouncing controls, looping activity or confetti.

## Do's and Don'ts

- Do keep one primary action and one big number per shopper screen.
- Do write real product copy: Bag, Checkout, Pay with PayPal, hold, charged, Order RL-24817, Track order.
- Do show the all-in price in the shopper's currency before payment.
- Do use real buttons, links and labels; 44 px minimum touch targets; visible focus.
- Don't write "Example", "preview", "fixture", "simulated" or "demo" anywhere in the UI.
- Don't use emoji, gradient washes, left-border cards, confetti or decorative agent avatars.
- Don't build explainer pages or logs to read. Show the deal while it happens, as prices and items.
- Don't show rounds, utilities, floors or agent jargon on shopper screens.
- Don't add a second accent color.
