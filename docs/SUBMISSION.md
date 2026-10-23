# Submission material — working draft

Do not publish this as completed provider evidence yet. G3/G4/G5 still require the deployed hosted model, new human sandbox approvals and provider-confirmed results. Replace the verification paragraph with the final executed evidence before submission.

## Project description

Rally helps a shopper buy Korean skincare across three participating fictional shops as one order in the shopper's currency. That includes a shop that ships only within Korea: the fictional Seoul hub consolidates the parcels into one international box.

The shopper chooses the products and explicitly permits any older-packaging swap or small extra. Code finds the lowest complete checkout cost and shows shipping, import assumptions and fees before payment. After the shopper approves the maximum through PayPal sandbox, Rally's buyer context and each shop's context propose executable terms. Code checks every price, commercial limit, stock change, permission and complete total. It captures the final amount, never more than the approved maximum.

The deal is visible item by item and survives refresh. Shops have scoped workspaces with their own private commercial information and an AG Grid products view. A confirmed fictional hub arrival queues a genuine sandbox payout; export tracking uses the PayPal Agent Toolkit through a durable transport. Import overestimates can be refunded; unshipped orders past their deadline are refunded. Unknown provider outcomes remain unresolved until reconciliation.

The intended benefit is simpler cross-shop purchasing with a visible complete price and fewer separate parcels to organize. We have not measured customer savings, environmental benefit or social impact, and do not guarantee a discount.

## What we built with

React/TypeScript, FastAPI, one worker with independent AI/payment/deadline capacity, the existing PostgreSQL database, and the existing paid Render services. One configured model adapter supplies separate buyer/shop proposal contexts; the models receive no payment tools or private floors/costs. PayPal sandbox handles human approval, authorization, final capture, void, refunds and shop payouts. PayPal Agent Toolkit supplies shipment tracking; AG Grid supports the private products view.

## Honest simulation disclosure

The shops, brands, products, stock, commercial policies, hub, parcels and delivery are fictional. FX, freight and import charges are complete dated scenario assumptions, not live customs or exchange-rate calculations. Rally absorbs cost overruns within the approved fictional terms; overestimates may be refunded. No real cosmetics are shipped. PayPal sandbox uses test money, not live-money escrow or a platform wallet.

Production payment status comes from the durable provider ledger and verified/reconciled webhooks, never from a model, animation or browser callback. Recorded events and injected provider/model doubles are test evidence only. The static Rootlane review cannot establish a connected payment or live model decision.

## Verification paragraph — update before publishing

G1 genuinely verified USD/CAD sandbox authorizations and final captures, a void, completed refund, a successful shop payout and recovery/re-verification of an original signed webhook. Local application contracts pass against PostgreSQL and actual rendered browser journeys were exercised with provider/model doubles. The synthetic 500-bag fixture benchmark completed 497 supported cases, with no C/D ceiling or shop-authority violations; the two-model baseline was not run. Do not describe that artifact as the hosted-model benchmark. EVIDENCE.md contains exact dates, source commits and provider provenance.

## Private testing notes checklist

Provide only the final working Render URL, personal sandbox buyer logins for each currency, and the read-only judge shop password. Never provide writer/hub passwords, server API keys, OAuth tokens or database credentials. No sign-up is needed to browse. Explain that Test mode is intentional. Include how to reset the bag without deleting receipts, and where to see the persisted deal and order history.

## Owner-only publishing

The agent can prepare the writeup, verify links and produce browser footage. The owner supplies private model/account configuration, explicitly approves each sandbox purchase, chooses the final public video upload/account and publishes the Devpost entry. Do not publish private credentials or an incomplete gate as verified.
