"""Narrow receiver release with container/source backups and automatic rollback."""
import importlib.util,json,os,shutil,subprocess,time
from pathlib import Path
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
os.umask(0o077);root=m.root;assert len(json.loads((root/'receiver-probe-results.json').read_text()))==4
snapshots={};activated=[]
# Preserve runtime environments privately; no credentials enter Git or output.
for project,p in m.plans.items():
 for kind in ('api','web'):
  name=p[kind];info=m.inspect(name);snapshots[name]=info
  (root/(name+'.private.json')).write_text(json.dumps(info))
(root/'runtime-snapshot-manifest.json').write_text(json.dumps({'names':list(snapshots),'timestamp':int(time.time())}))
trade_source=Path('/opt/trade-bidblitz/backend');trade_stage=Path(m.plans['trade']['root']+'/backend')
trade_paths=['app/services/central_sso.py','app/api/routes/bidblitz_sso.py','app/security_models.py','app/api/router.py']
source_backup=root/'trade-source';source_backup.mkdir(exist_ok=True);existing={}
for rel in trade_paths:
 p=trade_source/rel;existing[rel]=p.exists()
 if p.exists():target=source_backup/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
# The preflight has applied this additive migration. Keep it available to old and new startup paths.
migration='alembic/versions/0204_sso_20261004.py';shutil.copy2(trade_stage/migration,trade_source/migration)
(root/'trade-source-manifest.json').write_text(json.dumps(existing))
def detach(name,info):
 for network in info['NetworkSettings']['Networks']:m.engine('POST','/networks/'+network+'/disconnect',{'Container':name,'Force':True})
def reconnect(name,info):
 for network,endpoint in info['NetworkSettings']['Networks'].items():
  cfg={'Aliases':endpoint.get('Aliases') or [],'IPAMConfig':{'IPv4Address':endpoint['IPAddress']}}
  if endpoint.get('GlobalIPv6Address'):cfg['IPAMConfig']['IPv6Address']=endpoint['GlobalIPv6Address']
  m.engine('POST','/networks/'+network+'/connect',{'Container':name,'EndpointConfig':cfg})
def restore_trade():
 for rel,existed in existing.items():
  p=trade_source/rel
  if existed:shutil.copy2(source_backup/rel,p)
  elif p.exists():p.unlink()
def rollback():
 restore_trade()
 for name in reversed(activated):
  info=snapshots[name];backup=name+'-before-central-sso-20261004'
  try:m.engine('DELETE','/containers/'+name+'?force=true')
  except Exception:pass
  m.engine('POST','/containers/'+backup+'/rename?name='+name);reconnect(name,info);m.engine('POST','/containers/'+name+'/start')
 print('RECEIVER_RELEASE_ROLLED_BACK',flush=True)
try:
 for project,p in m.plans.items():
  for kind in ('api','web'):
   name=p[kind];info=snapshots[name];backup=name+'-before-central-sso-20261004'
   m.engine('POST','/containers/'+name+'/stop?t=15')
   m.engine('POST','/containers/'+name+'/rename?name='+backup);detach(backup,info);activated.append(name)
   if project=='trade' and kind=='api':
    for rel in trade_paths:
     dest=trade_source/rel;dest.parent.mkdir(parents=True,exist_ok=True);temp=dest.with_name(dest.name+'.central-release');shutil.copyfile(trade_stage/rel,temp);temp.chmod(0o644);os.replace(temp,dest)
   body=m.clone_body(info,'bidblitz-central-'+project+'-'+kind+':20261004',project if kind=='api' else None)
   m.engine('POST','/containers/create?name='+name,body);m.engine('POST','/containers/'+name+'/start')
   if kind=='api':m.health(project,name)
   else:
    for _ in range(20):
     state=m.inspect(name);healthy=state['State'].get('Health',{}).get('Status')
     if state['State']['Running'] and healthy in (None,'healthy'):break
     time.sleep(1)
    assert state['State']['Running'] and healthy in (None,'healthy'),'Frontend not ready: '+project
   print('RECEIVER_CONTAINER_RELEASED',project,kind,flush=True)
  from urllib.request import urlopen
  from urllib.error import HTTPError
  # The public HTTPS endpoint must resolve to the new POST-only receiver.
  try:
   with urlopen('https://'+project+'.bidblitz.ae/api/auth/bidblitz-sso',timeout=15) as r:status=r.status
  except HTTPError as e:status=e.code
  assert status==405,'Public receiver route missing: '+project+' HTTP '+str(status)
  print('PUBLIC_RECEIVER_READY',project,'HTTPS_METHOD_GATE',status,flush=True)
 result={'released':True,'projects':list(m.plans),'backup_directory':str(root),'containers':activated,'timestamp':int(time.time())}
 (root/'release-results.json').write_text(json.dumps(result,indent=2));print('RECEIVER_RELEASE_COMPLETE',json.dumps(result),flush=True)
except BaseException:
 rollback();raise
