#!/usr/bin/env python3
"""Hash-pinned diagnostic launcher; works from any directory."""
import hashlib
import os
import stat

path = '/home/rubi-deploy/diagnose-production-vpn.py'
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
with os.fdopen(fd, 'rb') as stream:
    info = os.fstat(stream.fileno())
    if not stat.S_ISREG(info.st_mode) or info.st_size > 100000:
        raise SystemExit('Unexpected diagnostic file')
    source = stream.read()
if hashlib.sha256(source).hexdigest() != '526c803c9e0ed1f0ee1aa04a2ba9d718eed03ee69e9bc57e730b7c4d57949ae0':
    raise SystemExit('Diagnostic changed; execution refused')
exec(compile(source, path, 'exec'), {'__name__': '__main__', '__file__': path})
