# Existing Render resources

Use the owner's existing **My Workspace** (`tea-db2o5549v7es739kq290`). Discovery on October 23, 2026 confirmed exactly these project resources in Virginia:

| Resource | Existing ID | Current capacity | Dashboard |
| --- | --- | --- | --- |
| Web service: paypalaihack26 | `srv-db2o862jnfac73fdj5ng` | Docker, one instance, `0.5c-512mb` | [Web service](https://dashboard.render.com/web/srv-db2o862jnfac73fdj5ng) |
| Background worker: paypalaihack26 | `srv-db2p3949v7es739oet90` | Docker, one instance, `0.5c-512mb` | [Worker](https://dashboard.render.com/worker/srv-db2p3949v7es739oet90) |
| Postgres: paypalaihacks26 | `dpg-db2oad2jnfac73fdqq10-a` | PostgreSQL 18, `0.1c-256mb`, 10 GB, no replicas or HA, storage autoscaling off | [Database](https://dashboard.render.com/d/dpg-db2oad2jnfac73fdqq10-a) |

No resource was created, renamed, restarted, resized or redeployed during this inspection. No plan, storage, region, replica, scaling or billing setting changed. Deploys consume pipeline minutes, so the unchanged recurring plans do not imply every future deploy is free.

Both services follow `main`, have commit-triggered auto-deploy enabled, and run commit `4561bf3b1b44d6021eea8019f6c935100f4cb229`. The web service uses the Docker image's default command; the worker overrides it with `python -m coalition.worker`. The public address remains https://paypalaihack26.onrender.com. The database contains Coalition's `public` tables and no `rally` schema.

## Preserve the existing stack

The former root `render.yaml` was an unbound provisioning template with different names, Python runtimes, PostgreSQL 16 and an additional static storefront. It did not describe the actual paid resources. It is retained only as `docs/archive/render-retired.yaml`; **do not apply it** or create another Blueprint. The current Dockerfile already bundles the frontend with FastAPI.

Both services currently share the same display name. Render Blueprints require unique resource names, so importing them by name is unsafe without reviewing an explicit adoption/rename proposal. Operate on the confirmed IDs above. The installed MCP tools can inspect services, query Postgres read-only, merge environment variables and trigger deploys; they cannot edit linked branches or Docker commands. Those changes need the existing service's Dashboard settings or an authorized Render API request. Do not create replacements to work around this limitation.

## Prepared cutover without Dashboard changes

A tested compatibility launcher now lets the existing `python -m coalition.worker` command initialize Rally's additive schema and run `rally.worker`. No retired purchasing routes are restored. The existing main branch and Docker override can stay. Promoting the verified Rally tree to main preserves both Git histories and automatically deploys the two existing services; no force push, new Blueprint or extra resource is needed.

The original public schema has seven commitments, five payment operations and one unknown order without a provider ID. Before release, the consent/provider-reference digest is `5b99b2d5e6d99f2d560118c82ed124d9`. Verify it after cutover; do not rewrite or retry those operations. A read-only PayPal lookup for the October 7 request returned 403 NOT_AUTHORIZED, so the original outcome remains unresolved.

The exact private configuration merge is limited to the project PayPal app/merchant/webhook keys, Rally mode/schema, existing public URL, review harness disabled, scheduled fulfillment off, and generated workspace passwords on the web service only. The database URL, unrelated variables, LLM settings and any configured named shop recipients are preserved. No local model endpoint or local database URL is copied to Render.

The installed MCP environment-update tool **automatically triggers a deploy** after merging. The first attempt was rejected by automatic approval review and made no change; explicit approval for that secret-bearing transfer and live promotion is pending. Once approved, record and monitor each resulting deploy instead of triggering duplicates. Confirm Rally health, catalog/session, shared schema and worker processing, owned legacy receipts/recovery, and direct signature-verified webhooks. The existing TCP health check remains valid; the Docker API command now uses exec for shutdown forwarding.

Private hosted-model settings and the three sandbox shop recipients are still required for the genuine model/payout gates. Deploying an app with its honest outage fallback does not establish G3/G4/G5. [Owner actions](ACTIONS.md) now separate those missing inputs from work the agent can perform.

The G1 success uses an explicitly approved **recovery replay** of the original signed CAD webhook from Render into the local Rally handler and worker. PayPal signature verification and resource reconciliation succeeded. That evidence does not establish any of the hosted cutover checks above.

References: [Render MCP capabilities](https://render.com/docs/mcp-server), [existing Blueprint resource adoption](https://render.com/docs/infrastructure-as-code#adding-an-existing-resource), [unique Blueprint names](https://render.com/docs/blueprint-spec#name), [deploy behavior](https://render.com/docs/deploys).
