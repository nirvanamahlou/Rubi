"""Short root-console entry point for the reviewed, hash-pinned setup."""
import hashlib
from pathlib import Path

path = Path(__file__).with_name('setup-production-worker.py')
payload = path.read_bytes()
if hashlib.sha256(payload).hexdigest() != 'df1da3c269b397598dd084b4d70bcbaa51cf558163175af4761be1443ca41b8b':
    raise SystemExit('Setup file changed; request a reviewed replacement.')
exec(compile(payload, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
