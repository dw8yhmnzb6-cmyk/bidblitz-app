import importlib.util,json,subprocess,time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location('probe','/tmp/admin-probe-receivers.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
info=m.inspect('trade-bidblitz-frontend-1');assert info['Image']=='sha256:10627d9336b26f0ea0433ded7849f0f6a831b2277b32c8e3b41f8700f7a9efc8'
import socket
s=socket.socket();s.bind(('127.0.0.1',5329));s.close()
body=m.clone_body(info,'bidblitz-trade-customer-entry:20261004',None)
body['HostConfig']['PortBindings']={'8080/tcp':[{'HostIp':'127.0.0.1','HostPort':'5329'}]}
body['HostConfig']['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
body['NetworkingConfig']['EndpointsConfig']={n:{'Aliases':[]} for n in info['NetworkSettings']['Networks']}
name='trade-customer-entry-probe-20261004'
created=m.engine('POST','/containers/create?name='+name,body);m.engine('POST','/containers/'+created['Id']+'/start')
for _ in range(15):
 try:
  with urlopen('http://127.0.0.1:5329/healthz',timeout=3) as r:assert r.status==200
  break
 except Exception:time.sleep(1)
with urlopen('http://127.0.0.1:5329/',timeout=10) as r:
 html=r.read().decode();assert 'admin-customer-entry.js' in html and 'admin-entry-guard.js' in html;assert 'no-store' in r.headers['Cache-Control']
with urlopen('http://127.0.0.1:5329/admin-entry-guard.js',timeout=10) as r:assert r.status==200
try:
 urlopen('http://127.0.0.1:5329/assets/missing-admin-guard.js',timeout=10);raise AssertionError('Missing JS must not return SPA HTML')
except HTTPError as e:assert e.code==404
with urlopen('http://127.0.0.1:5329/assets/index-adminfix-af8fc1878b52.js',timeout=10) as r:
 body=r.read();assert b'hostedWorkers' not in body
 import hashlib
 assert hashlib.sha256(body).hexdigest()=='af8fc1878b52889f7e4803d63018447dbf4729860ced63f7355f2c49c1e5444f'
print('TRADE_CUSTOMER_ENTRY_IMAGE_PREFLIGHT_PASSED')
