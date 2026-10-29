#!/usr/bin/env python3
"""Execute the reviewed bootstrap bytes, independent of current directory."""
import hashlib
import os
from pathlib import Path
import stat

path = Path('/home/rubi-deploy/setup-production-vpn.py')
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
with os.fdopen(fd, 'rb') as stream:
    info = os.fstat(stream.fileno())
    if not stat.S_ISREG(info.st_mode) or info.st_size > 100000:
        raise SystemExit('Unexpected installer file')
    source = stream.read()
if hashlib.sha256(source).hexdigest() != 'd1eb918bd770a8ecda91e08d503c596533885ad30a0b6aa022f887ca6021fed8':
    raise SystemExit('Installer changed; execution refused')
exec(compile(source, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
