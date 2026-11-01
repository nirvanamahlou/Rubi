#!/usr/bin/env python3
"""Repair a stale Docker service:api namespace without changing images or settings."""
import fcntl
import json
import subprocess
from pathlib import Path


def stale(api, worker):
    mode = worker['HostConfig']['NetworkMode']
    return mode.startswith('container:') and mode != 'container:' + api['Id']


def main():
    def inspect(name):
        return json.loads(subprocess.check_output(['docker', 'inspect', 'rubi-production-' + name + '-1']))[0]

    with Path('/opt/rubi/avina-deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        api, worker = inspect('api'), inspect('worker')
        if not api['State']['Running'] or not worker['State']['Running']:
            return
        if api['State'].get('Health', {}).get('Status', 'healthy') != 'healthy':
            return
        if not stale(api, worker):
            return
        subprocess.run(['docker', 'compose', '-f', '/opt/rubi/compose.yaml', 'up', '-d', '--no-deps', '--force-recreate', 'worker'], check=True, timeout=90)
        after = inspect('worker')
        assert not stale(api, after), 'Worker namespace repair failed'
        assert after['Image'] == worker['Image'], 'Unexpected worker image change'
        assert dict(v.split('=', 1) for v in after['Config']['Env']) == dict(v.split('=', 1) for v in worker['Config']['Env']), 'Unexpected worker environment change'
        assert inspect('api')['Id'] == api['Id'], 'API changed during repair'
        print('Worker network rebound to current API; image and environment preserved.')


if __name__ == '__main__':
    main()
