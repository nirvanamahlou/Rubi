import importlib.util
import pathlib
import socket
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('relay', pathlib.Path(__file__).with_name('groq-connect.py'))
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)


class RelayBoundaryTests(unittest.TestCase):
    def test_other_targets_and_plain_http_never_open_upstream(self):
        with relay.Server(('127.0.0.1', 0), relay.Handler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                with patch.object(relay.socket, 'create_connection') as upstream:
                    for line in (b'CONNECT example.com:443 HTTP/1.1', b'CONNECT api.groq.com:80 HTTP/1.1', b'GET https://api.groq.com/ HTTP/1.1'):
                        with socket.socket() as client:
                            client.settimeout(2)
                            client.connect(server.server_address)
                            client.sendall(line + b'\r\n\r\n')
                            self.assertIn(b'403 Forbidden', client.recv(256))
                    upstream.assert_not_called()
            finally:
                server.shutdown()
                worker.join()


if __name__ == '__main__':
    unittest.main()
