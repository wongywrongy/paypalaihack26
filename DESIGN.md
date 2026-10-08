---
name: Commonplace / Coalition
description: Photo-led headphone shopping and evidence-backed group purchasing with persistent checkout.
colors:
  indigo: "#4338ca"
  indigo-hover: "#352aa8"
  green: "#247154"
  ink: "#202431"
  muted: "#626977"
  ground: "#f7f8fa"
  surface: "#fff"
  line: "#e0e3e9"
  photo-ground: "#efeeec"
typography:
  display:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "clamp(30px, 3.1vw, 42px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.035em"
  storefront-title:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.03em"
  catalog-title:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "22px"
    fontWeight: 550
    letterSpacing: "-.02em"
  product-title:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "17px"
    fontWeight: 550
  title:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "24px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-.03em"
  price:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-.04em"
  body:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "14px"
    lineHeight: 1.7
  label:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "13px"
    fontWeight: 550
  storefront-price:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.035em"
rounded:
  field: "6px"
  panel: "10px"
  media: "12px"
spacing:
  field-gap: "12px"
  panel-mobile: "20px"
  panel: "24px"
  checkout-panel: "26px"
  selected-gap: "64px"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "14px 18px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.indigo-hover}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  search-field:
    rounded: "{rounded.media}"
    padding: "6px 6px 6px 20px"
  product-photo:
    backgroundColor: "{colors.photo-ground}"
    rounded: "{rounded.media}"
    width: "100%"
---

# Design System: Commonplace / Coalition

## Overview

**Creative North Star: "Coalition storefront"**

Coalition brings shopping and group purchasing into a white storefront with precise Archivo typography, fine neutral dividers and solid indigo actions. Sourced Apple, Sony and Bose product photographs make the catalog immediately browsable; intelligent search supports product choice. Commonplace Audio is the fictional headphone merchant. Historical calculator purchases retain their dedicated checkout and recovery controls. The user-approved composition extends the incumbent neutral/indigo system.

Editable needs unfold on demand. Product evidence and a bounded buyer/merchant negotiation lead to a concise deal summary and persistent checkout, where the full payment explanation remains visible. Financial outcomes use restrained text, tabular amounts and explicit provenance. Generated product photographs are illustrations, never evidence of specifications or fulfillment.

**Key Characteristics:**

- Large product photographs, white shopping surfaces and fine neutral dividers.
- One Archivo family, tabular amounts and solid indigo actions.
- Collapsed requirements and completed negotiation history; evidence-backed eligibility and buyer-owned payment outcomes.
- Finite, reduced-motion-aware confirmation effects.

## Colors

### Primary

Solid indigo identifies primary actions and confirmed authorization positions; the deeper hover shade supplies interaction feedback.

### Secondary

Green identifies savings and completed payment confirmations. Eligibility also uses textual verdicts with green, amber and red accents so color never carries the conclusion alone.

### Neutral

Cool ink and muted supporting text sit on white shopping surfaces and pale checkout surroundings. Thin neutral borders separate browsing, evidence and consent. Warm pale-gray photographic material supports graphite products. The frontmatter preserves the incumbent palette and the reused photo fallback; local checkout and operator neutral variants remain contextual code values, not replacement tokens.

**The Evidence Color Rule.** Authorization uses indigo; confirmed payment uses green. A compatible request or full authorization count does not establish completed payment.

## Typography

Self-hosted Archivo Variable is the only font family. Prices, counts and deadlines use tabular numerals. Product identity, payment status and totals have clear size and weight differences; supporting terms and evidence remain subordinate. No serif display typography.

The shopping heading uses the responsive display role, fixed at (30px) on mobile. Selected-product headings use the storefront-title role, reducing to (25px) on mobile; catalog headings reduce from (22px) to (20px). Product tile titles reduce from (17px) to (14px). Search labels use the label role; editable requirement labels use (12px). Selected-deal prices use storefront-price; checkout status uses title, reducing to (20px) on mobile, and checkout maximum price uses price, reducing to (32px). Supporting checkout copy remains compact without making its smallest evidence labels a default for new surfaces.

