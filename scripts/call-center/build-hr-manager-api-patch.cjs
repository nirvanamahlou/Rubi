// Run in the existing API image: use its actual project compiler configuration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const req = createRequire('/workspace/apps/api/package.json');
const ts = req('typescript');
const root = '/workspace/apps/api';
const output = process.argv[2];
if (!output || !path.isAbsolute(output))
  throw Error('Absolute output required');
const config = ts.readConfigFile(
  root + '/tsconfig.build.json',
  ts.sys.readFile,
);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (config.error || parsed.errors.length)
  throw Error('Compiler config invalid');
const hashes = {};
const sourceHashes = {};
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
for (const name of [
  'hr/hr-user-unit-directory',
  'iam/iam-call-center-directory',
]) {
  const file = root + '/src/' + name + '.ts';
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      ...parsed.options,
      declaration: false,
      declarationMap: false,
    },
    reportDiagnostics: true,
  });
  if (result.diagnostics?.length) throw Error('Compiler diagnostics: ' + name);
  sourceHashes[name] = hash(source);
  for (const [suffix, content] of [
    ['.js', result.outputText],
    ['.js.map', result.sourceMapText],
  ]) {
    if (!content) throw Error('Missing compiler output');
    const relative = name + suffix;
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    hashes[relative] = hash(content);
  }
}
fs.writeFileSync(
  path.join(output, 'compiler-receipt.json'),
  JSON.stringify({ typescript: ts.version, sourceHashes, hashes }, null, 2),
);
console.log('BOUNDED_API_COMPILER_OUTPUT_VERIFIED');
