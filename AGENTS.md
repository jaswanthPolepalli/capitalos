# Repository rules

## Data backup and rollback before every deployment

Before every deployment or hosted schema/data migration, follow the mandatory backup gate in [DEPLOYMENT.md](DEPLOYMENT.md#mandatory-backup-gate).

This applies to Development and Production, including frontend-only, backend-only, hotfix and manual/CI deployments. Development may contain real business data.

Do not deploy until a fresh backup of the target environment's existing data and currently deployed application has been captured and verified. If any required backup or verification fails, stop and report the blocker. A successful local build or Git commit is not a backup of the deployed environment.

Both release gates are mandatory:

1. **Data backup:** capture and verify a complete, restorable backup of existing data.
2. **Rollback readiness:** preserve the previous deployed build and verify that it can be redeployed with its required runtime/configuration and compatible schema. Document the exact rollback commands and smoke checks before deployment. If rollback readiness cannot be verified, stop the deployment.

Code rollback does not automatically restore data. Any data recovery must preserve or reconcile transactions recorded after the backup.
