import asyncio, os, time, sys
from pathlib import Path
ROOT=Path("/var/www/bidblitz")
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
p=Path("/tmp/bidblitz-admin-browser-cookie.txt")
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,"w") as out: out.write(token)
print("SHORT_LIVED_BROWSER_VERIFICATION_READY")