**The Stable Amount Rule.** Monetary amounts remain static; only verified counts may use a number ticker.

## Layout

The storefront is browsable before a request is submitted. A centered container (1200px) with horizontal padding (28px) holds the wordmark, navigation, a left-aligned heading and wide search, then the product catalog. The search field is capped at (920px). Desktop browsing uses three columns with gaps (38px vertically, 26px horizontally); square photographs occupy most of each unboxed tile. A selected product appears above the catalog, with its large photograph beside a concise purchase column, a gap (64px), and a fine divider below. Requirements remain in a native disclosure beneath search; completed negotiation history remains beneath the selected deal.

At (700px) and below, horizontal padding becomes (16px), navigation wraps below the wordmark and demo badge, and the search action fills its own row. The catalog becomes two columns with gaps (28px vertically, 16px horizontally); the selected photograph stacks before the deal and is capped at (400px). Requirement fields become a single column. Buyer and merchant roles stay embedded in the selected-product journey.

The sole storefront is the headphone shopping journey. Old `/shop` links open it; dedicated consent and payment live at `/checkout?run=<run UUID>`.

Desktop checkout allocates 40% to the order summary and 60% to group progress and payment, using a centered container with a (22px) gap. Summary and payment surfaces have (26px) padding, reduced at narrower widths. At (700px) and below, they form one focused white surface: item, delivered price, shipping/tax, logistics, payment status, commitment positions, conditional terms, consent and payment controls, payment outcomes, latest event and evidence. Catalog browsing stays on the headphone storefront. Payment and recovery links remain in keyboard order.

## Elevation & Depth

Checkout surfaces use thin neutral borders and tonal separation rather than prominent shadows. Keep the receipt's restrained green tint subordinate to the verified payment outcome. Focus outlines remain visible on links, buttons, native disclosures and form controls.

Shopping tiles are unboxed; selected content and negotiation use dividers and pale proposal material. Visible keyboard focus uses a solid indigo outline (3px) with offset (4px). The search wrapper also changes its border to indigo on focus. Selected product photographs use an indigo outline (2px) with offset (4px).

## Shapes

Photographs and the wide search wrapper share the media radius; checkout panels retain the panel radius. Native fields, role labels, proposal rows and receipts use the smaller field radius. The compact demo badge is outlined. Numbered commitment positions are circles joined by thin connectors. Preserve these established forms rather than introducing avatars or ornamental shapes.

## Components

### Product photography and browsing

Six square studio photographs place graphite headphones on pale neutral material. `frontend/public/assets/headphones-studio.png` is a generated three-column, two-row contact sheet, displayed with CSS background size (300% 200%) and catalog positions. Each photo has an accessible illustrative-product label. Source, prompt and fictional status are recorded in `docs/photography.json`; the footer and demo disclosure retain that status. Selection outlines the photograph and scrolls to the selected-product section. Tile titles, retail price, delivery and fit evidence remain distinct from accepted group terms.

### Requirements and eligibility

The labeled search input and “Find deals” action evaluate the shopper's needs. Extracted number, date and text fields are editable inside the initially collapsed “Your requirements” disclosure. Native checkboxes explicitly relax requirements. Product tiles use text fit status and native disclosures for per-requirement rationale, sources and uncertainty; excluded products have a separate disclosure. Unknown mandatory requirements remain distinct from compatible offers. Failed or edited requests suppress previous fit and quote presentation until a current evaluation completes; failure shows a plain retry alert and the ordinary catalog. Approval locks the accepted agreement rather than silently editing its financial terms.

### Buttons and navigation

