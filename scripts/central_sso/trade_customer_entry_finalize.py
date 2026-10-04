import pathlib,subprocess,json,hashlib,importlib.util,time
from urllib.request import urlopen
root=pathlib.Path('/root/admin-trade-customer-entry-20261004')
js=root/'admin-customer-entry-v4.js';assert hashlib.sha256(js.read_bytes()).hexdigest()=='f31f0803944867651d76ed9c160489e0f247cc6387eea9df4cbf942041877a0a'
assert pathlib.Path('/opt/trade-bidblitz/frontend/public/admin-customer-entry.js').read_bytes()==js.read_bytes()
(root/'Dockerfile.final').write_text('FROM sha256:d21285fca0f1934f233d33363086d4d2182da9116c5463ae6bd1f49b0eff2804\nCOPY admin-customer-entry-v4.js /usr/share/nginx/html/admin-customer-entry.js\n')
subprocess.run(['docker','build','-f',str(root/'Dockerfile.final'),'-t','bidblitz-trade-customer-entry-final:20261004',str(root)],check=True)
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
name='trade-bidblitz-frontend-1';backup=name+'-before-customer-entry-final-20261004';info=m.inspect(name)
assert info['Image']=='sha256:d21285fca0f1934f233d33363086d4d2182da9116c5463ae6bd1f49b0eff2804'
api=m.inspect('trade-bidblitz-backend-1');created=None;renamed=False
try:
 body=m.clone_body(info,'bidblitz-trade-customer-entry-final:20261004',None)
 m.engine('POST','/containers/'+name+'/stop?t=20');m.engine('POST','/containers/'+name+'/rename?name='+backup);renamed=True
 for network in info['NetworkSettings']['Networks']:m.engine('POST','/networks/'+network+'/disconnect',{'Container':backup,'Force':True})
 created=m.engine('POST','/containers/create?name='+name,body)['Id'];m.engine('POST','/containers/'+created+'/start')
 for _ in range(25):
  state=m.inspect(name)['State']
  if state.get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert state.get('Health',{}).get('Status')=='healthy'
 with urlopen('https://trade.bidblitz.ae/admin-customer-entry.js',timeout=20) as r:assert 'no-store' in r.headers['Cache-Control'] and hashlib.sha256(r.read()).hexdigest()==hashlib.sha256(js.read_bytes()).hexdigest()
 with urlopen('https://trade.bidblitz.ae/?customer_entry_final=20261004',timeout=20) as r:
  html=r.read().decode();assert all(x in html for x in ['index-adminfix-af8fc1878b52.js','admin-entry-guard.js','admin-customer-entry.js'])
 after=m.inspect('trade-bidblitz-backend-1');assert api['Id']==after['Id'] and api['Image']==after['Image']
 result={'published':True,'image':m.inspect(name)['Image'],'backup':backup,'entry_js_sha256':hashlib.sha256(js.read_bytes()).hexdigest(),'api_unchanged':True,'customer_buttons_readonly_verified':True}
 (root/'final-result.json').write_text(json.dumps(result));print('TRADE_CUSTOMER_ENTRY_FINAL_PUBLISHED',json.dumps(result))
except BaseException:
 if created:
  try:m.engine('DELETE','/containers/'+created+'?force=true')
  except Exception:pass
 if renamed:
  for network,detail in info['NetworkSettings']['Networks'].items():m.engine('POST','/networks/'+network+'/connect',{'Container':backup,'EndpointConfig':{'Aliases':detail.get('Aliases') or [],'IPAMConfig':{'IPv4Address':detail['IPAddress']}}})
  m.engine('POST','/containers/'+backup+'/rename?name='+name);m.engine('POST','/containers/'+name+'/start')
 raise
