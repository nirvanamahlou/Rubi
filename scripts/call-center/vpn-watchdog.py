#!/usr/bin/env python3
"""Recover the dedicated Issabel VPN when xl2tpd remains alive without its tunnel."""
import fcntl
import os
from pathlib import Path
import subprocess


def run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=15)


def main():
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    with open('/run/rubi-issabel-watchdog.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = Path('/run/rubi-issabel-watchdog-failures')
        if run(['systemctl', 'is-active', '--quiet', 'rubi-issabel-vpn']).returncode:
            state.unlink(missing_ok=True)
            return  # systemd Restart=on-failure owns inactive/starting services.
        route = run(['ip', 'route', 'get', '192.168.100.200'])
        status = run(['ipsec', 'status'])
        own = [line for line in status.stdout.splitlines() if 'rubi-issabel-1029' in line]
        healthy = (route.returncode == 0 and ' dev ppp' in route.stdout and
                   status.returncode == 0 and any('ESTABLISHED' in line for line in own) and
                   any('INSTALLED' in line for line in own))
        if healthy:
            state.unlink(missing_ok=True)
            return
        failures = int(state.read_text()) + 1 if state.exists() else 1
        state.write_text(str(failures))
        if failures >= 3:
            # Respect application deployment coordination; retry at next timer tick.
            with open('/opt/rubi/avina-deploy.lock') as deployment:
                try:
                    fcntl.flock(deployment, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    return
                subprocess.run(['systemctl', 'restart', 'rubi-issabel-vpn'], check=True, timeout=90)
                state.unlink(missing_ok=True)
                print('Restarted dedicated Issabel VPN after three failed tunnel checks')


if __name__ == '__main__':
    main()
