import subprocess,tarfile,pathlib,re,json,hashlib
p=pathlib.Path('/opt/rubi/call-center-final-rollout-1031')
current=subprocess.check_output(['docker','exec','rubi-production-api-1','cat','/workspace/packages/database/prisma/schema.prisma']).decode()
with tarfile.open(p/'source.tar.gz') as archive:
 desired=archive.extractfile('packages/database/prisma/schema.prisma').read().replace(b'\r\n',b'\n')
def parse(source):
 return {name:{re.sub(r'\s+','',line.split('//')[0]) for line in body.splitlines() if line.strip() and not line.strip().startswith('//')} for name,body in re.findall(r'^model\s+(\w+)\s*\{(.*?)^\}',source,re.M|re.S)}
before,after=parse(current),parse(desired.decode())
assert before and after and set(before).issubset(after)
assert all(fields.issubset(after[name]) for name,fields in before.items()), 'Canonical schema omits live fields'
target='packages/database/prisma/schema.prisma'
record=json.loads((p/'prepared.json').read_text())
assert hashlib.sha256(desired).hexdigest()==json.loads((p/'source-compare.json').read_text())['target'][target]
(p/'context/release'/target).write_bytes(desired)
digest=hashlib.sha256(desired).hexdigest()
record['sourceHashes'][target]=digest
record['preservedLiveFiles'][target]=digest
(p/'prepared.json').write_text(json.dumps(record,indent=2))
(p/'canonical-schema-reviewed.json').write_text(json.dumps({'allLiveModelsAndFieldsRetained':True,'sha256':digest,'reason':'Live appended responsibility model already exists in canonical develop; text merge duplicated it.'}))
print('Canonical schema verified: every live model and field retained; duplicate textual insertion removed from candidate only.')
