#!/usr/bin/env python3
"""Bounded, root-only direct ERP -> company VPN bootstrap. No application/PBX writes."""
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import stat
import subprocess
import sys
import time
import urllib.request

GATEWAY = '46.100.12.214'
PBX = '192.168.100.200'
TARGET = PBX + '/32'
ROOT = Path('/opt/rubi')
PRIVATE = ROOT / 'private/call-center-vpn-1029'
INPUT = Path('/home/rubi-deploy/.rubi-vpn-1029.json')
PSK_FILE = Path('/etc/ipsec.d/rubi-issabel-1029.secrets')
UNIT = Path('/etc/systemd/system/rubi-issabel-vpn.service')
TLS_UNIT = Path('/etc/systemd/system/rubi-issabel-tls.service')
CONN = 'rubi-issabel-1029'
OUT_CHAIN = 'RUBI_ISSABEL_OUT'
IN_CHAIN = 'RUBI_ISSABEL_IN'


def run(args, timeout=30, required=True):
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        if required:
            raise
        return ''
    if required and result.returncode:
        raise RuntimeError('Operation failed: ' + ' '.join(args[:2]) + ' exit=' + str(result.returncode))
    return result.stdout.decode(errors='replace')


def quote(value):
    if not isinstance(value, str) or not value or len(value) > 512 or any(c in value for c in '\r\n\0'):
        raise ValueError('Invalid credential shape')
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def credentials(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'r') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o077 or info.st_size > 8192:
            raise RuntimeError('Credential file must be private and regular')
        doc = json.load(stream)
    if doc.get('version') != 1 or doc.get('gateway') != GATEWAY or doc.get('username') != 'bi':
        raise RuntimeError('Credential target mismatch')
    quote(doc.get('password')); quote(doc.get('psk')); quote(doc.get('amiSecret'))
    if doc.get('amiUsername') != 'ai': raise RuntimeError('Dedicated AMI identity mismatch')
    return doc


def files(doc):
    return {
        PRIVATE / 'connection.conf': '''conn %s
    keyexchange=ikev1
    type=transport
    authby=psk
    left=%%defaultroute
    leftprotoport=17/1701
    right=%s
    rightid=%%any
    rightprotoport=17/1701
    ike=aes128-sha1-modp2048!
    esp=aes128-sha1,aes256-sha1,aes128-sha256,aes256-sha256!
    forceencaps=yes
    dpdaction=restart
    dpddelay=20s
    dpdtimeout=60s
    keyingtries=1
    auto=add
''' % (CONN, GATEWAY),
        PSK_FILE: ': PSK ' + quote(doc['psk']) + '\n',
        PRIVATE / 'ppp.options': '''ipcp-accept-local
ipcp-accept-remote
noauth
noipdefault
nodefaultroute
noipv6
refuse-eap
refuse-pap
refuse-chap
refuse-mschap
hide-password
mtu 1360
mru 1360
lcp-echo-interval 20
lcp-echo-failure 3
ipparam rubi-issabel-1029
linkname rubi-issabel-1029
name "bi"
password %s
ip-up-script %s/ip-up
ip-down-script %s/ip-down
''' % (quote(doc['password']), PRIVATE, PRIVATE),
        PRIVATE / 'xl2tpd.conf': '''[global]
port = 1701
[lac rubi-issabel-1029]
lns = %s
pppoptfile = %s/ppp.options
ppp debug = no
require authentication = no
length bit = yes
pass peer = no
autodial = yes
redial = yes
redial timeout = 20
max redials = 5
''' % (GATEWAY, PRIVATE),
    }


HOOK = '''#!/usr/bin/python3
import os,re,subprocess,sys
if len(sys.argv)!=7 or sys.argv[6]!='rubi-issabel-1029' or not re.fullmatch(r'ppp[0-9]+',sys.argv[1]):
    raise SystemExit(1)
cmd=['ip','route','replace' if os.path.basename(sys.argv[0])=='ip-up' else 'del','192.168.100.200/32','dev',sys.argv[1],'proto','186','metric','50']
subprocess.run(cmd,check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
'''

