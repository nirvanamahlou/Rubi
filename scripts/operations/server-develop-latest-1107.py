"""Include a newly merged Web-only delta before the authorized server rollout."""
import hashlib
from pathlib import Path
import sys

PRIOR = Path('/opt/rubi/server-develop-bd59eafd4-1107/deploy.py')
assert hashlib.sha256(PRIOR.read_bytes()).hexdigest() in {
    'd71a01d41b5f6c54f580bde618173085b63b4e37297a4d5c26324dfe83311f42',
    # Same reviewed controller with its final extra blank line removed.
    '0f8c59398041f63f4903d33f4e830d04c613b58fd69e99277323e9735eef9b12',
}
exec(compile(PRIOR.read_text().rsplit('\nphase = sys.argv[1]', 1)[0], str(PRIOR), 'exec'))
REVISION = '5f5f6ec8b80674640bd600579d45f1e89267a89a'
IMAGE = 'rubi-production:develop-5f5f6ec8b-1107'
BASE_IMAGE = 'rubi-production:develop-e3ca5977c-1107'
CONTEXT = WORK / 'latest-context'


def checkpoint(name):
    """Fresh complete runtime checkpoint without recursively copying old DB backups."""
    record = read('build-verified')
    assert healthy() and snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    private = ROOT/'private'
    historical = [p for p in private.rglob('*') if p.is_file() and
                  (p.name.endswith('.dump.enc') or p.name.endswith('.dump'))]
    mounted = [Path(m['Source']).resolve() for item in record['base'].values() for m in item['mounts']]
    for path in historical:
        assert not path.is_symlink() and path.resolve().is_relative_to(private.resolve())
        assert not any(path.resolve() == m or path.resolve().is_relative_to(m) for m in mounted)
    references = {str(p.relative_to(ROOT)): filehash(p) for p in historical}
    private_bytes = sum(p.stat().st_size for p in private.rglob('*') if p.is_file() and p not in historical)
    doc_bytes = int(capture(['docker', 'exec', 'rubi-production-api-1', 'du', '-sb', '/srv/rubi/documents']).split()[0])
    previous_dump = Path(read('initial-backup-verified')['folder'])/'database.dump.enc'
    budget = previous_dump.stat().st_size * 3 // 2 + private_bytes + doc_bytes + 64 * 1024**2
    assert shutil.disk_usage(ROOT).free > budget + 2 * 1024**3, 'Measured backup budget and operational reserve required'
    folder = ROOT/'backups'/('before-develop-'+REVISION[:10]+'-'+name+'-'+str(int(time.time())))
    folder.mkdir(mode=0o700)
    encrypted(['docker', 'exec', 'rubi-production-postgres-1', 'pg_dump', '-U', 'rubi', '-d', 'rubi', '-Fc'],
              folder/'database.dump.enc', ['docker', 'exec', '-i', 'rubi-production-postgres-1', 'pg_restore', '--list'])
    encrypted(['docker', 'exec', 'rubi-production-api-1', 'tar', '-C', '/srv/rubi/documents', '-czf', '-', '.'],
              folder/'documents.tar.gz.enc', ['tar', '-tzf', '-'])
    # These exact historical database archives are retained and hash-referenced;
    # the fresh DB dump above captures current data. All live configuration,
    # secrets, public documents, recordings state and remaining private files stay.
    args = ['tar'] + ['--exclude='+path for path in references]
    args += ['-C', str(ROOT), '-czf', '-', 'compose.yaml', 'private']
    encrypted(args, folder/'configuration-public-documents.tar.gz.enc', ['tar', '-tzf', '-'])
    assert references == {str(p.relative_to(ROOT)): filehash(p) for p in historical}
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    receipt = dict(folder=str(folder), createdAt=(folder/'database.dump.enc').stat().st_mtime,
                   state=snapshot(), composeHash=filehash(COMPOSE), oldAssets=assets(),
                   hashes={p.name: filehash(p) for p in folder.glob('*.enc')},
                   historicalBackupsRetained=references, storage='server-persistent', noOffserverCopy=True)
    assert len(receipt['hashes']) == 3 and shutil.disk_usage(ROOT).free > 2 * 1024**3
    (folder/'manifest.json').write_text(json.dumps(receipt, indent=2))
    for path in folder.iterdir():
        with path.open('rb') as stream:
            os.fsync(stream.fileno())
    save(name+'-backup-verified', receipt)
    print('FRESH_ENCRYPTED_CHECKPOINT_VERIFIED '+str(folder), flush=True)
    return receipt


