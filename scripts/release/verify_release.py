"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
from pathlib import Path
import sys,json,zipfile,hashlib,datetime,concurrent.futures
r=Path(os.environ['CAPITALOS_RELEASE_DIR']);sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalyst import Catalyst,save
from capture import rows,download
from smoke import api,canonical,get
label,workspace,report=sys.argv[1:4];p=json.loads((r/label/'project.json').read_text());pid=str(p['id']);host=p['project_domain_details']['project_domain'];base='/project/'+pid;c=Catalyst();source=r/workspace
apis=api(label,host)
baseline=r/label/'api-before.json'
if baseline.exists():
 expected=json.loads(baseline.read_text())
 assert canonical(apis)==canonical(expected),'API baseline mismatch'
else:save(label+'/api-before.json',apis)
files=[f for f in (source/'client/dist').rglob('*') if f.is_file() and f.name!='client-package.json']
def check(f):
 rel=str(f.relative_to(source/'client/dist'));assert hashlib.sha256(get(host+'/app/'+rel)).digest()==hashlib.sha256(f.read_bytes()).digest(),rel
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(check,files))
count=0
for f in (r/label/'data').glob('*.json'):
 expected=json.loads(f.read_text());assert rows(c,base,f.stem)==expected,'Data changed: '+f.stem;count+=len(expected)
if label=='target':
 assert c.request(base+'/table')==json.loads((r/'target/tables.json').read_text()),'Table inventory/permissions changed'
 for f in (r/'target/schema').glob('*.json'):assert c.request(base+'/table/'+f.stem+'/column')==json.loads(f.read_text()),'Schema changed'
functions={f['name']:f for f in c.request(base+'/function')};result={}
targets=json.loads((source/'catalyst.json').read_text())['functions']['targets']
assert set(functions)==set(targets),'Unexpected function inventory'
for name in targets:
 fn=functions[name];actual=c.request(base+'/function/'+str(fn['id']));config=json.loads((source/'functions'/name/'catalyst-config.json').read_text())['deployment']
 assert actual['stack']==config['stack']=='node24'
 assert actual['configuration']['memory']==config['memory'],name+' memory'
 assert actual['configuration']['environment']['variables']==config['env_variables'],name+' env'
 old=r/'target/function-config'/(name+'.json')
 if old.exists():
  before=json.loads(old.read_text())
  for field in ['type','authentication','is_authenticated']:assert actual.get(field)==before.get(field),name+' '+field
 else:assert actual['type']=='job'
 download(c,base+'/function/'+str(fn['id'])+'/download',report+'-artifacts/'+name+'.zip')
 fc=0
 with zipfile.ZipFile(r/(report+'-artifacts')/(name+'.zip')) as z:
  expected_files={str(f.relative_to(source/'functions'/name)) for f in (source/'functions'/name).rglob('*') if f.is_file() and f.name!='catalyst-config.json' and '.catalyst' not in f.parts}
  actual_files={n for n in z.namelist() if not n.endswith('/') and Path(n).name!='catalyst-config.json' and '.catalyst' not in Path(n).parts}
  assert expected_files==actual_files,name+' unexpected artifact file inventory'
  for f in (source/'functions'/name).rglob('*'):
   if not f.is_file() or f.name=='catalyst-config.json' or '.catalyst' in f.parts:continue
   rel=str(f.relative_to(source/'functions'/name))
   assert rel in z.namelist(),name+' missing '+rel
   assert hashlib.sha256(z.read(rel)).digest()==hashlib.sha256(f.read_bytes()).digest(),name+' changed '+rel
   fc+=1
 result[name]={'files':fc,'id':str(fn['id']),'runtime_and_config_verified':True}
 save(report+'-artifacts/'+name+'-config.json',actual)
if label=='isolation':
 assert not c.request(base+'/job_scheduling/cron');assert not c.request(base+'/cron')
else:

 for endpoint, filename in [('job_scheduling/cron','job-crons'),('job_scheduling/jobpool','job-pools'),('cron','legacy-crons')]:
  assert c.request(base+'/'+endpoint)==json.loads((r/'target'/(filename+'.json')).read_text()),'Existing schedule/pool changed'
 save(report+'-artifacts/scheduler-verified.json',{'unchanged':True})
save(report+'.json',{'passed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':pid,'apis_verified':len(apis),'assets_verified':len(files),'raw_records_unchanged':count,'functions':result})
print(json.dumps({'passed':True,'project':pid,'apis':len(apis),'assets':len(files),'rows':count,'functions':result}))
