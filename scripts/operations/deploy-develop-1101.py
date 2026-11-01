import os, sys, json, pathlib, subprocess, hashlib, tarfile, shutil, time, fcntl, http.client, re, html, tempfile
from urllib.parse import quote
os.umask(0o077)
ROOT = pathlib.Path('/opt/rubi')
WORK = ROOT / 'call-center-final-rollout-1031'
COMPOSE = ROOT / 'compose.yaml'
REVISION = '409a6fa645a9b1c8f508f2bd92148e90de2d18a4'
ARCHIVE_SHA = '13b0ff232b7820f86485516e703af2c088ae0ebcc375e0df7bb88c6674dc58e0'
SERVICES = ['api', 'web', 'worker', 'postgres', 'redis', 'document-scanner', 'document-signatures']

def run(args, **kw):
    return subprocess.run(args, check=True, **kw)

def capture(args):
    return run(args, capture_output=True, text=True).stdout

def digest(data):
    return hashlib.sha256(data).hexdigest()

def filehash(path):
    h = hashlib.sha256()
    with pathlib.Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''): h.update(chunk)
    return h.hexdigest()

def inspect(service):
    return json.loads(capture(['docker', 'inspect', 'rubi-production-' + service + '-1']))[0]

def snapshot():
    result = {}
    for service in SERVICES:
        p = inspect(service)
        result[service] = {'id': p['Id'], 'image': p['Config']['Image'], 'imageId': p['Image'], 'envHash': digest(json.dumps(sorted(p['Config']['Env'])).encode()), 'mounts': sorted(p['Mounts'], key=lambda m: m['Destination'])}
    return result

def get(path, port=None):
    c = http.client.HTTPConnection('127.0.0.1', port, timeout=15) if port else http.client.HTTPSConnection('avinaofficial.ir', timeout=20)
    c.request('GET', path)
    r = c.getresponse(); data = r.read(); status = r.status; c.close()
    return status, data

def healthy():
    try: return get('/login')[0] == 200 and json.loads(get('/api/v1/health')[1])['data']['status'] == 'ok'
    except Exception: return False

