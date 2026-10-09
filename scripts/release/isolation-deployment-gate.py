"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
from pathlib import Path
import json,sys,hashlib,datetime
r=Path(os.environ['CAPITALOS_RELEASE_DIR'])
sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalyst import Catalyst,save
from capture import rows
backup=r/'isolation-before-rollback'
assert json.loads((backup/'backup-verification.json').read_text())['data_verified']
assert json.loads((r/'isolation/restore-verification.json').read_text())['passed']
assert json.loads((r/'recovery-reset-gate.json').read_text())['passed']
for f,h in json.loads((backup/'checksums.json').read_text()).items():assert hashlib.sha256((backup/f).read_bytes()).hexdigest()==h
c=Catalyst();base='/project/71834000000073259'
for f in (r/'isolation/data').glob('*.json'):
 assert json.loads(f.read_text())==json.loads((backup/'data'/f.name).read_text())
 assert rows(c,base,f.stem)==json.loads(f.read_text())
assert not c.request(base+'/job_scheduling/cron') and not c.request(base+'/cron')
assert (r/'release-procedure.md').exists()
save('isolation/first-deployment-gate.json',{'passed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fresh_restored_project_backup':'isolation-before-rollback','restoration_verified':True,'previous_recovery_build_redeploy_verified':'recovery-reset-gate.json','rollback_commands':'release-procedure.md'})
print('Recovery deployment gate passed.')
