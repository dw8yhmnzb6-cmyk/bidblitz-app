import asyncio,json,os
from datetime import timedelta
from sqlalchemy import select
from app.core.database import get_session
from app.models import Customer
from app.services.auth_security import create_auth_session,utc_now
from app.services.auth_mfa import active_totp_factor
from app.api.routes.auth import _login_success_payload,_email_verification_required
async def main():
 async for db in get_session():
  owner_id=os.environ['TRADE_BIDBLITZ_LOCAL_ADMIN_ID']
  customer=(await db.execute(select(Customer).where(Customer.id==owner_id))).scalar_one()
  assert customer.is_active and customer.role=='SUPER_ADMIN' and not _email_verification_required(customer)
  assert await active_totp_factor(db,owner_id) is None,'Use an authenticated browser for an MFA owner'
  now=utc_now()
  session=await create_auth_session(db,customer_id=owner_id,device_name='Admin Safari render diagnostic',user_agent='Read-only Playwright diagnostic',now=now)
  session.expires_at=now+timedelta(minutes=5)
  await db.commit()
  token=_login_success_payload(customer,session)['access_token']
  fd=os.open('/tmp/trade-admin-render-cookie.txt',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
  with os.fdopen(fd,'w') as f:f.write(token)
  print('FIVE_MINUTE_EXISTING_OWNER_DIAGNOSTIC_SESSION_READY')
  break
asyncio.run(main())
