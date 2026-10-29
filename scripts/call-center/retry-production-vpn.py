#!/usr/bin/env python3
"""One inspected retry of the rolled-back first setup; never overwrites it."""
import hashlib
import os
from pathlib import Path
import json
import subprocess

path = Path('/home/rubi-deploy/setup-production-vpn.py')
source = path.read_bytes()
if hashlib.sha256(source).hexdigest() != 'df11f1c582742eccfc72e43425dbc52f042c4fa6ed79804f926d49625579233b':
    raise SystemExit('Installer changed; execution refused')
scope = {'__name__': 'reviewed_bootstrap', '__file__': str(path)}
exec(compile(source, str(path), 'exec'), scope)
if os.geteuid() != 0:
    raise SystemExit('Run as root')
root = Path('/opt/rubi')
receipt = json.loads((root / 'CALL-CENTER-VPN-1029.json').read_text())
if receipt.get('stage') != 'rolled_back' or receipt.get('preserved') is not True:
    raise SystemExit('Expected preserved failed attempt')
previous = root / 'private/call-center-vpn-1029'
for name in ('ipsec.conf', 'ipsec.secrets'):
    if (Path('/etc') / name).read_bytes() != (previous / (name + '.before')).read_bytes():
        raise SystemExit('IPsec baseline changed; inspect before retry')
for name in ('rubi-issabel-vpn.service', 'rubi-issabel-tls.service', 'strongswan-starter.service'):
    if subprocess.run(['systemctl', 'is-active', '--quiet', name]).returncode == 0:
        raise SystemExit('VPN service already active; inspect before retry')
scope['PRIVATE'] = root / 'private/call-center-vpn-retry2-1029'
raise SystemExit(scope['main'](retry=True))
