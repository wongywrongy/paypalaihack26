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

## Cutover gates and proposed changes

This is a review checklist, not an applied release or a ready connected product. M2/M3 must first provide the real engine, checkout and server-side shopper authentication.

1. Preserve the legacy public tables, receipts and recovery access. The audit found seven historical commitments, four completed order operations and **one unknown order operation**, with no authorization/capture recorded on those commitments. Unknown is not confirmed failure. Reconcile it against provider records before retiring its recovery path; do not resend the order or discard it. The original Coalition code and deployed worker remain available meanwhile.
2. Confirm rollback compatibility and a current backup using the existing database's supported recovery facilities. Do not create a replica, new database instance or larger plan. Apply only Rally's additive migrations in its dedicated `rally` schema, preserving `public`. The G1 ledger is local and is not automatically present in Render: do not point the G1 script at an empty database and repeat its payment operations.
3. Review the existing services' private configuration without exposing values. Both must use the existing database and consistent PayPal app, merchant and webhook IDs. Merge only intended keys; preserve unrelated variables. Set `RALLY_MODE=connected`, `RALLY_DATABASE_SCHEMA=rally`, the existing public URL, the privately configured shop recipient and a hosted model adapter. Keep the frontend review harness disabled. Do not replace the existing database URL or credentials with local development values.
4. Review changing both existing services from `main` to the tested `rally` release. Keep their Docker runtimes, `./Dockerfile`, `.` build contexts, plans, regions and single instances. For the existing worker only, replace the Coalition Docker override with `python -m rally.worker`, with `python -m rally.db` as its additive pre-deploy command. The web image's default command already initializes Rally and starts its API; configure `/api/health` as its HTTP health path. Preserve legacy receipt/recovery access before making this switch.
5. Obtain the owner's approval for that concrete settings diff. Do not trigger a duplicate deploy if an approved branch/configuration change already started one. Record each deploy ID and wait for `live`; verify `app: rally` in health, worker processing against the same database, original purchase access and a genuine signed webhook delivered directly to Rally. Keep the existing public callback URL unless a separately reviewed change is necessary.

The G1 success uses an explicitly approved **recovery replay** of the original signed CAD webhook from Render into the local Rally handler and worker. PayPal signature verification and resource reconciliation succeeded. That evidence does not establish any of the hosted cutover checks above.

References: [Render MCP capabilities](https://render.com/docs/mcp-server), [existing Blueprint resource adoption](https://render.com/docs/infrastructure-as-code#adding-an-existing-resource), [unique Blueprint names](https://render.com/docs/blueprint-spec#name), [deploy behavior](https://render.com/docs/deploys).
