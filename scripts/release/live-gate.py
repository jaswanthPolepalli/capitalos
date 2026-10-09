"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
from pathlib import Path
import sys,json,hashlib,zipfile,datetime
r=Path(os.environ['CAPITALOS_RELEASE_DIR']);sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalyst import Catalyst,save
from capture import rows,download
from smoke import api,canonical
for report in ['target/backup-verification.json','isolation/restore-verification.json','rollback-isolation-verification.json','validation.json','candidate-behavior-verification.json']:
 d=json.loads((r/report).read_text());assert d.get('passed',d.get('data_verified')),report
for label in ['target','rollback','candidate']:
 path=r/label/'checksums.json' if label=='target' else r/(label+'-checksums.json')
 for f,h in json.loads(path.read_text()).items():assert hashlib.sha256((r/label/f).read_bytes()).hexdigest()==h,(label,f)
c=Catalyst();base='/project/71834000000017016'
assert c.request(base+'/table')==json.loads((r/'target/tables.json').read_text()),'Table inventory/permissions changed'
for f in (r/'target/data').glob('*.json'):assert rows(c,base,f.stem)==json.loads(f.read_text()),'Data changed: '+f.stem
for f in (r/'target/schema').glob('*.json'):assert c.request(base+'/table/'+f.stem+'/column')==json.loads(f.read_text()),'Schema changed'
for endpoint,filename in [('job_scheduling/cron','job-crons'),('job_scheduling/jobpool','job-pools'),('cron','legacy-crons'),('folder','folders')]:assert c.request(base+'/'+endpoint)==json.loads((r/'target'/(filename+'.json')).read_text()),filename
for f in json.loads((r/'target/functions.json').read_text()):
 name=f['name'];old=json.loads((r/'target/function-config'/(name+'.json')).read_text());actual=c.request(base+'/function/'+str(f['id']))
 for k in ['stack','configuration','type','authentication','is_authenticated']:assert old.get(k)==actual.get(k),name+' '+k
 download(c,base+'/function/'+str(f['id'])+'/download','gate-artifacts/'+name+'.zip')
 with zipfile.ZipFile(r/'gate-artifacts'/(name+'.zip')) as a,zipfile.ZipFile(r/'target/artifacts'/(name+'.zip')) as b:
  assert {n:hashlib.sha256(a.read(n)).hexdigest() for n in a.namelist()}=={n:hashlib.sha256(b.read(n)).hexdigest() for n in b.namelist()},name
history=c.request(base+'/webapp/history');old=json.loads((r/'target/frontend-history.json').read_text())
assert next(v['history_id'] for v in history if v.get('status'))==next(v['history_id'] for v in old if v.get('status'))
host=json.loads((r/'target/project.json').read_text())['project_domain_details']['project_domain']
assert canonical(api('target',host))==canonical(json.loads((r/'target/api-before.json').read_text()))
save('target-deployment-gate.json',{'passed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data_backup_verified':True,'isolated_restore_and_rollback_verified':True,'raw_data_schema_functions_config_frontend_schedules_unchanged':True,'validation_passed':True,'scope':os.environ['CAPITALOS_RELEASE_SCOPE'],'rollback_procedure':'release-procedure.md'})
print('LIVE RELEASE GATE PASSED: fresh data, schema, deployed artifacts/configuration, schedules and rollback verified.')
