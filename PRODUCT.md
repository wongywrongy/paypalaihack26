# Rally
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
React, TypeScript, Vite, existing Magic UI pieces, AG Grid (Rally for shops products grid only); FastAPI; PostgreSQL; one worker; exact search for sourcing (no solver dependency); hosted LLM through a structured-output adapter; PayPal sandbox (Orders v2 authorize/capture/void/refund, Payouts, Agent Toolkit for tracking). Render hosting.
## Users
Shoppers outside Korea who love Korean skincare and want it from Korean shops without the hassle: foreign cards failing, Korean-only checkout, shops that don't ship abroad, fees at the door. Korean shops that want overseas sales without handling export; they use Rally for shops, a desktop dashboard. Hackathon judges, who play the whole flow alone in about 90 seconds.
## Product Purpose
Buy Korean skincare from several Korean shops as one box, with one all-in price in your own currency, duty and tax prepaid, paid with PayPal. An agent builds the routine, picks the cheapest shop for each item and bargains with each shop's agent after checkout. PayPal holds the checkout price; you are charged that or less.
## Capabilities and Constraints
3 fictional shops: Haneul Beauty (Seoul, multi-brand, ships abroad), Bada Market (Busan drugstore, ships inside Korea only), Dalbit Official (Seoul brand store, ships abroad). About 30 products from 6 fictional brands. 5 destinations: US (USD), Canada (CAD), UK (GBP), Germany (EUR), Australia (AUD). Prices include shipping inside Korea, shipping to you, duty, import tax and a small Rally fee. The hold is a hard ceiling enforced in code. Terms traded: unit price, older packaging, bundle discount, free sample kit, free shipping inside Korea (including a small add-on). Two shopper rules on the bag; no questions during the deal. At most 3 replies per shop; the deal finishes in under 30 seconds.
## Brand Commitments
Rally feels like a calm, product-led shopping app, not a fintech dashboard. Products and photos lead; one big number per screen. Warm off-white ground, near-black ink, one berry accent for actions, butter only for "your rule was applied", mint only for savings. Schibsted Grotesk for text, IBM Plex Mono for money. Fictional shops and brands only; no real brand names or logos anywhere.
## Product Principles
It is a real product. Real shopping words: Bag, Checkout, Pay with PayPal, hold, charged, order number, Track order, older packaging, ships inside Korea. Never "Example", "preview", "fixture", "simulated" or "demo" in the UI; the only sandbox marker is a small "Test mode" pill. Never mandate, utility, authorization, floor or round in shopper copy.
One primary action per screen. The deal is part of the process, not a page to read: right after PayPal approves, the shopper watches each shop's price meet Rally's offer and the total count down. No explainer pages; how it works is told in the README, Devpost and video. Distinguish hold, charge, release and refund clearly. Show the all-in price before payment and nothing due at the door after.
Shopper screens are designed for a quick phone session at 390 px. Each screen answers one question: what can I buy, what does it cost where I live, what should I use, what am I paying, how is the deal going, what did I pay, where is my box. Rally for shops shows the same deal from the shop's side on desktop, with its private lowest prices, the messages and the payout.
## Accessibility & Inclusion
Contrast at least 4.5:1, touch targets at least 44 px, real buttons, links and labels, visible focus, keyboard access, reduced motion respected. Motion limited to the live deal: price markers sliding, agreed tracks turning mint, the total counting down; reduced motion shows each state without movement.
## Delegated Decisions
Product imagery: replace the mockup illustrations with about 30 product images in one art direction, unbranded containers with fictional labels. Exact type scale, spacing and component details are open to refinement within the palette and type choices above; do not add a second accent.
