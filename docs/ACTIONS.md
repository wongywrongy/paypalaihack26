# Kyle's remaining actions

The latest plan is **Rally v2 (October 22)**. Implementation and local verification are complete; hosted gates still need private configuration, reviewed deployment and human approvals. No new Render resources, plans or recurring capacity are needed.

## 1. Supply the private model and shop configuration

In `/home/kyle/code/paypalaihack26/.env`, set the hosted provider's `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_PROTOCOL`. The current endpoint is local and has not passed a connected model check. Use the endpoint's base URL, before `/v1/chat/completions` or `/v1/messages`. Do not paste keys into chat.

Set `PAYPAL_SHOP_EMAIL_DALBIT`, `PAYPAL_SHOP_EMAIL_BADA`, `PAYPAL_SHOP_EMAIL_HANEUL` to the three receiving sandbox business accounts. They must differ from Rally's sending account. The older `PAYPAL_SHOP_EMAIL` was only the G1 probe recipient and does not configure these shops. Confirm Payouts is enabled and the sending sandbox account has USD funds.

Strong shop, hub and read-only judge passwords have already been generated privately in the root `.env` (existing values were preserved). The agent can transfer the intended settings privately to the **two existing Render services**, preserving unrelated variables and the hosted database URL. Workspace passwords are needed only on the web service; payment configuration is shared. A pending explicit approval covers this transfer because the Render MCP also triggers a deploy. Never put server passwords or keys in `VITE_*` variables. Set `PUBLIC_URL=https://paypalaihack26.onrender.com`, `RALLY_MODE=connected`, `RALLY_DATABASE_SCHEMA=rally`; leave `VITE_RALLY_TEST_HARNESS` unset. The public PayPal client ID is intentionally supplied by the API; its secret remains server-side.

Keep scheduled fulfillment off initially. After the genuine manual handoff/payout/tracking checks pass, review enabling `RALLY_AUTO_FULFILLMENT=1`: it records fictional arrivals/export/delivery after approximately 1/2/4 minutes, enqueues genuine sandbox payouts/tracking, and waits for confirmed funding/payouts. It neither ships cosmetics nor moves real money.

## 2. Approve the agent-managed existing-service cutover

The release now includes a minimal `coalition.worker` startup compatibility module. It initializes the separate Rally schema, then runs only `rally.worker`; it does not restore the retired app. Both paid services can retain their existing **main** branch and Docker settings. The agent can promote the verified Rally tree to main, preserving both Git histories and using a normal non-force push. No Dashboard branch/command edit is required.

The Render environment-update tool merges keys but also triggers a deploy. Automatic approval review rejected the first private configuration transfer because that exact secret-bearing mutation/deploy had not been explicitly approved; neither service changed. The pending approval covers merging the intended project keys into the two existing services and promoting the tested release. The same resource IDs, plans, regions, instance counts, database and URLs remain in place. Only additive Rally-schema migrations run; original public tables remain untouched. The agent will monitor deploy IDs, verify app/worker/database behavior and compare the historical consent digest before and after.

The current TCP health check can remain; `/api/health` and real catalog/session requests are verified after deployment. The web image uses exec to pass shutdown signals. Scheduled fictional fulfillment stays off. PayPal's existing webhook URL remains unchanged. CAD/GBP/EUR/AUD acceptance and the missing model/shop configuration still require valid account settings.

One original Coalition order operation remains unknown without a provider ID. The agent inspected its exact request time and attempted a read-only provider activity lookup; PayPal returned 403 NOT_AUTHORIZED. Review the original October 7, 00:50 UTC request against sandbox activity before considering it resolved. Do not resend it, mark it failed without evidence or delete it. Owned legacy receipts and read-only recovery metadata remain implemented.

## 3. Complete human PayPal approvals with me

After configuration and deployment, tell me they are ready. I can run model checks, inspect the existing deployments/worker, verify a newly delivered signed webhook, execute the no-payment connected benchmark and reconcile provider results. Do not rerun the historical G1 lifecycle just to obtain new evidence.

You must explicitly approve each new shopper order in the real PayPal sandbox UI with a personal buyer. Use [the connected demo procedure](DEMO.md#connected-judge-journey). Start with USD, then fresh-browser CAD/GBP/EUR/AUD checks. A callback or screenshot is insufficient: we must confirm actual authorizations, captures, refunds/payouts/tracking and webhook processing in the ledger/provider before closing G3/G4/G5.

## 4. Submit only after those gates pass

The agent has prepared [submission text](SUBMISSION.md) and a [timed video script](VIDEO.md). Record/upload a public YouTube video under three minutes using the actual outcome (agents may retain checkout terms). Put the hosted URL, sandbox buyer logins per currency and the **read-only judge** shop password in Devpost's private testing notes. Keep writer/hub passwords and API secrets out. Include the public repository/license and the README's simulation disclosure; do not describe fixture benchmark results as live-model evidence or measured customer impact.

No owner action is needed for local builds, PostgreSQL contracts, frontend wiring, screenshots or recovery implementation: those are completed in this change. Native-device/screen-reader checks and genuine hosted gates remain unexecuted.
