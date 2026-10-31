#!/usr/bin/env python3
"""Root-only, read-only PBX pull into the existing authenticated recording API."""
import base64
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import struct
import subprocess
import time
import urllib.error
import urllib.request

PRIVATE = Path('/opt/rubi/private/call-recordings-1031')
REPORT = Path('/opt/rubi/CALL-RECORDINGS-PULL-1031.json')
MAX_BYTES = 20971520


def capture(args, data=None, timeout=30, environment=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout, env=environment)
    if result.returncode:
        raise RuntimeError('COMMAND_FAILED')
    return result.stdout


def recording_id(root, external, direction, sha):
    # Match the owning Integrations uploader's existing stable v8 identity.
    raw = json.dumps([root, external, direction, sha], separators=(',', ':'), ensure_ascii=False)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return h[:8]+'-'+h[8:12]+'-8'+h[13:16]+'-a'+h[17:20]+'-'+h[20:32]


def valid_audio(audio, expected_sha):
    return (44 <= len(audio) <= MAX_BYTES and audio[:4] == b'RIFF' and
            audio[8:12] == b'WAVE' and struct.unpack('<I', audio[4:8])[0] + 8 == len(audio) and
            hashlib.sha256(audio).hexdigest() == expected_sha)


def sessions(cursor):
    # Values are only service-produced ISO timestamp/UUID, never source caller data.
    after = ''
    if cursor:
        if not re.fullmatch(r'[0-9TZ:+. -]+', cursor[0]) or not re.fullmatch(r'[0-9a-f-]{36}', cursor[1]):
            raise RuntimeError('INVALID_CURSOR')
        after = ' AND (s."updatedAt",s.id)>(\''+cursor[0]+'\'::timestamptz,\''+cursor[1]+'\'::uuid)'
    columns = '''s.id,s."rootFingerprint",s."connectionId",s."encryptedTechnical",s."keyVersion",s."updatedAt",c.direction'''
    base = ''' FROM call_center_telephony_sessions s JOIN customer_affairs_calls c ON c.id=s."callId" WHERE NOT s.synthetic AND s.state='ENDED' AND c.origin='TELEPHONY' AND c.occurred_at>now()-interval '90 days' '''
    query = 'BEGIN READ ONLY; SET LOCAL statement_timeout=\'8000ms\'; SELECT json_build_object(\'older\',(SELECT coalesce(json_agg(x),\'[]\'::json) FROM (SELECT '+columns+base+after+' ORDER BY s."updatedAt",s.id LIMIT 200) x),\'recent\',(SELECT coalesce(json_agg(x),\'[]\'::json) FROM (SELECT '+columns+base+' ORDER BY s."updatedAt" DESC,s.id DESC LIMIT 20) x)); COMMIT;'
    encrypted = capture(['docker', 'exec', 'rubi-production-postgres-1', 'psql', '-X', '-U', 'rubi', '-d', 'rubi', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query])
    code = r'''const fs=require('fs');const req=require('node:module').createRequire('/workspace/apps/api/dist/main.js');const {ConfigService}=req('@nestjs/config');const {CallCenterCrypto}=req('/workspace/apps/api/dist/customer-affairs/call-center.crypto.js');const c=new CallCenterCrypto(new ConfigService(process.env));const d=JSON.parse(fs.readFileSync(0,'utf8'));for(const key of ['older','recent'])d[key]=d[key].flatMap(r=>{try{if(r.connectionId!==process.env.ISSABEL_CONNECTION_ID)return[];const t=c.decrypt(r.encryptedTechnical,r.keyVersion,`telephony:${r.id}`);const root=t.first.rootCallId??t.first.externalCallId;const direction=r.direction==='INBOUND'?'IN':r.direction==='OUTBOUND'?'OUT':null;if(!direction||!/^[A-Za-z0-9_.:-]{1,128}$/.test(root)||c.fingerprint(`telephony:root:${r.connectionId}:${root}`)!==r.rootFingerprint)return[];return[{id:r.id,key:r.rootFingerprint,rootCallId:root,direction,updatedAt:r.updatedAt}]}catch{return[]}});console.log(JSON.stringify(d));'''
    return json.loads(capture(['docker', 'exec', '-i', 'rubi-production-api-1', 'node', '-e', code], encrypted))


