#!/usr/bin/env python3
"""Evaluate candidate read-only projections in the current API; no rollout."""
import base64
import datetime
import json
import os
from pathlib import Path
import pwd
import subprocess
import zipfile
import io
import xml.etree.ElementTree as ET


def run(args, data=None, timeout=160):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Read-only verification failed: ' + args[0])
    return result.stdout


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Use the approved root console')
    os.umask(0o077)
    code = Path('/home/rubi-deploy/reports-reconcile-1027.cjs').read_bytes()
    container = run(['docker', 'compose', '-f', '/opt/rubi/compose.yaml', 'ps', '-q', 'api']).decode().strip()
    if not container or '\n' in container:
        raise RuntimeError('Expected one running API')
    # Only compile in this separate short-lived node process. No container file,
    # image, live application, environment or database business row is changed.
    loader = "const M=require('module'),p=require('path');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const f=p.join(process.cwd(),'apps/api/reports-reconcile.cjs');const m=new M(f,module);m.filename=f;m.paths=M._nodeModulePaths(p.dirname(f));m._compile(s,f);});"
    receipt = json.loads(run(['docker', 'exec', '-i', container, 'node', '-e', loader], code))
    root = Path('/home/rubi-deploy') / ('reports-verified-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    root.mkdir(mode=0o700)
    account = pwd.getpwnam('rubi-deploy')
    for file in receipt.pop('files'):
        name = file['name']
        if name not in {code + '.xlsx' for code in ('sales_by_organization', 'sales_by_service_route', 'route_passengers', 'sales_contract_pipeline', 'payments_refunds')}:
            raise RuntimeError('Invalid output name')
        raw = base64.b64decode(file['base64'], validate=True)
        with zipfile.ZipFile(io.BytesIO(raw)) as workbook:
            for part in workbook.namelist():
                if part.endswith('.xml') or part.endswith('.rels'):
                    ET.fromstring(workbook.read(part))
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            styles = ET.fromstring(workbook.read('xl/styles.xml'))
            sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
            title = sheet.find(".//s:c[@r='A1']", ns)
            xf = styles.find('s:cellXfs', ns)[int(title.attrib.get('s', '0'))]
            font = styles.find('s:fonts', ns)[int(xf.attrib['fontId'])]
            if font.find('s:sz', ns).attrib['val'] != '16':
                raise RuntimeError('Title font is not 16')
            for cell in sheet.findall('.//s:c', ns):
                if int(cell.attrib.get('s', '0')) >= len(styles.find('s:cellXfs', ns)):
                    raise RuntimeError('Invalid cell style reference')
        target = root / name
        target.write_bytes(raw)
        os.chown(target, account.pw_uid, account.pw_gid)
    target = root / 'receipt.json'
    target.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    os.chown(target, account.pw_uid, account.pw_gid)
    os.chown(root, account.pw_uid, account.pw_gid)
    print('Receipt and verified XLSX outputs: ' + str(root))
    print('No deployment, migrations, seeds, user impersonation or application/database changes.')


if __name__ == '__main__':
    main()
