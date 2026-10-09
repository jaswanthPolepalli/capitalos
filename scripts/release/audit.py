"""Verify identity and schema compatibility before resetting reusable recovery."""
import json
import zipfile
from catalyst import ROOT, Catalyst


def names(label):
    """Map this project's table/column IDs to names so schemas compare across projects."""
    tables = {str(t['table_id']): t['table_name']
              for t in json.loads((ROOT / label / 'tables.json').read_text())}
    columns = {}
    for path in (ROOT / label / 'schema').glob('*.json'):
        for col in json.loads(path.read_text()):
            columns[str(col['column_id'])] = col['column_name']
    return {'tables': tables, 'columns': columns}


def schema(columns, lookup):
    """Comparable column definitions. Foreign keys resolve their parent IDs to names
    because every project assigns its own IDs; restore_isolation.py recreates them
    from the exported template using the same parent table/column names."""
    keys = ('column_name', 'data_type', 'is_mandatory', 'is_unique', 'max_length',
            'search_index_enabled', 'audit_consent', 'constraint_type')
    result = []
    for col in columns:
        entry = {k: col[k] for k in keys if k in col}
        if col.get('data_type') == 'foreign key':
            for side in ('table', 'column'):
                key = 'parent_' + side
                reference = str(col.get(key, ''))
                resolved = lookup[side + 's'].get(reference)
                if not resolved:
                    raise RuntimeError('Unresolved foreign-key ' + key + ' on ' + col['column_name'])
                entry[key] = resolved
        result.append(entry)
    return sorted(result, key=lambda col: col['column_name'])


def check_template_references(components, expected):
    """restore_isolation.py addresses foreign-key parents by name; fail here if the
    exported template references a table or column the backup does not contain."""
    for item in components:
        if item['type'] != 'column' or item['properties'].get('data_type') != 'foreign key':
            continue
        properties = item['properties']
        parent = properties['parent_table']
        if parent not in expected:
            raise RuntimeError('Foreign key references an uncaptured table: ' + parent)
        if properties['parent_column'] not in {col['column_name'] for col in expected[parent]}:
            raise RuntimeError('Foreign key references an uncaptured column: '
                               + parent + '.' + properties['parent_column'])


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
    target_names, recovery_names = names('target'), names('recovery-before')
    expected = {p.stem: schema(json.loads(p.read_text()), target_names)
                for p in (ROOT / 'target/schema').glob('*.json')}
    actual = {p.stem: schema(json.loads(p.read_text()), recovery_names)
              for p in (ROOT / 'recovery-before/schema').glob('*.json')}
    with zipfile.ZipFile(ROOT / 'target/project.zip') as archive:
        components = json.loads(archive.read('project-template-1.0.0.json'))['components']['Datastore']
    if {item['properties']['table_name'] for item in components if item['type'] == 'table'} != set(expected):
        raise RuntimeError('Exported schema does not match captured table inventory')
    check_template_references(components, expected)
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
