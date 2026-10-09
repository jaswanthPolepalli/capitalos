"""Verify identity and schema compatibility before resetting reusable recovery."""
import json
import zipfile
from catalyst import ROOT, Catalyst


def schema(columns):
    keys = ('column_name', 'data_type', 'is_mandatory', 'is_unique', 'max_length',
            'search_index_enabled', 'audit_consent', 'constraint_type')
    result = sorted([{k: col[k] for k in keys if k in col} for col in columns], key=lambda col: col['column_name'])
    if any(col.get('data_type') == 'foreign key' for col in result):
        raise RuntimeError('Foreign-key restoration requires a reviewed adapter')
    return result


def audit():
    source = json.loads((ROOT / 'target/project.json').read_text())
    recovery = json.loads((ROOT / 'recovery-before/project.json').read_text())
    if str(source['id']) != '71834000000017016' or str(recovery['id']) != '71834000000073259':
        raise RuntimeError('Unexpected project identity')
    if recovery['project_name'] != 'CapitalOS-Cards-Check':
        raise RuntimeError('Unexpected recovery project name')
    for label in ['target', 'recovery-before']:
        tables = json.loads((ROOT / label / 'tables.json').read_text())
        if {t['table_name'] for t in tables} != {p.stem for p in (ROOT / label / 'data').glob('*.json')}:
            raise RuntimeError('Incomplete table backup inventory')
    expected = {p.stem: schema(json.loads(p.read_text())) for p in (ROOT / 'target/schema').glob('*.json')}
    actual = {p.stem: schema(json.loads(p.read_text())) for p in (ROOT / 'recovery-before/schema').glob('*.json')}
    with zipfile.ZipFile(ROOT / 'target/project.zip') as archive:
        components = json.loads(archive.read('project-template-1.0.0.json'))['components']['Datastore']
    if {item['properties']['table_name'] for item in components if item['type'] == 'table'} != set(expected):
        raise RuntimeError('Exported schema does not match captured table inventory')
    if actual != expected:
        raise RuntimeError('Recovery/live schema mismatch; review before reset')
    c = Catalyst()
    for endpoint in ['job_scheduling/cron', 'cron']:
        if c.request('/project/71834000000073259/' + endpoint):
            raise RuntimeError('Recovery schedules must be absent')
    (ROOT / 'isolation').mkdir(exist_ok=True)
    (ROOT / 'isolation/project.json').write_text(json.dumps(recovery))


if __name__ == '__main__':
    audit()