def validate_archive(path, validator):
    cipher = ['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000',
              '-pass', 'file:/opt/rubi/private/backup.pass', '-in', str(path)]
    with subprocess.Popen(cipher, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as dec:
        check = subprocess.run(validator, stdin=dec.stdout, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, timeout=900)
        while dec.stdout.read(1048576):
            pass
        return dec.wait(timeout=30) == 0 and check.returncode == 0


def complete_checkpoint():
    record = read('build-verified')
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    folder = ROOT / 'backups/before-develop-bd59eafd4-initial-1794050417'
    validators = {
        'database.dump.enc': ['docker', 'exec', '-i', 'rubi-production-postgres-1', 'pg_restore', '--list'],
        'documents.tar.gz.enc': ['tar', '-tzf', '-'],
        'configuration-public-documents.tar.gz.enc': ['tar', '-tzf', '-'],
    }
    assert validate_archive(folder/'database.dump.enc', validators['database.dump.enc'])
    assert validate_archive(folder/'documents.tar.gz.enc', validators['documents.tar.gz.enc'])
    config = folder/'configuration-public-documents.tar.gz.enc'
    if not validate_archive(config, validators[config.name]):
        # Only the interrupted, unverified output is replaced; complete backups stay.
        encrypted(['tar', '-C', '/opt/rubi', '-czf', '-', 'compose.yaml', 'private'],
                  config, validators[config.name])
    created = (folder/'database.dump.enc').stat().st_mtime
    assert time.time() - created < 900 and snapshot() == record['base']
    receipt = dict(folder=str(folder), createdAt=created, state=snapshot(),
                   composeHash=filehash(COMPOSE), oldAssets=assets(),
                   hashes={name: filehash(folder/name) for name in validators},
                   storage='server-persistent', noOffserverCopy=True)
    (folder/'manifest.json').write_text(json.dumps(receipt, indent=2))
    save('initial-backup-verified', receipt)
    print('EXISTING_CHECKPOINT_COMPLETED_AND_VERIFIED', flush=True)


def build_latest():
    record = read('build-verified')
    assert record['revision'] == 'bd59eafd4225c6b659553284a5ca22f8814bff44'
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    assert filehash(WORK/'calendar-delta.tar.gz') == 'dff10b24b40f05e54f1384d30c2f2861d7937c4752a366424cf6fcb1d58c5f5f'
    assert CONTEXT.exists() and shutil.disk_usage(ROOT).free > 3 * 1024**3
    save('build-bd59-verified', record)
    extract(WORK/'calendar-delta.tar.gz', CONTEXT/'calendar')
    shutil.copytree(CONTEXT/'calendar', CONTEXT/'delta', dirs_exist_ok=True)
    name = 'apps/web/src/i18n/en-overrides.json'
    old = json.loads((CONTEXT/'base'/name).read_text())
    target = json.loads((CONTEXT/'delta'/name).read_text())
    live = json.loads(capture(['docker', 'run', '--rm', '--network', 'none', '--entrypoint',
                              'cat', BASE_IMAGE, '/workspace/'+name]))
    for key in set(old) | set(live):
        if live.get(key) == old.get(key):
            continue
        assert target.get(key) in [old.get(key), live.get(key)], 'Translation collision'
        if key in live:
            target[key] = live[key]
        else:
            target.pop(key, None)
    (CONTEXT/'delta'/name).write_text(json.dumps(target, ensure_ascii=False, indent=2)+'\n')
    for path in (CONTEXT/'delta').rglob('*'):
        if path.is_file():
            record['sourceHashes'][str(path.relative_to(CONTEXT/'delta'))] = digest(normalize(path.read_bytes()))
    record.update(revision=REVISION, image=IMAGE)
    record['preservedLiveFiles'][name] = record['sourceHashes'][name]
    assert (CONTEXT/'previous-static').is_dir()
    dockerfile = 'FROM '+BASE_IMAGE+'\nWORKDIR /workspace\nCOPY delta/ ./\nCOPY previous-static/ /tmp/previous-static/\n'
    dockerfile += 'RUN rm -rf apps/web/.next && NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @nora/web build --webpack && cp -an /tmp/previous-static/. apps/web/.next/static/ && rm -rf /tmp/previous-static apps/web/.next/cache\n'
    dockerfile += 'LABEL rubi.develop-revision="'+REVISION+'" rubi.source-revision="'+REVISION+'"\n'
    (CONTEXT/'Dockerfile').write_text(dockerfile)
    with (WORK/'latest-build.log').open('w') as log:
        run(['docker', 'build', '-t', IMAGE, str(CONTEXT)], stdout=log, stderr=subprocess.STDOUT)
    verify_sources(record)
    tests = ['src/modules/sales/model/combined-hotel-next.spec.ts',
             'src/modules/sales/model/sales-form.spec.ts',
             'src/modules/sales/components/sales-contract-form.spec.tsx',
             'src/modules/reservations/model/supplier-form-values.spec.tsx',
             'src/modules/reservations/server/reservation-pdf.spec.ts', 'src/i18n/coverage.spec.ts',
             'src/modules/workbench/calendar-model.spec.ts', 'src/modules/workbench/workbench-notes.spec.tsx',
             'src/modules/workbench/note-drafts.spec.ts']
    with (WORK/'latest-tests.log').open('w') as log:
        run(['docker', 'run', '--rm', '--network', 'none', '-e', 'NODE_ENV=test',
             '--workdir', '/workspace/apps/web', '--entrypoint', 'node', IMAGE,
             'node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', *tests], stdout=log, stderr=subprocess.STDOUT)
    canary = 'rubi-5f5f6ec8b-canary'
    try:
        run(['docker', 'run', '-d', '--name', canary, '--network', 'none', '--entrypoint', 'node',
             IMAGE, 'apps/web/node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '0.0.0.0'], stdout=subprocess.DEVNULL)
        for _ in range(30):
            probe = subprocess.run(['docker', 'exec', canary, 'node', '-e',
                "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], capture_output=True)
            if probe.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Latest Web canary failed')
    finally:
        subprocess.run(['docker', 'rm', '-f', canary], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert snapshot() == record['base'] and filehash(COMPOSE) == record['composeHash']
    save('build-verified', record)
    assert CONTEXT.resolve().parent == WORK.resolve()
    shutil.rmtree(CONTEXT)
    print('LATEST_BUILD_SOURCE_TESTS_CANARY_VERIFIED', REVISION, flush=True)


phase = sys.argv[1]
with (ROOT/'avina-deploy.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    save('latest-'+phase+'-status', dict(status='running', startedAt=time.time()))
    try:
        if phase == 'backup':
            complete_checkpoint()
        elif phase == 'build':
            build_latest()
        elif phase == 'deploy':
            assert read('ci-approved')['revision'] == REVISION and read('ci-approved')['conclusion'] == 'success'
            assert read('build-verified')['revision'] == REVISION
            assert shutil.disk_usage(ROOT).free > 2 * 1024**3
            checkpoint('initial')
            PENDING = read('build-verified')['pendingMigrations']
            deploy_current()
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as stream:
                stream.write('\nSERVER-DEVELOP-REFRESH-1107 '+json.dumps(read('verified'))+'\n')
        else:
            raise RuntimeError('Unknown phase')
        save('latest-'+phase+'-status', dict(status='success', finishedAt=time.time()))
    except BaseException as error:
        save('latest-'+phase+'-status', dict(status='failed', errorType=type(error).__name__))
        raise
