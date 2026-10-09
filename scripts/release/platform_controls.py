"""CapitalOS Development platform controls. Private snapshots precede every change.

The barrier covers the inventoried app/API/job writers. Console/OAuth administrators
must not issue out-of-band writes during the release; they retain recovery access.
"""
import copy
import json
import os
from pathlib import Path
import sys
import time
import urllib.request
import urllib.error
import zipfile
from catalyst import Catalyst, ROOT, save

LIVE = '71834000000017016'
RECOVERY = '71834000000073259'
PROJECTS = (LIVE, RECOVERY)
WORKERS = {'capitalos-daily-summary': 'DAILY_SUMMARY_EMAILS_ENABLED', 'capitalos-month-end': 'MONTH_END_EMAILS_ENABLED'}
ENV_CONFIRM_POLLS = 30
ENV_CONFIRM_INTERVAL = 2


def require(value, message):
    if not value:
        raise RuntimeError(message)


def controls(c, pid):
    base = '/project/' + pid
    project = c.request(base)
    require(str(project['id']) == pid, 'Wrong project identity')
    functions = c.request(base + '/function')
    require({f['name'] for f in functions} == {'capitalos-api', *WORKERS}, 'Unexpected writer functions')
    require(not c.request(base + '/project-user'), 'App users require direct datastore permission review')
    require(not c.request(base + '/api-gateway')['status'], 'API Gateway configuration requires review')
    require(not c.request(base + '/cron'), 'Unexpected legacy cron')
    return {'project': project, 'security': c.request(base + '/security-rules'),
            'functions': {f['name']: c.request(base + '/function/' + str(f['id'])) for f in functions},
            'crons': c.request(base + '/job_scheduling/cron')}


def read_only(rules):
    expected = {'advancedio': {'capitalos-api': [{'.*': {'methods': ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], 'authentication': 'optional'}}]}}
    paused = copy.deepcopy(expected)
    paused['advancedio']['capitalos-api'][0]['.*']['methods'] = ['GET']
    require(rules in [expected, paused], 'Unexpected routes/authentication; do not overwrite')
    return paused


def set_security(c, pid, desired):
    path = '/project/' + pid + '/security-rules'
    if c.request(path) == desired:
        return
    # This installation's API credential can read rules but its update call is
    # rejected. Never retry with another credential or fabricate a success receipt.
    save('console-action.json', {'pending': True, 'project': pid, 'desired_security_rules': desired,
         'reason': 'Security Rules update requires the authorized console session',
         'url': 'https://console.catalyst.zoho.in/baas/60088793510/project/' + pid + '/Development#/serverless/security-rules'})
    print('CONSOLE ACTION REQUIRED: Security Rules for project ' + pid, flush=True)
    for _ in range(120):
        if c.request(path) == desired:
            save('console-action.json', {'pending': False, 'project': pid, 'verified': True})
            return
        time.sleep(5)
    raise RuntimeError('Timed out waiting for verified console Security Rules change')


def update_env(c, pid, function, values):
    path = '/project/' + pid + '/function/' + str(function['id'])
    env = copy.deepcopy(function['configuration']['environment']['variables'])
    env.update(values)
    c.request(path + '/configuration', 'POST', {'environment': {'variables': env}})
    # Configuration reads are eventually consistent: a correct update can still read
    # back stale briefly. Poll for the exact desired state; never accept a mismatch.
    for _ in range(ENV_CONFIRM_POLLS):
        if c.request(path)['configuration']['environment']['variables'] == env:
            return
        time.sleep(ENV_CONFIRM_INTERVAL)
    require(False, 'Runtime change unconfirmed')