GUARD = '''#!/usr/bin/python3
import subprocess
G='46.100.12.214'
def cmd(a,required=True):
    p=subprocess.run(a,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if required and p.returncode: raise SystemExit(1)
    return p.returncode
cmd(['ip','route','replace','unreachable','192.168.100.200/32','proto','186','metric','42760'])
for direction,chain,base in [('out','RUBI_ISSABEL_OUT','OUTPUT'),('in','RUBI_ISSABEL_IN','INPUT')]:
    if cmd(['iptables','-w','-nL',chain],False)!=0:
        cmd(['iptables','-w','-N',chain])
        cmd(['iptables','-w','-A',chain,'-s' if direction=='in' else '-d',G,'-m','policy','--dir',direction,'--pol','ipsec','--proto','esp','--mode','transport','-j','ACCEPT'])
        cmd(['iptables','-w','-A',chain,'-j','REJECT'])
    rule=['-p','udp','--dport','1701']+(['-d',G] if direction=='out' else [])+['-j',chain]
    if cmd(['iptables','-w','-C',base]+rule,False)!=0: cmd(['iptables','-w','-I',base,'1']+rule)
'''


def write(path, data, mode=0o600):
    if path.exists() or path.is_symlink():
        raise RuntimeError('Refusing to overwrite ' + str(path))
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'w') as stream:
        stream.write(data)


def healthy():
    with urllib.request.urlopen('https://avinaofficial.ir/api/v1/health', timeout=10) as response:
        if response.status != 200:
            raise RuntimeError('ERP health failed')


def unchanged_state():
    return (ROOT.joinpath('compose.yaml').read_bytes(), run(['ip', '-j', 'route', 'show', 'default']),
            Path('/etc/resolv.conf').read_bytes(), run(['docker', 'ps', '--format', '{{.ID}} {{.Names}} {{.Image}}']))


def cleanup(originals):
    run(['systemctl','disable','--now','rubi-issabel-tls.service'],required=False)
    run(['systemctl', 'disable', '--now', 'rubi-issabel-vpn.service'], required=False)
    run(['ipsec', 'down', CONN], required=False)
    for base, chain, rule in [
        ('OUTPUT', OUT_CHAIN, ['-p','udp','--dport','1701','-d',GATEWAY]),
        ('INPUT', IN_CHAIN, ['-p','udp','--dport','1701'])]:
        run(['iptables','-w','-D',base]+rule+['-j',chain], required=False)
        run(['iptables','-w','-F',chain], required=False)
        run(['iptables','-w','-X',chain], required=False)
    routes = json.loads(run(['ip','-j','route','show','exact',TARGET]))
    for route in routes:
        if str(route.get('protocol')) not in ('186', 'bgp'): continue
        args=['ip','route','del']
        if route.get('type')=='unreachable': args+=['unreachable']
        args += [TARGET,'proto','186','metric',str(route.get('metric',0))]
        if route.get('dev'): args+=['dev',route['dev']]
        run(args,required=False)
    for path, content in originals.items():
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(content)
    run(['systemctl','daemon-reload'],required=False)
    run(['ipsec','reload'],required=False)
    run(['ipsec','rereadsecrets'],required=False)
    run(['systemctl','disable','--now','strongswan-starter.service'],required=False)


def connected():
    routes=json.loads(run(['ip','-j','route','get',PBX],required=False) or '[]')
    return bool(routes and re.fullmatch(r'ppp[0-9]+',routes[0].get('dev','')))


def await_daemon(seconds=30):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        result=subprocess.run(['ipsec','statusall'],capture_output=True,timeout=5)
        if result.returncode==0 and b'Listening IP addresses:' in result.stdout:
            return
        time.sleep(1)
    raise RuntimeError('IPsec control socket not ready after service start')


def await_link(seconds=70):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        if connected():
            try:
                with socket.create_connection((PBX,5038),timeout=3) as sock:
                    if b'Asterisk Call Manager' not in sock.recv(128): raise RuntimeError('AMI banner mismatch')
                with socket.create_connection((PBX,22),timeout=3) as sock:
                    if not sock.recv(128).startswith(b'SSH-'): raise RuntimeError('SSH banner mismatch')
                return
            except OSError: pass
        time.sleep(2)
    raise RuntimeError('Authenticated L2TP/PPP/PBX verification did not complete')


