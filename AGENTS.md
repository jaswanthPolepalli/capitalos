# Repository rules

## Data backup and rollback before every deployment

Before every deployment or hosted schema/data migration, follow the mandatory backup gate in [DEPLOYMENT.md](DEPLOYMENT.md#mandatory-backup-gate).

This applies to Development and Production, including frontend-only, backend-only, hotfix and manual/CI deployments. Development may contain real business data.

Do not deploy until a fresh backup of the target environment's existing data and currently deployed application has been captured and verified. If any required backup or verification fails, stop and report the blocker. A successful local build or Git commit is not a backup of the deployed environment.

Both release gates are mandatory:

1. **Data backup:** capture and verify a complete, restorable backup of existing data.
2. **Rollback readiness:** preserve the previous deployed build and verify that it can be redeployed with its required runtime/configuration and compatible schema. Document the exact rollback commands and smoke checks before deployment. If rollback readiness cannot be verified, stop the deployment.

Code rollback does not automatically restore data. Any data recovery must preserve or reconcile transactions recorded after the backup.

## Push code after every successful deployment

After every successful Development or Production deployment and passing hosted smoke checks, commit and push the deployed source, relevant tests, non-secret configuration and release documentation to `main` in `https://github.com/jaswanthPolepalli/capitalos.git`. Follow the [post-deployment Git sync](DEPLOYMENT.md#post-deployment-git-sync) procedure and verify the release commit exists on the remote before reporting the release workflow complete. This push is part of the authorized deployment workflow and does not require separate confirmation.

Never commit credentials, private business data, backups or generated local financial reports. If authentication or push fails, report the deployment outcome and pending Git sync separately; do not claim the code was pushed.

## Reusable deployment automation

Start deployment work with `npm run deploy -- --plan` and follow
[deployment automation](docs/deployment-automation.md). Use the guarded runner for
supported releases once its documented setup and hosted qualification are complete.
Keep detailed logs private and report stage summaries. On a guardrail failure,
inspect the relevant evidence; do not bypass checks or rerun a deployment blindly.
The runner does not replace either mandatory release gate or post-deployment Git sync.
