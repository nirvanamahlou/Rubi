"""Evaluate only the pure source allowlist; never import deployment side effects."""
import ast
from pathlib import Path
import unittest

tree = ast.parse(Path(__file__).with_name('three-panels-release-1103.py').read_text())
scope = {'Path': Path}
for node in tree.body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in ('PREFIXES', 'EXTRA') for t in node.targets):
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<scope>', 'exec'), scope)
    if isinstance(node, ast.FunctionDef) and node.name == 'allowed':
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<scope>', 'exec'), scope)


class SourceScope(unittest.TestCase):
    def test_only_requested_modules_and_explicit_public_ports(self):
        for name in ['apps/web/src/modules/call-center/call-form.tsx',
                     'apps/web/src/modules/reports/model/reporting.ts',
                     'apps/web/src/modules/dashboard/components/dashboard-workspace.tsx',
                     'apps/api/src/reporting/reporting-native-operational.ts',
                     'apps/api/src/hr/hr-reporting.public.ts']:
            self.assertTrue(scope['allowed'](name), name)

    def test_no_schema_credentials_other_module_or_traversal(self):
        for name in ['packages/database/prisma/schema.prisma', '.env',
                     '/etc/passwd', 'apps/api/src/hr/hr.service.ts',
                     'apps/web/src/modules/call-center/../../secret',
                     'apps/api/src/reporting-other/code.ts']:
            self.assertFalse(scope['allowed'](name), name)


if __name__ == '__main__':
    unittest.main()