def probe(host):
    results = {}
    for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
        request = urllib.request.Request(host + '/server/capitalos-api/__capitalos_release_probe__',
                                         method=method, data=b'{}', headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                status, body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read()
        # Only a platform method rejection is proof. The app's unknown-route 404 is not.
        require(status in [400, 403, 405] and b'INVALID_REQUEST_METHOD' in body,
                'Platform write restriction not proven for ' + method + ' (HTTP ' + str(status) + ')')
        results[method] = status
    return results


def check(c, drained=True):
    state = json.loads((ROOT / 'platform-control.json').read_text())
    require(state['run_id'] == os.environ['CAPITALOS_RUN_ID'], 'Maintenance owner mismatch')
    require(state.get('configured_at'), 'Maintenance setup incomplete')
    if drained:
        require(time.time() - state['configured_at'] >= 930, 'Job/API drain interval has not elapsed')
    for pid in PROJECTS:
        current = controls(c, pid)
        require(current['security'] == read_only(current['security']), 'Security rules no longer read-only')
        require(all(not cron['cron_status'] for cron in current['crons']), 'Scheduled writer enabled')
        for name, key in WORKERS.items():
            require(current['functions'][name]['configuration']['environment']['variables'].get(key) == 'false', 'Job writer enabled')
        save('platform-probes/' + pid + '.json', probe(current['project']['project_domain_details']['project_domain']))
    return state


def inspect_writer_inventory(c, pid):
    from capture import download
    base = '/project/' + pid
    job = c.request(base + '/export', 'POST', {'template_format': 'JSON'})
    for _ in range(100):
        try:
            status = c.request(base + '/export/status')
        except RuntimeError as error:
            if 'HTTP 404' not in str(error): raise
            time.sleep(1)
            continue
        if status.get('id') == job.get('id') and status.get('status') == 'Completed': break
        require(status.get('status') != 'Error_Processing', 'Configuration export failed')
        time.sleep(1)
    else: raise RuntimeError('Configuration export timed out')
    name = 'platform-inventory/' + pid + '.zip'
    download(c, base + '/export/download', name)
    with zipfile.ZipFile(ROOT / name) as archive:
        components = json.loads(archive.read('project-template-1.0.0.json'))['components']
    for key in ['EventListeners', 'AppSail', 'Pipelines', 'Cron']:
        require(not components.get(key), 'Unexpected writer component: ' + key)
    permissions = [item['properties'] for item in components['Datastore'] if item['type'] == 'tablePermission']
    require(permissions, 'No captured datastore permissions')
    for permission in permissions:
        require(permission['role_name'] in ['App User', 'App Administrator'], 'Unknown datastore role')
        if permission['role_name'] == 'App User':
            require(set(permission['table_permissions']) <= {'SELECT'}, 'App user has direct write access')
    save('platform-inventory/' + pid + '.json', {'known_writers_only': True, 'no_app_users': True,
         'app_user_permissions_read_only': True, 'administrative_access': 'Retained for the exclusive release/recovery operator'})


def quiesce(c):
    require(not (ROOT / 'platform-control.json').exists(), 'Never reuse a maintenance attempt')
    state = {'run_id': os.environ['CAPITALOS_RUN_ID'], 'projects': {}, 'configured_at': None, 'resumed': False}
    for pid in PROJECTS:
        state['projects'][pid] = controls(c, pid)
        read_only(state['projects'][pid]['security'])
        inspect_writer_inventory(c, pid)
    require(not state['projects'][RECOVERY]['crons'], 'Recovery schedules must be absent')
    save('platform-control.json', state)
    for pid in PROJECTS:
        base = '/project/' + pid
        original = state['projects'][pid]
        set_security(c, pid, read_only(original['security']))
        for cron in original['crons']:
            if cron['cron_status']:
                c.request(base + '/job_scheduling/cron/' + str(cron['id']), 'PATCH', {'cron_status': False})
        for name, key in WORKERS.items():
            fn = original['functions'][name]
            if fn['configuration']['environment']['variables'].get(key) != 'false':
                update_env(c, pid, fn, {key: 'false'})
    state['configured_at'] = time.time()
    save('platform-control.json', state)
    check(c, drained=False)
    # Cloud Job Functions have a maximum 15-minute execution time. A 30-second
    # margin also drains Advanced I/O (30-second max). Never equate quiet reads to a drain.
    while time.time() - state['configured_at'] < 930:
        time.sleep(min(30, max(0, 930 - (time.time() - state['configured_at']))))
        print('Waiting for the platform execution drain.', flush=True)
    check(c)


def resume(c):
    path = ROOT / 'platform-control.json'
    if not path.exists():
        return
    state = json.loads(path.read_text())
    require(state['run_id'] == os.environ['CAPITALOS_RUN_ID'], 'Maintenance owner mismatch')
    for pid, original in state['projects'].items():
        base = '/project/' + pid
        # Restore only controls changed by this hook. Preserve newly deployed SMTP settings.
        for name, key in WORKERS.items():
            fn = c.request(base + '/function/' + str(original['functions'][name]['id']))
            prior = original['functions'][name]['configuration']['environment']['variables'].get(key)
            if prior is not None:
                update_env(c, pid, fn, {key: prior})
        for cron in original['crons']:
            c.request(base + '/job_scheduling/cron/' + str(cron['id']), 'PATCH', {'cron_status': cron['cron_status']})
            require(c.request(base + '/job_scheduling/cron/' + str(cron['id']))['cron_status'] == cron['cron_status'], 'Cron resume unconfirmed')
        # Keep recovery read-only after a successful release; restore originals on a failed attempt.
        verified = (ROOT / 'live-verification.json').exists() and json.loads((ROOT / 'live-verification.json').read_text()).get('passed') is True
        desired = read_only(original['security']) if pid == RECOVERY and verified else original['security']
        set_security(c, pid, desired)
        require(c.request(base + '/security-rules') == desired, 'Security resume unconfirmed')
    state['resumed'] = True
    save('platform-control.json', state)


def isolation(c):
    check(c)
    current = controls(c, RECOVERY)
    require(not current['crons'], 'Recovery schedules found')
    # No application users; only the owner/release administrator can access raw datastore.
    # The legacy API's email paths are POST-only and all non-GET invocations are blocked.
    require(not c.request('/project/' + RECOVERY + '/project-user'), 'Recovery application users found')


def main():
    os.umask(0o077)
    mode = sys.argv[1]
    c = Catalyst()
    if mode == 'quiesce': quiesce(c)
    elif mode == 'assert_quiesced': check(c)
    elif mode == 'resume': resume(c)
    elif mode == 'isolation': isolation(c)
    else: raise RuntimeError('Unknown platform hook')
    receipt = {'passed': True, 'run_id': os.environ['CAPITALOS_RUN_ID'], 'project': LIVE, 'recovery_project': RECOVERY}
    receipt[{'quiesce':'all_writers_paused','assert_quiesced':'all_writers_paused','resume':'writes_resumed','isolation':'outbound_email_blocked'}[mode]] = True
    if mode == 'isolation': receipt['access_permissions_verified'] = True
    Path(os.environ['CAPITALOS_RECEIPT']).write_text(json.dumps(receipt))


if __name__ == '__main__': main()