def integration_ready():
    probe = "fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>process.exitCode=1)"
    run(['docker','exec','rubi-production-worker-1','node','-e',probe], capture_output=True, timeout=12)
    query = '''BEGIN READ ONLY; SELECT action FROM integration_telephony_audit WHERE action IN ('AMI_CONNECTED','AMI_GAP','AMI_STOPPED') ORDER BY "createdAt" DESC,id DESC LIMIT 1; COMMIT;'''
    assert capture(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAtc',query]).strip() == 'AMI_CONNECTED', 'AMI not connected'
    assert capture(['systemctl','is-active','rubi-call-recordings.timer']).strip() == 'active', 'Recording timer inactive'

def assets():
    return list(dict.fromkeys(html.unescape(p) for p in re.findall(r'(?:src|href)="([^" ]*/_next/static/[^" ]+)"', get('/login')[1].decode())))[:8]

def migrations():
    return capture(['docker', 'exec', 'rubi-production-postgres-1', 'psql', '-U', 'rubi', '-d', 'rubi', '-Atc', 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name']).splitlines()

def extract(archive, target):
    target.mkdir(mode=0o700)
    with tarfile.open(archive) as t:
        for m in t.getmembers():
            p = pathlib.PurePosixPath(m.name)
            assert not p.is_absolute() and '..' not in p.parts and not m.isdev()
        t.extractall(target, filter='data')

def save(name, data):
    (WORK / (name + '.json')).write_text(json.dumps(data, indent=2))

def read(name):
    data = json.loads((WORK / (name + '.json')).read_text())
    for key in ['base', 'state']:
        if isinstance(data, dict) and isinstance(data.get(key), dict):
            for item in data[key].values():
                if isinstance(item, dict) and 'mounts' in item: item['mounts'].sort(key=lambda m: m['Destination'])
    return data

def prepare():
    assert healthy() and shutil.disk_usage(ROOT).free > 8 * 1024**3
    assert filehash(WORK / 'source.tar.gz') == ARCHIVE_SHA
    state = snapshot(); compose_hash = filehash(COMPOSE)
    context = WORK / 'context'
    if context.exists():
        assert context.resolve().parent == WORK.resolve()
        ids = capture(['docker', 'ps', '-aq']).split()
        containers = json.loads(capture(['docker', 'inspect', *ids])) if ids else []
        assert not any(pathlib.Path(m['Source']).resolve().is_relative_to(context.resolve()) for item in containers for m in item['Mounts'])
        context.rename(WORK / ('context-unused-' + str(int(time.time()))))
    context.mkdir(mode=0o700)
    release = context / 'release'; extract(WORK / 'source.tar.gz', release)
    overlap = WORK / 'base-overlap'
    if not overlap.exists(): extract(WORK / 'base-overlap.tar.gz', overlap)
    manifest = read('source-compare'); preserved = {}
    for service in ['api', 'web']:
        candidates = read(service + '-source-comparison')['conflicts']
        if service == 'web':
            js = "const f=require('fs'),c=require('crypto');let s='';process.stdin.on('data',x=>s+=x).on('end',()=>{const m=JSON.parse(s),a=[];for(const[p,h]of Object.entries(m.target)){if(!p.startsWith('apps/web/'))continue;try{const v=c.createHash('sha256').update(f.readFileSync('/workspace/'+p).toString().replace(/\\r\\n/g,'\\n')).digest('hex');if(v!==h&&v!==m.base[p])a.push(p)}catch{}}console.log(JSON.stringify(a))});"
            result = run(['docker', 'exec', '-i', 'rubi-production-web-1', 'node', '-e', js], input=json.dumps(manifest), capture_output=True, text=True)
            candidates = json.loads(result.stdout)
        for name in candidates:
            if (name.startswith('apps/web/')) != (service == 'web'): continue
            current = run(['docker', 'exec', 'rubi-production-' + service + '-1', 'cat', '/workspace/' + name], capture_output=True).stdout.replace(b'\r\n', b'\n')
            target = release / name
            desired = target.read_bytes().replace(b'\r\n', b'\n')
            if manifest['target'][name] == manifest['base'].get(name):
                effective = current
            else:
                base = (overlap / name).read_bytes().replace(b'\r\n', b'\n')
                if name.endswith('.json'):
                    b, d, c = map(json.loads, [base, desired, current]); effective_json = dict(d)
                    for key in set(b) | set(c):
                        if c.get(key) == b.get(key): continue
                        assert d.get(key) == b.get(key) or d.get(key) == c.get(key), 'Translation conflict: ' + name
                        if key in c: effective_json[key] = c[key]
                        else: effective_json.pop(key, None)
                    effective = (json.dumps(effective_json, ensure_ascii=False, indent=2) + '\n').encode()
                else:
                    folder = WORK / 'merge'; folder.mkdir(exist_ok=True)
                    for suffix, content in [('desired', desired), ('base', base), ('current', current)]: (folder / suffix).write_bytes(content)
                    result = subprocess.run(['git', 'merge-file', '-p', str(folder / 'desired'), str(folder / 'base'), str(folder / 'current')], capture_output=True)
                    if 0 < result.returncode < 128 and name == 'apps/web/src/modules/call-center/operational-call-popup.tsx':
                        def whitespace_conflict(match):
                            a, b = match.group(1), match.group(2)
                            assert re.sub(rb'\s+', b'', a) == re.sub(rb'\s+', b'', b), 'Non-format popup conflict'
                            return a
                        effective = re.sub(rb'^<<<<<<<[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>>[^\n]*\n', whitespace_conflict, result.stdout, flags=re.M|re.S)
                        assert b'<<<<<<<' not in effective
                    elif 0 < result.returncode < 128 and name == 'apps/web/src/modules/call-center/telephony-attention.tsx':
                        def receipt_conflict(match):
                            a, b = match.group(1), match.group(2)
                            assert not b.strip() and a.strip() in [b"import { shownCallSession } from './shown-call-session';", b'actorId={actor.userId}'], 'Unreviewed attention conflict'
                            return a
                        effective = re.sub(rb'^<<<<<<<[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>>[^\n]*\n', receipt_conflict, result.stdout, flags=re.M|re.S)
                        assert b'<<<<<<<' not in effective
                    else:
                        assert result.returncode == 0, 'Source merge requires review: ' + name
                        effective = result.stdout
            target.write_bytes(effective); preserved[name] = digest(effective)
    # Keep current public brand assets that do not have a tracked replacement.
    public_source = next(pathlib.Path(m['Source']) for m in state['web']['mounts'] if m['Destination'] == '/workspace/apps/web/public')
    public_target = release / 'apps/web/public'
    for p in public_source.rglob('*'):
        assert p.resolve().is_relative_to(public_source.resolve())
        if p.is_file():
            dest = public_target / p.relative_to(public_source)
            if not dest.exists(): dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, dest)
    run(['docker', 'cp', 'rubi-production-web-1:/workspace/apps/web/.next/static', str(context / 'previous-static')], stdout=subprocess.DEVNULL)
    expected = sorted(p.name for p in (release / 'packages/database/prisma/migrations').iterdir() if p.is_dir())
    applied = migrations(); pending = sorted(set(expected)-set(applied)); assert set(pending).issubset({'20261031170000_hotel_reference_currency','20261031170000_hr_shared_reference_sources'}), 'Unreviewed pending migrations'
    # API/worker/web dependencies are unchanged from the running base; no install or secret-bearing build arguments.
    dockerfile = 'FROM ' + state['api']['image'] + '\nWORKDIR /workspace\nCOPY release/ ./\nCOPY previous-static/ /tmp/previous-static/\n'
    dockerfile += 'RUN DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused NODE_OPTIONS=--max-old-space-size=3072 pnpm db:generate && pnpm --filter @nora/contracts build && pnpm --filter @nora/database build && NODE_OPTIONS=--max-old-space-size=3072 pnpm --filter @nora/api build && pnpm --filter @nora/worker build\n'
    dockerfile += 'RUN NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @nora/web build && cp -an /tmp/previous-static/. apps/web/.next/static/ && rm -rf /tmp/previous-static apps/web/.next/cache\n'
    dockerfile += 'LABEL rubi.develop-revision="' + REVISION + '"\n'
    (context / 'Dockerfile').write_text(dockerfile)
    effective = dict(manifest['target']); effective.update(preserved)
    save('prepared', {'revision': REVISION, 'base': state, 'composeHash': compose_hash, 'migrations': applied, 'pendingMigrations': pending, 'preservedLiveFiles': preserved, 'sourceHashes': effective, 'image': 'rubi-production:final-409a6fa645a9', 'publicSource': str(public_source), 'publicTarget': str(public_target)})
    assert snapshot() == state and filehash(COMPOSE) == compose_hash
    print('PREPARED revision=' + REVISION + ' preservedLiveFiles=' + str(len(preserved)), flush=True)

def build():
    record = read('prepared'); assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    with (WORK / 'docker-build.log').open('w') as log:
        run(['docker', 'build', '-t', record['image'], str(WORK / 'context')], stdout=log, stderr=subprocess.STDOUT)
    image = record['image']
    api_tests = ['src/customer-affairs/call-center.http.spec.ts', 'src/customer-affairs/call-destination-history.spec.ts', 'src/hr/hr-call-answer-directory.spec.ts']
    web_tests = ['src/modules/call-center/call-form.spec.tsx','src/modules/call-center/telephony-hold.spec.tsx','src/modules/call-center/telephony-wakeup.spec.ts','src/modules/call-center/shown-call-session.spec.ts']
    for app, tests in [('api', api_tests), ('web', web_tests)]:
        with (WORK / ('tests-' + app + '.log')).open('w') as log:
            run(['docker', 'run', '--rm', '--network', 'none', '-e', 'NODE_ENV=test', '-e', 'NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true', '--workdir', '/workspace/apps/' + app, '--entrypoint', 'node', image, 'node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', *tests], stdout=log, stderr=subprocess.STDOUT)
    verify_sources(record)
    ef = WORK / 'canary.env'; ef.write_text('\n'.join(inspect('web')['Config']['Env']) + '\n'); canary = 'rubi-develop-web-35921e-canary'
    try:
        args = ['docker', 'run', '-d', '--name', canary, '-p', '127.0.0.1:3331:3000', '--env-file', str(ef), '--entrypoint', 'node']
        for m in inspect('web')['Mounts']:
            source = record['publicTarget'] if m['Destination'] == '/workspace/apps/web/public' else m['Source']
            args += ['-v', source + ':' + m['Destination'] + ('' if m['RW'] else ':ro')]
        run(args + [image, 'apps/web/node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '0.0.0.0', '--port', '3000'], stdout=subprocess.DEVNULL)
        for _ in range(45):
            try:
                status, data = get('/login', 3331)
                if status == 200 and b'/_next/static/' in data: break
            except OSError: pass
            time.sleep(2)
        else: raise RuntimeError('Canary failed')
    finally:
        subprocess.run(['docker', 'rm', '-f', canary], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); ef.unlink(missing_ok=True)
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash'] and migrations() == record['migrations']
    save('build-verified', record); print('BUILD_TESTS_CANARY_VERIFIED', flush=True)

def verify_sources(record):
    js = "const f=require('fs'),c=require('crypto');let s='';process.stdin.on('data',x=>s+=x).on('end',()=>{for(const[p,h]of Object.entries(JSON.parse(s))){const a=c.createHash('sha256').update(f.readFileSync('/workspace/'+p).toString().replace(/\\r\\n/g,'\\n')).digest('hex');if(a!==h)throw Error('Source mismatch: '+p);}console.log('SOURCE_VERIFIED');});"
    run(['docker', 'run', '--rm', '-i', '--network', 'none', '--entrypoint', 'node', record['image'], '-e', js], input=json.dumps(record['sourceHashes']), text=True, stdout=subprocess.DEVNULL)

def encrypted(command, target, check):
    cipher = ['openssl', 'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '200000', '-pass', 'file:/opt/rubi/private/backup.pass']
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as source:
        run(cipher + ['-out', str(target)], stdin=source.stdout); source.stdout.close(); assert source.wait() == 0
    with subprocess.Popen(cipher + ['-d', '-in', str(target)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as dec:
        result = subprocess.run(check, stdin=dec.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        while dec.stdout.read(1048576): pass
        dec.stdout.close(); assert dec.wait() == 0 and result.returncode == 0

def backup():
    record = read('build-verified'); assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash'] and healthy()
    folder = ROOT / 'backups' / ('before-develop-' + record['revision'][:10] + '-' + str(int(time.time()))); folder.mkdir(mode=0o700)
    encrypted(['docker', 'exec', 'rubi-production-postgres-1', 'pg_dump', '-U', 'rubi', '-d', 'rubi', '-Fc'], folder / 'database.dump.enc', ['docker', 'exec', '-i', 'rubi-production-postgres-1', 'pg_restore', '--list'])
    encrypted(['docker', 'exec', 'rubi-production-api-1', 'tar', '-C', '/srv/rubi/documents', '-czf', '-', '.'], folder / 'documents.tar.gz.enc', ['tar', '-tzf', '-'])
    encrypted(['tar', '-C', '/opt/rubi', '-czf', '-', 'compose.yaml', 'private'], folder / 'configuration-public-documents.tar.gz.enc', ['tar', '-tzf', '-'])
    save('backup-verified', {'folder': str(folder), 'createdAt': time.time(), 'state': snapshot(), 'composeHash': filehash(COMPOSE), 'oldAssets': assets(), 'hashes': {p.name: filehash(p) for p in folder.glob('*.enc')}})
    assert snapshot() == record['base']; print('ENCRYPTED_BACKUPS_VERIFIED', flush=True)

def atomic(path, content):
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.develop-'); os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(content); f.flush(); os.fsync(f.fileno())
    os.replace(name, path)

def activate():
    record = read('build-verified'); before = read('backup-verified'); folder = pathlib.Path(before['folder'])
    assert time.time() - before['createdAt'] < 900 and healthy()
    assert snapshot() == before['state'] == record['base'] and filehash(COMPOSE) == record['composeHash'] == before['composeHash']
    assert migrations() in [record['migrations'], sorted(record['migrations'] + record.get('pendingMigrations', []))] and all(filehash(folder / n) == h for n, h in before['hashes'].items())
    expected_migrations = sorted(record['migrations'] + record.get('pendingMigrations', []))
    if record.get('pendingMigrations') and migrations() == record['migrations']:
        assert set(record['pendingMigrations']).issubset({'20261031170000_hotel_reference_currency','20261031170000_hr_shared_reference_sources'})
        network = list(inspect('api')['NetworkSettings']['Networks']); assert len(network) == 1
        migration_env = WORK / 'migration.env'
        pg = dict(v.split('=', 1) for v in inspect('postgres')['Config']['Env'] if '=' in v)
        admin_url = 'postgresql://' + quote(pg['POSTGRES_USER'], safe='') + ':' + quote(pg['POSTGRES_PASSWORD'], safe='') + '@postgres:5432/' + quote(pg['POSTGRES_DB'], safe='') + '?schema=public'
        migration_env.write_text('DATABASE_URL=' + admin_url + '\n')
        try:
            with (WORK / 'migration.log').open('w') as log:
                run(['docker', 'run', '--rm', '--network', network[0], '--env-file', str(migration_env), '--entrypoint', 'pnpm', record['image'], '--filter', '@nora/database', 'exec', 'prisma', 'migrate', 'deploy'], stdout=log, stderr=subprocess.STDOUT)
        finally: migration_env.unlink(missing_ok=True)
        assert migrations() == expected_migrations
        print('ADDITIVE_MIGRATION_VERIFIED', flush=True)
    original = COMPOSE.read_text(); updated = original
    images = {service: record['image'] + '-' + service for service in ['api', 'web', 'worker']}
    for service in ['api', 'web', 'worker']:
        run(['docker', 'tag', record['image'], images[service]])
        pattern = r'(^  '+re.escape(service)+r':\s*\n)(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)'
        matches=list(re.finditer(pattern,updated,re.M|re.S)); assert len(matches)==1, 'Service block not unique: '+service
        match=matches[0]; body=match.group(2)
        oldline=r'(?m)^(    image:\s*)'+re.escape(record['base'][service]['image'])+r'\s*$'
        body,count=re.subn(oldline,lambda m:m.group(1)+images[service],body)
        assert count==1, 'Expected image not found in '+service
        updated=updated[:match.start(2)]+body+updated[match.end(2):]
    assert updated.count(record['publicSource']) == 1; updated = updated.replace(record['publicSource'], record['publicTarget'], 1)
    command = ['docker', 'compose', '-p', 'rubi-production', '-f', str(COMPOSE)]
    try:
        atomic(COMPOSE, updated); run(command + ['config', '--quiet']); run(command + ['up', '-d', '--no-deps', '--force-recreate', 'api', 'web', 'worker'])
        for _ in range(60):
            if healthy(): break
            time.sleep(2)
        else: raise RuntimeError('New runtime failed health checks')
        for attempt in range(30):
            try: integration_ready(); break
            except Exception:
                if attempt == 29: raise
                time.sleep(2)
        after = snapshot()
        for service in SERVICES:
            assert after[service]['envHash'] == before['state'][service]['envHash'], 'Environment changed: ' + service
            if service not in ['api', 'web', 'worker']: assert after[service]['id'] == before['state'][service]['id'], 'Unrelated service changed'
            if service != 'web': assert after[service]['mounts'] == before['state'][service]['mounts'], 'Unexpected volume change'
        expected_web_mounts = json.loads(json.dumps(before['state']['web']['mounts']))
        for mount in expected_web_mounts:
            if mount['Destination'] == '/workspace/apps/web/public': mount['Source'] = record['publicTarget']
        assert after['web']['mounts'] == expected_web_mounts, 'Unexpected web volume change'
        for service in ['api', 'web', 'worker']: assert after[service]['image'] == images[service]
        for service in ['api', 'web', 'worker']:
            p = inspect(service); assert p['State']['Running'] and p['RestartCount'] == 0
        assert all(get(p)[0] == 200 for p in before['oldAssets'])
        assert assets() and all(get(p)[0] == 200 for p in assets())
        assert get('/reservations')[0] in [307, 308] and get('/api/v1/ticket-catalog/tours/packages')[0] == 401
        assert migrations() == expected_migrations; time.sleep(10); assert healthy()
        result = {'revision': record['revision'], 'images': images, 'healthy': True, 'workerAuthenticated': True, 'amiConnected': True, 'recordingTimer': True, 'backup': str(folder), 'preservedLiveFiles': len(record['preservedLiveFiles']), 'migrationsApplied': record.get('pendingMigrations', []), 'freeBytes': shutil.disk_usage(ROOT).free}
        save('verified', result); print('DEPLOYMENT_VERIFIED ' + json.dumps(result), flush=True)
    except BaseException:
        if COMPOSE.read_text() != updated: raise RuntimeError('Concurrent compose change; rollback paused')
        atomic(COMPOSE, original); run(command + ['up', '-d', '--no-deps', '--force-recreate', 'api', 'web', 'worker'])
        for _ in range(60):
            if healthy(): print('ROLLBACK_HEALTHY', flush=True); break
            time.sleep(2)
        raise

phase = sys.argv[1]
assert phase in ['prepare', 'build', 'backup', 'activate', 'backup-activate']
with (ROOT / 'avina-deploy.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        if phase == 'backup-activate': backup(); activate()
        else: globals()[phase]()
        save(phase + '-status', {'complete': True, 'exitCode': 0})
    except BaseException as error:
        save(phase + '-status', {'complete': True, 'exitCode': 1, 'error': str(error)}); raise
