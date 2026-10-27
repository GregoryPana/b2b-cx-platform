#!/usr/bin/env python3
"""Read-only web01 inventory. Reports are NOT deployment acceptance evidence.

Only fixed commands are sent over SSH. Never persist raw command output/errors.
The unverified certificate connection inventories public data, NOT trust.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import ssl
import subprocess
import tempfile
import urllib.parse

from check_mystery_deploy_sudo import check_listing
from mystery_public_release_guard import privileged_suite_version

HERE = Path(__file__).resolve().parent
SUITE_NAMES = (
    'cwscx_mystery_public_deploy_entrypoint.sh',
    'install_mystery_public_bundle.sh',
    'mystery_public_release_guard.py',
    'mystery_public_bootstrap_transaction.py',
)
TARGET = 'cxadmin@172.17.0.200'
STATUS = 'sudo -n /usr/local/sbin/cwscx-mystery-public-deploy --action status'
SUDO = 'sudo -n -l'
# Entire program is a constant, passed on stdin to an unprivileged interpreter.
# No file contents, directory listings, process arguments or configuration reads.
INVENTORY = r'''
import json, os, re, stat, subprocess, grp
root='/opt/cwscx-mystery-public'
paths={
 'app':root, 'releases':root+'/releases', 'shared':root+'/shared',
 'state':'/var/lib/cwscx-mystery-public',
 'entrypoint':'/usr/local/sbin/cwscx-mystery-public-deploy',
 'installer':'/usr/local/libexec/cwscx-mystery-public/install_mystery_public_bundle.sh',
 'guard':'/usr/local/libexec/cwscx-mystery-public/mystery_public_release_guard.py',
 'transaction':'/usr/local/libexec/cwscx-mystery-public/mystery_public_bootstrap_transaction.py',
}
result={'metadata':{},'service_uid':os.getuid(),'service_gid':grp.getgrnam('www-data').gr_gid}
for label,path in paths.items():
 try:
  s=os.lstat(path)
  expected=stat.S_ISDIR(s.st_mode) if label in ('app','releases','shared','state') else stat.S_ISREG(s.st_mode)
  mode=stat.S_IMODE(s.st_mode)
  safe=(s.st_uid==result['service_uid'] and s.st_gid==result['service_gid'] and mode==0o770) if label=='shared' else (s.st_uid==0 and not(mode & 0o022))
  result['metadata'][label]={'uid':s.st_uid,'gid':s.st_gid,'mode':mode,'safe':expected and safe}
 except PermissionError: result['metadata'][label]={'inspection':'requires_privileged_status'}
 except OSError: result['metadata'][label]={'safe':False}
try:
 link=os.path.realpath(root+'/current',strict=True)
 match=re.fullmatch(re.escape(root)+r'/releases/([A-Za-z0-9][A-Za-z0-9._-]{0,159})',link)
 result['current_release_id']=match.group(1) if match and os.path.islink(root+'/current') else None
except OSError: result['current_release_id']=None
try:
 v=os.statvfs(root); result['disk_free_bytes']=v.f_bavail*v.f_frsize
except OSError: result['disk_free_bytes']=None
result['services']={}
for service in ('cwscx-mystery-public-backend','nginx'):
 try:
  p=subprocess.run(['/usr/bin/systemctl','show',service,'--property=ActiveState','--property=SubState','--property=MainPID','--property=ActiveEnterTimestampMonotonic'],capture_output=True,text=True,timeout=8,env={'PATH':'/usr/bin:/bin','LC_ALL':'C'})
  d=dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
  result['services'][service]={'active':d.get('ActiveState')=='active','running':d.get('SubState')=='running','main_pid':int(d.get('MainPID','0')),'active_since_monotonic_us':int(d.get('ActiveEnterTimestampMonotonic','0'))} if p.returncode==0 else {}
 except (OSError,ValueError,subprocess.TimeoutExpired): result['services'][service]={}
print(json.dumps(result))
'''
META = ('app', 'releases', 'shared', 'state', 'entrypoint', 'installer', 'guard', 'transaction')
SERVICES = ('cwscx-mystery-public-backend', 'nginx')


def _limit_output_files():
    import resource
    resource.setrlimit(resource.RLIMIT_FSIZE, (65537, 65537))


def run(args, input=None):
    """Kernel-bound output files prevent remote output growing process memory."""
    try:
        with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
            p = subprocess.run(args, input=input, text=True, stdout=stdout, stderr=stderr,
                               timeout=25, preexec_fn=_limit_output_files,
                               env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'})
            stdout.seek(0)
            stderr.seek(0)
            out, err = stdout.read(65537), stderr.read(65537)
            if len(out) > 65536 or len(err) > 65536:
                return 125, ''
            return p.returncode, out.decode('utf-8', errors='replace')
    except (OSError, subprocess.TimeoutExpired):
        return 124, ''


def ssh_args(key, known):
    for path in (key, known):
        p = Path(path)
        if p.is_symlink() or not p.is_file() or p.stat().st_mode & 0o077:
            raise ValueError('unsafe credential file')
    return ['ssh', '-F', '/dev/null', '-i', str(key), '-o', 'IdentitiesOnly=yes',
            '-o', 'IdentityAgent=none', '-o', f'UserKnownHostsFile={known}',
            '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
            '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=2',
            '-o', 'ClearAllForwardings=yes', '-o', 'RequestTTY=no', TARGET]


def identifier(value, pattern):
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        raise ValueError('invalid identity')
    return value


def status_report(raw):
    d = json.loads(raw)
    result: dict = {'release_id': identifier(d['release_id'], r'[A-Za-z0-9][A-Za-z0-9._-]{0,159}'),
              'source_sha': identifier(d['git_sha'], r'[0-9a-f]{40}'),
              'privileged_suite_version': identifier(d['privileged_suite_version'], r'[0-9a-f]{64}')}
    for k in ('baseline_established', 'signed_archive_verified', 'recovery_required'):
        if type(d[k]) is not bool:
            raise ValueError('invalid boolean')
        result[k] = d[k]
    pending = d['pending_operation']
    if pending is not None and not isinstance(pending, dict):
        raise ValueError('invalid pending state')
    result['pending_operation'] = pending is not None
    return result


def natural(v):
    if type(v) is not int or not 0 <= v <= 2**63 - 1:
        raise ValueError('invalid integer')
    return v


def inventory_report(raw):
    d = json.loads(raw)
    result: dict = {'metadata': {}, 'services': {}}
    service_uid, service_gid = natural(d['service_uid']), natural(d['service_gid'])
    if service_uid == 0 or service_gid == 0:
        raise ValueError('invalid service identity')
    result['current_release_id'] = identifier(d['current_release_id'], r'[A-Za-z0-9][A-Za-z0-9._-]{0,159}')
    result['disk_free_bytes'] = natural(d['disk_free_bytes'])
    for name in META:
        m = d['metadata'][name]
        if m == {'inspection': 'requires_privileged_status'} and name in ('installer', 'guard', 'transaction'):
            result['metadata'][name] = {'inspection': 'requires_privileged_status'}
            continue
        if m == {'safe': False}:
            result['metadata'][name] = {'safe': False}
            continue
        # Recompute permission checks locally; never trust a remote safe flag alone.
        uid, gid, mode = (natural(m[k]) for k in ('uid', 'gid', 'mode'))
        if mode > 0o7777 or type(m['safe']) is not bool:
            raise ValueError('invalid metadata')
        boundary = (uid == service_uid and gid == service_gid and mode == 0o770) if name == 'shared' else (uid == 0 and not mode & 0o022)
        result['metadata'][name] = {'uid': uid, 'gid': gid, 'mode': mode,
                                   'safe': m['safe'] and boundary}
    for name in SERVICES:
        s = d['services'][name]
        if type(s['active']) is not bool or type(s['running']) is not bool:
            raise ValueError('invalid service')
        result['services'][name] = {k: s[k] for k in ('active', 'running')}
        for k in ('main_pid', 'active_since_monotonic_us'):
            result['services'][name][k] = natural(s[k])
    return result


def url_host(value):
    if not isinstance(value, str) or len(value) > 253 or any(ord(c) < 33 for c in value):
        raise ValueError('invalid URL')
    u = urllib.parse.urlsplit(value)
    if (u.scheme != 'https' or not u.hostname or u.username is not None or
            u.password is not None or u.port not in (None, 443) or
            u.path not in ('', '/') or u.query or u.fragment or
            not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', u.hostname)):
        raise ValueError('invalid URL')
    return u.hostname


def tls_inventory(host):
    result: dict = {'strict_tls_valid': False, 'certificate_inventory_unverified': True}
    try:
        with socket.create_connection((host, 443), timeout=8) as sock:
            with ssl.create_default_context().wrap_socket(sock, server_hostname=host):
                result['strict_tls_valid'] = True
    except (OSError, ValueError):
        pass
    # A separate unverified connection retrieves ONLY the public certificate.
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((host, 443), timeout=8) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as connection:
                cert = connection.getpeercert(binary_form=True)
        if not cert or len(cert) > 65536:
            raise ValueError('invalid certificate size')
        # subprocess bytes input avoids private certificate decoder APIs/dependencies.
        with tempfile.TemporaryDirectory(prefix='mystery-public-cert-') as temp:
            path = Path(temp) / 'public.der'
            path.write_bytes(cert)
            code, text = run(['openssl', 'x509', '-inform', 'DER', '-in', str(path),
                              '-noout', '-subject', '-issuer', '-enddate', '-ext', 'subjectAltName'])
        if code != 0 or len(text) > 16384:
            raise ValueError('certificate decode failed')
        fields = {}
        for line in text.splitlines():
            for prefix, key in (('subject=', 'subject'), ('issuer=', 'issuer'), ('notAfter=', 'expiry')):
                if line.startswith(prefix):
                    fields[key] = line[len(prefix):].strip()
        san = [line.strip() for line in text.splitlines() if line.startswith(' ') and line.strip()]
        fields['san'] = san
        fields['sha256_fingerprint'] = hashlib.sha256(cert).hexdigest()
        if not all(k in fields for k in ('subject', 'issuer', 'expiry')):
            raise ValueError('missing certificate field')
        result['public_certificate'] = fields
        result['inventory_ok'] = True
    except (OSError, ValueError):
        result['inventory_ok'] = False
    return result


def collect(key, known, base_url, mode):
    report = {'schema_version': 1, 'read_only': True, 'deployment_acceptance': False,
              'preflight_ok': False, 'strict_trust_gate': False, 'failures': []}
    failures = report['failures']
    try:
        if mode not in ('prepublic', 'trusted'):
            raise ValueError('invalid TLS mode')
        host = url_host(base_url)
        ssh = ssh_args(key, known)
        expected = privileged_suite_version([HERE / n for n in SUITE_NAMES])
    except (ValueError, OSError):
        failures.append('input_or_source_guard_failed')
        return report
    report.update(tls_mode=mode, expected_privileged_suite_version=expected)
    code, raw = run(ssh + [SUDO])
    report['ssh_authenticated'] = code not in (124, 125, 255)
    report['sudo_policy'] = {'ok': False, 'reason': 'listing_unavailable'}
    if code == 0:
        try:
            check_listing(raw)
            report['sudo_policy'] = {'ok': True, 'reason': 'fixed_entrypoint_only'}
        except ValueError:
            report['sudo_policy']['reason'] = 'policy_rejected'
    if not report['sudo_policy']['ok']:
        failures.append('sudo_policy_failed')
    # Unprivileged inventory remains useful even when root status cannot run.
    code, raw = run(ssh + ['python3 -I -'], input=INVENTORY)
    try:
        if code != 0:
            raise ValueError('unavailable')
        inv = inventory_report(raw)
        report['inventory'] = inv
        if any(m.get('safe') is False for m in inv['metadata'].values()):
            failures.append('unsafe_permissions')
        if not all(s['active'] and s['running'] and s['main_pid'] > 0 for s in inv['services'].values()):
            failures.append('service_not_running')
        if inv['disk_free_bytes'] == 0:
            failures.append('disk_full')
    except (ValueError, KeyError, TypeError):
        failures.append('inventory_invalid_or_unavailable')
    # Never invoke privileged status unless the existing narrow sudo guard passed.
    report['root_status_class'] = 'not_run_sudo_guard_failed'
    if report['sudo_policy']['ok']:
        code, raw = run(ssh + [STATUS])
        report['root_status_exit'] = code
        report['root_status_class'] = 'status_command_failed'
        if code == 0:
            try:
                state = status_report(raw)
                report['status'] = state
                report['root_status_class'] = 'valid_status'
                if state['privileged_suite_version'] != expected:
                    failures.append('privileged_suite_mismatch_bootstrap_required')
                if state['pending_operation'] or state['recovery_required']:
                    failures.append('pending_operation_or_recovery')
                if state['release_id'] != report.get('inventory', {}).get('current_release_id'):
                    failures.append('current_release_mismatch')
            except (ValueError, KeyError, TypeError):
                report['root_status_class'] = 'invalid_status_schema'
        if report['root_status_class'] != 'valid_status':
            failures.append(report['root_status_class'])
    report['tls'] = tls_inventory(host)
    report['strict_trust_gate'] = report['tls']['strict_tls_valid']
    if not report['tls']['inventory_ok']:
        failures.append('certificate_inventory_failed')
    if mode == 'trusted' and not report['strict_trust_gate']:
        failures.append('strict_tls_validation_failed')
    report['preflight_ok'] = not failures
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key', required=True)
    parser.add_argument('--known-hosts', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        report = collect(args.key, args.known_hosts, os.environ.get('MYSTERY_PUBLIC_BASE_URL', ''),
                         os.environ.get('VERIFY_TLS_MODE', ''))
    except Exception:
        # Never serialize exception strings: they may contain remote/private data.
        report = {'schema_version': 1, 'read_only': True, 'deployment_acceptance': False,
                  'preflight_ok': False, 'strict_trust_gate': False,
                  'failures': ['collector_internal_failure']}
    Path(args.output).write_text(json.dumps(report, sort_keys=True, indent=2) + '\n', encoding='utf-8')
    return 0 if report['preflight_ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
