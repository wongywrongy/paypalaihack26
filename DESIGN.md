---
name: Rally
description: Product-led group ordering. One hold, one big number, bargaining one tap away.
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

Refined from the mockup in `design/mockup/` for the fixture milestone. The locked palette and type choices remain the visual authority.

## Overview

Rally feels like a calm, product-led shopping app. A member sees six screens and one optional question; each has one primary action and one leading number. The progress screen prominently opens "See the example bargaining"; a secondary link still goes straight to the final deal. The example fixture is labeled at every step. The separate deal room gives the exchange room without crowding the basket or payment review.

## Colors

### Primary

Berry (`accent`) is the action color for primary buttons, links, checked rules and focus outlines. Bottle-choice selection uses near-black. The wordmark dot also uses berry; keep other uses functional.

### Secondary

Butter (`rule-applied`) appears only when a member's own rule changed their order ("Old bottle is $5 cheaper. You said that's fine, so we switched you."). Mint (`saving`, `saving-tint`) marks money saved, "still under your max", and the agreed terms in the deal table. Savings use mint rather than a berry banner, reserving berry for the primary action.

### Neutral

Warm off-white ground, white grouped rows and cards, near-black ink. Warm lines separate rows and timelines or outline the max field; most cards have no outer border. Secondary text uses `muted`, with at least 4.5:1 contrast on the ground.

## Typography

Schibsted Grotesk for all text; heavy (800) for main headings, 700 for section titles and 650 for product names and primary actions. Body text defaults to 15 px with a 1.5 line height. Ordinary type uses root-relative units so browser text preferences can enlarge it; decision-bearing metadata stays at least 12 px, product names 14 px and item prices 13 px at the default size. Rows grow and wrap rather than truncate bottle details. IBM Plex Mono for every money amount, with tabular figures, so totals line up and read as exact. The 58 px hero amount appears on both "Deal reached" and the receipt and is the largest type in the product; its viewport bound keeps the complete amount readable on narrow screens.

## Layout

Mobile first at 390 px with a 20 px gutter. One column; the primary action follows the content and settles at the bottom when space permits, without covering content. Member pages remain a comfortable 460 px column on desktop. Desktop deal pages use a 1272 px outer max width (1232 px of content after gutters), wrap the decision log below the terms at 800 px and below, and put the 720 px minimum-width table in a labeled horizontal scroll box.

## Elevation & Depth

Flat. Separation comes from white cards on the warm ground, semantic tints and fine dividers. No shadows, gradients or glass.

## Shapes

Rounded but not bubbly: 12 px max fields and savings bands, 10 px product photos (6 px in the deal table), 16 px cards, request fields and buttons, full pills for example badges.

## Components

### Product tiles and photos

Each skincare item appears with its photo; the free sample kit uses a small gift icon. Photos sit on a quiet surface in a rounded frame. Product art is fictional (Dalbit) and must never show a real brand or logo. The checked generated contact sheet uses consistent light and materials; white pump and black cap distinguish new and old essence packaging. Images remain understandable with their text labels.

### Request and rules

The member's own words appear as a dark chat bubble; what Rally understood appears as product tiles plus a max amount. Rules are plain-language checkboxes ("Take the old bottle if $4+ cheaper"). At most one question, with tap answers.

### Hold and money

The example action previews a hold of the max without contacting PayPal. Copy distinguishes the proposed hold, charge and release; receipt amounts and timeline remain labeled as examples. Breakdowns (items, shared shipping, duty, customs fee, tax) sit behind a "See full breakdown" toggle.

### Negotiation status

A three-step progress bar and a single highlighted card for applied rules remain on the member progress screen. Its primary action opens the bargaining exchange. The deal room leads with four visible proposals: group opening, shop counter, group revision, shop final counter. Named sides, exact unit-price changes, whole-group shipping and sample-kit terms explain what each side traded. Aisha's choice appears at the relevant counteroffer; the complete final share and saved-allocation code checks follow the history. The full term matrix remains available below.

The public example events have stable IDs and explicit sequence numbers derived from the canonical term columns. They reconstruct the scenario; they are not recorded model output or database-persisted negotiation events. State that near the heading. Do not animate invented typing, ongoing work or financial success, and do not invent complete intermediate totals. Item prices are labeled per unit before shared costs; only the final saved allocation is presented as the complete share. Desktop can place adjacent proposals side by side; mobile follows the same chronological DOM order. Completed proposals remain visible after refresh.

On small screens, offer history stays chronological with pinned product labels. "Show agreed terms" and "Show opening offer" move the existing comparison instantly; position feedback follows actual scrolling. Confirming the optional question focuses the continuation link; changing the answer returns focus to the selected radio. A persistent, initially empty status region announces the answer.

### Interaction and motion

Apply Emil Kowalski's purpose and frequency test before adding motion. Primary hover feedback changes only `background-color` over 160 ms with `ease`, and only for a fine pointer that supports hover. Press and keyboard focus feedback are immediate. Reduced motion keeps state colors with a shorter 80 ms color transition. Table jumps are instant for every input method. Financial figures remain immediately readable; the static example never animates fabricated progress or financial success. No entrance staggers, bouncing controls, looping activity or additional motion dependency.

The plan permits a final-price count and calm progress when they clarify real state. That permission is not a requirement to animate this immutable example. Review a future counter's currency, cents, accessible final value and reduced-motion formatting before using the retained Magic UI component.

### Receipt

A vertical timeline (hold, charged, ships, pick up) and a "You're covered" card listing the refund protections.

## Do's and Don'ts

- Do keep one primary action and one big number per member screen.
- Do label estimates as estimates and show the max as a hard ceiling.
- Do use real buttons, links and labels; 44 px minimum touch targets; visible focus.
- Don't use emoji, gradient washes, left-border cards, confetti or decorative agent avatars.
- Don't show rounds, utilities, walk-away prices or agent jargon on member screens.
- Don't add a second accent color.
