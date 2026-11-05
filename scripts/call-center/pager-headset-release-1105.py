"""Bounded Call Center KPI duotone icon Web release; no DB migrations."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time
import fcntl

os.umask(0o077)
PRIOR = Path('/opt/rubi/avina-safe-develop-refresh-1102/deploy.py')
assert hashlib.sha256(PRIOR.read_bytes()).hexdigest() == 'a8ad55b0f1ba8f19ec8f5d40b2f62efec59a63bf59a175e6fd3fcac2de1c8c0a'
definitions = PRIOR.read_text().split('phase = sys.argv[1]')[0]
guard = "assert read('offserver-backup-verified')['hashes']==before['hashes']"
assert definitions.count(guard) == 2
definitions = definitions.replace(guard, "assert read('server-backup-verified')['hashes']==before['hashes']")
exec(compile(definitions, str(PRIOR), 'exec'))
WORK = ROOT / 'pager-headset-1105'
CONTEXT = WORK / 'context'
IMAGE = 'rubi-production:pager-headset-1105'

SOURCE_FILES = {
    "apps/web/src/modules/call-center/workspace.tsx",
    "apps/web/src/modules/call-center/workspace.module.css",
    "apps/web/src/modules/call-center/workflow.module.css",
    "apps/web/src/modules/call-center/expert-activity.tsx",
    "apps/web/src/modules/call-center/title-icon.tsx",
}
NEW_FILE = 'apps/web/src/modules/call-center/title-icon.tsx'


def source_file(service, name):
    result = subprocess.run(['docker', 'exec', 'rubi-production-' + service + '-1',
                             'cat', '/workspace/' + name], capture_output=True)
    return normalize(result.stdout) if result.returncode == 0 else None


def prepare():
    assert healthy() and not CONTEXT.exists(), 'Healthy baseline and fresh context required'
    state = snapshot()
    manifest = json.loads((WORK / 'manifest.json').read_text())
    assert filehash(WORK / 'payload.tar.gz') == manifest['archiveSha256']
    assert len(manifest['files']) == len(SOURCE_FILES) and set(manifest['files']) == SOURCE_FILES, 'Unexpected source scope'
    assert shutil.disk_usage(ROOT).free > 4 * 1024**3
    CONTEXT.mkdir(mode=0o700)
    with tarfile.open(WORK / 'payload.tar.gz') as archive:
        for member in archive.getmembers():
            assert (member.isfile() or member.isdir()) and not member.name.startswith('/') and '..' not in Path(member.name).parts
        archive.extractall(CONTEXT / 'input', filter='data')
    overlay = CONTEXT / 'overlay'
    (overlay / 'apps/web').mkdir(parents=True)
    run(['docker', 'cp', 'rubi-production-web-1:/workspace/apps/web/src', str(overlay / 'apps/web/src')])
    effective = {}
    for name in manifest['files']:
        current = source_file('web', name)
        base_path, target_path = CONTEXT / 'input/base' / name, CONTEXT / 'input/target' / name
        base = normalize(base_path.read_bytes()) if base_path.exists() else None
        target = normalize(target_path.read_bytes()) if target_path.exists() else None
        assert target is not None, 'Source deletion is not allowed: ' + name
        if name == NEW_FILE:
            assert base is None, 'KPI icon must be absent from the payload base'
            assert current in (None, target), 'Conflicting live KPI icon: ' + name
            result = target
        elif current in (base, target):
            assert base is not None and current is not None, 'Existing KPI presentation files required: ' + name
            result = target
        elif base == target:
            assert base is not None and current is not None, 'Existing KPI presentation files required: ' + name
            result = current
        else:
            assert base is not None and current is not None, 'Existing KPI presentation files required: ' + name
            merge = CONTEXT / 'merge'
            merge.mkdir(exist_ok=True)
            for key, data in [('desired', target), ('base', base), ('current', current)]:
                (merge / key).write_bytes(data)
            result = subprocess.run(['git', 'merge-file', '-p', str(merge / 'desired'),
                                     str(merge / 'base'), str(merge / 'current')], capture_output=True)
            assert result.returncode == 0, 'Live source conflict: ' + name
            result = result.stdout
        destination = overlay / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(result)
        effective[name] = digest(result)
    run(['docker', 'cp', 'rubi-production-web-1:/workspace/apps/web/.next/static', str(CONTEXT / 'previous-static')])
    public = next(m['Source'] for m in state['web']['mounts'] if m['Destination'] == '/workspace/apps/web/public')
    # Copy current Web source, rather than an old Git snapshot, to preserve peer overlays.
    dockerfile = 'FROM ' + state['web']['image'] + '\nWORKDIR /workspace\nCOPY overlay/ ./\nCOPY previous-static/ /tmp/previous-static/\n'
    dockerfile += 'RUN rm -rf apps/web/.next && NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @nora/web build --webpack && cp -an /tmp/previous-static/. apps/web/.next/static/ && rm -rf /tmp/previous-static apps/web/.next/cache\n'
    dockerfile += 'LABEL rubi.pager-headset-1105-source="' + manifest['revision'] + '"\n'
    (CONTEXT / 'Dockerfile').write_text(dockerfile)
    save('prepared', {'base': state, 'revision': manifest['revision'], 'image': IMAGE,
                      'composeHash': filehash(COMPOSE), 'migrations': migrations(),
                      'pendingMigrations': [], 'publicSource': public, 'publicTarget': public,
                      'preservedLiveFiles': effective, 'sourceHashes': effective})
    assert snapshot() == state
    print('PREPARED source files=' + str(len(effective)), flush=True)


def build():
    record = read('prepared')
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    with (WORK / 'build.log').open('w') as log:
        run(['docker', 'build', '--network', 'none', '-t', IMAGE, str(CONTEXT)], stdout=log, stderr=subprocess.STDOUT)
    for app, paths in {
        'web': ['src/modules/call-center', 'src/components/ui/illustration-icon.spec.tsx', 'src/components/layout/navigation-collapse.spec.ts', 'src/i18n/coverage.spec.ts']
    }.items():
        with (WORK / ('tests-' + app + '.log')).open('w') as log:
            run(['docker', 'run', '--rm', '--network', 'none', '-e', 'NODE_ENV=test',
                 '--workdir', '/workspace/apps/' + app, '--entrypoint', 'node', IMAGE,
                 'node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', *paths], stdout=log, stderr=subprocess.STDOUT)
    # Start the candidate Web server on loopback before replacing any live service.
    env_file = WORK / 'canary.env'
    env_file.write_text('\n'.join(inspect('web')['Config']['Env']) + '\n')
    canary = 'rubi-pager-headset-1105-canary'
    try:
        run(['docker', 'run', '-d', '--name', canary, '-p', '127.0.0.1:3331:3000',
             '--env-file', str(env_file), '--entrypoint', 'node', IMAGE,
             'apps/web/node_modules/next/dist/bin/next', 'start', 'apps/web',
             '--hostname', '0.0.0.0', '--port', '3000'], stdout=subprocess.DEVNULL)
        for _ in range(45):
            try:
                status, data = get('/login', 3331)
                if status == 200 and b'/_next/static/' in data:
                    break
            except OSError:
                pass
            time.sleep(2)
        else:
            raise RuntimeError('Candidate Web canary failed')
    finally:
        subprocess.run(['docker', 'rm', '-f', canary], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        env_file.unlink(missing_ok=True)
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    save('build-verified', record)
    print('BUILD_AND_SOURCE_TESTS_VERIFIED', flush=True)


def backup():
    record = read('build-verified')
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash'] and healthy()
    assert shutil.disk_usage(ROOT).free > 4 * 1024**3
    folder = ROOT / 'backups' / ('before-pager-headset-1105-' + str(int(time.time())))
    folder.mkdir(mode=0o700)
    encrypted(['docker', 'exec', 'rubi-production-postgres-1', 'pg_dump', '-U', 'rubi', '-d', 'rubi', '-Fc'], folder / 'database.dump.enc', ['docker', 'exec', '-i', 'rubi-production-postgres-1', 'pg_restore', '--list'])
    encrypted(['docker', 'exec', 'rubi-production-api-1', 'tar', '-C', '/srv/rubi/documents', '-czf', '-', '.'], folder / 'documents.tar.gz.enc', ['tar', '-tzf', '-'])
    encrypted(['tar', '-C', '/opt/rubi', '-czf', '-', 'compose.yaml', 'private'], folder / 'configuration.enc', ['tar', '-tzf', '-'])
    hashes = {p.name: filehash(p) for p in folder.glob('*.enc')}
    assert len(hashes) == 3 and snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    receipt = {'folder': str(folder), 'createdAt': time.time(), 'state': record['base'],
               'composeHash': record['composeHash'], 'oldAssets': assets(), 'hashes': hashes,
               'storage': 'server-persistent', 'noOffserverCopy': True}
    (folder / 'manifest.json').write_text(json.dumps(receipt, indent=2))
    for path in folder.iterdir():
        with path.open('rb') as stream:
            os.fsync(stream.fileno())
    directory = os.open(folder, os.O_RDONLY)
    os.fsync(directory)
    os.close(directory)
    save('backup-verified', receipt)
    save('server-backup-verified', receipt)
    print('ENCRYPTED_SERVER_BACKUP_VERIFIED', flush=True)


def activate():
    record = read('build-verified')
    before = read('backup-verified')
    ci = read('ci-approved')
    assert ci['revision'] == record['revision'] and ci['merged'] and ci['allChecksSuccessful']
    assert read('server-backup-verified')['hashes'] == before['hashes']
    folder = Path(before['folder'])
    assert all(filehash(folder / name) == value for name, value in before['hashes'].items())
    assert time.time() - before['createdAt'] < 900 and healthy()
    assert snapshot() == before['state'] == record['base']
    assert filehash(COMPOSE) == record['composeHash'] == before['composeHash']
    assert migrations() == record['migrations'] and not record['pendingMigrations']
    assert shutil.disk_usage(ROOT).free > 2 * 1024**3
    candidate = json.loads(capture(['docker', 'image', 'inspect', IMAGE]))[0]
    old_image = json.loads(capture(['docker', 'image', 'inspect', record['base']['web']['image']]))[0]
    assert sorted(candidate['Config']['Env']) == sorted(old_image['Config']['Env'])
    original = COMPOSE.read_text()
    pattern = r'(^  web:\s*\n)(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)'
    matches = list(re.finditer(pattern, original, re.M | re.S))
    assert len(matches) == 1
    match = matches[0]
    body, count = re.subn(r'(?m)^(    image:\s*)' + re.escape(record['base']['web']['image']) + r'\s*$',
                         lambda m: m.group(1) + IMAGE, match.group(2))
    assert count == 1
    updated = original[:match.start(2)] + body + original[match.end(2):]
    command = ['docker', 'compose', '-p', 'rubi-production', '-f', str(COMPOSE)]
    try:
        atomic(COMPOSE, updated)
        run(command + ['config', '--quiet'])
        run(command + ['up', '-d', '--no-deps', '--force-recreate', 'web'])
        for _ in range(60):
            if healthy():
                break
            time.sleep(2)
        else:
            raise RuntimeError('Web health check failed')
        after = snapshot()
        for service in SERVICES:
            assert after[service]['envHash'] == before['state'][service]['envHash']
            assert after[service]['mounts'] == before['state'][service]['mounts']
            if service != 'web':
                assert after[service] == before['state'][service], 'Unrelated service changed: ' + service
        assert after['web']['image'] == IMAGE
        for name, expected in record['sourceHashes'].items():
            actual = source_file('web', name)
            assert actual is not None and digest(actual) == expected, 'Deployed source mismatch: ' + name
        assert all(get(path)[0] == 200 for path in before['oldAssets'])
        assert assets() and all(get(path)[0] == 200 for path in assets())
        integration_ready()
        assert migrations() == record['migrations']
        time.sleep(10)
        assert healthy() and shutil.disk_usage(ROOT).free > 2 * 1024**3
        save('verified', {'revision': record['revision'], 'image': IMAGE,
                         'healthy': True, 'workerAuthenticated': True, 'amiConnected': True,
                         'recordingTimer': True, 'backup': str(folder), 'sourceHashes': record['sourceHashes'],
                         'migrationsApplied': [], 'unrelatedServicesUnchanged': True,
                         'freeBytes': shutil.disk_usage(ROOT).free})
        print('PAGER_HEADSET_VERIFIED', flush=True)
    except BaseException:
        if COMPOSE.read_text() != updated:
            raise RuntimeError('Concurrent Compose edit; rollback paused')
        atomic(COMPOSE, original)
        run(command + ['up', '-d', '--no-deps', '--force-recreate', 'web'])
        for _ in range(60):
            if healthy():
                print('ROLLBACK_HEALTHY', flush=True)
                break
            time.sleep(2)
        raise


if __name__ == '__main__':
    assert os.geteuid() == 0
    assert sys.argv[1] in ['prepare', 'build', 'backup', 'activate']
    with (ROOT / 'avina-deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        {'prepare': prepare, 'build': build, 'backup': backup, 'activate': activate}[sys.argv[1]]()
