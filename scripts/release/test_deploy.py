"""Offline safety tests: no Catalyst/network calls or business-data fixtures."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
import contextlib
import io
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('deploy', Path(__file__).resolve().parents[1] / 'deploy.py')
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)


class Guards(unittest.TestCase):
    def test_default_and_plan_do_not_execute(self):
        for args in [[], ['--plan'], ['--execute', '--plan']]:
            with patch.object(deploy.subprocess, 'run', side_effect=AssertionError('No command allowed')):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(deploy.main(args), 0)

    def test_execute_requires_configuration(self):
        with patch.object(deploy.subprocess, 'run', side_effect=AssertionError('No command allowed')):
            self.assertEqual(deploy.main(['--execute']), 1)

    def test_wrong_target_rejected(self):
        for environment in ['Production', None]:
            with self.assertRaises(deploy.Guardrail):
                deploy.validate_config({'environment': environment, 'project': deploy.LIVE,
                                        'recovery_project': deploy.RECOVERY})

    def test_missing_hooks_rejected(self):
        with self.assertRaisesRegex(deploy.Guardrail, 'hook'):
            deploy.validate_config({'environment': 'Development', 'project': deploy.LIVE,
                                    'recovery_project': deploy.RECOVERY})

    def test_checksum_tamper_and_path_escape(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'artifact').write_text('old build')
            manifest = root / 'checksums.json'
            manifest.write_text(json.dumps({'artifact': deploy.sha(root / 'artifact')}))
            deploy.verify_manifest(root, manifest)
            (root / 'artifact').write_text('modified')
            with self.assertRaises(deploy.Guardrail):
                deploy.verify_manifest(root, manifest)
            manifest.write_text(json.dumps({'../outside': 'fake'}))
            with self.assertRaises(deploy.Guardrail):
                deploy.verify_manifest(root, manifest)
            manifest.write_text('{}')
            with self.assertRaises(deploy.Guardrail):
                deploy.verify_manifest(root, manifest)

    def test_lock_blocks_parallel_release(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'lock'
            with deploy.release_lock(path):
                with self.assertRaises(deploy.Guardrail):
                    with deploy.release_lock(path):
                        pass
            with deploy.release_lock(path):
                pass

    def test_failed_or_stale_hook_receipt_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            release = deploy.Release({'hooks': {'quiesce': ['/hook']}}, 'all', root)
            def fake_run(*args, **kwargs):
                Path(kwargs['env']['CAPITALOS_RECEIPT']).write_text(json.dumps({
                    'passed': True, 'run_id': 'previous-run', 'project': deploy.LIVE,
                    'recovery_project': deploy.RECOVERY, 'all_writers_paused': True}))
                return subprocess.CompletedProcess([], 0)
            with patch.object(deploy.subprocess, 'run', side_effect=fake_run):
                with self.assertRaises(deploy.Guardrail):
                    release.hook('quiesce')

    def test_unknown_project_cannot_deploy(self):
        with tempfile.TemporaryDirectory() as folder:
            release = deploy.Release({}, 'all', Path(folder))
            with patch.object(release, 'hook'), patch.object(deploy, 'verify_manifest'), patch.object(release, 'command') as command:
                with self.assertRaises(deploy.Guardrail):
                    release.deploy('candidate', 'unexpected', 'client')
                command.assert_not_called()

    def test_missing_live_gate_cannot_deploy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'target-deployment-gate.json').write_text('{"passed":false}')
            release = deploy.Release({}, 'all', root)
            with patch.object(release, 'hook'), patch.object(deploy, 'verify_manifest'), patch.object(release, 'command') as command:
                with self.assertRaises(deploy.Guardrail):
                    release.deploy('candidate', deploy.LIVE, 'client')
                command.assert_not_called()
                self.assertFalse(release.state['deployment_attempted'])

    def test_source_drift_blocks_deploy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'target-deployment-gate.json').write_text('{"passed":true}')
            release = deploy.Release({}, 'all', root)
            with patch.object(release, 'hook'), patch.object(deploy, 'verify_manifest'), patch.object(release, 'command') as command, \
                 patch.object(release, 'assert_source', side_effect=deploy.Guardrail('drift')):
                with self.assertRaises(deploy.Guardrail):
                    release.deploy('candidate', deploy.LIVE, 'client')
                command.assert_not_called()

    def test_git_sync_requires_hosted_success(self):
        with tempfile.TemporaryDirectory() as folder:
            release = deploy.Release({}, 'all', Path(folder))
            with patch.object(release, 'command') as command:
                with self.assertRaises(deploy.Guardrail):
                    release.sync()
                command.assert_not_called()

    def test_secret_match_never_echoes_value(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            secret = 'synthetic-fixture-only'
            (root / 'source.js').write_text('const APP_PASS = "' + secret + '";')
            with patch.object(deploy, 'output', return_value='source.js'):
                with self.assertRaises(deploy.Guardrail) as error:
                    deploy.scan_secrets(root)
                self.assertNotIn(secret, str(error.exception))

    def test_every_stage_failure_stops_subsequent_actions(self):
        # Exercise the real sequence/finally logic, with only external stage bodies mocked.
        for failure in deploy.STAGES:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                release = deploy.Release({}, 'all', root)
                visited = []
                def stage(name, action):
                    visited.append(name)
                    if name == 'Write barrier':
                        release.state['write_barrier_pending'] = True
                    if name == failure:
                        raise deploy.Guardrail('injected failure')
                    if name.startswith('Resume writes'):
                        release.state['write_barrier_pending'] = False
                with patch.object(release, 'stage', side_effect=stage):
                    with self.assertRaises(deploy.Guardrail):
                        release.execute()
                index = deploy.STAGES.index(failure)
                self.assertEqual(visited[:index + 1], deploy.STAGES[:index + 1])
                self.assertNotIn('Deployment', visited if index < deploy.STAGES.index('Deployment') else [])
                if deploy.STAGES.index('Write barrier') <= index <= deploy.STAGES.index('Resume writes'):
                    self.assertEqual(visited[-1], 'Resume writes after stop')

    def test_partially_failed_quiesce_keeps_cleanup_pending(self):
        with tempfile.TemporaryDirectory() as folder:
            release = deploy.Release({}, 'all', Path(folder))
            with patch.object(release, 'hook', side_effect=deploy.Guardrail('hook failed after pausing')):
                with self.assertRaises(deploy.Guardrail):
                    release.barrier()
            self.assertTrue(release.state['write_barrier_pending'])


    def test_added_artifact_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            artifacts = root / 'build'
            artifacts.mkdir()
            (artifacts / 'index.js').write_text('verified')
            manifest = root / 'manifest.json'
            manifest.write_text(json.dumps({'index.js': deploy.sha(artifacts / 'index.js')}))
            deploy.verify_manifest(artifacts, manifest, exact=True)
            (artifacts / 'unverified.js').write_text('extra')
            with self.assertRaises(deploy.Guardrail):
                deploy.verify_manifest(artifacts, manifest, exact=True)

    def load_helper(self, name, root):
        with patch.dict(os.environ, {'CAPITALOS_RELEASE_DIR': str(root)}), patch.object(sys, 'path', [str(deploy.TOOLS), *sys.path]):
            spec = importlib.util.spec_from_file_location(name, deploy.TOOLS / (name + '.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module

    def test_backup_follows_all_pages(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = self.load_helper('capture', Path(folder))
            pages = [dict(data=[{'ROWID': '1'}], next_token='page2', more_records=True),
                     dict(data=[{'ROWID': '2'}], more_records=False)]
            class Client:
                def request(self, path, full=False):
                    return pages.pop(0)
            self.assertEqual(capture.rows(Client(), '/project/test', 'Table'), [{'ROWID': '1'}, {'ROWID': '2'}])
            self.assertFalse(pages)

    def test_backup_refuses_truncated_and_repeated_pages(self):
        with tempfile.TemporaryDirectory() as folder:
            capture = self.load_helper('capture', Path(folder))
            for response in [dict(data=[], more_records=True),
                             dict(data=[{'ROWID': '1'}], more_records=True, next_token='same')]:
                class Client:
                    def request(self, path, full=False):
                        return response
                with self.assertRaises((RuntimeError, AssertionError)):
                    capture.rows(Client(), '/project/test', 'Table')

    def test_archive_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            prepare = self.load_helper('prepare', root)
            archive = root / 'bad.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr('../escaped', 'untrusted')
            with self.assertRaises(RuntimeError):
                prepare.extract(archive, root / 'destination')
            self.assertFalse((root / 'escaped').exists())

    def test_platform_rules_preserve_auth_and_reject_unknown_routes(self):
        with tempfile.TemporaryDirectory() as folder:
            controls = self.load_helper('platform_controls', Path(folder))
            rules = {'advancedio': {'capitalos-api': [{'.*': {'methods': ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], 'authentication': 'optional'}}]}}
            paused = controls.read_only(rules)
            self.assertEqual(paused['advancedio']['capitalos-api'][0]['.*']['methods'], ['GET'])
            self.assertIn('POST', rules['advancedio']['capitalos-api'][0]['.*']['methods'])
            self.assertEqual(controls.read_only(paused), paused)
            with self.assertRaises(RuntimeError):
                controls.read_only({'advancedio': {'unexpected': []}})

    def env_client(self, root, reads):
        controls = self.load_helper('platform_controls', root)
        function = {'id': '1', 'configuration': {'environment': {'variables': {'A': 'old'}}}}
        calls = []
        class Client:
            def request(self, path, method='GET', body=None, full=False):
                calls.append((method, path))
                if method == 'POST':
                    return {}
                return {'configuration': {'environment': {'variables': reads.pop(0)}}}
        return controls, function, Client(), calls

    def test_env_update_tolerates_eventual_consistency(self):
        with tempfile.TemporaryDirectory() as folder:
            # Stale reads first, then the applied configuration.
            reads = [{'A': 'old'}, {'A': 'old'}, {'A': 'new'}]
            controls, function, client, calls = self.env_client(Path(folder), reads)
            with patch.object(controls.time, 'sleep'):
                controls.update_env(client, deploy.LIVE, function, {'A': 'new'})
            self.assertEqual(calls[0][0], 'POST')
            self.assertEqual(len([c for c in calls if c[0] == 'GET']), 3)

    def test_env_update_still_fails_when_change_never_applies(self):
        with tempfile.TemporaryDirectory() as folder:
            controls, function, client, _ = self.env_client(Path(folder), None)
            class Stuck:
                def request(self, path, method='GET', body=None, full=False):
                    if method == 'POST':
                        return {}
                    return {'configuration': {'environment': {'variables': {'A': 'old'}}}}
            with patch.object(controls.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, 'Runtime change unconfirmed'):
                    controls.update_env(Stuck(), deploy.LIVE, function, {'A': 'new'})

    def test_env_update_rejects_masked_values(self):
        with tempfile.TemporaryDirectory() as folder:
            controls, function, _, _ = self.env_client(Path(folder), None)
            function['configuration']['environment']['variables'] = {'SMTP_APP_PASSWORD': 'real-value'}
            class Masking:
                def request(self, path, method='GET', body=None, full=False):
                    if method == 'POST':
                        return {}
                    return {'configuration': {'environment': {'variables':
                            {'SMTP_APP_PASSWORD': '****', 'A': 'new'}}}}
            with patch.object(controls.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, 'Runtime change unconfirmed'):
                    controls.update_env(Masking(), deploy.LIVE, function, {'A': 'new'})

    def test_platform_check_requires_full_execution_drain(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            controls = self.load_helper('platform_controls', root)
            (root / 'platform-control.json').write_text(json.dumps({'run_id': 'test', 'configured_at': 1000}))
            with patch.object(controls, 'ROOT', root), patch.dict(os.environ, {'CAPITALOS_RUN_ID': 'test'}), patch.object(controls.time, 'time', return_value=1900):
                with self.assertRaisesRegex(RuntimeError, 'drain'):
                    controls.check(None)

    def write_schema(self, root, label, tables):
        (root / label).mkdir(parents=True, exist_ok=True)
        (root / label / 'schema').mkdir(parents=True, exist_ok=True)
        inventory = []
        for position, (name, columns) in enumerate(tables.items()):
            inventory.append({'table_name': name, 'table_id': str(1000 + position)})
            (root / label / 'schema' / (name + '.json')).write_text(json.dumps(columns))
        (root / label / 'tables.json').write_text(json.dumps(inventory))

    def foreign_key_fixture(self, offset):
        # Each project assigns its own table/column IDs for identical schemas.
        return {
            'Partners': [{'column_name': 'ROWID', 'data_type': 'bigint', 'column_id': str(offset + 1)}],
            'Transactions': [
                {'column_name': 'ROWID', 'data_type': 'bigint', 'column_id': str(offset + 2)},
                {'column_name': 'partner_id', 'data_type': 'foreign key', 'max_length': '50',
                 'constraint_type': 'ON-DELETE-SET-NULL', 'column_id': str(offset + 3),
                 'parent_table': '1000', 'parent_column': str(offset + 1)},
            ],
        }

    def load_audit(self, root):
        # catalyst is cached in sys.modules, so bind ROOT to this test's directory.
        audit = self.load_helper('audit', root)
        return audit, patch.object(audit, 'ROOT', root)

    def test_foreign_key_schemas_compare_by_name_across_projects(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            audit, bind = self.load_audit(root)
            self.write_schema(root, 'target', self.foreign_key_fixture(0))
            self.write_schema(root, 'recovery-before', self.foreign_key_fixture(500))
            with bind:
                target, recovery = audit.names('target'), audit.names('recovery-before')
                expected = {p.stem: audit.schema(json.loads(p.read_text()), target)
                            for p in (root / 'target/schema').glob('*.json')}
                actual = {p.stem: audit.schema(json.loads(p.read_text()), recovery)
                          for p in (root / 'recovery-before/schema').glob('*.json')}
            # Identical schemas with different hosted IDs must not be reported as drift.
            self.assertEqual(actual, expected)
            partner_id = next(c for c in expected['Transactions'] if c['column_name'] == 'partner_id')
            self.assertEqual(partner_id['parent_table'], 'Partners')
            self.assertEqual(partner_id['parent_column'], 'ROWID')

    def test_real_foreign_key_schema_drift_is_still_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            audit, bind = self.load_audit(root)
            self.write_schema(root, 'target', self.foreign_key_fixture(0))
            drifted = self.foreign_key_fixture(500)
            drifted['Transactions'][1]['constraint_type'] = 'ON-DELETE-CASCADE'
            self.write_schema(root, 'recovery-before', drifted)
            with bind:
                target, recovery = audit.names('target'), audit.names('recovery-before')
                self.assertNotEqual(
                    audit.schema(json.loads((root / 'recovery-before/schema/Transactions.json').read_text()), recovery),
                    audit.schema(json.loads((root / 'target/schema/Transactions.json').read_text()), target))

    def test_unresolvable_foreign_key_parent_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            audit, bind = self.load_audit(root)
            fixture = self.foreign_key_fixture(0)
            fixture['Transactions'][1]['parent_table'] = '9999'
            self.write_schema(root, 'target', fixture)
            with bind, self.assertRaisesRegex(RuntimeError, 'Unresolved foreign-key parent_table'):
                audit.schema(json.loads((root / 'target/schema/Transactions.json').read_text()),
                             audit.names('target'))

    def test_template_foreign_key_to_uncaptured_table_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            audit, _ = self.load_audit(root)
            expected = {'Transactions': [{'column_name': 'ROWID', 'data_type': 'bigint'}]}
            components = [{'type': 'column', 'properties': {
                'table_name': 'Transactions', 'column_name': 'partner_id',
                'data_type': 'foreign key', 'parent_table': 'Partners', 'parent_column': 'ROWID'}}]
            with self.assertRaisesRegex(RuntimeError, 'uncaptured table'):
                audit.check_template_references(components, expected)
            expected['Partners'] = [{'column_name': 'OTHER', 'data_type': 'bigint'}]
            with self.assertRaisesRegex(RuntimeError, 'uncaptured column'):
                audit.check_template_references(components, expected)
            expected['Partners'] = [{'column_name': 'ROWID', 'data_type': 'bigint'}]
            audit.check_template_references(components, expected)

    def test_all_release_python_sources_parse(self):
        import ast
        for path in [deploy.REPO / 'scripts/deploy.py', *deploy.TOOLS.glob('*.py')]:
            ast.parse(path.read_text(), filename=str(path))


if __name__ == '__main__':
    unittest.main()
