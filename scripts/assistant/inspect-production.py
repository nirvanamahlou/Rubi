#!/usr/bin/env python3
"""Read-only Nora deployment diagnosis. Never emit environment values or logs."""
import json
import os
import subprocess


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Diagnostic command failed: ' + args[0])
    return result.stdout


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run with root through the server console; no arguments.')
    config = json.loads(run(['docker', 'compose', '-f', '/opt/rubi/compose.yaml',
                             'config', '--format', 'json']))
    services = config.get('services', {})
    report = {'read_only': True, 'services': {}, 'web_checks': {}}
    keys = ['ASSISTANT_SERVICE_URL', 'ERP_API_BASE_URL', 'ERP_REPORTS_API_BASE_URL',
            'ERP_AUTH_API_BASE_URL', 'ASSISTANT_CONVERSATION_ENABLED',
            'ASSISTANT_MODEL_PROVIDER', 'ASSISTANT_DATA_POLICY', 'GROQ_API_KEY']
    for name in services:
        if name not in ('web', 'api', 'assistant', 'assistant-read', 'nora-assistant'):
            continue
        ids = run(['docker', 'compose', '-f', '/opt/rubi/compose.yaml', 'ps', '-q', name]).strip()
        row = {'running': bool(ids)}
        if ids:
            data = json.loads(run(['docker', 'inspect', ids]))[0]
            env = dict(item.split('=', 1) for item in data['Config'].get('Env', []) if '=' in item)
            row['configured'] = {key: bool(env.get(key)) for key in keys}
            row['chat_policy_valid'] = (env.get('ASSISTANT_CONVERSATION_ENABLED') == 'true'
                                       and env.get('ASSISTANT_MODEL_PROVIDER') == 'groq'
                                       and env.get('ASSISTANT_DATA_POLICY') == 'messages-only'
                                       and bool(env.get('GROQ_API_KEY')))
            if name == 'web':
                # The URL stays inside the container; no cookie or ERP data is sent.
                script = """const u=process.env.ASSISTANT_SERVICE_URL;
if(!u){console.log(JSON.stringify({configured:false}));process.exit()}
try{const t=new URL(u);t.pathname='/health';t.search='';t.hash='';
const r=await fetch(t,{signal:AbortSignal.timeout(5000),redirect:'error'});
console.log(JSON.stringify({configured:true,healthStatus:r.status}))}
catch{console.log(JSON.stringify({configured:true,reachable:false}))}"""
                report['web_checks'] = json.loads(run(['docker', 'exec', ids, 'node',
                                                       '--input-type=module', '-e', script]))
        report['services'][name] = row
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
