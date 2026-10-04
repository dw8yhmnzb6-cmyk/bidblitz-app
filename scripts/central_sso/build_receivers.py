import subprocess,json,shutil,os,hashlib
from pathlib import Path
def run(args,**kw):return subprocess.run(args,check=True,**kw)
plans={
 'eyes':('eyes-prod-api-1','/opt/central-sso-eyes-20261004/backend',['app/main.py','app/store.py','app/central_sso.py','app/routes/bidblitz_sso.py']),
 'nex':('bidblitz-nex-dev-api-1','/opt/central-sso-nex-20261004/apps/api',['app/main.py','app/bidblitz_sso.py','app/central_sso.py']),
 'stack':('bidblitz-stack-dev-api-1','/opt/central-sso-stack-20261004/apps/api',['main.py','bidblitz_sso.py','central_sso.py','migrations/050_central_sso.sql']),
 'trade':('trade-bidblitz-backend-1','/opt/central-sso-trade-20261004/backend',['app/api/router.py','app/api/routes/bidblitz_sso.py','app/services/central_sso.py','app/security_models.py'])
}
base=Path('/root/central-sso-build-20261004');base.mkdir(mode=0o700,exist_ok=True)
# Preserve the customer navigation already present in the served Trade bundle.
patch=subprocess.check_output(['git','-C','/opt/trade-bidblitz','diff','--','frontend/src/App.jsx'])
run(['git','-C','/opt/central-sso-trade-20261004','apply','-'],input=patch)
p=Path('/opt/central-sso-trade-20261004/backend/alembic/versions/0204_sso_20261004.py')
p.write_text('"""Central owner handoff nonce storage on the actual live auth schema."""\nfrom alembic import op\nimport sqlalchemy as sa\nrevision = "0204_sso_20261004"\ndown_revision = "0204_strategy_builder_auto_demo"\nbranch_labels = None\ndepends_on = None\ndef upgrade():\n op.create_table("central_sso_nonces",sa.Column("nonce_hash",sa.String(64),primary_key=True),sa.Column("expires_at",sa.BigInteger(),nullable=False))\n op.create_index("central_sso_nonce_expiry","central_sso_nonces",["expires_at"])\ndef downgrade():\n op.drop_table("central_sso_nonces")\n')
plans['trade'][2].append('alembic/versions/0204_sso_20261004.py')
for name,(container,source,paths) in plans.items():
 info=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
 run(['docker','tag',info['Image'],'bidblitz-central-base-'+name+':20261004'])
 target=base/name;target.mkdir(exist_ok=True)
 for rel in paths:
  p=Path(source)/rel;compile(p.read_text(),str(p),'exec') if p.suffix=='.py' else None
  t=target/rel;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,t)
 dockerfile='FROM bidblitz-central-base-'+name+':20261004\n'+''.join('COPY '+rel+' /app/'+rel+'\n' for rel in paths)
 (target/'Dockerfile').write_text(dockerfile)
 log=base/(name+'-api-build.log')
 with log.open('w') as f:run(['docker','build','-t','bidblitz-central-'+name+'-api:20261004',str(target)],stdout=f,stderr=subprocess.STDOUT)
 print('API_OVERLAY_BUILT',name,flush=True)
fronts={'eyes':('/opt/central-sso-eyes-20261004/frontend','Dockerfile',{'VITE_API_URL':''}),'nex':('/opt/central-sso-nex-20261004/apps/web','Dockerfile',{}),'stack':('/opt/central-sso-stack-20261004/apps/web','Dockerfile',{}),'trade':('/opt/central-sso-trade-20261004/frontend','Dockerfile.stage',{'VITE_API_URL':'/'})}
for name,(folder,dockerfile,args) in fronts.items():
 log=base/(name+'-web-build.log')
 command=['docker','build','-f',str(Path(folder)/dockerfile),'-t','bidblitz-central-'+name+'-web:20261004']
 for k,v in args.items():command+=['--build-arg',k+'='+v]
 command.append(folder)
 with log.open('w') as f:run(command,stdout=f,stderr=subprocess.STDOUT)
 print('FRONTEND_BUILT',name,flush=True)
print('ALL_RECEIVER_IMAGES_BUILT',flush=True)
