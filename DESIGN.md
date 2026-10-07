---
name: Commonplace / Coalition
description: Evidence-backed group purchasing in the incumbent merchant and checkout system.
colors:
  indigo: "#4338ca"
  indigo-hover: "#352aa8"
  green: "#247154"
  ink: "#202431"
  muted: "#626977"
  ground: "#f7f8fa"
  surface: "#fff"
  line: "#e0e3e9"
typography:
  display:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "clamp(25px, 3vw, 34px)"
    fontWeight: 400
    letterSpacing: "-.025em"
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
    lineHeight: 1.55
  label:
    fontFamily: '"Archivo Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 600
rounded:
  field: "6px"
  panel: "10px"
spacing:
  field-gap: "12px"
  panel-mobile: "20px"
  panel: "24px"
  checkout-panel: "26px"
  request-gap: "28px"
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
---

# Commonplace / Coalition

## Overview

**Creative North Star: "Commonplace / Coalition Operate"**

The incumbent system uses cool off-white surroundings, white surfaces, precise Archivo typography and solid indigo actions. Coalition is the request-first purchase identity; Commonplace Audio is the fictional headphone merchant. The retained Commonplace Supply calculator storefront remains a regression surface. This is a code-led extension of the existing system, following the user's direction without an approved image comp, FORM roll or a new visual world.

Editable needs, product evidence and a bounded buyer/merchant negotiation lead to a fixed quote and persistent checkout. Financial outcomes use restrained text, tabular amounts and explicit provenance rather than speculative payment animation.

**Key Characteristics:**

- White bordered panels on a cool neutral ground.
- One Archivo family, tabular amounts and solid indigo actions.
- Evidence-backed eligibility, stable quote amounts and buyer-owned payment outcomes.
- Finite, reduced-motion-aware confirmation effects.

## Colors

### Primary

Solid indigo identifies primary actions and confirmed authorization positions; the deeper hover shade supplies interaction feedback.

### Secondary

Green identifies savings and completed payment confirmations. Eligibility also uses textual verdicts with green, amber and red accents so color never carries the conclusion alone.

### Neutral

Cool ink and muted supporting text sit on off-white ground and white surfaces. Thin neutral borders separate evidence and consent without decorative gradients or glow. The frontmatter preserves the incumbent palette; local request-surface neutral variants are existing code drift, not replacement tokens.

**The Evidence Color Rule.** Authorization uses indigo; confirmed payment uses green. A compatible request or full authorization count does not establish completed payment.

## Typography

Self-hosted Archivo Variable is the only font family. Prices, counts and deadlines use tabular numerals. Product identity, payment status and totals have clear size and weight differences; supporting terms and evidence remain subordinate. No serif display typography.

The request heading uses the responsive display role. Request section headings use (20px), offer titles (18px), and body and editable field labels use the body and label roles. Checkout status uses the title role; its mobile heading reduces to (20px). Checkout maximum price uses the price role, reducing to (32px) on mobile; the accepted-quote maximum is (30px). Supporting checkout copy is compact and should remain subordinate without inheriting its smallest evidence labels into new surfaces.

**The Stable Amount Rule.** Monetary amounts remain static; only verified counts may use a number ticker.

## Layout

The request surface leads with editable requirements and supplied headphone eligibility. A centered container (1140px) has horizontal padding (28px); desktop uses a narrower requirements column and a wider offer/negotiation column with a gap (28px). At (700px) and below, panels stack, main horizontal padding becomes (16px), and panel padding reduces from (24px) to (20px). An accepted quote precedes eligibility details and negotiation history in its column. Buyer and merchant roles stay embedded in this journey.

The retained storefront keeps its product gallery and ordinary demo purchase controls alongside a compact Coalition widget. The widget shows backend price, savings, confirmed count and one checkout link; full consent and payment live at `/checkout?run=<run UUID>`.

Desktop checkout allocates 40% to the order summary and 60% to group progress and payment, using a centered container with a (22px) gap. Summary and payment surfaces have (26px) padding, reduced at narrower widths. At (700px) and below, they form one focused white surface: item, delivered price, shipping/tax, logistics, payment status, commitment positions, conditional terms, consent and payment controls, payment outcomes, latest event and evidence, then optional assistance. Catalog browsing stays on the merchant page. The assistant follows payment in both DOM and visual keyboard order.

