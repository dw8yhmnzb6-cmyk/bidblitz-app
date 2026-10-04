import importlib.util,json,pathlib,time,hashlib
from urllib.request import urlopen
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=pathlib.Path('/root/admin-trade-render-fix-20261004');patch=json.loads((root/'patch.json').read_text())
name='trade-bidblitz-frontend-1';backup=name+'-before-render-fix-20261004';info=m.inspect(name)
assert info['Image']==patch['baseline_image'],'Concurrent frontend release detected'
assert hashlib.sha256(pathlib.Path('/opt/trade-bidblitz/frontend/src/App.jsx').read_bytes()).hexdigest()==patch['source_app_sha256'],'Source changed concurrently'
api=m.inspect('trade-bidblitz-backend-1')
created=None;renamed=False
try:
 body=m.clone_body(info,'bidblitz-trade-render-fix:20261004',None)
 m.engine('POST','/containers/'+name+'/stop?t=20');m.engine('POST','/containers/'+name+'/rename?name='+backup);renamed=True
 for network in info['NetworkSettings']['Networks']:m.engine('POST','/networks/'+network+'/disconnect',{'Container':backup,'Force':True})
 created=m.engine('POST','/containers/create?name='+name,body)['Id'];m.engine('POST','/containers/'+created+'/start')
 for _ in range(25):
  state=m.inspect(name)['State']
  if state['Running'] and state.get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert state.get('Health',{}).get('Status')=='healthy'
 with urlopen('https://trade.bidblitz.ae/?admin_render_check=20261004',timeout=20) as r:
  html=r.read().decode();assert patch['patched_asset'] in html and 'admin-entry-guard.js' in html and 'no-store' in r.headers['Cache-Control']
 with urlopen('https://trade.bidblitz.ae/assets/'+patch['patched_asset'],timeout=20) as r:assert hashlib.sha256(r.read()).hexdigest()==patch['patched_sha256']
 after=m.inspect('trade-bidblitz-backend-1');assert after['Id']==api['Id'] and after['Image']==api['Image']
 result={**patch,'published':True,'image':m.inspect(name)['Image'],'backup':backup,'api_unchanged':True,'existing_assets_retained':True}
 (root/'result.json').write_text(json.dumps(result));print('TRADE_RENDER_FIX_PUBLISHED',json.dumps(result))
except BaseException:
 if created:
  try:m.engine('DELETE','/containers/'+created+'?force=true')
  except Exception:pass
 if renamed:
  for network,detail in info['NetworkSettings']['Networks'].items():
   m.engine('POST','/networks/'+network+'/connect',{'Container':backup,'EndpointConfig':{'Aliases':detail.get('Aliases') or [],'IPAMConfig':{'IPv4Address':detail['IPAddress']}}})
  m.engine('POST','/containers/'+backup+'/rename?name='+name);m.engine('POST','/containers/'+name+'/start')
 raise
finally:
 try:m.engine('DELETE','/containers/trade-render-fix-probe-20261004?force=true')
 except Exception:pass
