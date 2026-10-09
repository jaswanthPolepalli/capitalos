"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
import os,json,sys,time,datetime,hashlib,urllib.request,urllib.parse,zipfile,io
from pathlib import Path
from catalyst import Catalyst,ROOT,save,ORG
os.umask(0o077)
def rows(c,base,name):
 out=[];token=None;seen=set()
 while True:
  d=c.request(base+'/table/'+name+'/row?max_rows=200'+('&next_token='+urllib.parse.quote(token) if token else ''),full=True)
  out.extend(d['data']);token=d.get('next_token')
  if d.get('more_records') and not token:raise RuntimeError('Missing row pagination token')
  if not token:break
  assert token not in seen;seen.add(token)
 assert len({str(r['ROWID']) for r in out})==len(out)
 return sorted(out,key=lambda r:str(r['ROWID']))
def download(c,path,out):
 req=urllib.request.Request('https://api.catalyst.zoho.in/baas/v1'+path,headers={'Authorization':'Zoho-oauthtoken '+c.token,'CATALYST-ORG':ORG,'Environment':'Development'})
 with urllib.request.urlopen(req,timeout=60) as r:blob=r.read()
 with zipfile.ZipFile(io.BytesIO(blob)) as z:assert z.testzip() is None
 f=ROOT/out;f.parent.mkdir(exist_ok=True,parents=True,mode=0o700);f.write_bytes(blob)
 return blob

def capture(pid,label):
 c=Catalyst();base='/project/'+pid
 project=c.request(base)
 assert str(project['id'])==pid,'Project identity mismatch'
 save(label+'/project.json',project)
 tables=c.request(base+'/table');save(label+'/tables.json',tables)
 snapshot={}
 for t in tables:
  name=t['table_name'];snapshot[name]=rows(c,base,name)
  save(label+'/data/'+name+'.json',snapshot[name])
  save(label+'/schema/'+name+'.json',c.request(base+'/table/'+name+'/column'))
 save(label+'/job-crons.json',c.request(base+'/job_scheduling/cron'))
 save(label+'/job-pools.json',c.request(base+'/job_scheduling/jobpool'))
 save(label+'/legacy-crons.json',c.request(base+'/cron'))
 save(label+'/row-counts.json',{k:len(v) for k,v in snapshot.items()})
 functions=c.request(base+'/function');save(label+'/functions.json',functions)
 for f in functions:
  save(label+'/function-config/'+f['name']+'.json',c.request(base+'/function/'+str(f['id'])))
  download(c,base+'/function/'+str(f['id'])+'/download',label+'/artifacts/'+f['name']+'.zip')
 history=c.request(base+'/webapp/history');save(label+'/frontend-history.json',history)
 active=next(v for v in history if v.get('status'))
 download(c,base+'/webapp/history/'+str(active['history_id'])+'/download',label+'/artifacts/frontend.zip')
 folders=c.request(base+'/folder');save(label+'/folders.json',folders)
 assert not folders,'Stored files require full capture before proceeding'
 job=c.request(base+'/export','POST',{'template_format':'JSON'});save(label+'/export-job.json',job)
 for _ in range(100):
  try:s=c.request(base+'/export/status')
  except RuntimeError as e:
   if 'HTTP 404' not in str(e):raise
   time.sleep(1);continue
  if s.get('id')==job.get('id') and s.get('status')=='Completed':break
  if s.get('id')==job.get('id') and s.get('status')=='Error_Processing':raise RuntimeError('Project export failed')
  time.sleep(1)
 else:raise RuntimeError('Export timeout')
 save(label+'/export-status.json',s)
 download(c,base+'/export/download',label+'/project.zip')
 assert c.request(base+'/table')==tables,'Table inventory/permissions changed during backup'
 for name,original in snapshot.items():assert rows(c,base,name)==original,'Concurrent writes: '+name
 root=ROOT/label
 checks={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in root.rglob('*') if f.is_file()}
 save(label+'/checksums.json',checks)
 assert all(hashlib.sha256((root/n).read_bytes()).hexdigest()==h for n,h in checks.items())
 save(label+'/backup-verification.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':pid,'environment':'Development','data_verified':True,'tables':len(snapshot),'rows':sum(map(len,snapshot.values())),'files_verified':len(checks),'frontend_history_id':active['history_id'],'consistency':'Runner write-barrier hooks must pass before and after capture; two full snapshots also match','rollback_ready':False})
 print(label,'backup verified:',len(snapshot),'tables;',sum(map(len,snapshot.values())),'rows;',len(checks),'checksums; frontend',active['history_id'],flush=True)
if __name__=='__main__':capture(sys.argv[1],sys.argv[2])
