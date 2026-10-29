#!/usr/bin/env python3
"""Root-only bounded failed-link diagnostics; no new connection or PBX changes."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path('/opt/rubi')
PRIVATE = ROOT / 'private/call-center-vpn-1029'


def capture(args):
    p = subprocess.run(args, capture_output=True, timeout=30)
    return p.stdout.decode(errors='replace')


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    os.umask(0o077)
    receipt = json.loads((ROOT / 'CALL-CENTER-VPN-1029.json').read_text())
    if receipt.get('complete') or receipt.get('stage') != 'rolled_back':
        raise SystemExit('Expected failed, rolled-back installation')
    with open(ROOT / 'avina-deploy.lock', 'r') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        secrets = json.loads(Path('/home/rubi-deploy/.rubi-vpn-1029.json').read_text())
        sensitive = [secrets[k] for k in ('password', 'psk', 'amiSecret')]
        logs = capture(['journalctl', '--since', '-3 hours', '-n', '5000', '--no-pager', '-o', 'json'])
        entries = []
        for line in logs.splitlines():
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            name = str(entry.get('SYSLOG_IDENTIFIER', ''))
            unit = str(entry.get('_SYSTEMD_UNIT', ''))
            if not (name in ('charon', 'ipsec', 'ipsec_starter', 'xl2tpd', 'pppd') or
                    unit in ('rubi-issabel-vpn.service', 'strongswan-starter.service')):
                continue
            message = str(entry.get('MESSAGE', ''))
            for value in sensitive:
                message = message.replace(value, '[REDACTED]')
            if re.search(r'password|secret|CHAP.*(?:challenge|response)|PAP.*(?:AuthReq|password)', message, re.I):
                continue
            entries.append({'source': name, 'message': message[:1500]})
        # iproute2 renders protocol186 as its registered name bgp. Remove only the
        # exact fallback installed by this failed setup, after all own services stop.
        active = capture(['systemctl', 'is-active', 'rubi-issabel-vpn.service', 'rubi-issabel-tls.service'])
        routes = json.loads(capture(['ip', '-j', 'route', 'show', 'exact', '192.168.100.200/32']))
        removed = False
        if 'active' not in active.splitlines():
            for route in routes:
                if (route.get('type') == 'unreachable' and route.get('metric') == 42760 and
                        str(route.get('protocol')) in ('186', 'bgp')):
                    subprocess.run(['ip', 'route', 'del', 'unreachable', '192.168.100.200/32',
                                    'proto', '186', 'metric', '42760'], check=True)
                    removed = True
        report = {'entries': entries[-250:], 'leftover_fallback_removed': removed,
                  'routes': json.loads(capture(['ip', '-j', 'route', 'show', 'exact', '192.168.100.200/32'])),
                  'xfrm': capture(['ip', 'xfrm', 'policy']),
                  'unit': capture(['systemctl', 'show', 'rubi-issabel-vpn.service',
                                   '-p', 'Result', '-p', 'ExecMainStatus'])}
        output = ROOT / 'CALL-CENTER-VPN-DIAG-1029.json'
        if output.exists() or output.is_symlink():
            raise SystemExit('Diagnostic output already exists; inspect first')
        fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(fd, 'w') as stream:
            json.dump(report, stream, indent=2)
        os.chmod(output, 0o644)
        print('Diagnostic ready: /opt/rubi/CALL-CENTER-VPN-DIAG-1029.json')
        print('No connection retried; application and PBX unchanged.')


if __name__ == '__main__':
    main()