def tls_proxy(doc, originals):
    api=run(['docker','compose','-f',str(ROOT/'compose.yaml'),'ps','-q','api']).strip()
    inspected=json.loads(run(['docker','inspect',api]))[0]
    gateways={n['Gateway'] for n in inspected['NetworkSettings']['Networks'].values() if n.get('Gateway')}
    if len(gateways)!=1: raise RuntimeError('Ambiguous API gateway')
    host=gateways.pop()
    if not isinstance(ipaddress.ip_address(host),ipaddress.IPv4Address) or not ipaddress.ip_address(host).is_private:
        raise RuntimeError('Expected private Docker gateway')
    key=PRIVATE/'proxy.key';cert=PRIVATE/'proxy.crt'
    run(['openssl','req','-x509','-newkey','rsa:3072','-sha256','-nodes','-days','730',
        '-subj','/CN=rubi-issabel-proxy','-addext','subjectAltName=IP:'+host,
        '-addext','basicConstraints=critical,CA:TRUE','-keyout',str(key),'-out',str(cert)],timeout=60)
    conf='''foreground = yes
pid =
debug = warning
sslVersionMin = TLSv1.2
cert = /run/credentials/rubi-issabel-tls.service/proxy.crt
key = /run/credentials/rubi-issabel-tls.service/proxy.key
[ami]
accept = %s:15039
connect = 192.168.100.200:5038
TIMEOUTconnect = 5
TIMEOUTclose = 0
''' % host
    write(PRIVATE/'proxy.conf',conf)
    originals[TLS_UNIT]=None
    write(TLS_UNIT,'''[Unit]
Description=Rubi private TLS bridge to VPN-protected Issabel AMI
Requires=rubi-issabel-vpn.service
After=rubi-issabel-vpn.service
[Service]
Type=simple
LoadCredential=proxy.conf:%s/proxy.conf
LoadCredential=proxy.crt:%s/proxy.crt
LoadCredential=proxy.key:%s/proxy.key
ExecStart=/usr/bin/stunnel4 /run/credentials/rubi-issabel-tls.service/proxy.conf
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
''' % (PRIVATE,PRIVATE,PRIVATE),0o644)
    UNIT.write_text(UNIT.read_text().replace('Wants=network-online.target\n',
        'Wants=network-online.target rubi-issabel-tls.service\n'))
    run(['systemctl','daemon-reload']);run(['systemctl','start','rubi-issabel-tls.service'])
    code=r'''const tls=require('node:tls');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>{
const c=JSON.parse(input);const s=tls.connect({host:c.host,port:15039,ca:c.ca,rejectUnauthorized:true});
const timer=setTimeout(()=>{s.destroy();process.exit(2)},15000);let buffer='';let done=false;
const sep=String.fromCharCode(13,10);
s.on('secureConnect',()=>s.write(['Action: Login','ActionID: rubi-network-check','Username: '+c.username,'Secret: '+c.secret,'Events: off','',''].join(sep)));
s.on('data',b=>{buffer+=b.toString();if(buffer.length>65536){s.destroy();process.exit(3)};
let n;while((n=buffer.indexOf(sep+sep))>=0){const frame=buffer.slice(0,n);buffer=buffer.slice(n+4);
if(frame.includes('ActionID: rubi-network-check')){if(!frame.includes('Response: Success')){s.destroy();process.exit(4)};
done=true;clearTimeout(timer);s.destroy();console.log('AMI_AUTHENTICATED_FROM_API_CONTAINER');}}});
s.on('error',()=>process.exit(5));s.on('close',()=>{if(!done)process.exit(6)});});'''
    # JSON goes through stdin, not arguments/environment/logs. Only the fixed success marker is retained.
    result=subprocess.run(['docker','exec','-i',api,'node','-e',code],
        input=json.dumps({'host':host,'ca':cert.read_text(),'username':doc['amiUsername'],'secret':doc['amiSecret']}).encode(),
        capture_output=True,timeout=25)
    if result.returncode or b'AMI_AUTHENTICATED_FROM_API_CONTAINER' not in result.stdout:
        raise RuntimeError('Docker TLS/AMI authentication failed')
    # Prepared private application fragment; deliberately not attached to Compose until provider rollout.
    write(PRIVATE/'ami-client.json',json.dumps({'ISSABEL_AMI_HOST':host,'ISSABEL_AMI_PORT':'15039',
        'ISSABEL_AMI_TLS':'true','ISSABEL_AMI_CA_PEM':cert.read_text(),
        'ISSABEL_AMI_USERNAME':doc['amiUsername'],'ISSABEL_AMI_SECRET':doc['amiSecret']},indent=2))
    run(['systemctl','enable','rubi-issabel-tls.service'])
    return {'host':host,'port':15039,'docker_ami_authenticated':True,'tls_verified':True}


