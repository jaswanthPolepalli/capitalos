"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
import json,sys,hashlib,urllib.request,concurrent.futures,datetime,time
from pathlib import Path
from catalyst import Catalyst,ROOT,save
from capture import rows
ENDPOINTS=['partners','allocations','capital-returns','profit-records','credit-cards','partners?deleted=true','allocations?deleted=true','capital-returns?deleted=true','profit-records?deleted=true','credit-cards?deleted=true','activity','reminder-events']
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=35) as r:
    assert r.status==200
    return r.read()
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def canonical(x):
 if isinstance(x,list):return sorted([canonical(v) for v in x],key=lambda v:json.dumps(v,sort_keys=True))
 if isinstance(x,dict):return {k:canonical(v) for k,v in x.items()}
 return x

def api(label,host):
 def fetch(endpoint):
  d=json.loads(get(host+'/server/capitalos-api/'+endpoint));assert d['status']=='success',endpoint
  return endpoint,d['data']
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:result=dict(pool.map(fetch,ENDPOINTS))
 return result
if __name__=='__main__':
 label,mode=sys.argv[1:3];p=json.loads((ROOT/label/'project.json').read_text());host=p['project_domain_details']['project_domain'];pid=str(p['id'])
 result=api(label,host)
 if mode=='baseline':
  save(label+'/api-before.json',result);print(label,'12 API baselines captured');sys.exit(0)
 expected=json.loads((ROOT/label/'api-before.json').read_text());assert canonical(result)==canonical(expected),'API data changed'
 folder=Path(sys.argv[3]);report=sys.argv[4]
 files=[f for f in folder.rglob('*') if f.is_file() and f.name!='client-package.json']
 def check(f):
  rel=str(f.relative_to(folder));blob=get(host+'/app/'+rel)
  assert hashlib.sha256(blob).digest()==hashlib.sha256(f.read_bytes()).digest(),'Asset mismatch: '+rel
  return rel
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:assets=list(pool.map(check,files))
 c=Catalyst();count=0
 for f in (ROOT/label/'data').glob('*.json'):
  expectedRows=json.loads(f.read_text());actualRows=rows(c,'/project/'+pid,f.stem)
  for row in actualRows:
   if row.get('cashback_data') is None:row.pop('cashback_data',None)
  for row in expectedRows:
   if row.get('cashback_data') is None:row.pop('cashback_data',None)
  assert actualRows==expectedRows,'Raw data changed: '+f.stem;count+=len(expectedRows)
 fn=next(f for f in c.request('/project/'+pid+'/function') if f['name']=='capitalos-api');assert fn['stack']=='node24'
 save(report,{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'apis_verified':len(result),'assets_verified':len(assets),'raw_records_unchanged':count,'runtime':'node24','host':host})
 print(label,'passed:',len(result),'APIs,',len(assets),'assets,',count,'raw rows unchanged',flush=True)
