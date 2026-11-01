#!/usr/bin/env python3
"""Activate a tested additive image; preserve runtime, data and worker identity."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request

ROOT = Path('/opt/rubi')
IMAGE = 'rubi-production:call-all-users-1031'
BASE = 'sha256:a3ac4bf1ec3a5140ead9f288503f562ffa5e886087bcd916067dd68a6840a3a8'
BACKUP = 'backup-20261031T120301852069Z'


def run(args, timeout=60):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Operation failed: ' + ' '.join(args[:3]))
    return result.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', 'rubi-production-'+name+'-1']))[0]


def same_runtime(before, after):
    env = lambda value: dict(row.split('=', 1) for row in value['Config']['Env'])
    mounts = lambda value: sorted(value['Mounts'], key=lambda row: row['Destination'])
    return env(before) == env(after) and mounts(before) == mounts(after)


def healthy():
    for path in ['/api/v1/health', '/login']:
        with urllib.request.urlopen('https://avinaofficial.ir'+path, timeout=10) as response:
            body = response.read()
            if response.status != 200:
                raise RuntimeError('Public health failed')
            if path.endswith('/health') and json.loads(body)['data']['status'] != 'ok':
                raise RuntimeError('API unhealthy')
    assets = re.findall(r'<script[^>]+src="(/_next/static/[^"]+)"', body.decode())
    if not assets:
        raise RuntimeError('Missing Web assets')
    for asset in assets:
        with urllib.request.urlopen('https://avinaofficial.ir'+asset, timeout=10) as response:
            if response.status != 200:
                raise RuntimeError('Asset unhealthy')
    probe = "fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>process.exitCode=1)"
    run(['docker', 'exec', 'rubi-production-worker-1', 'node', '-e', probe], 10)
    query = '''BEGIN READ ONLY; SELECT action FROM integration_telephony_audit WHERE action IN ('AMI_CONNECTED','AMI_GAP','AMI_STOPPED') ORDER BY "createdAt" DESC,id DESC LIMIT 1; COMMIT;'''
    if run(['docker', 'exec', 'rubi-production-postgres-1', 'psql', '-X', '-U', 'rubi', '-d', 'rubi', '-qAtc', query]).strip() != 'AMI_CONNECTED':
        raise RuntimeError('AMI not connected')


def main():
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    os.umask(0o077)
    build = json.loads((ROOT/'CALL-ALL-USERS-BUILD-1031.json').read_text())
    image_id = json.loads(run(['docker', 'image', 'inspect', IMAGE]))[0]['Id']
    if not build['complete'] or build['image_id'] != image_id:
        raise SystemExit('Validated final image required')
    if not (Path('/var/lib/rubi-backup-export')/BACKUP).is_dir():
        raise SystemExit('Existing encrypted pre-change backup required')
    with open(ROOT/'avina-deploy.lock') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        before = {name: inspect(name) for name in ['api', 'web', 'worker', 'postgres', 'redis']}
        if any(before[name]['Image'] != BASE for name in ['api', 'web', 'worker']):
            raise SystemExit('Live version changed; integrate before deployment')
        path = ROOT/'compose.yaml'
        original = path.read_text()
        updated = original
        for name in ['api', 'web']:
            old = before[name]['Config']['Image']
            if updated.count('image: '+old+'\n') != 1:
                raise SystemExit('Unexpected Compose image reference')
            updated = updated.replace('image: '+old+'\n', 'image: '+IMAGE+'\n')
        work = ROOT/'private/call-all-users-release-1031'
        work.mkdir(mode=0o700)
        (work/'compose.before.yaml').write_text(original)
        command = ['docker', 'compose', '-f', str(path)]

        def replace(text):
            temporary = work/'compose.temporary'
            temporary.write_text(text)
            os.chmod(temporary, path.stat().st_mode & 0o777)
            os.replace(temporary, path)

        result = {'complete': False, 'backup': BACKUP}
        try:
            replace(updated)
            # Worker shares API's network namespace; recreate it with API.
            run(command+['up', '-d', '--no-deps', '--force-recreate', 'api', 'worker', 'web'], 240)
            for _ in range(35):
                try:
                    healthy()
                    break
                except Exception:
                    time.sleep(2)
            else:
                raise RuntimeError('Post-deploy readiness failed')
            for name in ['api', 'worker', 'web']:
                after = inspect(name)
                expected = before[name]['Image'] if name == 'worker' else image_id
                if after['Image'] != expected or not same_runtime(before[name], after):
                    raise RuntimeError('Unexpected runtime change: '+name)
            if any(inspect(name)['Id'] != before[name]['Id'] for name in ['postgres', 'redis']):
                raise RuntimeError('Data service changed')
            if run(['systemctl', 'is-active', 'rubi-call-recordings.timer']).strip() != 'active':
                raise RuntimeError('Recording timer inactive')
            result.update(complete=True, image_id=image_id, worker_authenticated=True, ami_connected=True, recording_timer=True, schema_changed=False)
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as stream:
                stream.write('\nOwn-extension popups1031: preserve current develop5b overlays; recover polling after tab/network/session recovery; show proven inbound destination without inventing an answer. No IAM/schema/recording changes.\n')
        except Exception as error:
            replace(original)
            run(command+['up', '-d', '--no-deps', '--force-recreate', 'api', 'worker', 'web'], 240)
            result.update(rolled_back=True, failure=str(error))
        report = ROOT/'CALL-ALL-USERS-RELEASE-1031.json'
        report.write_text(json.dumps(result, indent=2))
        os.chmod(report, 0o644)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
