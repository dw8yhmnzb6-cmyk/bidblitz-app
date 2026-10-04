import pathlib,subprocess,json,hashlib
root=pathlib.Path('/root/admin-trade-customer-entry-20261004');root.mkdir(mode=0o700,exist_ok=True)
info=json.loads(subprocess.check_output(['docker','inspect','trade-bidblitz-frontend-1']))[0]
assert info['Image']=='sha256:10627d9336b26f0ea0433ded7849f0f6a831b2277b32c8e3b41f8700f7a9efc8'
assert not info['Mounts']
(root/'baseline-container.json').write_text(json.dumps(info));(root/'baseline-container.json').chmod(0o600)
for old,new in [('/usr/share/nginx/html/index.html','index.html'),('/etc/nginx/conf.d/default.conf','nginx.stage.conf')]:
 subprocess.run(['docker','cp','trade-bidblitz-frontend-1:'+old,str(root/new)],check=True)
index=(root/'index.html').read_text();assert '/admin-customer-entry.js' not in index
(root/'index.html').write_text(index.replace('<head>','<head>\n    <script defer src="/admin-customer-entry.js"></script>',1))
(root/'admin-customer-entry.js').write_bytes(pathlib.Path('/tmp/trade-admin-customer-entry-20261004.js').read_bytes())
config=(root/'nginx.stage.conf').read_text();assert 'location = /admin-customer-entry.js' not in config
config=config.replace('    location / {','    location = /admin-customer-entry.js { add_header Cache-Control "no-store, max-age=0" always; try_files $uri =404; }\n    location / {',1)
(root/'nginx.stage.conf').write_text(config)
source=pathlib.Path('/opt/trade-bidblitz/frontend');assert not (source/'public/admin-customer-entry.js').exists()
baseline={p:hashlib.sha256((source/p).read_bytes()).hexdigest() for p in ['index.html','src/App.jsx']}
(root/'source-baseline.json').write_text(json.dumps(baseline))
(root/'Dockerfile').write_text('FROM '+info['Image']+'\nCOPY index.html admin-customer-entry.js /usr/share/nginx/html/\nCOPY nginx.stage.conf /etc/nginx/conf.d/default.conf\n')
subprocess.run(['docker','build','-t','bidblitz-trade-customer-entry:20261004',str(root)],check=True)
print('TRADE_CUSTOMER_ENTRY_STAGED')
