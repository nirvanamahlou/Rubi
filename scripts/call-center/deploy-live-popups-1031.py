#!/usr/bin/env python3
"""Enable owner-authorized operational popups; preserve private runtime and Web mounts."""
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path('/opt/rubi')
WORK = ROOT / 'private/call-popups-release2-1031'
WEB_BASE = 'rubi-production:358bf900f691016c00ed5b5a9c346cdd7aedea34'
API_BASE = 'rubi-production:call-center-answered-1031-358'
WEB_IMAGE = 'rubi-production:call-popups-1031'
PRIVATE = ROOT / 'private/call-center-live-ingress-release4-1031/issabel.env'


def run(args, timeout=60):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('Operation failed: ' + ' '.join(args[:3]))
    return p.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', 'rubi-production-' + name + '-1']))[0]


def main():
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    os.umask(0o077)
    if WORK.exists():
        raise SystemExit('Existing attempt requires inspection')
    build = json.loads((ROOT/'CALL-POPUPS-BUILD-1031.json').read_text())
    if not build['complete']:
        raise SystemExit('Successful build required')
    image = json.loads(run(['docker', 'image', 'inspect', WEB_IMAGE]))[0]
    if image['Id'] != build['image_id']:
        raise SystemExit('Validated image changed')
    before = {n: inspect(n) for n in ('api', 'web', 'worker', 'postgres', 'redis')}
    if before['api']['Config']['Image'] != API_BASE or any(before[n]['Config']['Image'] != WEB_BASE for n in ('web', 'worker')):
        raise SystemExit('Live release changed; integrate first')
    compose = (ROOT/'compose.yaml').read_text()
    private = PRIVATE.read_text()
    key = "ISSABEL_USER_NOTIFICATIONS_ENABLED='false'"
    if private.count(key) != 1:
        raise SystemExit('Unexpected notification configuration')
    run(['/usr/local/sbin/rubi-backup-create-1027'], 600)
    with open(ROOT/'avina-deploy.lock') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if any(inspect(n)['Id'] != v['Id'] for n, v in before.items()) or (ROOT/'compose.yaml').read_text() != compose or PRIVATE.read_text() != private:
            raise SystemExit('Concurrent changes; retry after inspection')
        WORK.mkdir(mode=0o700)
        (WORK/'compose.before.yaml').write_text(compose)
        (WORK/'issabel.before.env').write_text(private)
        # Replace only the Web service image, preserving API/Worker release and mounts.
        lines = compose.splitlines(keepends=True)
        start = next(i for i, line in enumerate(lines) if line.rstrip() == '  web:')
        end = next((i for i in range(start+1, len(lines)) if lines[i].startswith('  ') and not lines[i].startswith('   ') and lines[i].strip()), len(lines))
        candidates = [i for i in range(start+1, end) if lines[i].strip() == 'image: '+WEB_BASE]
        if len(candidates) != 1:
            raise SystemExit('Unexpected Web image layout')
        lines[candidates[0]] = lines[candidates[0]].replace(WEB_BASE, WEB_IMAGE)
        command = ['docker', 'compose', '-f', str(ROOT/'compose.yaml')]
        report = {'complete': False, 'incoming_enabled': False, 'outgoing_enabled': False}
        def replace(path, content):
            temp = WORK/(path.name+'.temporary')
            temp.write_text(content)
            os.chmod(temp, path.stat().st_mode & 0o777)
            os.replace(temp, path)
        try:
            replace(PRIVATE, private.replace(key, "ISSABEL_USER_NOTIFICATIONS_ENABLED='true'"))
            replace(ROOT/'compose.yaml', ''.join(lines))
            run(command+['up', '-d', '--no-deps', '--force-recreate', 'api', 'worker', 'web'], 180)
            probe = "fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>process.exitCode=1)"
            for _ in range(40):
                try:
                    with urllib.request.urlopen('https://avinaofficial.ir/api/v1/health', timeout=8) as response:
                        if json.load(response)['data']['status'] != 'ok':
                            raise RuntimeError('Unhealthy API')
                    run(['docker', 'exec', 'rubi-production-worker-1', 'node', '-e', probe], 10)
                    q = '''BEGIN READ ONLY; SELECT action FROM integration_telephony_audit WHERE action IN ('AMI_CONNECTED','AMI_GAP','AMI_STOPPED') ORDER BY "createdAt" DESC,id DESC LIMIT 1; COMMIT;'''
                    if run(['docker', 'exec', 'rubi-production-postgres-1', 'psql', '-X', '-U', 'rubi', '-d', 'rubi', '-qAtc', q]).strip() != 'AMI_CONNECTED':
                        raise RuntimeError('AMI unavailable')
                    break
                except Exception:
                    time.sleep(2)
            else:
                raise RuntimeError('Readiness checks failed')
            if inspect('web')['Image'] != build['image_id'] or sorted(inspect('web')['Mounts'], key=lambda m: m['Destination']) != sorted(before['web']['Mounts'], key=lambda m: m['Destination']):
                raise RuntimeError('Web image/mount mismatch')
            for n in ('api', 'worker'):
                a, b = inspect(n), before[n]
                ae, be = (dict(item.split('=', 1) for item in value['Config']['Env']) for value in (a, b))
                if n == 'api':
                    be['ISSABEL_USER_NOTIFICATIONS_ENABLED'] = 'true'
                if ae != be or a['Image'] != b['Image'] or sorted(a['Mounts'], key=lambda m: m['Destination']) != sorted(b['Mounts'], key=lambda m: m['Destination']):
                    raise RuntimeError('Unexpected runtime changes')
            if any(inspect(n)['Id'] != before[n]['Id'] for n in ('postgres', 'redis')):
                raise RuntimeError('Data service changed')
            report.update(complete=True, incoming_enabled=True, outgoing_enabled=True, worker_authenticated=True, ami_authenticated=True, web_image_id=build['image_id'], technical_widget_hidden=True)
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as log:
                log.write('\nCall popup1031: owner-authorized inbound/outbound operational popups enabled; API answered overlay preserved; Worker recreated with API network; no schema/IAM changes.\n')
        except Exception as error:
            replace(PRIVATE, private)
            replace(ROOT/'compose.yaml', compose)
            run(command+['up', '-d', '--no-deps', '--force-recreate', 'api', 'worker', 'web'], 180)
            report.update(failure=str(error), rolled_back=True)
        output = ROOT/'CALL-POPUPS-RELEASE-1031.json'
        output.write_text(json.dumps(report, indent=2))
        os.chmod(output, 0o644)
        print(json.dumps(report))


if __name__ == '__main__':
    main()
