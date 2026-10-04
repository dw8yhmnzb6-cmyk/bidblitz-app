import importlib.util,json,subprocess,time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
info=m.inspect('trade-bidblitz-frontend-1');assert info['Image']=='sha256:39e123a9ed0a98504eb653474240b896ecd8023dea6c3d55a8be0652d678c185'
import socket
s=socket.socket();s.bind(('127.0.0.1',5299));s.close()
body=m.clone_body(info,'bidblitz-trade-entry-guard:20261004',None)
body['HostConfig']['PortBindings']={'8080/tcp':[{'HostIp':'127.0.0.1','HostPort':'5299'}]}
body['HostConfig']['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
body['NetworkingConfig']['EndpointsConfig']={n:{'Aliases':[]} for n in info['NetworkSettings']['Networks']}
name='trade-entry-guard-probe-20261004'
created=m.engine('POST','/containers/create?name='+name,body);m.engine('POST','/containers/'+created['Id']+'/start')
for _ in range(15):
 try:
  with urlopen('http://127.0.0.1:5299/healthz',timeout=3) as r:assert r.status==200
  break
 except Exception:time.sleep(1)
with urlopen('http://127.0.0.1:5299/',timeout=10) as r:
 html=r.read().decode();assert 'admin-entry-guard.js' in html;assert 'no-store' in r.headers['Cache-Control']
with urlopen('http://127.0.0.1:5299/admin-entry-guard.js',timeout=10) as r:assert r.status==200
try:
 urlopen('http://127.0.0.1:5299/assets/missing-admin-guard.js',timeout=10);raise AssertionError('Missing JS must not return SPA HTML')
except HTTPError as e:assert e.code==404
for p in Path('/root/admin-trade-entry-guard-20261004/old-assets').glob('*'):
 with urlopen('http://127.0.0.1:5299/assets/'+p.name,timeout=10) as r:assert r.read()==p.read_bytes()
print('TRADE_ENTRY_IMAGE_PREFLIGHT_PASSED',json.dumps({'html_no_store':True,'missing_asset_404':True,'old_assets_retained':True,'probe_port':5299}))
