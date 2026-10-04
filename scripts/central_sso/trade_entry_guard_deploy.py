import importlib.util,json,os,pathlib,time,shutil,hashlib,subprocess
from urllib.request import urlopen
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=pathlib.Path('/root/admin-trade-entry-guard-20261004');source=pathlib.Path('/opt/trade-bidblitz/frontend')
name='trade-bidblitz-frontend-1';backup=name+'-before-entry-guard-20261004';info=m.inspect(name)
assert info['Image']=='sha256:39e123a9ed0a98504eb653474240b896ecd8023dea6c3d55a8be0652d678c185','Concurrent frontend release detected'
baseline=json.loads((root/'source-baseline.json').read_text())
for file,key in [('index.html','index'),('nginx.stage.conf','nginx')]:
 assert hashlib.sha256((source/file).read_bytes()).hexdigest()==baseline[key],'Concurrent frontend source changes detected'
 (root/(file+'.source-before')).write_bytes((source/file).read_bytes())
assert not (source/'public/admin-entry-guard.js').exists()
index=(source/'index.html').read_text();assert '<head>' in index
(source/'index.html').write_text(index.replace('<head>','<head>\n    <script defer src="/admin-entry-guard.js"></script>',1))
(source/'nginx.stage.conf').write_text((root/'nginx.stage.conf').read_text())
shutil.copy2(root/'admin-entry-guard.js',source/'public/admin-entry-guard.js')
created=None;renamed=False
try:
 body=m.clone_body(info,'bidblitz-trade-entry-guard:20261004',None)
 m.engine('POST','/containers/'+name+'/stop?t=20')
 m.engine('POST','/containers/'+name+'/rename?name='+backup);renamed=True
 for network in info['NetworkSettings']['Networks']:m.engine('POST','/networks/'+network+'/disconnect',{'Container':backup,'Force':True})
 created=m.engine('POST','/containers/create?name='+name,body)['Id'];m.engine('POST','/containers/'+created+'/start')
 for attempt in range(25):
  state=m.inspect(name)['State']
  if state['Running'] and state.get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert state['Running'] and state.get('Health',{}).get('Status')=='healthy','Frontend health check failed'
 with urlopen('https://trade.bidblitz.ae/',timeout=20) as r:
  html=r.read().decode();assert 'admin-entry-guard.js' in html;assert 'no-store' in r.headers['Cache-Control']
 with urlopen('https://trade.bidblitz.ae/admin-entry-guard.js',timeout=20) as r:assert r.status==200
 try:
  urlopen('https://trade.bidblitz.ae/assets/missing-admin-entry-test.js',timeout=20);raise AssertionError('Missing assets must return 404')
 except HTTPError as e:assert e.code==404
 result={'published':True,'image':'bidblitz-trade-entry-guard:20261004','backup':backup,'html_no_store':True,'missing_asset_404':True,'app_bundle_unchanged':True,'old_assets_retained':True}
 (root/'result.json').write_text(json.dumps(result));print('TRADE_ENTRY_GUARD_PUBLISHED',json.dumps(result))
except BaseException:
 if created:
  try:m.engine('DELETE','/containers/'+created+'?force=true')
  except Exception:pass
 if renamed:
  for network,detail in info['NetworkSettings']['Networks'].items():
   endpoint={'Aliases':detail.get('Aliases') or [],'IPAMConfig':{'IPv4Address':detail['IPAddress']}}
   m.engine('POST','/networks/'+network+'/connect',{'Container':backup,'EndpointConfig':endpoint})
  m.engine('POST','/containers/'+backup+'/rename?name='+name);m.engine('POST','/containers/'+name+'/start')
 for file in ['index.html','nginx.stage.conf']:shutil.copy2(root/(file+'.source-before'),source/file)
 (source/'public/admin-entry-guard.js').unlink(missing_ok=True)
 raise
finally:
 try:m.engine('DELETE','/containers/trade-entry-guard-probe-20261004?force=true')
 except Exception:pass
