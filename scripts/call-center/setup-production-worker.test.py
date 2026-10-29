"""Synthetic configuration preservation checks; never contacts a live service."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('setup', Path(__file__).with_name('setup-production-worker.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SetupTests(unittest.TestCase):
    def test_env_file_forms_keep_existing_settings(self):
        for block in ('', '    env_file: /private/base.env\n', '    env_file:\n      - /private/base.env\n'):
            original = 'services:\n  api:\n'+block+'    image: pinned\n    volumes:\n      - data:/data\n  web:\n    image: unchanged\n'
            result = setup.add_env_file(original, 'api', '/private/transport.env')
            self.assertEqual(result.count('/private/transport.env'), 1)
            self.assertIn('    image: pinned\n    volumes:\n      - data:/data', result)
            self.assertIn('  web:\n    image: unchanged\n', result)
            if block:
                self.assertIn('/private/base.env', result)

    def test_ambiguous_layout_is_rejected(self):
        for text in ('services:\n  web:\n    image: unchanged\n', 'services:\n  api:\n    env_file: [one, two]\n'):
            with self.assertRaises(RuntimeError):
                setup.add_env_file(text, 'api', '/private/transport.env')

    def config(self):
        return {'services': {name: {'image': name, 'volumes': ['preserved'], 'environment': {'EXISTING': 'kept'}} for name in ('api', 'worker', 'web')}, 'networks': {'private': {'internal': True}}}

    def proposed(self, config, resolved):
        result = copy.deepcopy(config)
        for name in ('api', 'worker'):
            if resolved:
                result['services'][name]['environment'].update({setup.SECRET_NAME: 'synthetic-only', setup.URL_NAME: 'https://avinaofficial.ir/api/v1'})
            else:
                result['services'][name]['env_file'] = [{'path': '/private/transport.env', 'required': True}]
        return result

    def test_both_compose_representations_are_accepted(self):
        for resolved in (False, True):
            original = self.config()
            setup.verify_compose_change(original, self.proposed(original, resolved), '/private/transport.env', 'synthetic-only')
            self.assertNotIn(setup.SECRET_NAME, original['services']['api']['environment'])

    def test_unrelated_image_environment_or_mount_change_is_rejected(self):
        for property_name, value in (('image', 'unreviewed'), ('volumes', ['replacement']), ('environment', {'EXISTING': 'changed'})):
            original = self.config()
            changed = self.proposed(original, False)
            changed['services']['web'][property_name] = value
            with self.assertRaises(RuntimeError):
                setup.verify_compose_change(original, changed, '/private/transport.env', 'synthetic-only')

    def test_changed_release_stops_before_backup_or_mutation(self):
        with patch.object(setup.os, 'geteuid', return_value=0), patch.object(setup.sys, 'argv', ['setup']), patch.object(setup, 'inspect', return_value=[{'Config': {'Image': 'different'}}]), patch.object(setup, 'run') as commands, patch.object(setup.Path, 'read_bytes', return_value=b'baseline'):
            with self.assertRaisesRegex(RuntimeError, 'Release changed'):
                setup.main()
            commands.assert_not_called()


if __name__ == '__main__':
    unittest.main()