def rpc(request):
    script = (PRIVATE/'pbx-recording-source.py').read_text()
    script += '\nmain(json.loads('+repr(json.dumps(request))+'))\n'
    environment = dict(os.environ, SSH_ASKPASS=str(PRIVATE/'askpass'), SSH_ASKPASS_REQUIRE='force', DISPLAY=':rubi-recordings')
    result = capture(['ssh', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile='+str(PRIVATE/'known_hosts'), '-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password', '-o', 'NumberOfPasswordPrompts=1', '-o', 'ConnectTimeout=10', '-o', 'LogLevel=ERROR', 'bi@192.168.100.200', 'python -'], script.encode(), 90, environment=environment)
    return json.loads(result)


def post(path, body, token):
    request = urllib.request.Request('http://127.0.0.1:4000/api/v1/internal/issabel/recordings'+path, json.dumps(body, separators=(',', ':')).encode(), {'Authorization': 'Bearer '+token, 'Content-Type': 'application/json'}, method='POST')
    # Loopback only, no redirect to another origin with the private token.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        return json.load(response)


def upload(row, file, audio, sha, token):
    ident = recording_id(row['rootCallId'], file['externalCallId'], row['direction'], sha)
    started = post('', {'id': ident, 'rootCallId': row['rootCallId'], 'externalCallId': file['externalCallId'], 'direction': row['direction'], 'sha256': sha, 'sizeBytes': len(audio)}, token)
    if started.get('id') != ident or started.get('state') not in ('UPLOADING', 'COMPLETE'):
        raise RuntimeError('INVALID_START_RECEIPT')
    if started['state'] != 'COMPLETE':
        for offset in range(0, len(audio), 32768):
            receipt = post('/'+ident+'/chunks', {'index': offset//32768, 'data': base64.b64encode(audio[offset:offset+32768]).decode()}, token)
            if receipt.get('ok') is not True:
                raise RuntimeError('INVALID_CHUNK_RECEIPT')
    completed = post('/'+ident+'/complete', {}, token)
    if completed.get('id') != ident or completed.get('state') != 'COMPLETE':
        raise RuntimeError('INVALID_COMPLETE_RECEIPT')
    return ident


def main():
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    os.umask(0o077)
    with open(PRIVATE/'pull.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config = json.loads((PRIVATE/'config.json').read_text())
        database = sqlite3.connect(PRIVATE/'state.sqlite')
        database.executescript('CREATE TABLE IF NOT EXISTS roots (key TEXT PRIMARY KEY, done INTEGER, next_at REAL); CREATE TABLE IF NOT EXISTS files (key TEXT PRIMARY KEY, sha TEXT, recording_id TEXT, completed INTEGER, updated_at REAL); CREATE TABLE IF NOT EXISTS cursor (singleton INTEGER PRIMARY KEY CHECK(singleton=1), stamp TEXT, id TEXT);')
        cursor = database.execute('SELECT stamp,id FROM cursor WHERE singleton=1').fetchone()
        data = sessions(cursor)
        report = {'time_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'checked': 0, 'uploaded': 0, 'pending': 0, 'rejected': 0, 'source_failures': 0}
        seen = set()
        def process(row):
            if row['key'] in seen:
                return
            seen.add(row['key'])
            prior = database.execute('SELECT done,next_at FROM roots WHERE key=?', (row['key'],)).fetchone()
            if prior and (prior[0] or prior[1] > time.time()):
                return
            if report['checked'] >= 10:
                return
            report['checked'] += 1
            database.execute('INSERT OR REPLACE INTO roots VALUES (?,0,?)', (row['key'], time.time()+300))
            database.commit()
            try:
                result = rpc({'operation': 'inspect', 'rootCallId': row['rootCallId']})
                if not result.get('ok') or not result['files']:
                    report['pending'] += 1
                    return
                for item in result['files']:
                    key = hashlib.sha256(json.dumps([row['key'], item['file']], separators=(',', ':')).encode()).hexdigest()
                    saved = database.execute('SELECT sha,completed FROM files WHERE key=?', (key,)).fetchone()
                    if saved and saved[1]:
                        continue
                    if shutil.disk_usage('/opt/rubi').free < 2*1024**3 + 3*item['sizeBytes']:
                        raise RuntimeError('STORAGE_RESERVE')
                    response = rpc({'operation': 'read', 'rootCallId': row['rootCallId'], 'file': item['file'], 'externalCallId': item['externalCallId']})
                    if not response.get('ok'):
                        raise RuntimeError('SOURCE_NOT_READY')
                    audio = base64.b64decode(response['audio'], validate=True)
                    if not valid_audio(audio, response['sha256']) or (saved and saved[0] != response['sha256']):
                        report['rejected'] += 1
                        return
                    database.execute('INSERT OR REPLACE INTO files VALUES (?,?,NULL,0,?)', (key, response['sha256'], time.time()))
                    database.commit()
                    ident = upload(row, item, audio, response['sha256'], config['upload_secret'])
                    database.execute('UPDATE files SET recording_id=?,completed=1,updated_at=? WHERE key=?', (ident, time.time(), key))
                    database.commit()
                    report['uploaded'] += 1
                database.execute('UPDATE roots SET done=1 WHERE key=?', (row['key'],))
                database.commit()
            except Exception:
                report['source_failures'] += 1
        try:
            for row in data['recent']:
                process(row)
            for row in data['older']:
                if report['checked'] >= 10:
                    break
                process(row)
                database.execute('INSERT OR REPLACE INTO cursor VALUES (1,?,?)', (row['updatedAt'], row['id']))
                database.commit()
            if not data['older']:
                database.execute('DELETE FROM cursor')
            database.execute('DELETE FROM files WHERE updated_at<?', (time.time()-90*86400,))
            database.commit()
            report['completed_roots'] = database.execute('SELECT count(*) FROM roots WHERE done=1').fetchone()[0]
            temp = PRIVATE/'report.tmp'
            temp.write_text(json.dumps(report, indent=2))
            os.chmod(temp, 0o644)
            os.replace(temp, REPORT)
            print(json.dumps(report))
        finally:
            database.close()


if __name__ == '__main__':
    main()
