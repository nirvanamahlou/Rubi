# -*- coding: utf-8 -*-
"""Read-only Issabel Python2/3 RPC. No phone fields, PBX writes or shell paths."""
import base64
import hashlib
import json
import os
import re
import stat
import struct
import time

SOURCE_ROOT = '/var/spool/asterisk/monitor'
MAX_BYTES = 20971520
QUIET_SECONDS = 30


def safe_path(root, relative):
    if not isinstance(relative, str) or not relative or len(relative) > 512:
        raise ValueError('INVALID_PATH')
    parts = relative.split('/')
    if any(p in ('.', '..', '') or not re.match(r'^[A-Za-z0-9_+().-]+$', p) for p in parts):
        raise ValueError('INVALID_PATH')
    if not relative.lower().endswith('.wav'):
        raise ValueError('UNSUPPORTED_FORMAT')
    root = os.path.realpath(root)
    path = root
    for part in parts:
        path = os.path.join(path, part)
        if stat.S_ISLNK(os.lstat(path).st_mode):
            raise ValueError('SOURCE_LINK')
    if not os.path.realpath(path).startswith(root + os.sep):
        raise ValueError('OUTSIDE_SOURCE')
    return path


def finalized_audio(path, now=None):
    now = time.time() if now is None else now
    with open(path, 'rb') as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or not 44 <= before.st_size <= MAX_BYTES:
            raise ValueError('UNSUPPORTED_SIZE')
        if now - before.st_mtime < QUIET_SECONDS:
            raise ValueError('SOURCE_NOT_QUIET')
        audio = stream.read(MAX_BYTES + 1)
        after = os.fstat(stream.fileno())
    if (before.st_ino, before.st_dev, before.st_size, before.st_mtime, before.st_ctime) != (after.st_ino, after.st_dev, after.st_size, after.st_mtime, after.st_ctime):
        raise ValueError('SOURCE_CHANGED')
    if (len(audio) != before.st_size or audio[:4] != b'RIFF' or audio[8:12] != b'WAVE' or struct.unpack('<I', audio[4:8])[0] + 8 != len(audio)):
        raise ValueError('INCOMPLETE_WAV')
    return audio


def connection():
    try:
        import ConfigParser as configparser
    except ImportError:
        import configparser
    import MySQLdb
    parser = configparser.RawConfigParser()
    parser.read('/etc/asterisk/cdr_mysql.conf')
    def value(key, default=''):
        return parser.get('global', key) if parser.has_option('global', key) else default
    return MySQLdb.connect(host=value('hostname', 'localhost'), user=value('user'), passwd=value('password'), db=value('dbname', 'asteriskcdrdb'), port=int(value('port', '3306')), connect_timeout=10)


def inspect_root(cursor, root_id):
    if not re.match(r'^[A-Za-z0-9_.:-]{1,128}$', root_id):
        raise ValueError('INVALID_ROOT')
    cursor.execute("SELECT UNIX_TIMESTAMP(MAX(eventtime)) FROM cel WHERE linkedid=%s AND eventtype='LINKEDID_END'", (root_id,))
    ended = cursor.fetchone()[0]
    if not ended or time.time() - float(ended) < QUIET_SECONDS:
        raise ValueError('ROOT_NOT_FINALIZED')
    cursor.execute('SELECT DISTINCT uniqueid FROM cel WHERE linkedid=%s LIMIT 129', (root_id,))
    legs = sorted(set(str(row[0]) for row in cursor.fetchall()))
    if not legs or len(legs) > 128:
        raise ValueError('AMBIGUOUS_ROOT')
    cursor.execute("SELECT calldate,uniqueid,recordingfile FROM cdr WHERE uniqueid IN (" + ','.join(['%s'] * len(legs)) + ") AND recordingfile<>'' ORDER BY calldate,uniqueid", tuple(legs))
    rows = cursor.fetchall()
    files = {}
    for date, unique_id, filename in rows:
        unique_id, filename = str(unique_id), str(filename)
        cursor.execute("SELECT DISTINCT linkedid FROM cel WHERE uniqueid=%s AND linkedid<>''", (unique_id,))
        if set(str(row[0]) for row in cursor.fetchall()) != set([root_id]):
            raise ValueError('AMBIGUOUS_LEG')
        relative = filename if '/' in filename else date.strftime('%Y/%m/%d/') + filename
        if relative.startswith(SOURCE_ROOT + '/'):
            relative = relative[len(SOURCE_ROOT) + 1:]
        path = safe_path(SOURCE_ROOT, relative)
        info = os.stat(path)
        if time.time() - info.st_mtime < QUIET_SECONDS:
            raise ValueError('SOURCE_NOT_QUIET')
        if not 44 <= info.st_size <= MAX_BYTES:
            raise ValueError('UNSUPPORTED_SIZE')
        # The same root/file can appear in multiple CDR rows; choose one stable leg.
        if relative not in files or unique_id < files[relative]['externalCallId']:
            files[relative] = {'file': relative, 'externalCallId': unique_id, 'sizeBytes': info.st_size}
    if len(files) > 128:
        raise ValueError('TOO_MANY_FILES')
    return [files[key] for key in sorted(files)]


def main(request):
    database = None
    try:
        database = connection()
        files = inspect_root(database.cursor(), request['rootCallId'])
        result = {'ok': True, 'files': files}
        if request.get('operation') == 'read':
            matches = [f for f in files if f['file'] == request.get('file') and f['externalCallId'] == request.get('externalCallId')]
            if len(matches) != 1:
                raise ValueError('SOURCE_IDENTITY_CHANGED')
            audio = finalized_audio(safe_path(SOURCE_ROOT, matches[0]['file']))
            result = {'ok': True, 'sha256': hashlib.sha256(audio).hexdigest(), 'audio': base64.b64encode(audio).decode('ascii')}
        elif request.get('operation') != 'inspect':
            raise ValueError('INVALID_OPERATION')
        print(json.dumps(result))
    except ValueError as error:
        print(json.dumps({'ok': False, 'reason': str(error)}))
    except Exception:
        print(json.dumps({'ok': False, 'reason': 'SOURCE_UNAVAILABLE'}))
    finally:
        if database is not None:
            database.close()
