#!/usr/bin/env python3
"""Explicit root-only Nora activation; preserve core services and rollback on failure."""
import copy
import datetime
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path('/opt/rubi')
COMPOSE = ROOT / 'compose.yaml'
KEY = Path('/home/rubi-deploy/nora-provider-1027.env')
STAGE = 'initialization'


def command(args, timeout=90):
    global STAGE
    # Fixed operation names only; never log argv, environment values or stderr.
    if args[:2] == ['docker', 'compose']:
        STAGE = 'compose:' + args[4]
    elif args[:2] == ['docker', 'exec']:
        STAGE = 'container-probe'
    else:
        STAGE = ':'.join(args[:2])
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        diagnostic = ROOT / 'private/nora-last-command-error.txt'
        write_private(diagnostic, result.stderr)
        raise RuntimeError('Stage ' + STAGE + ' failed (exit ' + str(result.returncode)
                           + '). Private diagnostic: ' + str(diagnostic))
    return result.stdout.strip()


def docker_config():
    return json.loads(command(['docker', 'compose', '-f', str(COMPOSE), 'config', '--format', 'json']))


def container(name):
    return command(['docker', 'compose', '-f', str(COMPOSE), 'ps', '-q', name])


def write_private(path, data):
    temporary = path.with_name(path.name + '.nora-new')
    with temporary.open('x') as stream:
        os.chmod(temporary, 0o600)
        stream.write(data)
    temporary.replace(path)


def health(web, url, expected):
    script = "const r=await fetch(process.argv[1],{signal:AbortSignal.timeout(7000),redirect:'error'});process.exit(r.status===Number(process.argv[2])?0:1)"
    command(['docker', 'exec', web, 'node', '-e', script, url, str(expected)], 15)


