"""Approved, bounded admin release. No environment/roles/financial data changes."""
import asyncio, hashlib, importlib, json, os, shutil, subprocess, sys, tarfile, time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT=Path('/var/www/bidblitz')
release=Path(sys.argv[1]); expected=json.loads((release/'baseline.json').read_text())
manifest=json.loads((release/'admin-release-manifest.json').read_text())
backend_paths=manifest['backend_paths']
assert all(p.startswith(('backend/core/admin_', 'backend/routes/admin_')) or p=='backend/core/router_registry.py' for p in backend_paths)
assert len(backend_paths)==7
for path,digest in expected.items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, f'Live source changed: {path}'
assert json.loads((ROOT/'frontend/build/version.json').read_text())['git_commit']=='beec9e81579ce45b93b3454e6f09240d3d5a8e98', 'Live frontend changed'
for p in backend_paths:
    target=ROOT/p
    if p not in expected and target.exists():
        assert target.read_bytes()==(release/p).read_bytes(), f'Unexpected existing target: {p}'
    compile((release/p).read_text(),p,'exec')

sys.path.insert(0,str(ROOT/'backend'))
# Load the existing live auth/DB, then only the staged additional owner routes.
from core import security
from core.database import db
import core, routes
core.__path__.insert(0,str(release/'backend/core'))
routes.__path__.insert(0,str(release/'backend/routes'))
from routes import admin_projects, admin_sso
from fastapi import Request as ASGIRequest, Response
from core.config import JWT_SECRET, JWT_ALGORITHM
import jwt

async def prepare():
    import os
    emails=[s.strip().lower() for s in os.getenv('BIDBLITZ_OWNER_EMAILS',os.getenv('BIDBLITZ_CANONICAL_OWNER_EMAIL','admin@bidblitz.ae')).split(',') if s.strip()]
    owner=await db.users.find_one({'email':{'$in':emails},'role':{'$in':['admin','super_admin']}})
    assert owner and not owner.get('is_disabled') and not owner.get('login_disabled'), 'No active existing owner'
    assert not any(owner.get(k) for k in ('mfa_enabled','two_factor_enabled','totp_enabled','totp_secret','two_factor_secret')), 'Owner MFA requires an already authenticated browser session for verification'
    normal=security.create_access_token(str(owner.get('_id') or owner['id']),owner['email'])
    request=ASGIRequest({'type':'http','method':'GET','path':'/api/admin/projects','headers':[(b'authorization',('Bearer '+normal).encode())],'query_string':b''})
    data=await admin_projects.list_admin_projects(request,Response())
    assert len(data['projects'])>=35
    assert all(not p['integration']['remote_access_verified'] for p in data['projects'])
    # Preserve the ordinary local identity; shorten only the verification token.
    claims=jwt.decode(normal,JWT_SECRET,algorithms=[JWT_ALGORITHM]);claims['exp']=int(time.time())+300
    return jwt.encode(claims,JWT_SECRET,algorithm=JWT_ALGORITHM)
token=asyncio.run(prepare())

def get(path,authenticated=False):
    req=Request('http://127.0.0.1:8001'+path,headers={'Authorization':'Bearer '+token} if authenticated else {})
    try:
        with urlopen(req,timeout=8) as response:return response.status,response.read()
    except HTTPError as failure:return failure.code,failure.read()

stamp=time.strftime('%Y%m%d%H%M%S',time.gmtime())
backup=ROOT/('admin-release-backup-'+stamp);backup.mkdir(mode=0o700)
previous=ROOT/'frontend'/('build.admin-previous-'+stamp)
new=ROOT/'frontend'/('build.admin-new-'+stamp)
failed=ROOT/'frontend'/('build.admin-failed-'+stamp)
new.mkdir()
with tarfile.open(release/'frontend.tgz') as archive:
    members=archive.getmembers()
    for entry in members:
        assert not entry.issym() and not entry.islnk()
        assert (new/entry.name).resolve().is_relative_to(new.resolve())
    archive.extractall(new,members=members)
assert (new/'index.html').is_file() and (new/'service-worker.js').is_file()
new_version=json.loads((new/'version.json').read_text())
assert new_version['git_commit']==manifest['git_commit']
# Retain old hashed assets for tabs that have not refreshed yet.
for p in (ROOT/'frontend/build/static').rglob('*'):
    target=new/'static'/p.relative_to(ROOT/'frontend/build/static')
    if p.is_file() and not target.exists(): target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
states={}
for p in backend_paths:
    target=ROOT/p;states[p]=target.exists()
    if target.exists(): dest=backup/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
(backup/'manifest.json').write_text(json.dumps({'existing':states,'previous_frontend':str(previous),'release':manifest}))
activated=False
try:
    for p in backend_paths:
        target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True)
        tmp=target.with_name(target.name+'.admin-release-tmp');shutil.copyfile(release/p,tmp);tmp.chmod(0o644);os.replace(tmp,target)
    subprocess.run(['pm2','restart','api'],check=True,stdout=subprocess.DEVNULL)
    healthy=False
    for attempt in range(15):
        try:
            if get('/api/system/version')[0]==200 and get('/api/admin/projects')[0]==401:
                healthy=True;break
        except Exception: pass
        time.sleep(2)
    assert healthy,'Backend health/unauthenticated gate failed'
    status,body=get('/api/admin/projects',True);assert status==200, 'Existing owner catalogue login failed'
    catalogue=json.loads(body);assert len(catalogue['projects'])>=35
    # One-time paths remain explicitly gated by configuration; no handoff emitted.
    os.rename(ROOT/'frontend/build',previous)
    os.rename(new,ROOT/'frontend/build');activated=True
    subprocess.run(['chown','-R','www-data:www-data',str(ROOT/'frontend/build')],check=True)
    # Exact public HTML and build version prove the active frontend.
    with urlopen('https://bidblitz.ae/index.html?admin_release='+stamp,timeout=20) as response:
        assert response.read()==(ROOT/'frontend/build/index.html').read_bytes()
    with urlopen('https://bidblitz.ae/version.json?admin_release='+stamp,timeout=20) as response:
        assert json.load(response)['build_id']==new_version['build_id']
    # Refresh the short-lived browser verification cookie, kept out of all logs/artifacts.
    claims=jwt.decode(token,JWT_SECRET,algorithms=[JWT_ALGORITHM]);claims['exp']=int(time.time())+300
    secret_file=Path('/tmp/bidblitz-admin-browser-cookie.txt')
    fd=os.open(secret_file,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as output:output.write(jwt.encode(claims,JWT_SECRET,algorithm=JWT_ALGORITHM))
    result={'published':True,'build_id':new_version['build_id'],'projects':len(catalogue['projects']),'owner_login_verified':True,'backup':str(backup),'previous_frontend':str(previous)}
    (release/'result.json').write_text(json.dumps(result))
    print(json.dumps(result))
except BaseException:
    if activated:
        os.rename(ROOT/'frontend/build',failed);os.rename(previous,ROOT/'frontend/build')
    elif previous.exists() and not (ROOT/'frontend/build').exists():os.rename(previous,ROOT/'frontend/build')
    for p,existed in states.items():
        if existed:shutil.copy2(backup/p,ROOT/p)
        elif (ROOT/p).exists():(ROOT/p).unlink()
    subprocess.run(['pm2','restart','api'],stdout=subprocess.DEVNULL)
    print('ADMIN_RELEASE_ROLLED_BACK',str(backup))
    raise
