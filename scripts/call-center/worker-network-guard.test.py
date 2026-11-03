import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('guard', pathlib.Path(__file__).with_name('worker-network-guard.py'))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class NetworkGuardTest(unittest.TestCase):
    def test_current_namespace_is_unchanged(self):
        self.assertFalse(guard.stale({'Id':'current'}, {'HostConfig':{'NetworkMode':'container:current'}}))
    def test_previous_api_namespace_is_stale(self):
        self.assertTrue(guard.stale({'Id':'current'}, {'HostConfig':{'NetworkMode':'container:removed'}}))
    def test_independent_network_is_not_reconfigured(self):
        self.assertFalse(guard.stale({'Id':'current'}, {'HostConfig':{'NetworkMode':'project_default'}}))

if __name__ == '__main__':
    unittest.main()
