"""Read-only qualification of the frozen runtime guard candidate."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from catalyst import ROOT

repo = Path(os.environ['CAPITALOS_SOURCE_DIR'])
candidate = ROOT / 'candidate'
files = subprocess.check_output(['git', 'ls-files', '-z', 'functions'], cwd=repo).decode().split('\0')
for name in filter(None, files):
    if name.endswith('/catalyst-config.json'): continue
    if hashlib.sha256((repo / name).read_bytes()).digest() != hashlib.sha256((candidate / name).read_bytes()).digest():
        raise RuntimeError('Candidate differs from tested source: ' + name)
subprocess.run(['npm', 'test', '--', 'tests/release-safety.test.jsx', 'tests/daily-summary-job.test.jsx',
                'tests/month-end-job.test.jsx', 'tests/grouped-payment-email.test.jsx'], cwd=repo, check=True)
receipt = {'passed': True, 'run_id': os.environ['CAPITALOS_RUN_ID'], 'project': '71834000000017016',
           'recovery_project': '71834000000073259', 'candidate_behavior_verified': True}
Path(os.environ['CAPITALOS_RECEIPT']).write_text(json.dumps(receipt))