## Elevation & Depth

Checkout and merchant widget surfaces use thin neutral borders and tonal separation rather than prominent shadows. Keep the receipt's restrained green tint subordinate to the verified payment outcome. Focus outlines remain visible on links, buttons, native disclosures and form controls.

Request and negotiation panels share the flat bordered treatment. The incumbent ambient shadow is reserved for floating search and bag surfaces. Request focus uses a solid indigo outline (2px) with offset (3px); incumbent checkout focus uses (3px) with offset (4px).

## Shapes

White request, negotiation, checkout and merchant-widget surfaces share gently rounded panel corners. Native fields, tier strips, proposal rows and receipts use the smaller field radius. Numbered commitment positions are circles joined by thin connectors. Preserve these established forms rather than introducing avatars or ornamental shapes.

## Components

### Requirements and eligibility

Native textarea, number, date and text fields expose the extracted requirements for editing. Native checkboxes explicitly relax requirements. Compatible offers are divided rows with a radio selector, text status and native disclosure for per-requirement rationale, sources and uncertainty. Unknown mandatory requirements remain distinct from compatible offers. Approval locks the accepted agreement rather than silently editing its financial terms.

### Buttons and navigation

The full-width solid indigo primary control retains the incumbent rounded shape and minimum height (50px), with a deeper hover and visible focus. Secondary buttons use a neutral stroke and minimum height (42px); text actions use an underline. The request header provides simple text navigation; mobile navigation stacks. The merchant widget links to persistent checkout, with labels for joining, viewing the buyer's checkout or viewing group progress.

### Accepted quote and negotiation

The quote panel shows version, exact product/variant, merchant, reserved inventory and maximum authorization before a bordered tier strip. Separate count labels distinguish compatible requests from authorized payments; native progress and explicit next-tier copy follow. The small demo displays ($89) at three verified authorizations and ($85) at five; these are quote data, not universal price tokens. Delivery and fixed closing time remain inspectable. The lower tier remains provisional until closing; checkout retains the immutable accepted quote and maximum.

Buyer and merchant appear as plain bordered role labels, without agent avatars. Buyer proposals align left; merchant proposals align right on pale neutral material. Public summaries stay in the embedded negotiation panel; failures provide an edit-request action. Operator disclosures preserve request evaluations, negotiation attempts and validation evidence separately from payment evidence.

### Commitment, consent and receipt

The compact commitment track uses anonymous backend member records and the accepted offer's capacity; larger offers use summarized progress. Each position can show authorized, approval pending, paid, pending, failed, canceled, reversed, refund pending or refunded; only the current session's position receives “You.” After closure, a separate payment progress list preserves each recorded capture/refund outcome. Numbered positions do not imply known buyer identities.

Native checkbox consent covers the exact item, seller, maximum delivered total, delivery and conditional payment terms. The main control moves through preparation, approval verification, authorized waiting, settlement and completion without changing its place in the payment surface. A failed PayPal SDK load exposes “Retry PayPal approval” and reuses the existing commitment. Guidance reflects the current payment state. Pending payments, cancellation, refunds and provider errors remain visible; a paid receipt requires completed captures for every frozen selected member and the session-owned buyer's completed payment, with no unresolved refund. Receipt rows distinguish authorized maximum, actual capture and amount not captured; unspent authorization is not described as an instantaneous bank release.

Official Magic UI Animated Beam, Number Ticker, Animated List and Blur Fade sources use the existing Motion dependency. Confirmation beams run once after verified count increases. The ticker starts at the actual backend count; payment amounts stay static. Blur Fade briefly staggers the two checkout sections and reveals a newly confirmed receipt once; it does not replay a success celebration on refresh. Latest-event animation follows a new recorded resource/status/source event, not a reconciliation timestamp alone. All motion is finite and respects reduced motion.

Activity starts with the latest recorded provider observation, with history and webhook evidence in a native disclosure. Evidence preserves fixture, API, reconciliation and webhook provenance. The request-first tiered checkout needs no extra AI step or coming-soon placeholder; optional assistance remains after payment only on the retained untiered checkout. Explicit fixture/sandbox and simulated-fulfillment disclosures remain visible.

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
