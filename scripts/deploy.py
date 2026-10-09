#!/usr/bin/env python3
"""Fail-closed CapitalOS release runner. No hosted effects without --execute."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import traceback
import subprocess
import sys
import uuid

REPO = Path(__file__).resolve().parents[1]
TOOLS = REPO / 'scripts/release'
LIVE = '71834000000017016'
RECOVERY = '71834000000073259'
REMOTE = 'https://github.com/jaswanthPolepalli/capitalos.git'
STAGES = ['Preflight', 'Validation', 'Write barrier', 'Live backup', 'Recovery backup',
          'Recovery isolation', 'Freeze artifacts', 'Recovery reset and restore',
          'Rollback rehearsal', 'Candidate behavior', 'Final gate', 'Deployment',
          'Hosted checks', 'Resume writes', 'Release record', 'Git sync']
HOOKS = ('quiesce', 'assert_quiesced', 'resume', 'isolation', 'behavior')


class Guardrail(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise Guardrail(message)


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def output(args, cwd=REPO):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    require(result.returncode == 0, 'Command failed: ' + args[0] + ' (check authentication/configuration)')
    return result.stdout.strip()


def verify_manifest(folder, manifest, exact=False):
    entries = read(manifest)
    require(isinstance(entries, dict) and bool(entries), 'Empty checksum manifest')
    if exact:
        actual = {str(p.relative_to(folder)) for p in folder.rglob('*') if p.is_file()}
        require(actual == set(entries), 'Artifact file inventory changed')
    for name, checksum in entries.items():
        path = (folder / name).resolve()
        require(path.is_relative_to(folder.resolve()), 'Checksum path escapes archive')
        require(path.is_file() and sha(path) == checksum, 'Artifact integrity failure: ' + name)


def validate_config(config):
    require(config.get('environment') == 'Development' and config.get('project') == LIVE
            and config.get('recovery_project') == RECOVERY, 'Unsupported target; never infer Production IDs')
    for name in HOOKS:
        command = config.get('hooks', {}).get(name)
        require(isinstance(command, list) and bool(command)
                and all(isinstance(arg, str) and arg for arg in command), 'Configure reviewed hook: ' + name)
        require(Path(command[0]).is_absolute() and os.access(command[0], os.X_OK),
                'Hook executable must be an executable absolute path: ' + name)
    baseline = Path(config.get('recovery_baseline', '')).expanduser().resolve()
    require(not baseline.is_relative_to(REPO) and baseline.is_dir(), 'Recovery baseline must exist outside Git')
    require(read(baseline / 'rollback-isolation-verification.json').get('passed') is True,
            'Missing prior recovery rehearsal evidence')
    return baseline


def scan_secrets(repo):
    # Conservative guard, not a complete secret scanner. Never include matches in errors/logs.
    patterns = [re.compile(rb'(?:APP_PASS|APP_PASSWORD|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*[=:]\s*[\"\'][^\"\'\n]{8,}[\"\']', re.I),
                re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
    paths = output(['git', 'ls-files', '-z'], repo).split('\0')
    for name in filter(None, paths):
        path = repo / name
        require(not path.is_symlink(), 'Tracked symlink needs review: ' + name)
        require(not re.search(r'(^|/)(?:\.env(?:\.|$)|backups?/|outputs?/)|\.(?:zip|pem|key)$', name)
                or name.endswith('.env.example'), 'Private/generated file requires review: ' + name)
        if path.is_file() and any(pattern.search(path.read_bytes()) for pattern in patterns):
            raise Guardrail('Possible embedded credential in ' + name + '; remove from source before automated release')


@contextmanager
def release_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Guardrail('Another release is active') from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


class Release:
    def __init__(self, config, scope, root):
        self.config, self.scope, self.root = config, scope, root
        self.id = root.name
        self.env = dict(os.environ, CAPITALOS_RELEASE_DIR=str(root), CAPITALOS_SOURCE_DIR=str(REPO),
                        CAPITALOS_RELEASE_SCOPE=scope, CAPITALOS_RUN_ID=self.id, PYTHONOPTIMIZE='0', RESTORE_SOURCE='target')
        self.state = {'run_id': self.id, 'project': LIVE, 'environment': 'Development', 'scope': scope,
                      'deployment_attempted': False, 'hosted_verified': False, 'git_synced': False,
                      'write_barrier_pending': False, 'stages': {}}
        if config.get('install_smtp_runtime'):
            credential_path = Path(config['install_smtp_runtime']).expanduser().resolve()
            require(not credential_path.is_relative_to(REPO) and credential_path.is_file(), 'Runtime secrets must exist outside Git')
            require(credential_path.stat().st_mode & 0o077 == 0, 'Runtime secrets must be private')
            self.env['CAPITALOS_INSTALL_SMTP_RUNTIME'] = str(credential_path)
        self.head = None
        self.baseline = None

    def save(self):
        (self.root / 'status.json').write_text(json.dumps(self.state, indent=2))

    def command(self, args, name, cwd=REPO):
        with (self.root / (name + '.log')).open('ab') as log:
            result = subprocess.run(args, cwd=cwd, env=self.env, stdout=log, stderr=subprocess.STDOUT)
        require(result.returncode == 0, name + ' failed; see private log')

    def helper(self, name, *args):
        self.command([sys.executable, '-B', str(TOOLS / name), *map(str, args)], name.removesuffix('.py'))

    def hook(self, name):
        receipt = self.root / ('hook-' + name + '-' + uuid.uuid4().hex + '.json')
        env = dict(self.env, CAPITALOS_RECEIPT=str(receipt), CAPITALOS_PROJECT=LIVE,
                   CAPITALOS_RECOVERY_PROJECT=RECOVERY, CAPITALOS_ENVIRONMENT='Development')
        with (self.root / ('hook-' + name + '.log')).open('ab') as log:
            result = subprocess.run(self.config['hooks'][name], cwd=REPO, env=env,
                                    stdout=log, stderr=subprocess.STDOUT)
        require(result.returncode == 0 and receipt.is_file(), 'Hook failed or lacks evidence: ' + name)
        evidence = read(receipt)
        require(evidence.get('passed') is True and evidence.get('run_id') == self.id
                and evidence.get('project') == LIVE and evidence.get('recovery_project') == RECOVERY,
                'Hook evidence does not match this release: ' + name)
        expected = {'quiesce': 'all_writers_paused', 'assert_quiesced': 'all_writers_paused',
                    'resume': 'writes_resumed', 'isolation': 'outbound_email_blocked',
                    'behavior': 'candidate_behavior_verified'}[name]
        require(evidence.get(expected) is True, 'Missing hook guarantee: ' + expected)
        if name == 'isolation':
            require(evidence.get('access_permissions_verified') is True, 'Recovery access permissions unverified')

    def stage(self, name, action):
        print(f'{name:27} RUN', flush=True)
        self.state['stages'][name] = 'running'
        self.save()
        try:
            action()
        except BaseException:
            self.state['stages'][name] = 'failed'
            self.save()
            print(f'{name:27} STOP', flush=True)
            raise
        self.state['stages'][name] = 'passed'
        self.save()
        print(f'{name:27} PASS', flush=True)

    def preflight(self):
        require(os.environ.get('VITE_USE_MOCK', '').lower() != 'true' and
                os.environ.get('CAPITALOS_MOCK', '').lower() != 'true', 'Mock mode is forbidden for release')
        self.baseline = validate_config(self.config)
        self.env['CAPITALOS_RECOVERY_BASELINE'] = str(self.baseline)
        require(output(['node', '--version']).startswith('v24.'), 'Use Node 24 from .nvmrc')
        require(shutil.which('catalyst'), 'Catalyst CLI is missing')
        require(not output(['git', 'status', '--porcelain', '--untracked-files=all']),
                'Commit/review source first; release requires a clean source tree')
        require(output(['git', 'branch', '--show-current']) == 'main', 'Release source must be on main')
        require(output(['git', 'remote', 'get-url', 'origin']) == REMOTE
                and output(['git', 'remote', 'get-url', '--push', 'origin']) == REMOTE, 'Unexpected Git remote')
        scan_secrets(REPO)
        self.command(['git', 'fetch', 'origin', 'main'], 'git-preflight')
        self.head = output(['git', 'rev-parse', 'HEAD'])
        self.command(['git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'], 'git-ancestry')
        self.state['source_commit'] = self.head
        self.command(['git', 'push', '--dry-run', 'origin', 'HEAD:main'], 'git-push-preflight')
        # This adapter deliberately excludes schema/runtime/dependency migrations.
        previous_source = self.config.get('previous_source_commit')
        require(isinstance(previous_source, str) and re.fullmatch(r'[0-9a-f]{40}', previous_source),
                'Configure the previous deployed source commit')
        self.command(['git', 'merge-base', '--is-ancestor', previous_source, 'HEAD'], 'previous-source')
        changed = output(['git', 'diff', '--name-only', previous_source, self.head]).splitlines()
        require(not any(p.startswith('infrastructure/') or p.endswith(('package.json', 'package-lock.json',
                    'catalyst-config.json', 'project-template-1.0.0.json')) or p == 'catalyst.json' for p in changed if p != 'package.json'),
                'Schema/dependency/runtime configuration changes require a reviewed release adapter')
        before_package = json.loads(output(['git', 'show', previous_source + ':package.json']))
        current_package = read(REPO / 'package.json')
        before_package.pop('scripts', None)
        current_package.pop('scripts', None)
        require(before_package == current_package, 'Root dependency/runtime changes require release review')

    def assert_source(self):
        require(output(['git', 'rev-parse', 'HEAD']) == self.head and
                not output(['git', 'status', '--porcelain', '--untracked-files=all']), 'Source changed during release')

    def validation(self):
        self.command(['npm', 'run', 'validate'], 'validation')
        generated = [REPO / 'client/dist', REPO / 'functions/capitalos-month-end/shared',
                     REPO / 'functions/capitalos-daily-summary/shared']
        require(all(path.is_dir() for path in generated), 'Validation did not produce all artifacts')
        hashes = {str(p.relative_to(REPO)): sha(p) for folder in generated for p in folder.rglob('*') if p.is_file()}
        (self.root / 'validated-build.json').write_text(json.dumps(hashes))

    def barrier(self):
        # Mark before invoking: a hook may pause writes and then fail.
        self.state['write_barrier_pending'] = True
        self.save()
        self.hook('quiesce')

    def resume(self):
        self.hook('resume')
        self.state['write_barrier_pending'] = False
        self.save()

    def capture(self, project, label):
        self.hook('assert_quiesced')
        self.helper('capture.py', project, label)
        verify_manifest(self.root / label, self.root / label / 'checksums.json')
        self.hook('assert_quiesced')
        if label == 'target':
            self.helper('smoke.py', 'target', 'baseline')

    def prepare(self):
        self.assert_source()
        verify_manifest(REPO, self.root / 'validated-build.json')
        self.helper('audit.py')
        self.helper('prepare.py')
        verify_manifest(REPO, self.root / 'validated-build.json')
        (self.root / 'validation.json').write_text(json.dumps({'passed': True, 'source_commit': self.head,
                                                            'command': 'npm run validate'}))
        procedure = f'''# Rollback procedure — {self.id}

Target: Development / {LIVE}, organization 60088793510.
Triggers: failed loading, incorrect behavior, artifact/configuration drift, or failed hosted checks.
Data backup: target/. Integrity: target/checksums.json and rollback-checksums.json.
Runtime configuration, secrets and previous hosted application are in rollback/ (private).
This release does not migrate schema. Any later schema change invalidates these instructions.

Before rollback: capture and verify a FRESH consistent live backup, preserve/reconcile newer
transactions, reverify archived checksums and schema/runtime compatibility, and rehearse the
archived build in the protected recovery project. Never restore old data automatically.

After those gates, using Node 24 and authenticated Catalyst CLI:

```sh
cd '{self.root / 'rollback'}'
catalyst deploy --only functions,client --project {LIVE} --dc in --org 60088793510 -ni
```

Smoke checks: compare all 12 read-only API views with a fresh baseline, all hosted frontend
assets with rollback/client/dist, all three hosted function artifacts/runtime/authentication
with rollback/functions, raw rows with the fresh backup, and schedules/schema with that backup.
The runner's release/verify_release.py implements these comparisons. Prepare a NEW private
release directory whose target/ contains the fresh backup and whose rollback/ holds this
verified archived build, set CAPITALOS_RELEASE_DIR to that directory, then run:

```sh
python3 '{TOOLS / 'smoke.py'}' target baseline
# Capture the baseline BEFORE rollback deployment, then after deployment:
python3 '{TOOLS / 'verify_release.py'}' target rollback rollback-verification
```

Recovery reset failure: retain recovery-before/ and isolation/id-map.json; do not retry reset.
Investigate partial writes and restore from recovery-before only under a new verified gate.
No automatic recovery reset, live data restore, or retry is authorized by a failed stage.
'''
        (self.root / 'release-procedure.md').write_text(procedure)

    def deploy(self, folder, project, scope):
        self.hook('assert_quiesced')
        verify_manifest(self.root / folder, self.root / (folder + '-checksums.json'), exact=True)
        if project == LIVE:
            require(read(self.root / 'target-deployment-gate.json').get('passed') is True, 'Missing live gate')
            self.assert_source()
            self.state['deployment_attempted'] = True
            self.save()
        else:
            require(project == RECOVERY, 'Unexpected deploy project')
            require(read(self.root / 'isolation/first-deployment-gate.json').get('passed') is True,
                    'Missing recovery deployment gate')
            self.hook('isolation')
        self.command(['catalyst', 'deploy', '--only', scope, '--project', project,
                      '--dc', 'in', '--org', '60088793510', '-ni'], folder + '-deploy', self.root / folder)

    def recovery_restore(self):
        self.hook('assert_quiesced')
        require((self.root / 'release-procedure.md').is_file(), 'Missing rollback procedure before reset')
        self.helper('recovery-gate-and-reset.py')
        self.helper('restore_isolation.py')

    def rehearsal(self):
        self.capture(RECOVERY, 'isolation-before-rollback')
        self.helper('isolation-deployment-gate.py')
        self.deploy('rollback-isolation', RECOVERY, 'functions,client')
        self.helper('verify_release.py', 'isolation', 'rollback-isolation', 'rollback-isolation-verification')
        self.hook('isolation')

    def behavior(self):
        # Contract: read-only/local candidate checks. Never deploy candidate into recovery here.
        self.hook('behavior')
        (self.root / 'candidate-behavior-verification.json').write_text(json.dumps({'passed': True}))
        self.helper('verify_release.py', 'isolation', 'rollback-isolation', 'rollback-isolation-verification')

    def final_gate(self):
        self.assert_source()
        self.hook('assert_quiesced')
        self.helper('live-gate.py')

    def hosted(self):
        self.helper('verify_release.py', 'target', 'candidate', 'live-verification')
        self.state['hosted_verified'] = True
        self.save()

    def document(self):
        self.assert_source()
        report = REPO / 'docs' / ('deployment-' + self.id + '.md')
        report.write_text(f'''# Deployment {self.id}

Environment: Development. Project: `{LIVE}`. Scope: `{self.scope}`.
Source commit: `{self.head}`.

Validation, fresh live/recovery backups, isolated restoration, rollback rehearsal,
candidate behavior checks and hosted verification passed. No schema migration.
Private evidence reference: `{self.id}` under the configured backup root.
Exact rollback commands and smoke checks: private `release-procedure.md`.
Code rollback must preserve/reconcile transactions recorded after the backup.
No private records, runtime secrets or backup archives are included in this record.
''')
        self.state['release_document'] = str(report.relative_to(REPO))
        self.save()

    def sync(self):
        require(self.state['hosted_verified'] and not self.state['write_barrier_pending'], 'Release not verified/resumed')
        require(output(['git', 'rev-parse', 'HEAD']) == self.head, 'Source HEAD changed before Git sync')
        doc = self.state['release_document']
        require(output(['git', 'status', '--porcelain', '--untracked-files=all']) == '?? ' + doc,
                'Unexpected changes before Git sync')
        self.command(['git', 'add', '--', doc], 'git-add')
        self.command(['git', 'commit', '-m', 'docs: record deployment ' + self.id, '--', doc], 'git-commit')
        self.state['release_commit'] = output(['git', 'rev-parse', 'HEAD'])
        self.save()
        self.command(['git', 'fetch', 'origin', 'main'], 'git-fetch')
        self.command(['git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'], 'git-conflict-check')
        self.command(['git', 'push', 'origin', 'HEAD:main'], 'git-push')
        self.command(['git', 'fetch', 'origin', 'main'], 'git-verify-fetch')
        self.command(['git', 'merge-base', '--is-ancestor', self.state['release_commit'], 'origin/main'], 'git-verify')
        self.state['git_synced'] = True
        self.save()

    def execute(self):
        steps = [('Preflight', self.preflight), ('Validation', self.validation),
                 ('Write barrier', self.barrier), ('Live backup', lambda: self.capture(LIVE, 'target')),
                 ('Recovery backup', lambda: self.capture(RECOVERY, 'recovery-before')),
                 ('Recovery isolation', lambda: self.hook('isolation')),
                 ('Freeze artifacts', self.prepare), ('Recovery reset and restore', self.recovery_restore),
                 ('Rollback rehearsal', self.rehearsal), ('Candidate behavior', self.behavior),
                 ('Final gate', self.final_gate),
                 ('Deployment', lambda: self.deploy('candidate', LIVE, 'functions,client' if self.scope == 'all' else self.scope)),
                 ('Hosted checks', self.hosted), ('Resume writes', self.resume),
                 ('Release record', self.document), ('Git sync', self.sync)]
        try:
            for name, action in steps:
                self.stage(name, action)
        finally:
            # Do not leave business writes paused on an abandoned release. Hook must be idempotent.
            if self.state['write_barrier_pending']:
                try:
                    self.stage('Resume writes after stop', self.resume)
                except BaseException:
                    print('URGENT: write barrier could not be released; inspect private resume log.', file=sys.stderr)
            self.save()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Run a real guarded Development release')
    parser.add_argument('--config', type=Path, help='Private release configuration outside the repository')
    parser.add_argument('--scope', choices=['client', 'functions', 'all'], default='all')
    parser.add_argument('--plan', action='store_true', help='Print stages without executing commands (default)')
    args = parser.parse_args(argv)
    if not args.execute or args.plan:
        print('Development only; no deployment or network requests. Planned stages:')
        print('\n'.join(f'{i + 1:2}. {step}' for i, step in enumerate(STAGES)))
        print('Execute: npm run deploy -- --execute --config /private/release.json --scope ' + args.scope)
        return 0
    os.umask(0o077)
    release = None
    try:
        require(not sys.flags.optimize, 'Do not use optimized Python for release checks')
        require(args.config is not None and args.config.is_file(), 'Supply a private release configuration')
        config_path = args.config.resolve()
        require(not config_path.is_relative_to(REPO), 'Keep release configuration outside Git')
        config = read(config_path)
        backup = Path(config['backup_root']).expanduser().resolve()
        require(not backup.is_relative_to(REPO) and backup != Path('/'), 'Backups must be outside the repository')
        backup.mkdir(parents=True, exist_ok=True, mode=0o700)
        require(backup.stat().st_mode & 0o077 == 0, 'Backup root must be private (chmod 700)')
        git_dir = Path(output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir']))
        with release_lock(git_dir / 'capitalos-deploy.lock'):
            run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
            root = backup / run_id
            root.mkdir(mode=0o700)
            release = Release(config, args.scope, root)
            signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
            release.execute()
            print('COMPLETE: https://github.com/jaswanthPolepalli/capitalos/commit/' + release.state['release_commit'])
            print('Private evidence: ' + str(root))
        return 0
    except (Exception, KeyboardInterrupt) as error:
        # Do not print arbitrary exception bodies: remote responses may contain secrets/data.
        message = str(error) if isinstance(error, Guardrail) else type(error).__name__ + '; inspect private evidence/configuration'
        print('GUARDRAIL: ' + message, file=sys.stderr)
        if release:
            (release.root / 'runner-error.log').write_text(traceback.format_exc())
            print('Deployment attempted: ' + str(release.state['deployment_attempted']) +
                  '; hosted verified: ' + str(release.state['hosted_verified']) +
                  '; Git synced: ' + str(release.state['git_synced']), file=sys.stderr)
            print('Private evidence: ' + str(release.root), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