def main(retry=False):
    if os.geteuid()!=0 or len(sys.argv)!=1: raise SystemExit('Run as root without arguments')
    os.umask(0o077)
    if PRIVATE.exists() or UNIT.exists() or TLS_UNIT.exists() or PSK_FILE.exists(): raise SystemExit('Existing setup requires inspection; no automatic overwrite')
    for name in ('ipsec','xl2tpd','pppd','stunnel4'):
        if not retry and shutil.which(name): raise SystemExit('Pre-existing VPN software requires inspection')
        if retry and not shutil.which(name): raise SystemExit('Expected installed package missing')
    if json.loads(run(['ip','-j','route','show','exact',TARGET])):
        raise SystemExit('Pre-existing PBX route requires inspection')
    for chain in (OUT_CHAIN,IN_CHAIN):
        if subprocess.run(['iptables','-w','-nL',chain],capture_output=True).returncode==0:
            raise SystemExit('Pre-existing firewall chain requires inspection')
    secret=credentials(INPUT)
    before=unchanged_state();healthy()
    run(['/usr/local/sbin/rubi-backup-create-1027'],timeout=300)
    with open(ROOT/'avina-deploy.lock','r') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if before!=unchanged_state(): raise SystemExit('Concurrent deployment detected')
        PRIVATE.mkdir(mode=0o700)
        originals={};report={'complete':False,'application_changes':False,'database_changes':False,'gateway':GATEWAY,'target':TARGET}
        try:
            report['stage']='packages'
            # Packages are installed only if no VPN exists. No application container is recreated.
            if not retry:
                run(['apt-get','update'],timeout=300)
                run(['apt-get','install','-y','--no-install-recommends','strongswan','strongswan-starter','xl2tpd','ppp','stunnel4'],timeout=600)
            run(['systemctl','disable','--now','xl2tpd.service'],required=False)
            run(['systemctl','disable','--now','stunnel4.service'],required=False)
            report['stage']='configuration'
            for path in (Path('/etc/ipsec.conf'),Path('/etc/ipsec.secrets'),UNIT):
                originals[path]=path.read_bytes() if path.exists() else None
                if path.exists(): shutil.copy2(path,PRIVATE/(path.name+'.before'))
            if re.search(r'^\s*conn\s+(?!%default)',Path('/etc/ipsec.conf').read_text(),re.M):
                raise RuntimeError('Unexpected pre-existing IPsec connection')
            originals[PSK_FILE]=None
            for path,data in files(secret).items(): write(path,data)
            write(PRIVATE/'ip-up',HOOK,0o700);write(PRIVATE/'ip-down',HOOK,0o700);write(PRIVATE/'guard',GUARD,0o700)
            write(PRIVATE/'verify-ipsec', '''#!/usr/bin/python3
import subprocess,sys
p=subprocess.run(['ipsec','statusall'],capture_output=True,text=True,timeout=10)
lines=[line for line in p.stdout.splitlines() if 'rubi-issabel-1029' in line]
if p.returncode or not any('ESTABLISHED' in s for s in lines) or not any('INSTALLED' in s for s in lines):
    sys.exit('IPsec is not established and installed; L2TP start refused')
''',0o700)
            for path,include in [(Path('/etc/ipsec.conf'),PRIVATE/'connection.conf'),(Path('/etc/ipsec.secrets'),PSK_FILE)]:
                with path.open('a') as stream: stream.write('\n# rubi-issabel-1029\ninclude '+str(include)+'\n')
            unit='''[Unit]
Description=Rubi dedicated Issabel L2TP IPsec client
After=network-online.target strongswan-starter.service
Wants=network-online.target
Requires=strongswan-starter.service
StartLimitIntervalSec=0
[Service]
Type=simple
RuntimeDirectory=rubi-issabel-vpn
RuntimeDirectoryMode=0700
ExecStartPre=%s/guard
ExecStartPre=/usr/sbin/ipsec up %s
ExecStartPre=%s/verify-ipsec
ExecStart=/usr/sbin/xl2tpd -D -c %s/xl2tpd.conf -p /run/rubi-issabel-vpn/xl2tpd.pid -C /run/rubi-issabel-vpn/control
ExecStopPost=-/usr/sbin/ipsec down %s
Restart=on-failure
RestartSec=20
TimeoutStartSec=60
KillMode=control-group
[Install]
WantedBy=multi-user.target
''' % (PRIVATE,CONN,PRIVATE,PRIVATE,CONN)
            write(UNIT,unit,0o644)
            run(['systemctl','daemon-reload'])
            report['stage']='start_ipsec_daemon'
            run(['systemctl','enable','--now','strongswan-starter.service'])
            report['stage']='await_ipsec_control'
            await_daemon()
            report['stage']='load_ipsec_configuration'
            run(['ipsec','reload']);run(['ipsec','rereadsecrets'])
            report['stage']='authenticated_l2tp_probe'
            run(['systemctl','start','rubi-issabel-vpn.service'],timeout=75)
            await_link()
            report['stage']='reconnect'
            config=PRIVATE/'xl2tpd.conf'
            config.write_text(config.read_text().replace('max redials = 5','max redials = 999999'))
            run(['systemctl','restart','rubi-issabel-vpn.service'],timeout=75)
            await_link()
            report['stage']='docker_tls_ami'
            report['tls_proxy']=tls_proxy(secret,originals)
            healthy()
            if before!=unchanged_state(): raise RuntimeError('ERP/default route/DNS/container preservation failed')
            run(['systemctl','enable','rubi-issabel-vpn.service'])
            os.chmod(INPUT,0o600);os.chown(INPUT,0,0)
            report.update(complete=True,stage='vpn_connected',protocol='L2TP/IPsec IKEv1',ami_tcp=True,ssh_tcp=True,reconnect_verified=True,boot_enabled=True)
        except Exception as error:
            report['failure_type']=type(error).__name__
            report['failure_message']=str(error)[:300]
            report['failure_stage']=report.get('stage')
            recent=run(['journalctl','--since','-10 minutes','-t','charon','-t','ipsec','-t','xl2tpd','-t','pppd','-n','120','--no-pager','-o','cat'],required=False)
            for value in (secret['password'],secret['psk'],secret['amiSecret']):
                recent=recent.replace(value,'[REDACTED]')
            report['network_diagnostics']=[line[:1500] for line in recent.splitlines()
                if not re.search(r'password|secret|CHAP.*(?:challenge|response)|PAP.*(?:AuthReq|password)',line,re.I)]
            logs=run(['journalctl','-u','rubi-issabel-vpn.service','-u','strongswan-starter.service','-n','150','--no-pager','-o','cat'],required=False)
            report['signals']=[label for label,pattern in [
                ('IPSEC_ESTABLISHED',r'IKE_SA .*established|CHILD_SA .*established'),
                ('IPSEC_AUTH_FAILED',r'AUTHENTICATION_FAILED|authentication of .*failed'),
                ('PROPOSAL_REJECTED',r'NO_PROPOSAL_CHOSEN|no proposal chosen'),
                ('PPP_AUTH_FAILED',r'CHAP authentication failed|PAP authentication failed'),
                ('PPP_INTERFACE',r'Using interface ppp'),
                ('L2TP_TIMEOUT',r'Maximum retries exceeded|Unable to deliver closing message'),
            ] if re.search(pattern,logs,re.I)]
            cleanup(originals)
            healthy()
            report['preserved']=before==unchanged_state()
            report['stage']='rolled_back'
        finally:
            write(PRIVATE/'receipt.json',json.dumps(report,indent=2))
            public=ROOT/'CALL-CENTER-VPN-1029.json'
            public.write_text(json.dumps(report,indent=2));os.chmod(public,0o644)
        print('PASS: independent VPN, reconnect and authenticated Docker-to-Issabel TLS/AMI verified.' if report['complete'] else 'INCOMPLETE: rolled back; sanitized receipt retained.')
        print('Receipt: /opt/rubi/CALL-CENTER-VPN-1029.json')
        return 0 if report['complete'] else 1

if __name__=='__main__':
    sys.exit(main())
