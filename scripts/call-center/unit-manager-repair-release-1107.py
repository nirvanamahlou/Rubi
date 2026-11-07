"""Locked configuration-only release; encrypted database backup, no service restart."""
import fcntl, hashlib, json, os, shutil, sys, time
from pathlib import Path
os.umask(0o077)
prior=Path('/opt/rubi/avina-safe-develop-refresh-1102/deploy.py')
assert hashlib.sha256(prior.read_bytes()).hexdigest()=='a8ad55b0f1ba8f19ec8f5d40b2f62efec59a63bf59a175e6fd3fcac2de1c8c0a'
exec(compile(prior.read_text().split('phase = sys.argv[1]')[0],str(prior),'exec'))
WORK=ROOT/'unit-manager-repair-1107'
assert os.geteuid()==0 and sys.argv[1] in ['backup','apply']
with (ROOT/'avina-deploy.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 assert healthy()
 if sys.argv[1]=='backup':
  assert shutil.disk_usage(ROOT).free>2*1024**3
  before=snapshot()
  folder=ROOT/'backups'/('before-unit-manager-repair-1107-'+str(int(time.time())))
  folder.mkdir(mode=0o700)
  encrypted(['docker','exec','rubi-production-postgres-1','pg_dump','-U','rubi','-d','rubi','-Fc'],folder/'database.dump.enc',['docker','exec','-i','rubi-production-postgres-1','pg_restore','--list'])
  with (folder/'database.dump.enc').open('rb') as stream: os.fsync(stream.fileno())
  assert snapshot()==before
  save('backup-verified',{'folder':str(folder),'createdAt':time.time(),'state':before,'composeHash':filehash(COMPOSE),'databaseHash':filehash(folder/'database.dump.enc')})
  print('UNIT_MANAGER_BACKUP_VERIFIED',flush=True)
 else:
  record=read('backup-verified');ci=read('ci-approved')
  assert ci['merged'] and ci['allChecksSuccessful']
  assert time.time()-record['createdAt']<900 and snapshot()==record['state'] and filehash(COMPOSE)==record['composeHash']
  assert filehash(Path(record['folder'])/'database.dump.enc')==record['databaseHash']
  for name,expected_hash in ci['scripts'].items():
   assert name in ['repair-manager-unit-link.cjs','repair-request-manager-access.cjs'] and filehash(WORK/name)==expected_hash
   run(['docker','cp',str(WORK/name),'rubi-production-api-1:/tmp/'+name])
  assert len(ci['scripts'])==2
  assert callable(digest)
  args=['docker','exec','rubi-production-api-1','node']
  # Owner explicitly selects native HR grade as the managerial authority source.
  for mode in ['plan','apply']:
   run(args+['/tmp/repair-manager-unit-link.cjs',mode,'nima','danial','/tmp/hr-manager-unit-plan.json'])
  for username in ['roya','nima']:
   for mode in ['plan','apply']:
    run(args+['/tmp/repair-request-manager-access.cjs',mode,username,'danial','/tmp/'+username+'-unit-access-plan.json'])
  assert snapshot()==record['state'] and filehash(COMPOSE)==record['composeHash'] and healthy()
  save('verified',{'revision':ci['revision'],'backup':record['folder'],'nativeIamAudit':True,'serviceIdentitiesUnchanged':True,'migrationsApplied':[]})
  print('UNIT_MANAGER_CONFIGURATION_VERIFIED',flush=True)
