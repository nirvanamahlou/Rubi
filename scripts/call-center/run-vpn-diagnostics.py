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
if hashlib.sha256(source).hexdigest() != '914964b7445b767e5594bcc9d7983a8a9188f080ca75261dab4b95708f663a28':
    raise SystemExit('Diagnostic changed; execution refused')
exec(compile(source, path, 'exec'), {'__name__': '__main__', '__file__': path})
