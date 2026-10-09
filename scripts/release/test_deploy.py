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

    def test_platform_check_requires_full_execution_drain(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            controls = self.load_helper('platform_controls', root)
            (root / 'platform-control.json').write_text(json.dumps({'run_id': 'test', 'configured_at': 1000}))
            with patch.object(controls, 'ROOT', root), patch.dict(os.environ, {'CAPITALOS_RUN_ID': 'test'}), patch.object(controls.time, 'time', return_value=1900):
                with self.assertRaisesRegex(RuntimeError, 'drain'):
                    controls.check(None)

    def test_all_release_python_sources_parse(self):
        import ast
        for path in [deploy.REPO / 'scripts/deploy.py', *deploy.TOOLS.glob('*.py')]:
            ast.parse(path.read_text(), filename=str(path))


if __name__ == '__main__':
    unittest.main()
