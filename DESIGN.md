---
name: Rally
description: Product-led group ordering. One hold, one big number, bargaining one tap away.
colors:
  ground: "#F7F4F0"
  surface: "#FFFFFF"
  surface-quiet: "#FBF9F6"
  line: "#E4DFD8"
  line-quiet: "#EEEAE4"
  ink: "#17161A"
  ink-2: "#3E3C42"
  muted: "#5C5A60"
  accent: "#B4235A"
  accent-hover: "#8E1A47"
  accent-tint: "#FBE8EF"
  accent-ink: "#6E1437"
  rule-applied: "#FFE9A8"
  saving: "#0B5A3C"
  saving-tint: "#E2F2EA"
  warning: "#A3470F"
  warning-tint: "#FBE9DD"
typography:
  display:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-.025em"
  title:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-.02em"
  body:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 600
  money-hero:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-.03em"
  money:
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
    fontSize: "14px"
    fontWeight: 400
rounded:
  chip: "999px"
  field: "12px"
  card: "18px"
  button: "16px"
  photo: "12px"
spacing:
  gutter: "20px"
  card: "16px"
  stack: "14px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    minHeight: "54px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  rule-applied-card:
    backgroundColor: "{colors.rule-applied}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  savings-band:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.card}"
  product-photo:
    backgroundColor: "{colors.surface-quiet}"
    rounded: "{rounded.photo}"
---

# Design System: Rally

Draft written from the mockup in `design/mockup/`. Refine with Impeccable; keep the palette and type choices unless PLAN.md changes.

## Overview

Rally should feel like a calm, product-led shopping app. A member sees six screens; each has one primary action and one big number. The bargaining is real but stays one tap away ("See how the deal is going"). Behind-the-scenes pages (deal room, organizer sheet, shop console, scorecard) are denser but use the same system.

## Colors

### Primary

Berry (`accent`) is the only action color: primary buttons, links, selected choices. Never use it for decoration.

### Secondary

Butter (`rule-applied`) appears only when a member's own rule changed their order ("Old bottle is $5 cheaper. You said that's fine, so we switched you."). Mint (`saving`, `saving-tint`) appears only for money saved and "still under your max". Orange (`warning`) appears only for "over max" and failed outcomes.

### Neutral

Warm off-white ground, white cards with a fine warm border, near-black ink. Secondary text uses `ink-2` or `muted`, both at 4.5:1 or better on the ground.

## Typography

Schibsted Grotesk for all text; heavy (800) for display and titles, 600 for labels and names. IBM Plex Mono for every money amount, with tabular figures, so totals line up and read as exact. The hero amount on "Deal reached" is the largest type in the product.

## Layout

Mobile first at 390 px with a 20 px gutter. One column; the primary action sits at the bottom of the screen. Desktop pages use a 1232 px max width, wrap side panels below content on narrow screens, and put wide tables in a horizontal scroll box.

## Elevation & Depth

Flat. Separation comes from white cards on the warm ground and fine borders. No shadows, gradients or glass.

## Shapes

Rounded but not bubbly: 12 px fields and photos, 16–18 px cards and buttons, full pills for chips and status badges.

## Components

### Product tiles and photos

Every item appears with its photo. Photos sit on a quiet surface in a rounded frame. Product art is fictional (Dalbit) and must never show a real brand or logo.

### Request and rules

The member's own words appear as a dark chat bubble; what Rally understood appears as product tiles plus a max chip. Rules are plain-language checkboxes ("Take the old bottle if $4+ cheaper"). At most one question, with tap answers.

### Hold and money

The PayPal button approves a hold of the max. Copy always says "hold" before a deal and "charged" after. Breakdowns (items, shared shipping, duty, customs fee, tax) sit behind a "See full breakdown" toggle.

### Negotiation status

A three-step progress bar and a single highlighted card for applied rules. Agent detail lives on the deal room page, with CODE, SOLVER and LLM tags in the "Why it moved" log.

### Receipt

A vertical timeline (hold, charged, ships, pick up) and a "You're covered" card listing the refund protections.

## Do's and Don'ts

- Do keep one primary action and one big number per member screen.
- Do label estimates as estimates and show the max as a hard ceiling.
- Do use real buttons, links and labels; 44 px minimum touch targets; visible focus.
- Don't use emoji, gradient washes, left-border cards, confetti or decorative agent avatars.
- Don't show rounds, utilities, walk-away prices or agent jargon on member screens.
- Don't add a second accent color.
