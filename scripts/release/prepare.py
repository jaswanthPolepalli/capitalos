"""Freeze candidate and archived rollback builds, keeping secrets outside Git."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import zipfile
from catalyst import ROOT, save


def extract(archive, destination):
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError('Corrupt archive')
        for item in z.infolist():
            path = (destination / item.filename).resolve()
            if not path.is_relative_to(destination.resolve()) or stat.S_ISLNK(item.external_attr >> 16):
                raise RuntimeError('Unsafe archive member')
        z.extractall(destination)


def digest_tree(path):
    return {str(p.relative_to(path)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in path.rglob('*') if p.is_file()}


def prepare():
    repo = Path(os.environ['CAPITALOS_SOURCE_DIR'])
    scope = os.environ['CAPITALOS_RELEASE_SCOPE']
    isolation = json.loads((ROOT / 'isolation/project.json').read_text())
    names = [f['name'] for f in json.loads((ROOT / 'target/functions.json').read_text())]
    if set(names) != {'capitalos-api', 'capitalos-month-end', 'capitalos-daily-summary'}:
        raise RuntimeError('Unexpected deployed function inventory')
    for label in ['rollback', 'rollback-isolation']:
        root = ROOT / label
        (root / 'client/dist').mkdir(parents=True)
        for name in names:
            dest = root / 'functions' / name
            dest.mkdir(parents=True)
            extract(ROOT / 'target/artifacts' / (name + '.zip'), dest)
            metadata = json.loads((ROOT / 'target/function-config' / (name + '.json')).read_text())
            env = dict(metadata['configuration']['environment']['variables'])
            if label == 'rollback-isolation':
                for key in ['MONTH_END_EMAILS_ENABLED', 'DAILY_SUMMARY_EMAILS_ENABLED']:
                    env[key] = 'false'
                env['CAPITALOS_RECOVERY'] = 'true'
                env['CAPITALOS_EMAILS_ENABLED'] = 'false'
                env.pop('SMTP_USER', None)
                env.pop('SMTP_APP_PASSWORD', None)
                # The platform barrier also protects archived code predating these flags.
                if 'APP_BASE_URL' in env:
                    env['APP_BASE_URL'] = isolation['project_domain_details']['project_domain'] + '/app'
            config = {'deployment': {'name': name, 'stack': metadata['stack'],
                      'type': 'job' if metadata['type'] == 'job' else 'advancedio',
                      'memory': metadata['configuration']['memory'], 'env_variables': env},
                      'execution': {'main': 'index.js'}}
            (dest / 'catalyst-config.json').write_text(json.dumps(config, indent=2))
        extract(ROOT / 'target/artifacts/frontend.zip', root / 'client/dist')
        (root / 'catalyst.json').write_text(json.dumps({'client': {'source': 'client/dist'},
                                                     'functions': {'source': 'functions', 'targets': names}}))
    candidate = ROOT / 'candidate'
    shutil.copytree(ROOT / 'rollback', candidate)
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=repo).decode().split('\0')
    for name in names:
        original = candidate / 'functions' / name
        local = repo / 'functions' / name
        files = [f for f in tracked if f.startswith('functions/' + name + '/')]
        # Dependency/config changes need a separately reviewed release adapter.
        for filename in ['package.json', 'package-lock.json']:
            if (local / filename).read_bytes() != (original / filename).read_bytes():
                raise RuntimeError('Dependency changes require release review: ' + name + '/' + filename)
        if scope == 'client':
            for filename in files:
                if filename.endswith('/catalyst-config.json'):
                    continue
                if not (candidate / filename).exists() or (repo / filename).read_bytes() != (candidate / filename).read_bytes():
                    raise RuntimeError('Frontend-only scope contains backend changes: ' + filename)
            shared = local / 'shared'
            if shared.exists() and digest_tree(shared) != digest_tree(original / 'shared'):
                raise RuntimeError('Frontend-only scope contains generated backend changes: ' + name)
        else:
            config = (original / 'catalyst-config.json').read_bytes()
            dependencies = original / 'node_modules'
            saved_dependencies = ROOT / ('dependencies-' + name)
            if dependencies.exists():
                dependencies.rename(saved_dependencies)
            shutil.rmtree(original)
            original.mkdir()
            for filename in files:
                if filename.endswith('/catalyst-config.json'):
                    continue
                target = candidate / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(repo / filename, target)
            shared = local / 'shared'
            if shared.exists():
                shutil.copytree(shared, original / 'shared')
            if saved_dependencies.exists():
                saved_dependencies.rename(original / 'node_modules')
            (original / 'catalyst-config.json').write_bytes(config)
    if scope == 'functions':
        expected = digest_tree(candidate / 'client/dist')
        actual = digest_tree(repo / 'client/dist')
        expected.pop('client-package.json', None)
        actual.pop('client-package.json', None)
        if expected != actual:
            raise RuntimeError('Backend-only scope contains frontend changes')
    if scope != 'functions':
        shutil.rmtree(candidate / 'client/dist')
        shutil.copytree(repo / 'client/dist', candidate / 'client/dist')
    credential_path = os.environ.get('CAPITALOS_INSTALL_SMTP_RUNTIME')
    if credential_path:
        if scope == 'client': raise RuntimeError('Runtime setup requires backend deployment')
        credentials = json.loads(Path(credential_path).read_text())
        if set(credentials) != {'SMTP_USER', 'SMTP_APP_PASSWORD'} or not all(credentials.values()):
            raise RuntimeError('Invalid private SMTP runtime configuration')
        config_path = candidate / 'functions/capitalos-api/catalyst-config.json'
        config = json.loads(config_path.read_text())
        config['deployment']['env_variables'].update(credentials)
        config['deployment']['env_variables'].update({'CAPITALOS_EMAILS_ENABLED': 'true', 'CAPITALOS_RECOVERY': 'false', 'CAPITALOS_MAINTENANCE': 'false'})
        config_path.write_text(json.dumps(config, indent=2))
    for label in ['candidate', 'rollback', 'rollback-isolation']:
        save(label + '-checksums.json', digest_tree(ROOT / label))


if __name__ == '__main__':
    prepare()
