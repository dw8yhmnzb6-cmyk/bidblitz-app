import pathlib,subprocess,json,hashlib
R=pathlib.Path('/root/admin-trade-render-fix-20261004');R.mkdir(mode=0o700,exist_ok=True)
name='trade-bidblitz-frontend-1'
info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
assert info['Image']=='sha256:7304ccdd1141348c95e0db931ee501bf17e899714f5a9bce965e4bb105465ab9','Newer frontend must be inspected first'
assert not info['Mounts']
(R/'baseline-container.json').write_text(json.dumps(info));(R/'baseline-container.json').chmod(0o600)
for source,target in [('/usr/share/nginx/html/index.html','index.html'),('/usr/share/nginx/html/assets/index-Bem6NZgZ.js','original.js'),('/etc/nginx/conf.d/default.conf','nginx.stage.conf')]:
 subprocess.run(['docker','cp',name+':'+source,str(R/target)],check=True)
s=(R/'original.js').read_text()
start=s.index('(0,J.jsxs)(`div`,{className:`metricGrid four`,children:[(0,J.jsx)($,{icon:`signal`,label:`Hosted workers online`')
end=s.index('(0,J.jsxs)(`div`,{className:`twoPanelGrid`',start)
broken=s[start:end];assert broken.endswith('),')
assert all(x in broken for x in ['hostedWorkers','hostedGate','pcFreeReady','hostedAssignments','hosted.live_execution_enabled'])
# The working source already excludes this stale, unsupported KPI row.
source=pathlib.Path('/opt/trade-bidblitz/frontend/src/App.jsx')
assert 'hostedWorkers' not in source.read_text(),'A newer source needs a source-level review'
patched=s[:start]+'(0,J.jsx)(`div`,{className:`panel`,children:`Hosted-worker metrics are not available in this admin overview.`}),'+s[end:]
assert len(patched)<len(s) and 'hostedWorkers' not in patched
asset='index-adminfix-'+hashlib.sha256(patched.encode()).hexdigest()[:12]+'.js'
(R/asset).write_text(patched)
index=(R/'index.html').read_text();assert index.count('index-Bem6NZgZ.js')==1
index=index.replace('index-Bem6NZgZ.js',asset)
if '/admin-entry-guard.js' not in index:index=index.replace('<head>','<head>\n    <script defer src="/admin-entry-guard.js"></script>',1)
(R/'index.html').write_text(index)
guard=pathlib.Path('/opt/trade-bidblitz/frontend/public/admin-entry-guard.js');assert guard.is_file()
(R/'admin-entry-guard.js').write_bytes(guard.read_bytes())
config=(R/'nginx.stage.conf').read_text()
if 'location = /admin-entry-guard.js' not in config:
 add='    location = /index.html { add_header Cache-Control "no-store, max-age=0" always; try_files $uri =404; }\n    location = /admin-entry-guard.js { add_header Cache-Control "no-store, max-age=0" always; try_files $uri =404; }\n    location ^~ /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }\n'
 assert '    location / {' in config
 config=config.replace('    location / {',add+'    location / {',1)
(R/'nginx.stage.conf').write_text(config)
(R/'Dockerfile').write_text('FROM '+info['Image']+'\nCOPY index.html admin-entry-guard.js /usr/share/nginx/html/\nCOPY '+asset+' /usr/share/nginx/html/assets/\nCOPY nginx.stage.conf /etc/nginx/conf.d/default.conf\n')
result={'baseline_image':info['Image'],'original_asset':'index-Bem6NZgZ.js','original_sha256':hashlib.sha256(s.encode()).hexdigest(),'patched_asset':asset,'patched_sha256':hashlib.sha256(patched.encode()).hexdigest(),'source_app_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'removed_unsupported_metric_row':True,'financial_controls_unchanged':True}
(R/'patch.json').write_text(json.dumps(result));print('TRADE_RENDER_FIX_STAGED',json.dumps(result))
subprocess.run(['docker','build','-t','bidblitz-trade-render-fix:20261004',str(R)],check=True)
