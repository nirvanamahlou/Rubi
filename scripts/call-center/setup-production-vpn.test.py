"""Offline safety checks; no root, credentials, VPN or production writes."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).with_name('setup-production-vpn.py'))
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class BootstrapSafety(unittest.TestCase):
    def test_routes_and_ppp_never_replace_default_or_dns(self):
        rendered = bootstrap.files({'password': 'synthetic-password', 'psk': 'synthetic-psk'})
        options = rendered[bootstrap.PRIVATE / 'ppp.options']
        self.assertIn('nodefaultroute\n', options)
        self.assertNotIn('usepeerdns', options)
        self.assertNotIn('replacedefaultroute', options)
        self.assertIn('192.168.100.200/32', bootstrap.HOOK)
        self.assertIn("sys.argv[6]!='rubi-issabel-1029'", bootstrap.HOOK)
        self.assertIn("'unreachable','192.168.100.200/32'", bootstrap.GUARD)
        self.assertIn("'--pol','ipsec'", bootstrap.GUARD)

    def test_credentials_cannot_inject_configuration_lines(self):
        for value in ('bad\nvalue', 'bad\rvalue', 'bad\0value', '', None):
            with self.assertRaises(ValueError):
                bootstrap.quote(value)
        self.assertEqual(bootstrap.quote('a"b\\c'), '"a\\"b\\\\c"')

    def test_write_refuses_existing_files(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'config'
            bootstrap.write(path, 'original')
            with self.assertRaises(RuntimeError):
                bootstrap.write(path, 'replacement')
            self.assertEqual(path.read_text(), 'original')

    def test_optional_cleanup_handles_missing_packages(self):
        with patch.object(bootstrap.subprocess, 'run', side_effect=FileNotFoundError):
            self.assertEqual(bootstrap.run(['missing'], required=False), '')
            with self.assertRaises(FileNotFoundError):
                bootstrap.run(['missing'])

    def test_credential_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'target'
            target.write_text('{}')
            link = Path(folder) / 'link'
            link.symlink_to(target)
            with self.assertRaises(OSError):
                bootstrap.credentials(link)


if __name__ == '__main__':
    unittest.main()
