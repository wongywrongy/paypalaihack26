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

Rally feels like a calm, product-led shopping app that happens to ship from Seoul. A shopper sees six screens and one sheet: Shop, Ship to, Ask Rally, Bag, Deal, Paid, Track. Each has one primary action and one leading number. It reads as a real product: real shopping words, real order numbers and dates, the real PayPal button, and a single small "Test mode" pill in the header as the only sandbox marker. Behind-the-scenes pages (How the deal was made, Shop console, Scorecard, Who decides what, Benchmark) give the agent detail room without crowding the shopper's path.

## Colors

### Primary

Berry (`accent`) is the action color for primary buttons, links, checked switches and focus outlines. The wordmark dot also uses berry; keep other uses functional. The PayPal button uses PayPal's own SDK styling, not berry.

### Secondary

Butter (`rule-applied`) appears only when the shopper's own rule changed the order ("Older packaging, same formula. You said that's fine." / "Added a $2 sheet mask. It unlocks free shipping in Korea."). Mint (`saving`, `saving-tint`) marks money saved: "$12.03 less than at checkout", "Saved vs buying from each shop yourself". Reserve berry for actions.

### Neutral

Warm off-white ground, white grouped rows and cards, near-black ink. Warm lines separate rows and timelines; most cards have no outer border. Secondary text uses `muted`, with at least 4.5:1 contrast on the ground.

## Typography

Schibsted Grotesk for all text; heavy (800) for main headings, 700 for section titles and product names, 600 for labels and primary actions. Body text defaults to 15 px with a 1.5 line height. Ordinary type uses root-relative units so browser text preferences can enlarge it; decision-bearing metadata stays at least 12 px, product names 14 px and item prices 13 px. Rows grow and wrap rather than truncate product details. IBM Plex Mono for every money amount, with tabular figures. The 58 px hero amount appears on Deal and Paid and is the largest type in the product; its viewport bound keeps the complete amount readable on narrow screens. Local currency symbols (C$, £, €, A$) sit in the same mono face.

## Layout

Mobile first at 390 px with a 20 px gutter. One column; the primary action follows the content and settles at the bottom when space permits, without covering content. Shopper pages remain a comfortable 460 px column on desktop; the shop grid can widen to 3 or 4 columns. Behind-the-scenes pages use a 1272 px outer max width and put wide tables in labeled horizontal scroll boxes.

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

### Deal

Status pill ("Deal done · 14 seconds"), the new total over the struck-through checkout total, one card per change, butter for changes made under the shopper's rules, a plain card for "Prices held. The shop said no." Primary: "See your order". Link: "How the deal was made".

### Paid and Track

Hero "You paid $106.79", the release line, the saved-vs-direct band in mint, items with photos, a breakdown toggle, "Nothing to pay at your door". Track is a vertical timeline (paid, shops shipped to our Seoul hub, packed into one box, leaves Seoul, customs cleared, delivered) with a "You're covered" card listing refund protections.

### Behind the scenes

How the deal was made: per-shop replies in order with what changed, and a "Why it moved" log tagged CODE, SOLVER, LLM or PAYPAL. Shop console: the shop's products, stock, floors and costs (private to that shop), extras, code rules and payouts. Scorecard: buying direct vs checkout vs deal, checks, shop gains, every destination. Who decides what: one row per step with its owner.

### Interaction and motion

Apply Emil Kowalski's purpose and frequency test before adding motion. Primary hover changes only `background-color` over 160 ms with `ease`, and only for a fine pointer that supports hover. Press and keyboard focus feedback are immediate. On Deal, cards arrive one by one as the live deal returns them and the total counts down to the charged amount; with reduced motion, show the final state at once. Never animate progress or savings that have not happened. No entrance staggers elsewhere, bouncing controls, looping activity or confetti.

## Do's and Don'ts

- Do keep one primary action and one big number per shopper screen.
- Do write real product copy: Bag, Checkout, Pay with PayPal, hold, charged, Order RL-24817, Track order.
- Do show the all-in price in the shopper's currency before payment.
- Do use real buttons, links and labels; 44 px minimum touch targets; visible focus.
- Don't write "Example", "preview", "fixture", "simulated" or "demo" anywhere in the UI.
- Don't use emoji, gradient washes, left-border cards, confetti or decorative agent avatars.
- Don't show rounds, utilities, floors or agent jargon on shopper screens.
- Don't add a second accent color.
