"""Rollback only this exact approved release, preserving later deployments."""
import hashlib,json,os,shutil,subprocess,sys,time
from pathlib import Path
release=Path(sys.argv[1]);root=Path('/var/www/bidblitz')
if not (release/'result.json').exists():
    print('No completed release to roll back');sys.exit(0)
result=json.loads((release/'result.json').read_text());backup=Path(result['backup']);manifest=json.loads((backup/'manifest.json').read_text())
assert json.loads((root/'frontend/build/version.json').read_text())['build_id']==result['build_id'], 'Later frontend deployed; refusing rollback'
for p in manifest['existing']:
    assert hashlib.sha256((root/p).read_bytes()).digest()==hashlib.sha256((release/p).read_bytes()).digest(), 'Later backend change; refusing rollback'
failed=root/'frontend'/('build.admin-rolled-back-'+str(int(time.time())))
os.rename(root/'frontend/build',failed);os.rename(Path(result['previous_frontend']),root/'frontend/build')
for p,existed in manifest['existing'].items():
    if existed:shutil.copy2(backup/p,root/p)
    elif (root/p).exists():(root/p).unlink()
subprocess.run(['pm2','restart','api'],check=True,stdout=subprocess.DEVNULL)
print('ADMIN_RELEASE_ROLLED_BACK',str(backup))
