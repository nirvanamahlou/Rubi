"""Root host entrypoint: use the existing DB owner only for migration execution.

No credential is printed, written to a file, or passed in a command-line value.
The release script keeps the shared lock, backup, canary and rollback checks.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

revision = sys.argv[1] if len(sys.argv) == 2 else ''
if not re.fullmatch('[0-9a-f]{40}', revision):
    raise SystemExit('Exact tested source revision required')
if os.environ.get('SITE_COMMERCE_CI_APPROVED_REVISION') != revision:
    raise SystemExit('Final-head CI approval required before activation')
container = json.loads(subprocess.check_output(
    ['docker', 'inspect', 'rubi-production-postgres-1'], text=True))[0]
database = dict(item.split('=', 1) for item in container['Config']['Env'] if '=' in item)
user = database['POSTGRES_USER']
name = database['POSTGRES_DB']
password = database['POSTGRES_PASSWORD']
connection = f'postgresql://{quote(user, safe="")}:{quote(password, safe="")}@postgres:5432/{quote(name, safe="")}?schema=public'
environment = {**os.environ, 'SITE_COMMERCE_MIGRATION_DATABASE_URL': connection}
subprocess.run([sys.executable, str(Path(__file__).with_name('release.py')),
                'activate', revision], env=environment, check=True)
