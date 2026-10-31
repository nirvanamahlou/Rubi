import hashlib
import importlib.util
import os
from pathlib import Path
import struct
import tempfile
import time
import unittest
import wave


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


source = load('pbx-recording-source')
pull = load('recording-pull')
activation = load('activate-recordings-1031')


class RecordingSafety(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.path = self.root/'synthetic.wav'
        with wave.open(str(self.path), 'wb') as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(8000)
            stream.writeframes(b'\0\0'*80)
        os.utime(self.path, (time.time()-60, time.time()-60))

    def tearDown(self):
        self.folder.cleanup()

    def test_rejects_path_escape_absolute_paths_and_wrong_format(self):
        for path in ('../synthetic.wav', '/synthetic.wav', 'a//synthetic.wav', 'a/./synthetic.wav', 'audio.mp3'):
            with self.assertRaises(ValueError): source.safe_path(str(self.root), path)

    def test_rejects_symlink_even_when_destination_is_inside_root(self):
        (self.root/'link.wav').symlink_to(self.path)
        with self.assertRaises(ValueError): source.safe_path(str(self.root), 'link.wav')

    def test_final_wav_and_checksum_are_both_required(self):
        audio = source.finalized_audio(str(self.path))
        sha = hashlib.sha256(audio).hexdigest()
        self.assertTrue(pull.valid_audio(audio, sha))
        self.assertFalse(pull.valid_audio(audio, '0'*64))
        self.assertFalse(pull.valid_audio(audio[:-1], sha))

    def test_active_or_incomplete_file_is_not_finalized(self):
        with self.assertRaises(ValueError): source.finalized_audio(str(self.path), now=self.path.stat().st_mtime+1)
        self.path.write_bytes(b'RIFF'+struct.pack('<I', 9000)+b'WAVE'+b'\0'*40)
        os.utime(self.path, (time.time()-60, time.time()-60))
        with self.assertRaises(ValueError): source.finalized_audio(str(self.path))

    def test_stable_identity_has_native_v8_variant_and_separates_calls(self):
        args = ('synthetic-root', 'synthetic-leg', 'IN', 'a'*64)
        ident = pull.recording_id(*args)
        self.assertEqual(ident, '3b79ffa7-3fa2-807d-a6de-bbaefe1b2a4f')
        self.assertEqual(ident, pull.recording_id(*args))
        self.assertEqual(ident[14], '8')
        self.assertEqual(ident[19], 'a')
        self.assertNotEqual(ident, pull.recording_id('other-root', *args[1:]))
        self.assertNotEqual(ident, pull.recording_id(args[0], args[1], 'OUT', args[3]))

    def test_missing_root_end_never_queries_or_reads_cdr_audio(self):
        class Cursor:
            def execute(self, sql, parameters):
                if 'LINKEDID_END' not in sql: raise AssertionError('CDR must not be queried')
                self.parameters = parameters
            def fetchone(self): return (None,)
        cursor = Cursor()
        with self.assertRaisesRegex(ValueError, 'ROOT_NOT_FINALIZED'): source.inspect_root(cursor, 'synthetic-root')
        self.assertEqual(cursor.parameters, ('synthetic-root',))

    def test_upload_credential_change_is_api_only_and_rejects_interpolation(self):
        original = 'services:\n  api:\n    image: existing:api\n    environment:\n      EXISTING: unchanged\n  worker:\n    image: existing:worker\n'
        proposed = activation.proposal(original, 'x'*64)
        self.assertEqual(proposed.split('  worker:')[1], original.split('  worker:')[1])
        self.assertIn('      EXISTING: unchanged', proposed)
        self.assertEqual(proposed.replace("      ISSABEL_RECORDING_UPLOAD_SECRET: '"+'x'*64+"'\n", ''), original)
        for secret in ('unsafe$value', 'short', 'x'*63+'\n'):
            with self.assertRaises(RuntimeError): activation.proposal(original, secret)


if __name__ == '__main__': unittest.main()
