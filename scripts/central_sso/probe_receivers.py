"""Deploy only central SSO additions; preserve existing container settings and accounts."""
import base64,hashlib,hmac,http.client,json,os,secrets,shutil,socket,subprocess,time,concurrent.futures
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
class Docker(http.client.HTTPConnection):
 def __init__(self):super().__init__('localhost',timeout=40)
 def connect(self):self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.connect('/var/run/docker.sock')
def engine(method,path,body=None):
 c=Docker();data=json.dumps(body).encode() if body is not None else None
 c.request(method,'/v1.47'+path,body=data,headers={'Content-Type':'application/json'});r=c.getresponse();raw=r.read();c.close()
 if r.status>=400:raise RuntimeError('Docker request failed: '+method+' '+path+' HTTP '+str(r.status))
 return json.loads(raw) if raw else {}
def inspect(name):return engine('GET','/containers/'+name+'/json')
def checked(args,**kw):return subprocess.run(args,check=True,**kw)
plans={
 'eyes':{'api':'eyes-prod-api-1','web':'eyes-prod-web-1','port':8232,'internal':8000,'health':'/api/health','role':'admin','root':'/opt/central-sso-eyes-20261004'},
 'trade':{'api':'trade-bidblitz-backend-1','web':'trade-bidblitz-frontend-1','port':8233,'internal':8000,'health':'/api/health','role':'SUPER_ADMIN','root':'/opt/central-sso-trade-20261004'},
 'nex':{'api':'bidblitz-nex-dev-api-1','web':'bidblitz-nex-dev-web-1','port':8234,'internal':8080,'health':'/api/health/live','role':'OWNER','root':'/opt/central-sso-nex-20261004'},
 'stack':{'api':'bidblitz-stack-dev-api-1','web':'bidblitz-stack-dev-web-1','port':8235,'internal':8080,'health':'/api/health/live','role':'OWNER','root':'/opt/central-sso-stack-20261004'}
}
root=Path('/root/central-sso-release-20261004');root.mkdir(mode=0o700,exist_ok=True)
def clone_body(info,image,project,probe=False):
 cfg={k:v for k,v in info['Config'].items() if k in {'Hostname','Domainname','User','AttachStdin','AttachStdout','AttachStderr','ExposedPorts','Tty','OpenStdin','StdinOnce','Env','Cmd','Healthcheck','ArgsEscaped','Image','Volumes','WorkingDir','Entrypoint','NetworkDisabled','Labels','StopSignal','StopTimeout','Shell'}}
 cfg['Image']=image;cfg['Hostname']='';cfg['Labels']=dict(cfg.get('Labels') or {});cfg['Labels']['io.bidblitz.central-sso.release']='20261004'
 if project:
  settings=dict(line.split('=',1) for line in Path('/root/central-sso-secrets-20261004/'+project+'.env').read_text().splitlines() if line)
  env=dict(x.split('=',1) for x in cfg['Env']);env.update(settings)
  if probe and project in ('nex','stack'):
   from urllib.parse import urlsplit,urlunsplit
   parsed=urlsplit(env['REDIS_URL']);env['REDIS_URL']=urlunsplit((parsed.scheme,parsed.netloc,'/15',parsed.query,parsed.fragment))
  cfg['Env']=[k+'='+v for k,v in env.items()]
 h=json.loads(json.dumps(info['HostConfig']))
 endpoints={}
 for network,detail in info['NetworkSettings']['Networks'].items():
  if probe:endpoints[network]={'Aliases':[]}
  else:
   endpoints[network]={'Aliases':detail.get('Aliases') or [],'IPAMConfig':{'IPv4Address':detail['IPAddress']}}
   if detail.get('GlobalIPv6Address'):endpoints[network]['IPAMConfig']['IPv6Address']=detail['GlobalIPv6Address']
 if probe:
  p=plans[project];h['PortBindings']={str(p['internal'])+'/tcp':[{'HostIp':'127.0.0.1','HostPort':str(p['port'])}]};h['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
  if project=='trade':
   h['Binds']=[x.replace('/opt/trade-bidblitz/backend:','/opt/central-sso-trade-20261004/backend:') for x in h.get('Binds',[])]
 cfg['HostConfig']=h;cfg['NetworkingConfig']={'EndpointsConfig':endpoints};return cfg
def call(project,path,code=None,origin=True,token='',cookie='',csrf='',port=None,method=None):
 p=plans[project];headers={'Host':project+'.bidblitz.ae'}
 if origin:headers['Origin']='https://'+project+'.bidblitz.ae'
 if token:headers['Authorization']='Bearer '+token
 if cookie:headers['Cookie']=cookie
 if csrf:headers['X-CSRF-Token']=csrf
 payload=json.dumps({'code':code}).encode() if code is not None else None
 if payload is not None:headers['Content-Type']='application/json'
 req=Request('http://127.0.0.1:'+str(port or p['port'])+path,data=payload,headers=headers,method=method)
 try:
  with urlopen(req,timeout=15) as r:return r.status,json.loads(r.read() or b'{}'),r.headers
 except HTTPError as e:return e.code,{},e.headers
def sign(project,**changes):
 prefix=project.upper();values=dict(x.split('=',1) for x in Path('/root/central-sso-secrets-20261004/'+project+'.env').read_text().splitlines() if x)
 now=int(time.time());claims={'iss':'https://bidblitz.ae','aud':project,'sub':values[prefix+'_BIDBLITZ_OWNER_ID'],'role':'owner','permissions':['*'],'iat':now,'exp':now+60,'nonce':secrets.token_urlsafe(24),**changes}
 body=base64.urlsafe_b64encode(json.dumps(claims,separators=(',',':'),sort_keys=True).encode()).decode().rstrip('=')
 signature=base64.urlsafe_b64encode(hmac.new(values[prefix+'_BIDBLITZ_SSO_SHARED_SECRET'].encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 return body+'.'+signature
def health(project,name):
 p=plans[project];code="import urllib.request;urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:"+str(p['internal'])+p['health']+"',headers={'Host':'"+project+".bidblitz.ae'}),timeout=4).read()"
 for _ in range(25):
  r=subprocess.run(['docker','exec',name,'python','-c',code],capture_output=True)
  if r.returncode==0:return
  time.sleep(1)
 raise RuntimeError('Receiver health failed: '+project)
def probe():
 # One additive nonce table in the existing NEX authentication DB.
 sql=Path(plans['nex']['root']+'/apps/api/migrations/002_central_sso.sql').read_bytes()
 checked(['docker','exec','-i','bidblitz-nex-dev-postgres-1','psql','-v','ON_ERROR_STOP=1','-U','nex','-d','nex'],input=b'BEGIN;\n'+sql+b'\nCOMMIT;',stdout=subprocess.DEVNULL)
 results=[]
 for project,p in plans.items():
  name='central-sso-probe-'+project+'-20261004';info=inspect(p['api'])
  body=clone_body(info,'bidblitz-central-'+project+'-api:20261004',project,True)
  engine('POST','/containers/create?name='+name,body);engine('POST','/containers/'+name+'/start')
  try:
   health(project,name)
   response=call(project,'/api/auth/bidblitz-sso',sign(project))
   assert response[0]==200,'Owner exchange failed: '+project+' HTTP '+str(response[0])
   data=response[1];role=data.get('role') or data.get('user',{}).get('role');assert role==p['role'],'Existing local role mismatch: '+project
   cookie='; '.join(v.split(';',1)[0] for v in response[2].get_all('Set-Cookie',[]))
   token=data.get('access_token','');csrf=data.get('csrf_token','')
   profile_path='/api/customer/me' if project=='trade' else '/api/auth/me'
   me=call(project,profile_path,token=token,cookie=cookie,csrf=csrf)
   assert me[0]==200,'Existing session not accepted: '+project+' HTTP '+str(me[0])
   me_role=me[1].get('role') or (me[1].get('user') or {}).get('role');assert me_role==p['role'],'Existing session role not confirmed: '+project
   successful=[response]
   replay=sign(project);replay_response=call(project,'/api/auth/bidblitz-sso',replay);assert replay_response[0]==200;successful.append(replay_response)
   assert call(project,'/api/auth/bidblitz-sso',replay)[0]==401,'Replay accepted: '+project
   for change,status in [({'aud':'other-project'},401),({'sub':'unmapped-owner'},403),({'exp':int(time.time())-1},401)]:
    assert call(project,'/api/auth/bidblitz-sso',sign(project,**change))[0]==status,'Rejected claim failed: '+project
   assert call(project,'/api/auth/bidblitz-sso',sign(project),origin=False)[0]==403,'Missing origin accepted: '+project
   parallel_code=sign(project)
   with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    parallel_responses=list(pool.map(lambda _:call(project,'/api/auth/bidblitz-sso',parallel_code),range(2)))
   statuses=[r[0] for r in parallel_responses];successful.extend(r for r in parallel_responses if r[0]==200)
   assert sorted(statuses)==[200,401],'Concurrent replay protection failed: '+project
   for accepted in successful:
    data=accepted[1];cookies='; '.join(v.split(';',1)[0] for v in accepted[2].get_all('Set-Cookie',[]))
    auth=data.get('access_token','');csrf=data.get('csrf_token','')
    logout=call(project,'/api/auth/logout',token=auth,cookie=cookies,csrf=csrf,method='POST')
    assert logout[0] in (200,204),'Existing logout failed: '+project+' HTTP '+str(logout[0])
    revoked=call(project,profile_path,token=auth,cookie=cookies,csrf=csrf)
    assert revoked[0]==401 or (project=='eyes' and revoked[0]==200 and revoked[1].get('user') is None),'Revoked test session accepted: '+project
   results.append({'logout_verified':True,'project':project,'owner_exchange':200,'session_me':200,'role':role,'replay':401,'wrong_subject':403,'expired':401,'origin_required':True,'parallel_nonce_single_winner':True})
   print('RECEIVER_PROBE_PASSED',json.dumps(results[-1]),flush=True)
  finally:engine('DELETE','/containers/'+name+'?force=true')
 (root/'receiver-probe-results.json').write_text(json.dumps(results,indent=2))
if __name__=='__main__':probe()
