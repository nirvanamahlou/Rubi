#!/usr/bin/python3
"""Enable existing telephony Worker transport using protected existing env files.

Keeps provider disabled. Requires an existing encrypted backup before mutation.
No schema, contact, permission, PBX or application source changes.
"""
import datetime
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import re
import stat
import subprocess
import sys

ROOT = Path('/opt/rubi')
EXPECTED_IMAGE = 'rubi-production:5314830983e47a81c1ea1927d63b8b5c716b1cf8'
SECRET_NAME = 'TELEPHONY_WORKER_SECRET'
URL_NAME = 'TELEPHONY_API_URL'

def run(args, timeout=60):
    p = subprocess.run(args, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('Operation failed: ' + args[0])
    return p.stdout.decode().strip()

def protected(path):
    for part in (path, *path.parents):
        info = part.lstat()
        if info.st_uid or stat.S_ISLNK(info.st_mode) or info.st_mode & 0o022:
            raise RuntimeError('Configuration path is not root-protected')
    if not path.is_file():
        raise RuntimeError('Expected regular environment file')

def environment(item):
    return dict(x.split('=',1) for x in item['Config']['Env'] if '=' in x)

def inspect(names):
    return json.loads(run(['docker','inspect',*names]))

def add_env_file(text, service, path):
    lines = text.splitlines(keepends=True)
    starts = [i for i,line in enumerate(lines) if line.rstrip()==f'  {service}:']
    if len(starts)!=1:
        raise RuntimeError('Unexpected compose service layout')
    start=starts[0]
    end=next((i for i in range(start+1,len(lines)) if re.match(r'^  [a-zA-Z0-9_-]+:',lines[i])),len(lines))
    entries=[i for i in range(start+1,end) if re.match(r'^    env_file:',lines[i])]
    if not entries:
        lines.insert(start+1,'    env_file: '+str(path)+'\n')
    elif len(entries)==1:
        index=entries[0]
        value=lines[index].split(':',1)[1].strip()
        if value:
            if value.startswith(('[','{','&','*')) or '#' in value:
                raise RuntimeError('Complex compose env_file requires manual review')
            lines[index:index+1]=['    env_file:\n','    - '+value+'\n','    - '+str(path)+'\n']
        else:
            stop=next((i for i in range(index+1,end) if re.match(r'^    [a-zA-Z0-9_-]+:',lines[i])),end)
            indent=next((re.match(r'^(\s*)-',line).group(1) for line in lines[index+1:stop] if re.match(r'^\s*-',line)),'    ')
            lines.insert(stop,indent+'- '+str(path)+'\n')
    else:
        raise RuntimeError('Duplicate compose env_file property')
    return ''.join(lines)

def update(path, content):
    # Retain the same inode/permissions for consumers of existing secret files.
    with path.open('wb') as target:
        target.write(content)
        target.flush()
        os.fsync(target.fileno())

def verify_compose_change(config, after_config, secret_file, shared_secret):
    expected=json.loads(json.dumps(config))
    for service in ('api','worker'):
        settings=expected['services'][service]
        if 'env_file' in after_config['services'][service]:
            settings.setdefault('env_file',[]).append({'path':str(secret_file),'required':True})
        else:
            # Some Compose versions resolve env_file despite --no-env-resolution.
            settings.setdefault('environment',{}).update({SECRET_NAME:shared_secret,URL_NAME:'https://avinaofficial.ir/api/v1'})
    if after_config!=expected:
        raise RuntimeError('Unexpected resolved compose changes')

def healthy():
    connection = http.client.HTTPSConnection('avinaofficial.ir',timeout=15)
    try:
        connection.request('GET','/api/v1/health')
        response = connection.getresponse()
        return response.status == 200 and json.loads(response.read())['data']['status']=='ok'
    finally:
        connection.close()

def main():
    if os.geteuid() or len(sys.argv)!=1:
        raise RuntimeError('Run as root without arguments')
    os.umask(0o077)
    compose = ROOT/'compose.yaml'
    compose_hash = hashlib.sha256(compose.read_bytes()).hexdigest()
    baseline = inspect(['rubi-production-api-1','rubi-production-worker-1'])
    if any(row['Config']['Image'] != EXPECTED_IMAGE for row in baseline):
        raise RuntimeError('Release changed; inspect current release before setup')
    if run(['systemctl','is-enabled','docker']) != 'enabled':
        raise RuntimeError('Docker boot startup must be configured by the administrator')
    if any(row['HostConfig']['RestartPolicy']['Name'] != 'unless-stopped' for row in baseline):
        raise RuntimeError('Existing API/Worker restart policy requires review')
    for item in baseline:
        env = environment(item)
        if env.get(SECRET_NAME) or (item['Name'].endswith('worker-1') and env.get(URL_NAME)):
            raise RuntimeError('Transport settings already exist; no automatic replacement')
        if item['Name'].endswith('api-1') and env.get('ISSABEL_ENABLED')=='true':
            raise RuntimeError('Live collector active; schedule a reviewed restart')
    command = ['docker','compose','-f',str(compose)]
    config = json.loads(run(command+['config','--no-env-resolution','--format','json']))
    secret_file=ROOT/'private'/'telephony-worker-1029.env'
    if os.path.lexists(secret_file):
        raise RuntimeError('Worker secret file already exists; inspect before retry')
    protected(compose)
    for directory in (secret_file.parent,*secret_file.parent.parents):
        info=directory.lstat()
        if info.st_uid or stat.S_ISLNK(info.st_mode) or info.st_mode & 0o022:
            raise RuntimeError('Private directory is not root-protected')
    for service in ('api','worker'):
        settings = config['services'][service]
        if any(key in settings.get('environment',{}) for key in (SECRET_NAME, URL_NAME)):
            raise RuntimeError('Compose inline transport setting requires review')
    original=compose.read_bytes()
    proposed=original.decode()
    for service in ('api','worker'):
        proposed=add_env_file(proposed,service,secret_file)
    # Backup command takes its own lock. Verify deployment identity again afterwards.
    run(['/usr/local/sbin/rubi-backup-create-1027'],timeout=3600)
    with (ROOT/'avina-deploy.lock').open('r') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        current = inspect(['rubi-production-api-1','rubi-production-worker-1'])
        if hashlib.sha256(compose.read_bytes()).hexdigest()!=compose_hash or [x['Id'] for x in current]!=[x['Id'] for x in baseline]:
            raise RuntimeError('Concurrent deployment detected')
        sql = '''BEGIN READ ONLY; SELECT
          (SELECT count(*) FROM call_center_telephony_sessions WHERE NOT synthetic AND state<>'ENDED')+
          (SELECT count(*) FROM integration_telephony_outbox WHERE "completedAt" IS NULL); COMMIT;'''
        active = run(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAtc',sql])
        if active!='0' or not healthy():
            raise RuntimeError('Active telephony work or existing API unhealthy')
        shared_secret = secrets.token_urlsafe(48)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        restore_dir = ROOT/'private'/('before-telephony-worker-'+stamp)
        restore_dir.mkdir(mode=0o700)
        (restore_dir/'compose.yaml').write_bytes(original)
        changed = False
        try:
            descriptor=os.open(secret_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
            with os.fdopen(descriptor,'w') as output:
                output.write(SECRET_NAME+'='+shared_secret+'\n'+URL_NAME+'=https://avinaofficial.ir/api/v1\n')
            changed = True
            update(compose,proposed.encode())
            after_config=json.loads(run(command+['config','--no-env-resolution','--format','json']))
            verify_compose_change(config,after_config,secret_file,shared_secret)
            run(command+['config','--quiet'])
            run(command+['up','-d','--no-deps','api','worker'],timeout=180)
            # Node reads only container env; credentials never enter command arguments.
            probe = "fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>{process.exitCode=1})"
            import time
            for _ in range(30):
                try:
                    if healthy():
                        run(['docker','exec','rubi-production-worker-1','node','-e',probe],timeout=15)
                        break
                except Exception:
                    pass
                time.sleep(2)
            else:
                raise RuntimeError('Worker authenticated transport verification failed')
            after = inspect(['rubi-production-api-1','rubi-production-worker-1'])
            for before,now in zip(baseline,after):
                if before['Config']['Image']!=now['Config']['Image'] or before['Mounts']!=now['Mounts']:
                    raise RuntimeError('Unexpected image or mount change')
                if now['HostConfig']['RestartPolicy'] != before['HostConfig']['RestartPolicy']:
                    raise RuntimeError('Unexpected restart policy change')
                if not now['State']['Running']:
                    raise RuntimeError('API or Worker is not running')
                env_before,env_after=environment(before),environment(now)
                allowed={SECRET_NAME,URL_NAME}
                if {k:v for k,v in env_before.items() if k not in allowed}!={k:v for k,v in env_after.items() if k not in allowed}:
                    raise RuntimeError('Unrelated service environment changed')
            receipt = {
                'stage': 'worker_transport_ready',
                'time_utc': stamp,
                'image': EXPECTED_IMAGE,
                'compose_sha256': hashlib.sha256(compose.read_bytes()).hexdigest(),
                'rollback_compose': str(restore_dir/'compose.yaml'),
                'restart_policy': 'unless-stopped',
                'docker_boot_enabled': True,
                'authenticated_worker_api': True,
                'provider_enabled_by_this_setup': False,
                'remaining': ['verified VPN/AMI configuration', 'staff mapping and access acceptance', 'real call acceptance'],
            }
            receipt_path = ROOT/'CALL-CENTER-WORKER-1029.json'
            if os.path.lexists(receipt_path):
                raise RuntimeError('Existing setup receipt requires review')
            descriptor = os.open(receipt_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
            with os.fdopen(descriptor,'w') as output:
                json.dump(receipt,output,indent=2)
                output.write('\n')
                output.flush()
                os.fsync(output.fileno())
            os.chmod(receipt_path,0o644)
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as record:
                record.write('\nCall Center Worker transport setup '+stamp+'\n')
                record.write('Image preserved: '+EXPECTED_IMAGE+'\n')
                record.write('Authenticated Worker/API transport verified; receipt: '+str(receipt_path)+'\n')
            print('PASS: Telephony Worker transport configured and authenticated; HTTPS API healthy.')
            print('Issabel network, connection setup, staff access and real-call acceptance remain separate gates.')
        except BaseException:
            if changed:
                update(compose,original)
                run(command+['up','-d','--no-deps','api','worker'],timeout=180)
            raise

if __name__=='__main__':
    try:
        main()
    except Exception as error:
        print('Setup incomplete: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),file=sys.stderr)
        raise SystemExit(1)
