"""Prepare an immutable ERP image; activation is a separate explicit operation.

Run only on the authorized ERP host. Credentials/config/backups stay on that host.
No database downgrade, volume removal, or live business transaction is performed.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import time
import urllib.request
import yaml


def run(*args, capture=False):
    return subprocess.run(args, check=True, text=True, capture_output=capture).stdout


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image(container):
    return run('docker', 'inspect', container, '--format', '{{.Config.Image}}', capture=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['prepare', 'activate'])
    parser.add_argument('revision')
    parser.add_argument('--archive-sha256')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.revision):
        raise RuntimeError('Exact source revision required')
    root = Path('/opt/rubi/site-commerce-1114')
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = (root / 'release.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    release = root / args.revision[:12]
    release.mkdir(mode=0o700, parents=True, exist_ok=True)
    compose = Path('/opt/rubi/compose.yaml')
    manifest = release / 'prepared.json'
    command = ['docker', 'compose', '-f', str(compose)]
    if args.operation == 'prepare':
        archive = root / 'source.tar.gz'
        if not args.archive_sha256 or fingerprint(archive) != args.archive_sha256:
            raise RuntimeError('Source archive checksum mismatch')
        previous = {service: image(f'rubi-production-{service}-1') for service in ['api', 'web', 'worker']}
        base = previous['api']
        if not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.:/@-]+', base):
            raise RuntimeError('Unexpected image reference')
        snapshot = fingerprint(compose)
        source = release / 'release'
        source.mkdir(exist_ok=True)
        with tarfile.open(archive) as bundle:
            bundle.extractall(source, filter='data')
        previous_public = release / 'previous-public'
        previous_public.mkdir(exist_ok=True)
        run('docker', 'cp', 'rubi-production-web-1:/workspace/apps/web/public/.', str(previous_public))
        # Keep server-only assets while tracked source files come from this revision.
        for asset in previous_public.rglob('*'):
            destination = source / 'apps/web/public' / asset.relative_to(previous_public)
            if asset.is_file() and not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(asset, destination)
        static = release / 'previous-static'
        static.mkdir(exist_ok=True)
        run('docker', 'cp', 'rubi-production-web-1:/workspace/apps/web/.next/static/.', str(static))
        (release / '.dockerignore').write_text('*\n!Dockerfile\n!release/\n!release/**\n!previous-static/\n!previous-static/**\n')
        (release / 'Dockerfile').write_text(f'''FROM {base}
WORKDIR /workspace
RUN rm -rf apps/api/src apps/web/src apps/worker/src packages/contracts/src packages/database/src packages/database/prisma apps/api/dist apps/worker/dist packages/contracts/dist packages/database/dist apps/web/.next
COPY release/ ./
COPY previous-static/ /tmp/previous-static/
RUN export DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused NODE_OPTIONS=--max-old-space-size=2048 PRISMA_HIDE_UPDATE_MESSAGE=1 CHECKPOINT_DISABLE=1; (cd packages/database && node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma) && node packages/config/node_modules/typescript/bin/tsc -p packages/config/tsconfig.build.json && node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.build.json && node packages/database/node_modules/typescript/bin/tsc -p packages/database/tsconfig.build.json && (cd apps/api && node node_modules/@nestjs/cli/bin/nest.js build) && (cd apps/worker && node node_modules/@nestjs/cli/bin/nest.js build)
RUN NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 node apps/web/node_modules/next/dist/bin/next build apps/web --webpack && cp -an /tmp/previous-static/. apps/web/.next/static/ && rm -rf /tmp/previous-static apps/web/.next/cache
LABEL rubi.source-revision="{args.revision}"
''')
        target = f'rubi-production:site-commerce-{args.revision[:12]}-1114'
        run('docker', 'build', '-t', target, str(release))
        manifest.write_text(json.dumps({'revision': args.revision, 'image': target, 'previousImages': previous, 'composeHash': snapshot}))
        print(json.dumps({'state': 'prepared', 'revision': args.revision, 'image': target}))
        return
    if os.environ.get('SITE_COMMERCE_CI_APPROVED_REVISION') != args.revision:
        raise RuntimeError('Final-head CI approval required before activation')
    # Other ERP release tools use this same host-wide activation lock.
    activation_lock = Path('/opt/rubi/avina-deploy.lock').open('a')
    fcntl.flock(activation_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    state = json.loads(manifest.read_text())
    if state['revision'] != args.revision or state['composeHash'] != fingerprint(compose):
        raise RuntimeError('Compose changed since preparation; coordinate instead of overwriting')
    if any(image(f'rubi-production-{name}-1') != previous for name, previous in state['previousImages'].items()):
        raise RuntimeError('Another deployment changed runtime images; activation stopped')
    shutil.copy2(compose, release / 'previous-compose.yaml')
    os.chmod(release / 'previous-compose.yaml', 0o600)
    backup = release / 'before-site-commerce.dump'
    with backup.open('wb') as output:
        subprocess.run(['docker', 'exec', 'rubi-production-postgres-1', 'pg_dump', '-U', 'rubi', '-d', 'rubi', '-Fc'], stdout=output, check=True)
    os.chmod(backup, 0o600)
    run('docker', 'cp', str(backup), 'rubi-production-postgres-1:/tmp/site-commerce-pre.dump')
    run('docker', 'exec', 'rubi-production-postgres-1', 'pg_restore', '--list', '/tmp/site-commerce-pre.dump', capture=True)
    config = yaml.safe_load(compose.read_text())
    for name in ['api', 'web', 'worker']:
        config['services'][name]['image'] = state['image']
    public_mounts = 0
    for index, volume in enumerate(config['services']['web'].get('volumes', [])):
        if isinstance(volume, str) and volume.split(':')[1:] == ['/workspace/apps/web/public', 'ro']:
            config['services']['web']['volumes'][index] = str(release / 'release/apps/web/public') + ':/workspace/apps/web/public:ro'
            public_mounts += 1
    if public_mounts != 1:
        raise RuntimeError('Expected one read-only public asset mount')
    extra = '/opt/rubi/private/site-commerce.env'
    if not Path(extra).exists():
        raise RuntimeError('Site binding environment file must exist before activation')
    if extra not in config['services']['api']['env_file']:
        config['services']['api']['env_file'].append(extra)
    candidate = release / 'next-compose.yaml'
    candidate.write_text(yaml.safe_dump(config, sort_keys=False))
    os.chmod(candidate, compose.stat().st_mode & 0o777)
    os.replace(candidate, compose)
    try:
        run(*command, 'config', '--quiet')
        run(*command, 'run', '--rm', '--no-deps', 'api', 'sh', '-c', 'cd packages/database && node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma')
        run(*command, 'up', '-d', '--no-deps', 'api', 'web', 'worker')
        for attempt in range(36):
            try:
                for url in ['http://127.0.0.1:4000/api/v1/health', 'http://127.0.0.1:3000/login', 'https://avinaofficial.ir/api/v1/health']:
                    with urllib.request.urlopen(url, timeout=5) as response:
                        if response.status != 200:
                            raise RuntimeError('Health check failed')
                break
            except Exception:
                if attempt == 35:
                    raise
                time.sleep(5)
        (release / 'activated.json').write_text(json.dumps({'revision': args.revision, 'image': state['image'], 'backup': str(backup), 'state': 'healthy'}))
        print(json.dumps({'state': 'healthy', 'revision': args.revision}))
    except Exception:
        shutil.copy2(release / 'previous-compose.yaml', compose)
        run(*command, 'up', '-d', '--no-deps', 'api', 'web', 'worker')
        raise


if __name__ == '__main__':
    main()
