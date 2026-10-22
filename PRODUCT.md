# Rally
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
React, TypeScript, Vite, existing Magic UI pieces, AG Grid (organizer sheet only); FastAPI; PostgreSQL; one worker; OR-Tools CP-SAT; hosted LLM through a structured-output adapter; PayPal sandbox (Orders v2 authorize/capture/void/refund, Payouts, Agent Toolkit for tracking). Render hosting.
## Users
Members of a community group order (friends, a club, an online group) buying Korean skincare from one overseas shop; the organizer who used to run it in a group chat and a spreadsheet; the shop; hackathon judges.
## Product Purpose
Turn a group-chat order into one negotiated, prepaid group order. Each member says what they want and their max, approves a PayPal hold, and agents negotiate the whole order with the shop. Everyone pays their max or less; the shop is paid when it ships.
## Capabilities and Constraints
One fictional shop (Haneul Beauty, Seoul) and product line (Dalbit): snail essence (new and old bottle), rice toner, cica sheet masks, a free sample kit. USD only. Prices include shared shipping, a 12.5% duty estimate, a customs fee share and estimated tax. The max is a hard ceiling enforced in code. Terms traded: item prices, old-bottle swaps, shipping option, extras. At most 3 rounds and one question per member. Seeded demo: 10 members; a judge joins as the 10th.
## Brand Commitments
Rally feels like a calm, product-led shopping app, not a fintech dashboard. Products and photos lead; one big number per screen. Warm off-white ground, near-black ink, one berry accent for actions, butter only for "your rule was applied", mint only for savings. Schibsted Grotesk for text, IBM Plex Mono for money. Fictional brands only; no real brand names or logos anywhere.
## Product Principles
Plain words: max, hold, charged, old bottle. Never mandate, utility, authorization, walk-away or round in member copy. One primary action per screen. Bargaining detail is one tap away, never on the main path. Every question has a safe default. Distinguish hold, charge, release and refund clearly. Show estimates as estimates.
Member screens are designed for a quick, daylight phone session at 390 px. The main question changes with each step: what am I joining, what is in my order, what is my limit, what changed, what is my choice, what do I pay, and what happens next. The deal room serves an organizer or curious member on desktop and phone.
The design milestone is an explicitly labeled example from the scenario fixture. Previewing a hold moves no money. Only a confirmed payment result may be described as a real charge once the API is connected.
## Accessibility & Inclusion
Contrast at least 4.5:1, touch targets at least 44 px, real buttons, links and labels, visible focus, keyboard access, reduced motion respected. Motion limited to the final price counting up and a calm progress bar.
## Delegated Decisions
Product imagery: replace the mockup illustrations with unbranded product photography or checked renders labeled Dalbit. Exact type scale, spacing and component details are open to refinement within the palette and type choices above; do not add a second accent.
