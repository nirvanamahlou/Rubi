#!/usr/bin/env python3
"""Deploy validated Web-only answer-recipient refresh over enabled popups."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request


def run(args, timeout=60):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('Operation failed: ' + ' '.join(args[:3]))
    return p.stdout


def main():
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    os.umask(0o077)
    root = Path('/opt/rubi')
    work = root/'private/call-popup-recipient-current-1031'
    if work.exists():
        raise SystemExit('Existing attempt requires inspection')
    report = json.loads((root/'CALL-POPUP-RECIPIENT-CURRENT-BUILD-1031.json').read_text())
    image = 'rubi-production:call-popup-recipient-current-1031'
    if not report['complete'] or json.loads(run(['docker', 'image', 'inspect', image]))[0]['Id'] != report['image_id']:
        raise SystemExit('Validated image required')
    def inspect(n):
        return json.loads(run(['docker', 'inspect', 'rubi-production-'+n+'-1']))[0]
    before = {n: inspect(n) for n in ('web', 'api', 'worker', 'postgres', 'redis')}
    old = 'rubi-production:travis-sandbox-1031-7e31198756-web'
    if before['web']['Config']['Image'] != old:
        raise SystemExit('Unexpected Web base')
    path = root/'compose.yaml'
    original = path.read_text()
    if original.count('image: '+old+'\n') != 1:
        raise SystemExit('Unexpected Compose layout')
    run(['/usr/local/sbin/rubi-backup-create-1027'], 600)
    with open(root/'avina-deploy.lock') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if path.read_text() != original or any(inspect(n)['Id'] != item['Id'] for n, item in before.items()):
            raise SystemExit('Concurrent deployment detected')
        work.mkdir(mode=0o700)
        (work/'compose.before.yaml').write_text(original)
        def replace(content):
            temp = work/'compose.temporary'
            temp.write_text(content)
            os.chmod(temp, path.stat().st_mode & 0o777)
            os.replace(temp, path)
        command = ['docker', 'compose', '-f', str(path)]
        result = {'complete': False}
        try:
            replace(original.replace('image: '+old+'\n', 'image: '+image+'\n'))
            run(command+['up', '-d', '--no-deps', 'web'], 180)
            for _ in range(30):
                try:
                    with urllib.request.urlopen('https://avinaofficial.ir/login', timeout=8) as response:
                        html = response.read().decode()
                        if response.status != 200:
                            raise RuntimeError('Web not ready')
                    assets = re.findall(r'<script[^>]+src="(/_next/static/[^"]+)"', html)
                    if not assets:
                        raise RuntimeError('No production assets')
                    for asset in assets:
                        with urllib.request.urlopen('https://avinaofficial.ir'+asset, timeout=8) as response:
                            if response.status != 200:
                                raise RuntimeError('Missing asset')
                    break
                except Exception:
                    time.sleep(2)
            else:
                raise RuntimeError('Web readiness failed')
            now = inspect('web')
            if now['Image'] != report['image_id'] or sorted(now['Mounts'], key=lambda m: m['Destination']) != sorted(before['web']['Mounts'], key=lambda m: m['Destination']):
                raise RuntimeError('Web image/mount mismatch')
            if any(inspect(n)['Id'] != before[n]['Id'] for n in ('api', 'worker', 'postgres', 'redis')):
                raise RuntimeError('Unrelated service changed')
            result.update(complete=True, image_id=report['image_id'], web_only=True, assets_verified=len(assets))
            with (root/'DEPLOYMENT-RECORD.txt').open('a') as stream:
                stream.write('\nPopup recipient1031: Web-only answer-recipient refresh; business drafts/CAS baseline preserved; API/Worker unchanged.\n')
        except Exception as error:
            replace(original)
            run(command+['up', '-d', '--no-deps', 'web'], 180)
            result.update(failure=str(error), rolled_back=True)
        target = root/'CALL-POPUP-RECIPIENT-CURRENT-RELEASE-1031.json'
        target.write_text(json.dumps(result, indent=2))
        os.chmod(target, 0o644)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
