"""Persist the narrow receiver source and key settings for the existing deployment paths."""
import os,re,shutil,subprocess,json
from pathlib import Path
root=Path('/root/central-sso-release-20261004')
def update_env(path,project):
 original=path.read_bytes();backup=root/(project+'-original.env')
 if not backup.exists():backup.write_bytes(original);backup.chmod(0o600)
 additions=dict(line.split('=',1) for line in Path('/root/central-sso-secrets-20261004/'+project+'.env').read_text().splitlines() if line)
 lines=[line for line in original.decode().splitlines() if not any(re.match(r'^\s*(?:export\s+)?'+re.escape(key)+r'\s*=',line) for key in additions)]
 lines.extend(k+'='+v for k,v in additions.items())
 tmp=path.with_name(path.name+'.sso-tmp');tmp.write_text('\n'.join(lines)+'\n');tmp.chmod(0o600);os.replace(tmp,path)
for project in ('nex','stack'):
 live=Path('/opt/bidblitz-'+project);stage=Path('/opt/central-sso-'+project+'-20261004')
 subprocess.run(['git','-C',str(live),'diff','--quiet'],check=True)
 subprocess.run(['git','-C',str(live),'diff','--cached','--quiet'],check=True)
 sha=subprocess.check_output(['git','-C',str(stage),'rev-parse','HEAD'],text=True).strip()
 subprocess.run(['git','-C',str(live),'switch','-c','work/central-sso-production-20261004',sha],check=True,stdout=subprocess.DEVNULL)
 compose=live/'compose.yaml';content=compose.read_text();backup=root/(project+'-compose-original.yaml')
 if not backup.exists():backup.write_text(content)
 assert content.count('  api:\n')==1 and '    env_file:' not in content[content.index('  api:\n'):content.index('  api:\n')+350]
 content=content.replace('  api:\n','  api:\n    env_file:\n      - /root/central-sso-secrets-20261004/'+project+'.env\n',1);compose.write_text(content)
 subprocess.run(['git','-C',str(live),'add','compose.yaml'],check=True)
 subprocess.run(['git','-C',str(live),'-c','user.name=BidBlitz Admin','-c','user.email=admin@bidblitz.ae','commit','-m','Keep central owner settings in the existing compose deployment'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(live),'push','origin','HEAD:refs/heads/work/central-sso-production-20261004'],check=True)
 print('PERSISTED_RECEIVER_SOURCE_AND_CONFIGURATION',project,flush=True)
live=Path('/opt/eyes-bidblitz');stage=Path('/opt/central-sso-eyes-20261004')
paths=subprocess.check_output(['git','-C',str(stage),'diff-tree','--no-commit-id','-r','--name-only','HEAD'],text=True).splitlines()
for rel in paths:
 dst=live/rel;old=subprocess.run(['git','-C',str(stage),'show','HEAD^:'+rel],capture_output=True)
 if old.returncode==0:assert dst.read_bytes()==old.stdout,'Eyes source changed outside the approved patch: '+rel
 else:assert not dst.exists(),'Unexpected Eyes source file: '+rel
for rel in paths:
 dst=live/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(stage/rel,dst)
update_env(live/'.env.production','eyes')
# Preserve the previously served, uncommitted customer navigation; add only the SSO frontend hunks.
subprocess.run(['git','-C','/opt/trade-bidblitz','apply','--check','--include=frontend/src/App.jsx','--include=frontend/src/centralHandoff.js','--include=frontend/tests/central-handoff.test.mjs','/tmp/trade.patch'],check=True)
subprocess.run(['git','-C','/opt/trade-bidblitz','apply','--include=frontend/src/App.jsx','--include=frontend/src/centralHandoff.js','--include=frontend/tests/central-handoff.test.mjs','/tmp/trade.patch'],check=True)
update_env(Path('/opt/trade-bidblitz/.env'),'trade')
print('PERSISTED_RECEIVER_SOURCE_AND_CONFIGURATION eyes trade',flush=True)
