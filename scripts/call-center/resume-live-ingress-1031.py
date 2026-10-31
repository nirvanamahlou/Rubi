#!/usr/bin/env python3
"""Pin reviewed activation bytes before execution from the root console."""
import hashlib
import os
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit('Run from the root console')
path = Path('/home/codex-dev/activate-live-release4-1031.py')
source = path.read_bytes()
if hashlib.sha256(source).hexdigest() != '4cc6c9d936fa9b899f0d582583346bfbb6f02a9e2e783225fd412f15c81df2b6':
    raise SystemExit('Reviewed activation source changed; refusing execution')
exec(compile(source, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
