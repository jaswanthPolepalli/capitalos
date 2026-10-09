"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
from pathlib import Path
import json,sys,hashlib,zipfile,datetime
r=Path(os.environ['CAPITALOS_RELEASE_DIR']);sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalyst import Catalyst,save
from capture import rows
old=Path(os.environ['CAPITALOS_RECOVERY_BASELINE'])
backup=r/'recovery-before';verification=json.loads((backup/'backup-verification.json').read_text());assert verification['data_verified']
assert json.loads((old/'rollback-isolation-verification.json').read_text())['passed']
for f,h in json.loads((backup/'checksums.json').read_text()).items():assert hashlib.sha256((backup/f).read_bytes()).hexdigest()==h
p=json.loads((backup/'project.json').read_text());pid=str(p['id']);assert pid=='71834000000073259' and p['project_name']=='CapitalOS-Cards-Check'
assert pid!='71834000000017016'
assert {f.name for f in (backup/'data').glob('*.json')}=={f.name for f in (old/'isolation/data').glob('*.json')},'Recovery inventory changed'
assert (r/'release-procedure.md').is_file(),'Missing rollback procedure'
for f in (backup/'data').glob('*.json'):
 assert json.loads(f.read_text())==json.loads((old/'isolation/data'/f.name).read_text()),'Recovery has unique or changed data: '+f.stem
# Existing recovery build is the independently rehearsed prior hosted build.
for name in ['capitalos-api','capitalos-daily-summary','capitalos-month-end']:
 with zipfile.ZipFile(backup/'artifacts'/(name+'.zip')) as z:
  for f in (old/'rollback-isolation/functions'/name).rglob('*'):
   if f.is_file() and f.name!='catalyst-config.json' and '.catalyst' not in f.parts:
    assert z.read(str(f.relative_to(old/'rollback-isolation/functions'/name)))==f.read_bytes(),name
 config=json.loads((backup/'function-config'/(name+'.json')).read_text())
 expected=json.loads((old/'rollback-isolation/functions'/name/'catalyst-config.json').read_text())['deployment']
 assert config['stack']==expected['stack']=='node24'
 assert config['configuration']['environment']['variables']==expected['env_variables']
 assert config['configuration']['memory']==expected['memory']
with zipfile.ZipFile(backup/'artifacts/frontend.zip') as z:
 for f in (old/'rollback-isolation/client/dist').rglob('*'):
  if f.is_file():assert z.read(str(f.relative_to(old/'rollback-isolation/client/dist')))==f.read_bytes()
c=Catalyst();base='/project/'+pid
assert not c.request(base+'/job_scheduling/cron') and not c.request(base+'/cron')
for f in (backup/'data').glob('*.json'):assert rows(c,base,f.stem)==json.loads(f.read_text())
save('recovery-reset-gate.json',{'passed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':pid,'backup':'recovery-before','checksums_verified':True,'no_unique_business_data':True,'data_exactly_matches_previous_isolated_restore':str(old/'isolation/data'),'previous_build_and_runtime_verified':True,'independent_redeployment_evidence':str(old/'rollback-isolation-verification.json'),'rollback':'Restore recovery-before custom fields with ID remapping using tools/restore_isolation.py and redeploy archived artifacts with captured Node24/runtime configuration; preserve original IDs/timestamps in recovery-before. Outbound email stays disabled and no schedules exist. Live is never a restore target.'})
save('isolation/project.json',p)
for f in (backup/'data').glob('*.json'):
 data=json.loads(f.read_text())
 for start in range(0,len(data),100):
  ids=','.join(str(x['ROWID']) for x in data[start:start+100]);c.request(base+'/table/'+f.stem+'/row?ids='+ids,'DELETE')
 assert not rows(c,base,f.stem)
print('Existing recovery project verified, backed up, and emptied for the new restoration. No unique business data; live untouched.')
