import importlib.util,json,subprocess,time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
info=m.inspect('trade-bidblitz-frontend-1');assert info['Image']=='sha256:7304ccdd1141348c95e0db931ee501bf17e899714f5a9bce965e4bb105465ab9'
import socket
s=socket.socket();s.bind(('127.0.0.1',5319));s.close()
body=m.clone_body(info,'bidblitz-trade-render-fix:20261004',None)
body['HostConfig']['PortBindings']={'8080/tcp':[{'HostIp':'127.0.0.1','HostPort':'5319'}]}
body['HostConfig']['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
body['NetworkingConfig']['EndpointsConfig']={n:{'Aliases':[]} for n in info['NetworkSettings']['Networks']}
name='trade-render-fix-probe-20261004'
created=m.engine('POST','/containers/create?name='+name,body);m.engine('POST','/containers/'+created['Id']+'/start')
for _ in range(15):
 try:
  with urlopen('http://127.0.0.1:5319/healthz',timeout=3) as r:assert r.status==200
  break
 except Exception:time.sleep(1)
with urlopen('http://127.0.0.1:5319/',timeout=10) as r:
 html=r.read().decode();assert 'admin-entry-guard.js' in html;assert 'no-store' in r.headers['Cache-Control']
with urlopen('http://127.0.0.1:5319/admin-entry-guard.js',timeout=10) as r:assert r.status==200
try:
 urlopen('http://127.0.0.1:5319/assets/missing-admin-guard.js',timeout=10);raise AssertionError('Missing JS must not return SPA HTML')
except HTTPError as e:assert e.code==404
with urlopen('http://127.0.0.1:5319/assets/index-adminfix-af8fc1878b52.js',timeout=10) as r:
 body=r.read();assert b'hostedWorkers' not in body
 import hashlib
 assert hashlib.sha256(body).hexdigest()=='af8fc1878b52889f7e4803d63018447dbf4729860ced63f7355f2c49c1e5444f'
print('TRADE_RENDER_FIX_IMAGE_PREFLIGHT_PASSED')
