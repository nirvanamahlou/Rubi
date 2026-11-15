"""Loopback-only TLS CONNECT relay. No TLS termination, keys, bodies or request logs."""
import select
import socket
import socketserver
import threading
import time

TARGET = ('api.groq.com', 443)
SLOTS = threading.BoundedSemaphore(8)

class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        if not SLOTS.acquire(blocking=False):
            self.request.sendall(b'HTTP/1.1 503 Busy\r\nContent-Length: 0\r\n\r\n')
            return
        try:
            self.request.settimeout(5)
            header = b''
            while b'\r\n\r\n' not in header:
                chunk = self.request.recv(1024)
                if not chunk or len(header) + len(chunk) > 8192:
                    return
                header += chunk
            head, tail = header.split(b'\r\n\r\n', 1)
            if head.split(b'\r\n', 1)[0] != b'CONNECT api.groq.com:443 HTTP/1.1' or tail:
                self.request.sendall(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
                return
            with socket.create_connection(TARGET, timeout=5) as remote:
                self.request.sendall(b'HTTP/1.1 200 Connection Established\r\n\r\n')
                deadline, transferred = time.monotonic() + 30, 0
                while time.monotonic() < deadline:
                    ready, _, _ = select.select([self.request, remote], [], [], 10)
                    if not ready:
                        return
                    for source in ready:
                        data = source.recv(32768)
                        if not data:
                            return
                        transferred += len(data)
                        if transferred > 8 * 1024 * 1024:
                            return
                        (remote if source is self.request else self.request).sendall(data)
        except (OSError, ValueError):
            pass
        finally:
            SLOTS.release()

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with Server(('127.0.0.1', 4310), Handler) as server:
        server.serve_forever()
