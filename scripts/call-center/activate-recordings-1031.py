#!/usr/bin/env python3
"""Activate recording transport/config only; preserve deployed images and call UI."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request

ROOT = Path('/opt/rubi')
PRIVATE = ROOT/'private/call-recordings-1031'
WORK = PRIVATE/'activation'


def run(args, data=None, timeout=60):
    p = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if p.returncode:
        if WORK.exists(): (WORK/'failure.log').write_bytes(p.stdout+p.stderr)
        raise RuntimeError('Operation failed: '+' '.join(args[:3]))
    return p.stdout.decode()


def inspect(name):
    return json.loads(run(['docker', 'inspect', 'rubi-production-'+name+'-1']))[0]


def environment(container):
    return dict(value.split('=', 1) for value in container['Config']['Env'])


def proposal(original, secret):
    if not re.fullmatch(r'[A-Za-z0-9_-]{48,128}', secret):
        raise RuntimeError('Invalid private upload credential')
    lines = original.splitlines(keepends=True)
    starts = [i for i, line in enumerate(lines) if line.rstrip() == '  api:']
    if len(starts) != 1: raise RuntimeError('Unsupported API layout')
    start = starts[0]
    end = next((i for i in range(start+1, len(lines)) if re.match(r'^  [A-Za-z0-9_-]+:', lines[i])), len(lines))
    locations = [i for i in range(start+1, end) if lines[i].rstrip() == '    environment:']
    if len(locations) != 1 or any('ISSABEL_RECORDING_UPLOAD_SECRET:' in line for line in lines[start:end]):
        raise RuntimeError('Existing upload setting requires inspection')
    lines.insert(locations[0]+1, "      ISSABEL_RECORDING_UPLOAD_SECRET: '"+secret+"'\n")
    return ''.join(lines)


def main():
    if os.geteuid() != 0: raise SystemExit('Root required')
    os.umask(0o077)
    if WORK.exists(): raise SystemExit('Existing attempt requires inspection')
    if (ROOT/'CALL-RECORDINGS-RELEASE-1031.json').exists(): raise SystemExit('Existing receipt requires inspection')
    if 'SHA256:EcjsGnukKM9MEuphc3YKHEbo1vlyukz48fQo+52Y0lg' not in run(['ssh-keygen', '-lf', str(PRIVATE/'known_hosts'), '-E', 'sha256']):
        raise SystemExit('PBX host identity changed')
    config = json.loads((PRIVATE/'config.json').read_text())
    before = {n: inspect(n) for n in ('api', 'worker', 'web', 'postgres', 'redis')}
    native = environment(before['api'])
    if native.get('ISSABEL_ENABLED') != 'true' or native.get('ISSABEL_RECORDING_RETENTION_DAYS') != '90' or native.get('CALL_CENTER_ACCESS_POLICY') != 'ANSWERED':
        raise SystemExit('Existing real-call/access/retention configuration required')
    if any(config['upload_secret'] == native.get(k) for k in ('TELEPHONY_WORKER_SECRET','TELEPHONY_RELAY_SECRET','ISSABEL_AMI_SECRET')):
        raise SystemExit('Recording credential must be dedicated')
    original = (ROOT/'compose.yaml').read_text()
    mode = (ROOT/'compose.yaml').stat().st_mode & 0o777
    proposed = proposal(original, config['upload_secret'])
    run(['/usr/local/sbin/rubi-backup-create-1027'], timeout=600)
    with open(ROOT/'avina-deploy.lock') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if (ROOT/'compose.yaml').read_text() != original or any(inspect(n)['Id'] != c['Id'] for n,c in before.items()):
            raise SystemExit('Concurrent deployment detected')
        WORK.mkdir(mode=0o700)
        (WORK/'compose.before.yaml').write_text(original)
        command = ['docker','compose','-f',str(ROOT/'compose.yaml')]
        report = {'complete': False, 'retention_days': 90, 'schema_changed': False, 'images_preserved': True}
        changed = False
        def replace(content):
            temporary = WORK/'compose.temporary'
            temporary.write_text(content);os.chmod(temporary,mode);os.replace(temporary,ROOT/'compose.yaml')
        try:
            replace(proposed);changed=True
            run(command+['config','--quiet'])
            run(command+['up','-d','--no-deps','--force-recreate','api','worker'], timeout=180)
            probe="fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>process.exitCode=1)"
            for _ in range(40):
                try:
                    with urllib.request.urlopen('https://avinaofficial.ir/api/v1/health',timeout=8) as response:
                        if json.load(response)['data']['status'] != 'ok': raise RuntimeError('Unhealthy API')
                    run(['docker','exec','rubi-production-worker-1','node','-e',probe], timeout=10)
                    query='''BEGIN READ ONLY; SELECT action FROM integration_telephony_audit WHERE action IN ('AMI_CONNECTED','AMI_GAP','AMI_STOPPED') ORDER BY "createdAt" DESC,id DESC LIMIT 1; COMMIT;'''
                    if run(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAtc',query]).strip() != 'AMI_CONNECTED': raise RuntimeError('AMI unavailable')
                    break
                except Exception: time.sleep(2)
            else: raise RuntimeError('Collector/Worker readiness failed')
            for name in ('api','worker'):
                current = inspect(name)
                expected = environment(before[name])
                if name == 'api': expected['ISSABEL_RECORDING_UPLOAD_SECRET'] = config['upload_secret']
                if environment(current) != expected or current['Image'] != before[name]['Image'] or sorted(current['Mounts'],key=lambda x:x['Destination']) != sorted(before[name]['Mounts'],key=lambda x:x['Destination']):
                    raise RuntimeError('Unexpected runtime configuration change')
            if any(inspect(n)['Id'] != before[n]['Id'] for n in ('web','postgres','redis')): raise RuntimeError('Unrelated service changed')
            report.update(complete=True, authenticated_worker=True, ami_authenticated=True, ui_unchanged=True, download_access_pending=True)
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as stream:
                stream.write('\nCall recordings1031: dedicated upload credential enabled,90-day retention preserved; API/Worker recreated together, images/Web/DB preserved.\n')
        except Exception as error:
            if changed:
                replace(original)
                run(command+['up','-d','--no-deps','--force-recreate','api','worker'], timeout=180)
            report.update(failure=str(error),rolled_back=changed)
        target=ROOT/'CALL-RECORDINGS-RELEASE-1031.json'
        target.write_text(json.dumps(report,indent=2));os.chmod(target,0o644)
        print(json.dumps(report))


if __name__ == '__main__': main()
