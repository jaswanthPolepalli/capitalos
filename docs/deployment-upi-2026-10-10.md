# CapitalOS Development release — 10 October 2026

Added an optional UPI app handoff to the shared payment UI. Users can choose Google Pay, CRED or the phone's default UPI handler, edit the amount and payee reference, return to CapitalOS, and explicitly mark a payment successful. CapitalOS does not receive payment status from the UPI app; the user confirms it.

The shared `UpiPaymentPanel` is used by cashback, quick pay, profit, capital return, partner detail and scheduled profit payment forms. A UPI ID is included in the handoff URI when supplied. A phone number remains editable as a payee reference because UPI apps differ in resolving mobile numbers.

## Deployment and verification

- Target: Development project `71834000000017016`, organization `60088793510`; client only. No API, datastore schema, runtime or schedule changes.
- Fresh private backup: `/Users/jaswanth-6838/CapitalOS-backups/20261010T044110Z-upi-manual/target-final/`. All 19 tables and 832 rows were captured with full pagination; two complete reads matched. The backup includes the previous deployed frontend, backend archives/configuration, schedules, schemas and project export. All 57 file checksums and ZIP integrity checks passed.
- Reusable recovery project: `71834000000073259`. Its fresh `recovery-before/` snapshot (19 tables, 818 rows) matched the accepted prior recovery baseline exactly. Checksums and archives passed. Recovery was restored from the fresh target snapshot, producing 832 verified rows with custom fields and references checked.
- Rollback readiness: redeployed the archived frontend to recovery with `--only client`. Hosted verification passed for 49 prior frontend assets, 12 API views, all 832 raw rows, three backend archives and runtime configurations. Recovery schedules remained absent. The exact rollback command and smoke checks are in the private `target-final-gate.json`.
- Local validation: `npm run validate` passed, including 32 deployment-runner tests, schema/backend checks, TypeScript, 944 tests across 57 files and production client build.
- Live hosted verification: 48 candidate assets match; all 12 API views and 832 raw rows match the predeploy baseline; all three function runtime configurations, job schedules and pools are unchanged.
- Browser smoke: the Capital Return form displayed the UPI option, editable amount/payee fields and Google Pay/CRED choices. Changing the payment amount populated the UPI amount. The form was cancelled without recording a transaction. No external UPI app was launched or real payment attempted. No existing partner record had a saved phone number, so phone prefill could not be exercised with live data.

## Rollback

The previous frontend is preserved in the private release backup. Before rollback, capture and verify a fresh live backup and API baseline, and preserve or reconcile any transactions recorded since deployment. Then deploy the archived frontend:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261010T044110Z-upi-manual/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only client --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, check all 12 API views, 19 tables/raw rows against the new backup while accounting for legitimate later transactions, all 49 archived frontend assets, three backend configurations, and schedules/job pools. Code rollback does not restore data.
