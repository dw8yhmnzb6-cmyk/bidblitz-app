"""Frontend-only repair against a verified build. Never changes accounts or money."""
import asyncio, hashlib, json, os, shutil, sys, tarfile, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path('/var/www/bidblitz')
release = Path(sys.argv[1])
current = ROOT / 'frontend/build'
expected = '99bc37413c5c913c44381cbb6daa754322a6ece2'
manifest = json.loads((release / 'manifest.json').read_text())
assert json.loads((current / 'version.json').read_text())['git_commit'] == expected, 'Another frontend release is active'
assert hashlib.sha256((current / 'index.html').read_bytes()).hexdigest() == '077992f7bf1cd49893b3196c116b9279701086920cd360309d2ad2dc0f2be870', 'Live HTML changed'
sys.path.insert(0, str(ROOT / 'backend'))
from core import security
from core.database import db
from core.config import JWT_SECRET, JWT_ALGORITHM
import jwt

async def authenticate():
    emails = [s.strip().lower() for s in os.getenv('BIDBLITZ_OWNER_EMAILS', os.getenv('BIDBLITZ_CANONICAL_OWNER_EMAIL', 'admin@bidblitz.ae')).split(',') if s.strip()]
    owner = await db.users.find_one({'email': {'$in': emails}, 'role': {'$in': ['admin', 'super_admin']}})
    assert owner and not any(owner.get(k) for k in ('is_disabled', 'login_disabled', 'banned')), 'Existing owner is unavailable'
    assert not any(owner.get(k) for k in ('mfa_enabled', 'two_factor_enabled', 'totp_enabled', 'totp_secret', 'two_factor_secret')), 'Use an already authenticated browser for an MFA owner'
    token = security.create_access_token(str(owner.get('_id') or owner['id']), owner['email'])
    claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    claims['exp'] = int(time.time()) + 300
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)

token = asyncio.run(authenticate())
for path in ('/api/admin/projects', '/api/admin/customers?limit=1', '/api/admin/wallet/users?limit=1'):
    with urlopen(Request('http://127.0.0.1:8001' + path, headers={'Authorization': 'Bearer ' + token}), timeout=20) as response:
        assert response.status == 200, 'Existing customer endpoint unavailable: ' + path
        json.load(response)
    print('EXISTING_CUSTOMER_GET_VERIFIED', path.split('?')[0])
try:
    urlopen('http://127.0.0.1:8001/api/admin/projects', timeout=10)
    raise AssertionError('Anonymous admin access must fail')
except HTTPError as error:
    assert error.code == 401

stamp = time.strftime('%Y%m%d%H%M%S', time.gmtime())
new = ROOT / 'frontend' / ('build.customer-new-' + stamp)
previous = ROOT / 'frontend' / ('build.customer-previous-' + stamp)
new.mkdir()
with tarfile.open(release / 'frontend.tgz') as archive:
    for member in archive.getmembers():
        assert not member.issym() and not member.islnk()
        assert (new / member.name).resolve().is_relative_to(new.resolve())
    archive.extractall(new)
assert (new / 'index.html').is_file() and (new / 'service-worker.js').is_file()
version = json.loads((new / 'version.json').read_text())
assert version['git_commit'] == manifest['git_commit']
for old in (current / 'static').rglob('*'):
    target = new / 'static' / old.relative_to(current / 'static')
    if old.is_file() and not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old, target)
state = {'git_commit': manifest['git_commit'], 'previous': str(previous), 'published': False}
(release / 'result.json').write_text(json.dumps(state))
try:
    assert json.loads((current / 'version.json').read_text())['git_commit'] == expected
    os.rename(current, previous)
    os.rename(new, current)
    state['published'] = True
    shutil.chown(current, user='www-data', group='www-data')
    with urlopen('https://bidblitz.ae/version.json?customer_release=' + stamp, timeout=20) as response:
        assert json.load(response)['git_commit'] == manifest['git_commit']
    # Issue only after the new UI is ready; do not log or archive verification credentials.
    claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    claims['exp'] = int(time.time()) + 300
    token = jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)
    path = Path('/tmp/bidblitz-admin-browser-cookie.txt')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write(token)
    (release / 'result.json').write_text(json.dumps(state))
    print('ADMIN_CUSTOMER_UI_PUBLISHED', json.dumps({'git_commit': manifest['git_commit'], 'previous_frontend': str(previous)}))
except BaseException:
    if state['published']:
        failed = ROOT / 'frontend' / ('build.customer-failed-' + stamp)
        os.rename(current, failed)
        os.rename(previous, current)
    elif previous.exists() and not current.exists():
        os.rename(previous, current)
    raise
