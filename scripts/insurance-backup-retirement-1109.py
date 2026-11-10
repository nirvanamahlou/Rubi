"""Retire only the two backups explicitly approved by the operator."""
import fcntl
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

root = Path('/opt/rubi/backups').resolve(strict=True)
newer = root / 'before-develop-0fb77974b-verified-current-1109-1794203636'
names = ['before-source-share-legend-1105-1793871578', 'before-call-center-panel-scope-1105-1793869010']
with open('/opt/rubi/avina-deploy.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert not newer.is_symlink() and newer.resolve(strict=True).parent == root
    manifest = json.loads((newer / 'manifest.json').read_text())
    expected = {'database.dump.enc', 'documents.tar.gz.enc', 'configuration-public-documents.tar.gz.enc'}
    assert set(manifest['hashes']) == expected
    for name in sorted(expected):
        path = newer / name
        assert not path.is_symlink() and path.is_file()
        with path.open('rb') as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == manifest['hashes'][name]
        decrypt = subprocess.Popen(['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-pass', 'file:/opt/rubi/private/backup.pass', '-in', str(path)], stdout=subprocess.PIPE)
        if name == 'database.dump.enc':
            # pg_restore --list may finish before consuming the archive; drain the
            # decrypt stream separately so encryption integrity is also checked.
            check = subprocess.Popen(['docker', 'exec', '-i', 'rubi-production-postgres-1', 'pg_restore', '--list'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ended = False
            while chunk := decrypt.stdout.read(1024 * 1024):
                if not ended:
                    try:
                        check.stdin.write(chunk)
                    except BrokenPipeError:
                        ended = True
            try:
                check.stdin.close()
            except BrokenPipeError:
                pass
            code = check.wait()
        else:
            code = subprocess.run(['tar', '-tzf', '-'], stdin=decrypt.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
        decrypt.stdout.close()
        assert decrypt.wait() == 0 and code == 0, 'Backup validation failed: ' + name
        print('VERIFIED ' + name, flush=True)
    targets = [root / name for name in names]
    for target in targets:
        assert not target.is_symlink() and target.is_dir() and target.resolve(strict=True).parent == root
        assert target != newer and not target.is_mount()
        assert subprocess.run(['mountpoint', '-q', str(target)]).returncode in (1, 32)
    receipt = {'verifiedBackup': str(newer), 'verifiedHashes': manifest['hashes'], 'retired': names, 'time': time.time(), 'authorization': 'User explicitly approved these two backups after newer backup verification.'}
    for target in targets:
        shutil.rmtree(target)
        print('RETIRED ' + target.name, flush=True)
    (root / 'insurance-backup-retirement-1109.json').write_text(json.dumps(receipt, indent=2))
    print('FREE_BYTES ' + str(shutil.disk_usage(root).free), flush=True)
