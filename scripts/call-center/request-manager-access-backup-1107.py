"""Fresh encrypted backup and locked, audited native-IAM configuration repair."""
import fcntl, hashlib, json, os, shutil, subprocess, sys, time
from pathlib import Path
os.umask(0o077)
prior=Path('/opt/rubi/avina-safe-develop-refresh-1102/deploy.py')
assert hashlib.sha256(prior.read_bytes()).hexdigest()=='a8ad55b0f1ba8f19ec8f5d40b2f62efec59a63bf59a175e6fd3fcac2de1c8c0a'
exec(compile(prior.read_text().split('phase = sys.argv[1]')[0],str(prior),'exec'))
WORK=ROOT/'request-manager-access-1107'
assert os.geteuid()==0 and sys.argv[1] in ['backup','apply']
with (ROOT/'avina-deploy.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 assert healthy()
 if sys.argv[1]=='backup':
  assert shutil.disk_usage(ROOT).free>4*1024**3
  before=snapshot()
  folder=ROOT/'backups'/('before-request-manager-access-1107-'+str(int(time.time())))
  folder.mkdir(mode=0o700)
  encrypted(['docker','exec','rubi-production-postgres-1','pg_dump','-U','rubi','-d','rubi','-Fc'],folder/'database.dump.enc',['docker','exec','-i','rubi-production-postgres-1','pg_restore','--list'])
  encrypted(['docker','exec','rubi-production-api-1','tar','-C','/srv/rubi/documents','-czf','-','.'],folder/'documents.tar.gz.enc',['tar','-tzf','-'])
  encrypted(['tar','-C','/opt/rubi','-czf','-','compose.yaml','private'],folder/'configuration.enc',['tar','-tzf','-'])
  assert snapshot()==before
  receipt={'folder':str(folder),'createdAt':time.time(),'state':before,'composeHash':filehash(COMPOSE),'hashes':{p.name:filehash(p) for p in folder.glob('*.enc')}}
  assert len(receipt['hashes'])==3
  (folder/'manifest.json').write_text(json.dumps(receipt,indent=2))
  for path in folder.iterdir():
   with path.open('rb') as stream: os.fsync(stream.fileno())
  save('backup-verified',receipt)
  print('REQUEST_MANAGER_BACKUP_VERIFIED',flush=True)
 else:
  record=read('backup-verified');ci=read('ci-approved')
  assert ci['merged'] and ci['allChecksSuccessful']
  assert time.time()-record['createdAt']<900 and snapshot()==record['state'] and filehash(COMPOSE)==record['composeHash']
  assert all(filehash(Path(record['folder'])/name)==value for name,value in record['hashes'].items())
  assert shutil.disk_usage(ROOT).free>2*1024**3
  source=WORK/'repair-request-manager-access.cjs'
  assert filehash(source)==ci['operatorScriptSha256']
  run(['docker','cp',str(source),'rubi-production-api-1:/tmp/repair-request-manager-access.cjs'])
  args=['docker','exec','rubi-production-api-1','node','/tmp/repair-request-manager-access.cjs']
  # The owner explicitly identifies this sales manager. No role-name inference.
  run(args+['plan','atena','danial','/tmp/request-manager-access-plan.json'])
  run(args+['apply','atena','danial','/tmp/request-manager-access-plan.json'])
  assert snapshot()==record['state'] and filehash(COMPOSE)==record['composeHash'] and healthy()
  save('verified',{'revision':ci['revision'],'backup':record['folder'],'nativeIamAudit':True,'serviceIdentitiesUnchanged':True,'migrationsApplied':[]})
  print('REQUEST_MANAGER_CONFIGURATION_VERIFIED',flush=True)
