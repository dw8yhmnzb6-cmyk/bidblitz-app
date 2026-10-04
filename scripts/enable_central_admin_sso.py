"""Activate only the four live-tested existing project handoffs."""
import asyncio,json,os,re,subprocess,sys,time
from pathlib import Path
from urllib.request import Request,urlopen
sys.path.insert(0,'/var/www/bidblitz/backend')
from core import security
from core.database import db
from core.config import JWT_SECRET,JWT_ALGORITHM
import jwt
projects=('eyes','trade','nex','stack')
env=Path('/var/www/bidblitz/backend/.env')
backup=Path('/var/www/bidblitz/admin-sso-env-backup-20261004');backup.mkdir(mode=0o700,exist_ok=False)
original=env.read_bytes();(backup/'backend.env').write_bytes(original);(backup/'backend.env').chmod(0o600)
async def authenticated():
 emails=[s.strip().lower() for s in os.getenv('BIDBLITZ_OWNER_EMAILS',os.getenv('BIDBLITZ_CANONICAL_OWNER_EMAIL','admin@bidblitz.ae')).split(',') if s.strip()]
 owner=await db.users.find_one({'email':{'$in':emails},'role':{'$in':['admin','super_admin']}})
 assert owner and not owner.get('is_disabled') and not owner.get('login_disabled')
 assert not any(owner.get(k) for k in ('mfa_enabled','two_factor_enabled','totp_enabled','totp_secret','two_factor_secret'))
 token=security.create_access_token(str(owner.get('_id') or owner['id']),owner['email'])
 claims=jwt.decode(token,JWT_SECRET,algorithms=[JWT_ALGORITHM]);claims['exp']=int(time.time())+300
 return jwt.encode(claims,JWT_SECRET,algorithm=JWT_ALGORITHM)
token=asyncio.run(authenticated())
keys=json.loads(Path('/root/bidblitz-central-sso-20261004.json').read_text())
assert keys['owner_id']==os.getenv('BIDBLITZ_OWNER_ID','bidblitz-owner-primary').strip()
updates={'BIDBLITZ_OWNER_ID':keys['owner_id']}
for name in projects:
 assert len(keys['keys'][name])>=48
 updates['BIDBLITZ_SSO_'+name.upper()+'_SECRET']=keys['keys'][name]
 updates['BIDBLITZ_SSO_'+name.upper()+'_ENABLED']='true'
lines=original.decode().splitlines()
lines=[line for line in lines if not any(re.match(r'^\s*(?:export\s+)?'+re.escape(key)+r'\s*=',line) for key in updates)]
lines.extend(k+'='+v for k,v in updates.items())
try:
 temp=env.with_name('.env.central-sso-tmp');temp.write_text('\n'.join(lines)+'\n');temp.chmod(0o600);os.replace(temp,env)
 subprocess.run(['pm2','restart','api'],check=True,stdout=subprocess.DEVNULL)
 data=None
 for _ in range(20):
  try:
   with urlopen(Request('http://127.0.0.1:8001/api/admin/projects',headers={'Authorization':'Bearer '+token}),timeout=5) as r:data=json.load(r)
   if all(next(p for p in data['projects'] if p['id']==name)['open_mode']=='sso' for name in projects):break
  except Exception:pass
  time.sleep(1)
 assert data and len(data['projects'])==35 and all(next(p for p in data['projects'] if p['id']==name)['open_mode']=='sso' for name in projects)
 target=Path('/tmp/bidblitz-admin-browser-cookie.txt');fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:f.write(token)
 print('CENTRAL_HANDOFFS_ENABLED',json.dumps({'projects':list(projects),'catalogue_count':35,'existing_owner_checked':True,'native_entries':sum(p['open_mode']=='internal' for p in data['projects'])}))
except BaseException:
 env.write_bytes(original);env.chmod(0o600);subprocess.run(['pm2','restart','api'],stdout=subprocess.DEVNULL);print('CENTRAL_FLAGS_ROLLED_BACK');raise
