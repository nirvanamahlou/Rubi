#!/usr/bin/env python3
"""Private Unix-socket gateway. Audio exists in memory only during a request."""
import base64
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import socketserver
import struct
import subprocess
import threading

PRIVATE = Path('/opt/rubi/private/call-recordings-1031')
SOCKET = '/run/rubi-issabel-recordings/bridge.sock'
MAX_BYTES = 20971520
SLOTS = threading.BoundedSemaphore(2)


def rpc(request):
    source = (PRIVATE / 'pbx-recording-source.py').read_text()
    source += '\nmain(json.loads(' + repr(json.dumps(request)) + '))\n'
    environment = dict(os.environ, SSH_ASKPASS=str(PRIVATE / 'askpass'),
                       SSH_ASKPASS_REQUIRE='force', DISPLAY=':rubi-recordings')
    result = subprocess.run([
        'ssh', '-o', 'StrictHostKeyChecking=yes', '-o',
        'UserKnownHostsFile=' + str(PRIVATE / 'known_hosts'),
        '-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password',
        '-o', 'NumberOfPasswordPrompts=1', '-o', 'ConnectTimeout=10',
        '-o', 'LogLevel=ERROR', 'bi@192.168.100.200', 'python -'],
        input=source.encode(), capture_output=True, timeout=25, env=environment)
    if result.returncode or len(result.stdout) > MAX_BYTES * 2:
        raise RuntimeError('SOURCE_UNAVAILABLE')
    response = json.loads(result.stdout)
    if response.get('ok') is not True:
        raise RuntimeError('SOURCE_UNAVAILABLE')
    return response


def identity(root, item):
    raw = json.dumps([root, item['file'], item['externalCallId']], separators=(',', ':'))
    h = hashlib.sha256(raw.encode()).hexdigest()
    return h[:8] + '-' + h[8:12] + '-8' + h[13:16] + '-a' + h[17:20] + '-' + h[20:32]


def retrieve(path, body):
    root = body.get('rootCallId')
    if not isinstance(root, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', root):
        raise ValueError('INVALID_ROOT')
    if path not in ('/inspect', '/audio'):
        raise ValueError('INVALID_OPERATION')
    files = rpc({'operation': 'inspect', 'rootCallId': root})['files']
    if len(files) > 128:
        raise RuntimeError('SOURCE_LIMIT')
    if path == '/inspect':
        return json.dumps([{'id': identity(root, f), 'sizeBytes': f['sizeBytes']}
                           for f in files]).encode(), 'application/json', None
    matches = [f for f in files if identity(root, f) == body.get('id')]
    if len(matches) != 1:
        raise LookupError('NOT_FOUND')
    result = rpc(dict(matches[0], operation='read', rootCallId=root))
    audio = base64.b64decode(result['audio'], validate=True)
    sha = hashlib.sha256(audio).hexdigest()
    if (not 44 <= len(audio) <= MAX_BYTES or audio[:4] != b'RIFF' or
            audio[8:12] != b'WAVE' or struct.unpack('<I', audio[4:8])[0] + 8 != len(audio)
            or sha != result['sha256']):
        raise RuntimeError('INVALID_AUDIO')
    return audio, 'audio/wav', sha


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.connection.settimeout(60)
        if not SLOTS.acquire(blocking=False):
            self.send_error(503)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 1 <= size <= 2048 or self.headers.get('Transfer-Encoding'):
                raise ValueError('INVALID_BODY')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('INVALID_BODY')
            audio, content_type, sha = retrieve(self.path, body)
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(audio)))
            self.send_header('Cache-Control', 'private, no-store')
            if sha:
                self.send_header('X-Recording-Sha256', sha)
            self.end_headers()
            self.wfile.write(audio)
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_error(400)
        except LookupError:
            self.send_error(404)
        except Exception:
            self.send_error(503)
        finally:
            SLOTS.release()


class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    request_queue_size = 4


if __name__ == '__main__':
    os.umask(0o077)
    if os.path.exists(SOCKET):
        os.unlink(SOCKET)
    with Server(SOCKET, Handler) as server:
        server.serve_forever()
