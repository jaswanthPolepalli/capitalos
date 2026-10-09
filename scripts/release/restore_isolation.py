"""Adapted from the verified October 8 release tooling; invoked by deploy.py."""
import os, sys
if sys.flags.optimize:
 raise RuntimeError('Optimized Python disables release checks; refusing to run')
import pathlib,sys,json,zipfile,re,time,hashlib,os
r=pathlib.Path(os.environ['CAPITALOS_RELEASE_DIR']);sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from catalyst import Catalyst,ROOT,save
from capture import rows
os.umask(0o077)
c=Catalyst()
request=c.request
def consistent_request(path,method='GET',body=None,full=False):
 for attempt in range(20):
  try:return request(path,method,body,full)
  except RuntimeError as e:
   if method!='GET' or 'HTTP 404' not in str(e) or attempt==19:raise
   time.sleep(1)
c.request=consistent_request
p=json.loads((ROOT/'isolation/project.json').read_text());base='/project/'+str(p['id'])
assert p['project_name']=='CapitalOS-Cards-Check'
assert json.loads((ROOT/'recovery-reset-gate.json').read_text())['passed']
assert all(not rows(c,base,t['table_name']) for t in c.request(base+'/table'))
save('isolation/restore-start.json',{'project':p['id'],'gate':'recovery-reset-gate.json','source':'target','rollback':'Restore recovery-before data and artifacts using the archived restoration tools; never alter the live project.'})
source_label=os.environ.get('RESTORE_SOURCE','target')
assert source_label in ['target','recovery-before']
with zipfile.ZipFile(ROOT/source_label/'project.zip') as z:template=json.loads(z.read('project-template-1.0.0.json'))['components']['Datastore']
tables={t['table_name']:t for t in c.request(base+'/table')}
for t in template:
 if t['type']=='table':
  name=t['properties']['table_name']
  if name not in tables:tables[name]=c.request(base+'/table','POST',{'table_name':name,'table_scope':'GLOBAL'})
meta={n:c.request(base+'/table/'+n+'/column') for n in tables}
for name in tables:
 desired=[]
 for t in template:
  if t['type']!='column' or t['properties']['table_name']!=name:continue
  p=t['properties'];typ=p['data_type'];keys=['column_name','data_type','is_mandatory','search_index_enabled','audit_consent']
  if typ in ['varchar','text','bigint','int','double']:keys+=['is_unique']
  if typ in ['varchar','text']:keys+=['max_length']
  col={k:p[k] for k in keys if k in p}
  if typ=='foreign key':
   col['parent_table']=str(tables[p['parent_table']]['table_id']);col['parent_column']=str(next(z for z in meta[p['parent_table']] if z['column_name']==p['parent_column'])['column_id']);col['constraint_type']=p.get('constraint_type','ON-DELETE-SET-NULL')
  desired.append(col)
 existing={x['column_name'] for x in c.request(base+'/table/'+name+'/column')}
 missing=[x for x in desired if x['column_name'] not in existing]
 if missing:c.request(base+'/table/'+name+'/column','POST',missing)
 for attempt in range(20):
  actual={x['column_name']:x for x in c.request(base+'/table/'+name+'/column')}
  if all(x['column_name'] in actual for x in desired):break
  time.sleep(1)
 for col in desired:
  for key in ['data_type','is_mandatory','is_unique','max_length']:
   if key in col:assert str(actual[col['column_name']][key])==str(col[key]),(name,col['column_name'],key)
 print('Restored schema:',name,flush=True)
save('isolation/schema-restoration.json',{'passed':True,'tables':len(tables),'source_schema':'target/project.zip'})
system={'ROWID','CREATORID','CREATEDTIME','MODIFIEDTIME'}
data={f.stem:json.loads(f.read_text()) for f in (ROOT/source_label/'data').glob('*.json')};mapping={};created={}
for name,source in data.items():
 created[name]=[]
 for start in range(0,len(source),100):
  batch=source[start:start+100];payload=[{k:v for k,v in row.items() if k not in system} for row in batch]
  result=c.request(base+'/table/'+name+'/row','POST',payload);assert len(result)==len(batch)
  for original,new in zip(batch,result):
   mapping[str(original['ROWID'])]=str(new['ROWID'])
   created[name].append(new)
 save('isolation/id-map.json',mapping)
pattern=re.compile(r'(?<!\d)('+('|'.join(re.escape(k) for k in mapping))+r')(?!\d)')
def remap(row):
 d={k:v for k,v in row.items() if k not in system}
 for k,v in d.items():
  if isinstance(v,str) and (k in ['partner_id','credit_card_id','allocation_id','entity_id','before_state','after_state','cashback_data'] or (k=='notes' and 'CAPITALOS_' in v)):
   d[k]=pattern.sub(lambda m:mapping[m[0]],v) if mapping else v
 return d
for name,source in data.items():
 updates=[]
 for row in source:
  expected=remap(row);initial={k:v for k,v in row.items() if k not in system}
  if expected!=initial:updates.append({'ROWID':mapping[str(row['ROWID'])],**expected})
 for start in range(0,len(updates),100):c.request(base+'/table/'+name+'/row','PATCH',updates[start:start+100])
 actual=rows(c,base,name);assert len(actual)==len(source)
 byid={str(x['ROWID']):x for x in actual}
 for row in source:
  expected=remap(row);restored=byid[mapping[str(row['ROWID'])]]
  for k,v in expected.items():assert restored.get(k)==v,(name,k,'restored mismatch')
 save('isolation/data/'+name+'.json',actual)
 print('Restored and verified:',name,len(actual),flush=True)
for name in data:assert rows(c,base,name)==json.loads((ROOT/'isolation/data'/(name+'.json')).read_text())
save('isolation/restore-verification.json',{'passed':True,'tables':len(data),'rows':sum(map(len,data.values())),'all_custom_fields_verified':True,'references_remapped':True,'system_metadata':'Original ROWID/CREATORID/timestamps preserved in target backup, isolated generated IDs mapped in id-map.json','complete_second_read_matches':True})
print('ISOLATED RESTORATION VERIFIED',flush=True)
