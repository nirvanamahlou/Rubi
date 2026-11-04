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
if hashlib.sha256(source).hexdigest() != '6392dcfe9285987b481e390f969d2b1dd8f634b124d67346ad842446d4f47846':
    raise SystemExit('Installer changed; execution refused')
exec(compile(source, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
