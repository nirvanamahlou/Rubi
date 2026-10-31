"""No-root safety checks; only synthetic temporary Compose configuration is read."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

source=Path(__file__).with_name('activate-live-ingress.py')
if not source.exists(): source=Path(__file__).with_name('activate-call-center-1029.py')
spec=importlib.util.spec_from_file_location('activation',source)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class ActivationSafety(unittest.TestCase):
    def test_migration_role_is_separate_and_password_is_url_encoded(self):
        runtime='postgresql://rubi_app:runtime@postgres:5432/rubi?schema=public&options=readonly'
        database={'POSTGRES_USER':'rubi','POSTGRES_DB':'rubi','POSTGRES_PASSWORD':'synthetic@:/?#$'}
        actual=module.migration_database_url(runtime,database)
        parsed=module.urllib.parse.urlsplit(actual)
        self.assertEqual(parsed.username,'rubi')
        self.assertEqual(module.urllib.parse.unquote(parsed.password),'synthetic@:/?#$')
        self.assertEqual(parsed.query,'')
        self.assertIn('rubi_app:runtime',runtime)

    def test_migration_refuses_foreign_database_or_runtime_identity(self):
        database={'POSTGRES_USER':'rubi','POSTGRES_DB':'rubi','POSTGRES_PASSWORD':'synthetic'}
        for url in ('postgresql://rubi_app:p@other:5432/rubi',
                    'postgresql://other:p@postgres:5432/rubi',
                    'postgresql://rubi_app:p@postgres:5432/other'):
            with self.assertRaises(RuntimeError): module.migration_database_url(url,database)
        with self.assertRaises(RuntimeError):
            module.migration_database_url('postgresql://rubi_app:p@postgres:5432/rubi',{})

    def test_proposal_changes_only_api_image_and_adds_one_private_file(self):
        before='services:\n  api:\n    image: '+module.BASE+'\n    env_file:\n    - /old.env\n    ports:\n    - 4000:4000\n  worker:\n    image: '+module.BASE+'\n'
        after=module.proposal(before,Path('/private/new.env'))
        self.assertEqual(after.count(module.IMAGE),1)
        self.assertEqual(after.split('  worker:')[1],before.split('  worker:')[1])
        self.assertIn('    - /old.env\n    - /private/new.env\n',after)
        self.assertIn('    ports:\n    - 4000:4000\n',after)

    def test_complex_environment_layout_is_refused(self):
        with self.assertRaises(RuntimeError):
            module.proposal('services:\n  api:\n    image: '+module.BASE+'\n    env_file: [old.env]\n',Path('/private/new.env'))

    def test_invalid_environment_key_and_cr_are_refused(self):
        for values in ({'BAD-KEY':'synthetic'},{'SAFE':'bad\rvalue'}):
            with self.assertRaises(RuntimeError): module.dotenv(values)

    def test_compose_round_trip_preserves_literal_secret_and_multiline_certificate(self):
        values={'ISSABEL_AMI_SECRET':"synthetic$literal'quote\\tail",
                'ISSABEL_AMI_CA_PEM':'-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----\n'}
        with tempfile.TemporaryDirectory(prefix='rubi-env-fixture-') as folder:
            root=Path(folder)
            (root/'private.env').write_text(module.dotenv(values))
            (root/'compose.yaml').write_text('name: rubi-call-center-env-fixture\nservices:\n  api:\n    image: fixture:unused\n    env_file:\n    - ./private.env\n')
            p=subprocess.run(['docker','compose','-f',str(root/'compose.yaml'),'config','--format','json'],capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr)
            actual=module.compose_model(p.stdout)['services']['api']['environment']
            self.assertEqual(actual,values)


if __name__=='__main__': unittest.main()
