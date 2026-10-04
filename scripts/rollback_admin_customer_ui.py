import json, os, sys, time
from pathlib import Path

release = Path(sys.argv[1])
state = json.loads((release / 'result.json').read_text())
current = Path('/var/www/bidblitz/frontend/build')
assert state['published']
assert json.loads((current / 'version.json').read_text())['git_commit'] == state['git_commit'], 'Later release is active; refusing to overwrite'
failed = current.with_name('build.customer-failed-' + state['git_commit'][:12] + '-' + str(time.time_ns()))
assert not failed.exists()
os.rename(current, failed)
os.rename(Path(state['previous']), current)
print('ADMIN_CUSTOMER_UI_ROLLED_BACK')
