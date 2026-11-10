import hashlib
import importlib.util
from pathlib import Path
import struct
import unittest
from unittest.mock import patch
import base64

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).with_name('recording-bridge.py'))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def test_private_metadata_and_stable_root_bound_identity(self):
        row = dict(file='2026/01/01/test.wav', externalCallId='synthetic.2', sizeBytes=44)
        with patch.object(bridge, 'rpc', return_value={'files': [row]}):
            data, kind, sha = bridge.retrieve('/inspect', {'rootCallId': 'synthetic.1'})
        self.assertNotIn(b'test.wav', data)
        self.assertEqual(kind, 'application/json')
        self.assertNotEqual(bridge.identity('synthetic.1', row), bridge.identity('synthetic.3', row))

    def test_unknown_identity_never_reads_audio(self):
        with patch.object(bridge, 'rpc', return_value={'files': []}) as rpc:
            with self.assertRaises(LookupError):
                bridge.retrieve('/audio', {'rootCallId': 'synthetic.1', 'id': 'missing'})
            self.assertEqual(rpc.call_count, 1)

    def test_download_is_revalidated_and_integrity_checked(self):
        row = dict(file='test.wav', externalCallId='synthetic.2', sizeBytes=44)
        audio = b'RIFF' + struct.pack('<I', 36) + b'WAVE' + bytes(32)
        response = dict(audio=base64.b64encode(audio).decode(), sha256=hashlib.sha256(audio).hexdigest())
        with patch.object(bridge, 'rpc', side_effect=[{'files': [row]}, response]):
            result = bridge.retrieve('/audio', {'rootCallId': 'synthetic.1', 'id': bridge.identity('synthetic.1', row)})
        self.assertEqual(result[0], audio)
        response['sha256'] = '0' * 64
        with patch.object(bridge, 'rpc', side_effect=[{'files': [row]}, response]):
            with self.assertRaises(RuntimeError):
                bridge.retrieve('/audio', {'rootCallId': 'synthetic.1', 'id': bridge.identity('synthetic.1', row)})

    def test_invalid_root_never_connects(self):
        with patch.object(bridge, 'rpc') as rpc:
            with self.assertRaises(ValueError):
                bridge.retrieve('/inspect', {'rootCallId': '../other'})
            rpc.assert_not_called()


if __name__ == '__main__':
    unittest.main()
