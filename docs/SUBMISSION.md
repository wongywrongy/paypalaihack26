# Submission material — working draft

Do not publish local v4 checks as hosted payment evidence. The live marketplace branch needs review/deployment and a fresh human PayPal sandbox approval before the hosted v4 flow can be claimed. EVIDENCE.md separates real provider checks, doubles and pending hosted gates.

## Project description

Rally helps a shopper buy Korean skincare across three participating fictional shops as one order in the shopper's currency. That includes a shop that ships only within Korea: the fictional Seoul hub consolidates the parcels into one international box.

The shopper chooses the products and explicitly permits older packaging and bundles. Code finds the lowest complete checkout cost and shows shipping, import assumptions and fees before payment. After the shopper approves the maximum through PayPal sandbox, Rally's buyer context and each shop's context propose executable terms. Code checks every price, commercial limit, stock change, permission and complete total. It captures the final amount, never more than the approved maximum.

The deal is visible item by item and survives refresh. Shops have scoped workspaces with their own private commercial information and an AG Grid products view. A confirmed fictional hub arrival queues a genuine sandbox payout; export tracking uses the PayPal Agent Toolkit through a durable transport. Import overestimates can be refunded; unshipped orders past their deadline are refunded. Unknown provider outcomes remain unresolved until reconciliation.

## Potential impact

Korean cosmetics exports reached a record $11.4 billion in 2025 (+11.8%), with the United States the top destination at $2.2 billion (+15%), according to Ministry of Food and Drug Safety data reported by [Korea JoongAng Daily](https://www.koreajoongangdaily.com/business/korea-surpasses-us-in-cosmetics-exports-with-record-114-billion/12713991). Small businesses carry a growing share: SME online exports hit a quarterly record of $300 million in Q1 2026 (+38.2%), about two thirds of it cosmetics (+74.2%), per the Ministry of SMEs and Startups via [Korea JoongAng Daily](https://www.koreajoongangdaily.com/business/online-exports-of-smes-surpass-300m-in-q1-on-cosmetics/12522634). Since the US suspended duty-free de minimis treatment for all countries on August 29, 2025 ([CBP guidance summary](https://kpmg.com/us/en/taxnewsflash/news/2025/08/us-cbp-implements-eo-suspending-duty-free-de-minimis-treatment.html)), every separate parcel from a separate shop can bring its own duty and fees.

Rally addresses both sides of that gap. Shoppers get one checkout across shops, one box, duties paid up front and a total that can only go down after PayPal authorizes it. Shops, including ones that ship only within Korea, reach buyers abroad without building export logistics, keep their floors private, steer an agent in plain words, and are paid by PayPal payouts as soon as they hand off. The same pattern, a PayPal hold as a hard ceiling with competing merchant agents underneath, applies to any multi-merchant cross-border cart.

Within the product we show only what each order establishes: the shops in the box, what the shopper did not pay compared with the hold, and the shop's payout. We have not measured customer savings at scale, environmental benefit or social impact, and do not guarantee a discount.

## What we built with

React/TypeScript, FastAPI, one worker with independent AI/payment/deadline capacity, the existing PostgreSQL database, and the existing paid Render services. One configured model adapter supplies separate buyer/shop proposal contexts; the models receive no payment tools or private floors/costs. PayPal sandbox handles human approval, authorization, final capture, void, refunds and shop payouts. PayPal Agent Toolkit supplies shipment tracking; AG Grid supports the private products view.

## Honest simulation disclosure

The shops, brands, products, starting inventory, hub, parcels and delivery are fictional. Listing edits, applied goals and inventory reservations/depletion are real persisted application state, not physical stock. FX, freight and import charges are complete dated scenario assumptions, not live customs or exchange-rate calculations. Rally absorbs cost overruns within the approved fictional terms; overestimates may be refunded. No real cosmetics are shipped. PayPal sandbox uses test money, not live-money escrow or a platform wallet.

Production payment status comes from the durable provider ledger and verified/reconciled webhooks, never from a model, animation or browser callback. Recorded events and injected provider/model doubles are test evidence only. The static Rootlane review cannot establish a connected payment or live model decision.

## Verification paragraph — update before publishing

G1 genuinely verified USD/CAD sandbox authorizations and final captures, a void, completed refund, a successful shop payout and recovery/re-verification of an original signed webhook. Local application contracts pass against PostgreSQL and actual rendered browser journeys were exercised with provider/model doubles. The synthetic 500-bag fixture benchmark completed 497 supported cases, with no C/D ceiling or shop-authority violations; the two-model baseline was not run. Do not describe that artifact as the hosted-model benchmark. EVIDENCE.md contains exact dates, source commits and provider provenance.

## Private testing notes checklist

Provide the working Render URL, a Personal PayPal sandbox buyer login, and the **Haneul-only judge writer password** privately in the submission’s testing notes. The environment name is `RALLY_JUDGE_WRITER_PASSWORD`; its value must never appear in this repository, public README, video or chat. Retain `RALLY_JUDGE_PASSWORD` for read-only access to Bada and Dalbit. Never share other shop writers’ passwords, the hub password, API keys, OAuth tokens or database credentials.

Use one browser window. Follow README's five steps from Rally for shops Home: edit cream's lowest price, review and Apply a goal, open the storefront and approve PayPal, then hand off Haneul's winning parcel from the receipt. Existing quotes stay frozen. Reset to launch settings is audited and respects active reservations. Judges cannot use payment recovery or hand off another shop’s parcel.

Owner configuration on the **existing** Render resources: Bitdeer endpoint/key/model role ids and response format on web and worker; `RALLY_JUDGE_WRITER_PASSWORD` on web; `CHANNEL3_API_KEY` on worker for daily refresh. `RALLY_AUTO_FULFILLMENT=1` is optional and advances hub logistics only after all winning shops explicitly hand off. Without it, the private hub writer records hub steps. Do not change services, PayPal/DNS configuration or historical data as part of testing.

Channel3 references are real searches over comparable products; only reliable medians are shown. A successful October 30 refresh produced 13 raw aggregates but zero qualifying medians under the required filter. This is not a claim that all cards show live prices. Bitdeer compilation/auction checks and hosted money movement have separate evidence entries.

## Owner-only publishing

The agent can prepare the writeup, verify links and produce browser footage. The owner supplies private model/account configuration, explicitly approves each sandbox purchase, chooses the final public video upload/account and publishes the Devpost entry. Do not publish private credentials or an incomplete gate as verified.
