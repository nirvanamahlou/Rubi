"""Two-module API overlay, fresh encrypted backup, audited HR link and rollback."""
import os,sys,hashlib,json,fcntl,shutil,time,re
from pathlib import Path
os.umask(0o077)
prior=Path('/opt/rubi/avina-safe-develop-refresh-1102/deploy.py')
assert hashlib.sha256(prior.read_bytes()).hexdigest()=='a8ad55b0f1ba8f19ec8f5d40b2f62efec59a63bf59a175e6fd3fcac2de1c8c0a'
exec(compile(prior.read_text().split('phase = sys.argv[1]')[0],str(prior),'exec'))
WORK=ROOT/'hr-manager-authority-1107'
assert os.geteuid()==0 and sys.argv[1] in ['build','backup','activate']
with (ROOT/'avina-deploy.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 assert healthy()
 if sys.argv[1]=='build':
  manifest=read('source-manifest');before=snapshot()
  assert set(manifest['baseline'])=={'hr/hr-user-unit-directory.ts','iam/iam-call-center-directory.ts'}
  for name,expected_hash in manifest['files'].items():assert filehash(WORK/'source'/name)==expected_hash
  for name,expected_hash in manifest['baseline'].items():
   live=run(['docker','exec','rubi-production-api-1','cat','/workspace/apps/api/src/'+name],capture_output=True).stdout
   assert digest(normalize(live))==expected_hash,'Live source overlap: '+name
  output=WORK/'output';output.mkdir(mode=0o700,exist_ok=True)
  args=['docker','run','--rm','--network','none','--memory','512m','--mount','type=bind,source='+str(WORK)+',target=/release','--entrypoint','node']
  for name in manifest['baseline']:
   args+=['--mount','type=bind,source='+str(WORK/'source'/name)+',target=/workspace/apps/api/src/'+name+',readonly']
  run(args+[before['api']['imageId'],'/release/source/build-hr-manager-api-patch.cjs','/release/output'])
  compiled=json.loads((output/'compiler-receipt.json').read_text())
  assert len(compiled['hashes'])==4 and len(compiled['sourceHashes'])==2
  for name,expected_hash in compiled['sourceHashes'].items():assert expected_hash==manifest['files'][name+'.ts']
  for name,expected_hash in compiled['hashes'].items():assert filehash(output/name)==expected_hash
  image='rubi-production:hr-manager-authority-'+manifest['revision'][:10]+'-1107'
  dockerfile='FROM '+before['api']['imageId']+'\n'
  for name in compiled['hashes']:dockerfile+='COPY output/'+name+' /workspace/apps/api/dist/'+name+'\n'
  for name in manifest['baseline']:dockerfile+='COPY source/'+name+' /workspace/apps/api/src/'+name+'\n'
  (WORK/'Dockerfile').write_text(dockerfile)
  run(['docker','build','--network','none','-t',image,str(WORK)])
  base_config=inspect('api')['Config'];new_config=json.loads(capture(['docker','image','inspect',image]))[0]['Config']
  for key in ['Env','Cmd','Entrypoint','User','WorkingDir']:assert base_config[key]==new_config[key]
  assert snapshot()==before
  image_id=json.loads(capture(['docker','image','inspect',image]))[0]['Id']
  save('build-verified',{'revision':manifest['revision'],'image':image,'imageId':image_id,'base':before,'composeHash':filehash(COMPOSE),'migrations':migrations(),'compiled':compiled})
  print('HR_MANAGER_API_OVERLAY_VERIFIED',flush=True)
 elif sys.argv[1]=='backup':
  record=read('build-verified');assert snapshot()==record['base'] and filehash(COMPOSE)==record['composeHash']
  assert shutil.disk_usage(ROOT).free>2900*1024**2
  integration_ready()
  folder=ROOT/'backups'/('before-hr-manager-authority-1107-'+str(int(time.time())));folder.mkdir(mode=0o700)
  encrypted(['docker','exec','rubi-production-postgres-1','pg_dump','-U','rubi','-d','rubi','-Fc'],folder/'database.dump.enc',['docker','exec','-i','rubi-production-postgres-1','pg_restore','--list'])
  encrypted(['docker','exec','rubi-production-api-1','tar','-C','/srv/rubi/documents','-czf','-','.'],folder/'documents.tar.gz.enc',['tar','-tzf','-'])
  encrypted(['tar','-C','/opt/rubi','-czf','-','compose.yaml','private'],folder/'configuration.enc',['tar','-tzf','-'])
  hashes={p.name:filehash(p) for p in folder.glob('*.enc')};assert len(hashes)==3
  for path in folder.iterdir():
   with path.open('rb') as stream:os.fsync(stream.fileno())
  assert snapshot()==record['base']
  save('backup-verified',{'folder':str(folder),'createdAt':time.time(),'hashes':hashes})
  print('HR_MANAGER_ENCRYPTED_BACKUP_VERIFIED',flush=True)
 else:
  record=read('build-verified');backup=read('backup-verified');ci=read('ci-approved');manifest=read('source-manifest')
  assert ci['merged'] and ci['allChecksSuccessful'] and ci['revision']==record['revision']==manifest['revision']
  assert json.loads(capture(['docker','image','inspect',record['image']]))[0]['Id']==record['imageId']
  assert time.time()-backup['createdAt']<900 and snapshot()==record['base'] and filehash(COMPOSE)==record['composeHash']
  assert migrations()==record['migrations'] and shutil.disk_usage(ROOT).free>1024**3
  assert all(filehash(Path(backup['folder'])/name)==value for name,value in backup['hashes'].items())
  for name,expected_hash in manifest['files'].items():assert filehash(WORK/'source'/name)==expected_hash
  # Exact identity mapping is confirmed separately by the owner; it is not inferred.
  confirmed=read('confirmed-hr-link')
  for name in ['link-confirmed-hr-manager-account.cjs','verify-hr-manager-authority.cjs']:
   run(['docker','cp',str(WORK/'source'/name),'rubi-production-api-1:/tmp/'+name])
  for phase_name in ['plan','apply']:
   run(['docker','exec','rubi-production-api-1','node','/tmp/link-confirmed-hr-manager-account.cjs',phase_name,confirmed['employeeId'],confirmed['username'],confirmed['operator'],'/tmp/confirmed-hr-link-plan.json'])
  original=COMPOSE.read_text();pattern=r'(^  api:\s*\n)(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)'
  matches=list(re.finditer(pattern,original,re.M|re.S));assert len(matches)==1
  match=matches[0];body,count=re.subn(r'(?m)^(    image:\s*)'+re.escape(record['base']['api']['image'])+r'\s*$',lambda m:m.group(1)+record['image'],match.group(2));assert count==1
  updated=original[:match.start(2)]+body+original[match.end(2):]
  atomic(WORK/'compose.before.yaml',original)
  command=['docker','compose','-p','rubi-production','-f',str(COMPOSE)]
  try:
   atomic(COMPOSE,updated);run(command+['config','--quiet']);run(command+['up','-d','--no-deps','--force-recreate','api'])
   for _ in range(30):
    if healthy():break
    time.sleep(2)
   else:raise RuntimeError('API health check failed')
   integration_ready();after=snapshot()
   for name in SERVICES:
    if name!='api':assert after[name]==record['base'][name]
   assert after['api']['image']==record['image'] and after['api']['envHash']==record['base']['api']['envHash'] and after['api']['mounts']==record['base']['api']['mounts']
   assert migrations()==record['migrations']
   for name in ['verify-hr-manager-authority.cjs']:
    run(['docker','cp',str(WORK/'source'/name),'rubi-production-api-1:/tmp/'+name])
   run(['docker','cp',str(WORK/'acceptance-targets.json'),'rubi-production-api-1:/tmp/hr-manager-acceptance-targets.json'])
   proof=capture(['docker','exec','rubi-production-api-1','node','/tmp/verify-hr-manager-authority.cjs','/tmp/hr-manager-acceptance-targets.json'])
   save('verified',{'revision':record['revision'],'backup':backup['folder'],'image':record['image'],'acceptance':json.loads(proof),'onlyApiRecreated':True,'migrationsApplied':[]})
   print('HR_MANAGER_AUTHORITY_LIVE_VERIFIED',flush=True)
  except Exception:
   atomic(COMPOSE,original);run(command+['up','-d','--no-deps','--force-recreate','api'])
   raise
