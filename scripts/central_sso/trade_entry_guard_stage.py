import pathlib,subprocess,json,hashlib,shutil
ROOT=pathlib.Path('/opt/trade-bidblitz/frontend')
STAGE=pathlib.Path('/root/admin-trade-entry-guard-20261004')
STAGE.mkdir(mode=0o700,exist_ok=True)
c=json.loads(subprocess.check_output(['docker','inspect','trade-bidblitz-frontend-1']))[0]
assert c['Image']=='sha256:39e123a9ed0a98504eb653474240b896ecd8023dea6c3d55a8be0652d678c185','Frontend changed; inspect newer build before patching'
assert not c['Mounts'], 'Mounted frontend needs a different release'
(STAGE/'baseline-container.json').write_text(json.dumps(c));(STAGE/'baseline-container.json').chmod(0o600)
subprocess.run(['docker','cp','trade-bidblitz-frontend-1:/usr/share/nginx/html/index.html',str(STAGE/'index.html')],check=True)
subprocess.run(['docker','cp','trade-bidblitz-frontend-1:/etc/nginx/conf.d/default.conf',str(STAGE/'nginx.stage.conf')],check=True)
old=(STAGE/'index.html').read_text();assert '/admin-entry-guard.js' not in old
(STAGE/'index.before.html').write_text(old)
(STAGE/'index.html').write_text(old.replace('<head>','<head>\n    <script defer src="/admin-entry-guard.js"></script>',1))
config=(STAGE/'nginx.stage.conf').read_text(); assert 'location / {' in config
old_config=config
add='''    location = /index.html {\n        add_header Cache-Control "no-store, max-age=0" always;\n        try_files $uri =404;\n    }\n\n    location = /admin-entry-guard.js {\n        add_header Cache-Control "no-store, max-age=0" always;\n        try_files $uri =404;\n    }\n\n    location ^~ /assets/ {\n        add_header Cache-Control "public, max-age=31536000, immutable";\n        try_files $uri =404;\n    }\n\n'''
config=config.replace('    location / {',add+'    location / {',1)
(STAGE/'nginx.stage.conf').write_text(config)
# Preserve older hashed assets for cached tabs; never replace current assets.
if (STAGE/'old-assets').exists(): shutil.rmtree(STAGE/'old-assets')
old_container=subprocess.check_output(['docker','create','bidblitz-central-trade-web:20261004'],text=True).strip()
try:
 subprocess.run(['docker','cp',old_container+':/usr/share/nginx/html/assets',str(STAGE/'old-assets')],check=True)
finally:subprocess.run(['docker','rm',old_container],stdout=subprocess.DEVNULL,check=True)
(STAGE/'Dockerfile').write_text('FROM '+c['Image']+'\nCOPY index.html admin-entry-guard.js /usr/share/nginx/html/\nCOPY nginx.stage.conf /etc/nginx/conf.d/default.conf\nCOPY old-assets/ /usr/share/nginx/html/assets/\n')
# Source guard will be persisted after image and browser verification.
(STAGE/'source-baseline.json').write_text(json.dumps({'index':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'nginx':hashlib.sha256((ROOT/'nginx.stage.conf').read_bytes()).hexdigest(),'old_live_config':old_config}))
print('TRADE_ENTRY_GUARD_STAGED',json.dumps({'image':c['Image'],'old_assets':len(list((STAGE/'old-assets').glob('*')))}))