def activate():
    if os.geteuid() != 0:
        raise RuntimeError('Root console execution required')
    os.umask(0o077)
    with (ROOT / 'avina-deploy.lock').open('r') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another ERP deployment holds the lock. No changes made; retry after it completes.') from None
        original = COMPOSE.read_bytes()
        config = docker_config()
        services = config['services']
        names = ('nora-assistant', 'nora-assistant-read')
        if any(name in services for name in names):
            raise RuntimeError('Nora already configured; inspect before repeating')
        if not KEY.is_file() or KEY.is_symlink() or KEY.stat().st_mode & 0o077:
            raise RuntimeError('Private provider file missing or permissions invalid')
        provider = dict(line.split('=', 1) for line in KEY.read_text().splitlines() if '=' in line)
        key = provider.get('GROQ_API_KEY', '')
        if not key or any(c.isspace() for c in key):
            raise RuntimeError('Provider key invalid')
        api_id, web_id = container('api'), container('web')
        if not api_id or not web_id:
            raise RuntimeError('Core services must be running')
        api = json.loads(command(['docker', 'inspect', api_id]))[0]
        image = api['Config']['Image']
        # Check the exact running image; no new image, migration or source build.
        check = "const fs=require('fs');for(const p of ['apps/api/dist/assistant-read/main.js','services/assistant/server.mjs'])if(!fs.existsSync(p))process.exit(1)"
        command(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', image, '-e', check])
        env = dict(item.split('=', 1) for item in api['Config']['Env'] if '=' in item)
        for name in ('DATABASE_URL', 'IAM_ACCESS_TOKEN_SECRET'):
            if not env.get(name):
                raise RuntimeError('Missing required ERP runtime configuration')
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backup = ROOT / ('nora-before-' + stamp)
        backup.mkdir(mode=0o700)
        (backup / 'compose.yaml').write_bytes(original)
        os.chmod(backup / 'compose.yaml', 0o600)
        provider_path = ROOT / 'private/nora-assistant.env'
        provider_content = 'GROQ_API_KEY=' + key + '\n'
        if provider_path.exists():
            info = provider_path.lstat()
            if provider_path.is_symlink() or info.st_uid != 0 or info.st_mode & 0o077 or provider_path.read_text() != provider_content:
                raise RuntimeError('Existing provider configuration differs or permissions invalid')
        else:
            write_private(provider_path, provider_content)
        updated = copy.deepcopy(config)
        web_env = updated['services']['web'].setdefault('environment', {})
        web_env['ASSISTANT_SERVICE_URL'] = 'http://127.0.0.1:4300'
        base = {'image': image, 'working_dir': api['Config'].get('WorkingDir') or '/workspace',
                'network_mode': 'service:web', 'restart': 'unless-stopped'}
        read = copy.deepcopy(base)
        read.update(command=['node', 'apps/api/dist/assistant-read/main.js'],
                    environment={**env, 'NODE_ENV': 'production', 'ERP_ASSISTANT_READ_PORT': '4301'})
        assistant = copy.deepcopy(base)
        assistant.update(command=['node', 'services/assistant/server.mjs'], env_file=[str(provider_path)],
                         environment={'NODE_ENV': 'production', 'ASSISTANT_PORT': '4300',
                                      'ERP_API_BASE_URL': 'https://avinaofficial.ir/api/v1',
                                      'ERP_AUTH_API_BASE_URL': 'http://127.0.0.1:4301/api/v1',
                                      'ERP_REPORTS_API_BASE_URL': 'http://127.0.0.1:4301/api/v1',
                                      'ASSISTANT_CONVERSATION_ENABLED': 'true',
                                      'ASSISTANT_MODEL_PROVIDER': 'groq',
                                      'ASSISTANT_DATA_POLICY': 'messages-only'})
        updated['services'][names[0]] = assistant
        updated['services'][names[1]] = read
        changed = False
        try:
            write_private(COMPOSE, json.dumps(updated, indent=2) + '\n')
            changed = True
            command(['docker', 'compose', '-f', str(COMPOSE), 'config', '--quiet'])
            command(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', '--no-deps', 'web'])
            command(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', '--no-deps', *names])
            web_id = container('web')
            ready = False
            for _ in range(20):
                try:
                    health(web_id, 'http://127.0.0.1:4301/api/v1/health', 200)
                    health(web_id, 'http://127.0.0.1:4300/health', 200)
                    health(web_id, 'http://127.0.0.1:4300/v1/assistant/actions/daily-summary', 401)
                    health(web_id, 'http://127.0.0.1:3000/login', 200)
                    ready = True
                    break
                except RuntimeError:
                    time.sleep(2)
            if not ready:
                raise RuntimeError('Nora readiness failed')
            probe = "const r=await fetch('https://api.groq.com/openai/v1/models',{headers:{authorization:'Bearer '+process.env.GROQ_API_KEY},signal:AbortSignal.timeout(10000)});console.log(JSON.stringify({provider_status:r.status}));process.exit(r.ok?0:1)"
            command(['docker', 'exec', container(names[0]), 'node', '-e', probe], 20)
            receipt = {'status': 'transport_ready', 'authenticated_business_acceptance': 'pending',
                       'backup': str(backup), 'image': image, 'public_ports_added': False,
                       'database_mutations': False, 'provider_policy': 'messages-only'}
            destination = Path('/home/rubi-deploy/nora-activation-' + stamp + '.json')
            write_private(destination, json.dumps(receipt, indent=2) + '\n')
            import pwd
            account = pwd.getpwnam('rubi-deploy')
            os.chown(destination, account.pw_uid, account.pw_gid)
            print('PASS: transport/read-only service/provider access. Receipt: ' + str(destination))
        except BaseException:
            failed_stage = STAGE
            if changed:
                subprocess.run(['docker', 'compose', '-f', str(COMPOSE), 'stop', *names], capture_output=True)
                write_private(COMPOSE, original.decode())
                subprocess.run(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', '--no-deps', 'web'], capture_output=True)
            print('Failed stage: ' + failed_stage + '; previous Compose restored if changed.')
            raise


if __name__ == '__main__':
    try:
        activate()
    except Exception as error:
        print('Activation stopped safely: ' + str(error))
        raise SystemExit(1)