The full-width solid indigo primary control retains the incumbent rounded shape and minimum height (50px), with a deeper hover and visible focus. The search control uses a minimum height (48px desktop, 42px mobile). Secondary buttons use a neutral stroke and minimum height (42px); text actions use an underline. The Coalition wordmark accompanies “Shop,” session-owned “My purchases,” and a compact “Sandbox demo” disclosure. Mobile navigation wraps onto its own row. Purchase history uses divided rows for item, recorded payment state, amount and one checkout link. Current and historical purchases link to persistent owned checkout.

### Accepted quote and negotiation

The selected deal pairs its photograph with product/variant, merchant, static maximum per person, possible lower tier, real authorized-payment count, native progress, next-tier copy, delivery, closing time, reserved units and “Review deal.” The small demo displays ($89) at three verified authorizations and ($85) at five; these are quote data, not universal price tokens. Zero authorizations never establishes a reached tier. Browsing a different product changes the selection without moving the accepted quote or its price to that product. The lower tier remains provisional until closing; checkout retains the immutable quote, version, full tier schedule and maximum.

Buyer and merchant appear as plain bordered role labels, without agent avatars. While negotiation runs, the activity disclosure opens with both roles and a short status; buyer proposals align left and merchant proposals align right on pale neutral material. After completion it collapses into “How we got this price.” A failed negotiation remains expanded. Technical request evaluations, negotiation attempts and validation diagnostics stay in operator disclosures, separately from shopper-facing fit explanations and payment evidence.

### Commitment, consent and receipt

The compact commitment track uses anonymous backend member records and the accepted offer's capacity; larger offers use summarized progress. Each position can show authorized, approval pending, paid, pending, failed, canceled, reversed, refund pending or refunded; only the current session's position receives “You.” After closure, a separate payment progress list preserves each recorded capture/refund outcome. Numbered positions do not imply known buyer identities.

Native checkbox consent covers the exact item, seller, maximum delivered total, delivery and conditional payment terms. The main control moves through preparation, approval verification, authorized waiting, settlement and completion without changing its place in the payment surface. A failed PayPal SDK load exposes “Retry PayPal approval” and reuses the existing commitment. Guidance reflects the current payment state. Pending payments, cancellation, refunds and provider errors remain visible; a paid receipt requires completed captures for every frozen selected member and the session-owned buyer's completed payment, with no unresolved refund. Receipt rows distinguish authorized maximum, actual capture and amount not captured; unspent authorization is not described as an instantaneous bank release.

Official Magic UI Animated Beam, Number Ticker, Animated List and Blur Fade sources use the existing Motion dependency. Confirmation beams run once after verified count increases. The ticker starts at the actual backend count; payment amounts stay static. Blur Fade briefly staggers the two checkout sections and reveals a newly confirmed receipt once; it does not replay a success celebration on refresh. Latest-event animation follows a new recorded resource/status/source event, not a reconciliation timestamp alone. All motion is finite and respects reduced motion.

Activity starts with the latest recorded provider observation, with history and webhook evidence in a native disclosure. Evidence preserves fixture, API, reconciliation and webhook provenance. The tiered storefront checkout needs no extra AI step or coming-soon placeholder; optional assistance remains after payment only on the retained untiered checkout. Explicit fixture/sandbox and simulated-fulfillment disclosures remain visible.

## Do's and Don'ts

- Do derive offer amounts, counts and financial labels from backend records.
- Do distinguish compatible requests, authorized maximum, reached tier and confirmed capture.
- Do keep exact product, quote version, delivery and closing time visible before approval.
- Do preserve consent, approval and outcome controls across refresh and provider return/cancel navigation.
- Do keep payment and evidence before optional assistance in visual and keyboard order.
- Don't infer payment success from a full authorization track or a group status alone.
- Don't invent buyer activity, buyer identities or webhook provenance.
- Don't animate monetary amounts, loop confirmation effects or replay success on refresh.
- Don't introduce decorative gradients, glow, avatars or serif display typography.
