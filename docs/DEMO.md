# Coalition five-buyer sandbox demonstration

## Prerequisites and current blockers

Use the existing React/API/single-worker/PostgreSQL deployment. This revision has not been deployed during this review. An authorized operator must make the API and worker run the same revision, with the configured real model, `COALITION_MODE=connected`, sandbox app credentials, `PAYPAL_MERCHANT_ID`, and the webhook registration belonging to that app. Preserve the database and apply additive migrations. Never reset payment history.

The local merchant ID is missing; the existing local operator token was rejected by Render. App OAuth and registration retrieval succeeded, but neither proves webhook delivery. Five distinct sandbox payer accounts and five human PayPal approvals are required. Keep passwords and operator tokens out of chat, logs and recordings. The buyer approves on PayPal's sandbox surface; Coalition never collects credentials.

## Reproducible procedure

1. Open `/operator` with the deployed private operator token. Prepare **small**, successful scenario, with a 1,800-second closing window. Generate the five protected preparation links. Open each in a separate browser profile; keep the fragment invitation intact until the session is created. Ordinary shopping at `/` needs no operator preparation.
2. Wait for all five real model evaluations. Maya requests noise cancellation, iPhone, under $100 and seven days; Leo requests noise cancellation, maximum $92 and eight days; Aisha requests Bluetooth, iPhone, under $95 and nine days; Noah requests noise cancellation, under $120 and seven days; Sam requests iPhone, under $90 and ten days. These are simulated requirements, not funding.
3. In Sam's profile, inspect **Sony WH-CH720N** and negotiate. Review the actual structured exchanges and accepted product, variant, maximum, USD currency, delivery, closing time and quantity tiers. The October 8 real-product five-person model check yielded **$89/$88** with no authorizations. An earlier fictional-product model check observed $89/$85; neither result guarantees another quote. Agents can choose another permitted agreement or decline; never overwrite an accepted agreement to obtain this result. For the exact $89/$85 evidence gate, proceed only when those are the observed immutable terms; otherwise preserve the run and negotiate a fresh run with explicitly revised requirements.
4. In Maya, Leo, Aisha and Noah's profiles, review the same quote and consent checkbox, choose PayPal approval, sign in as four **different sandbox payer accounts**, and approve the displayed $89 maximum. Return to Coalition and wait for each provider-confirmed authorization. No timer, persona, model acceptance or PayPal button click alone increases the funding count.
5. Leave Sam's fifth profile for the judge. The judge can inspect the request and photograph, review immutable terms, consent and approve $89 using the fifth sandbox payer account. Activate the operator run if required; activation does not change the accepted closing time. Show five confirmed authorizations and the $85 tier.
6. Wait for the actual closing deadline. Every selected $85 final capture must be confirmed before success. In operator controls, inspect the five operations, signature-verified **processed** app webhook and separately labeled API/reconciliation observations. Inspect the provider's actual remaining authorization state. Do not assume a separate void event after final partial capture or promise immediate bank hold release.
7. Refresh Sam's receipt and purchase history. An authorized operator can restart the existing worker process, then refresh again and confirm identical receipt and logical operation IDs. **Find another deal** must preserve this purchase while allowing a different product request.
8. Prepare a separate small run with fewer than three genuine approvals. Cancel before capture using operator **Cancel**, or have a buyer leave and let the below-minimum group close. Wait for provider-confirmed `VOIDED` on the authorization; cancellation requested/pending is not proof. Retain its run ID.
9. On the completed five-buyer run, use explicit operator **Refund cleanup**. Wait for actual refunds to complete; pending refunds remain unresolved. This refunds all completed demo captures rather than leaving other sandbox obligations behind. Retain the completed/refunded and cancellation run IDs.
10. With server-side access to the same database and private connected environment, run the read-only gate:

    ```bash
    PYTHONPATH=backend .venv/bin/python scripts/check_connected.py SUCCESS_RUN_ID VOID_RUN_ID
    ```

    Save its redacted output in the verification record. It requires five distinct payers, $89/$85 provider resources, confirmed refund cleanup, a separate void, processed verified app webhook and live eligibility/exclusion. Do not substitute mocked payloads. If the provider returns pending or an unknown outcome, show that state and reconcile before retrying.

## Independent judge shopping

Open `/` in a fresh profile, browse or submit “Headphones under $100,” answer the delivery question, inspect matching products and negotiate. Editable chips preserve the request and completed answers. A compatible open group can be joined; otherwise a new bounded draft is negotiated. Closed, canceled, settled and unavailable deals offer another search. Previously approved terms remain attached to the original purchase.

## Fixture demonstration and recording

Fixture mode simulates both AI and provider resources and labels them accordingly. Its four prepared approvals plus Sam demonstrate application behavior only. Current desktop/mobile tests exercised the real API, worker, PostgreSQL, 90-second deadline, five-member $85 capture, refresh, cancellation and repeat shopping; saved receipts also survived an actual isolated worker/API restart.

For a short recording, show request/clarification and product (30 seconds), actual negotiation and terms (30 seconds), disclosed four earlier genuine approvals plus the judge's fifth approval (60 seconds), then the verified receipt and cancellation/refund evidence (60 seconds). Use observed timing; label time cuts or prerecorded evidence. A pending resource must stay pending on screen. Genuine connected acceptance remains incomplete until the approval and lifecycle gates above pass.
