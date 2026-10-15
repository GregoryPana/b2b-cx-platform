#!/usr/bin/env python3
"""Approved, bounded internal-host TLS/site repair. No DB/config-secret access.

Only staging_tls and production_site are supported. Private keys/backups never
leave the host. A failed verification restores the prior files and reloads NGINX.
This is not a power-loss/SIGKILL transaction guarantee.
"""
import argparse
import fcntl
import signal
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import stat
import subprocess
import tempfile
import time

ROOT = Path('/opt/cwscx')
CERT = Path('/etc/ssl/cwscx/cwscx.crt')
KEY = Path('/etc/ssl/cwscx/cwscx.key')
AVAILABLE = Path('/etc/nginx/sites-available')
ENABLED = Path('/etc/nginx/sites-enabled')
HOSTS = {'staging_tls': ('cwscx-tst01', '172.17.1.213'), 'production_site': ('cwscx-app01', '172.17.1.211')}


def run(*args, input=None):
    result = subprocess.run(list(args), input=input, capture_output=True, timeout=45)
    if result.returncode:
        # Do not include command output: service tools may contain runtime config.
        raise RuntimeError('Required repair command failed: ' + Path(args[0]).name)
    return result.stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def regular_root_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0:
        raise RuntimeError('Expected a root-owned regular file: ' + str(path))
    return info


def atomic_copy(source, target, mode, uid=0, gid=0):
    fd, name = tempfile.mkstemp(prefix='.analytics-repair-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(source.read_bytes())
            output.flush()
            os.fsync(output.fileno())
        os.chmod(name, mode)
        os.chown(name, uid, gid)
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def verify_certificate(cert, key, host, ip):
    run('openssl', 'x509', '-in', str(cert), '-noout', '-checkhost', host)
    # openssl checkhost/checkip may print mismatch with exit0: inspect the text too.
    if b'does match certificate' not in run('openssl', 'x509', '-in', str(cert), '-noout', '-checkhost', host):
        raise RuntimeError('Certificate hostname mismatch')
    if b'does match certificate' not in run('openssl', 'x509', '-in', str(cert), '-noout', '-checkip', ip):
        raise RuntimeError('Certificate IP mismatch')
    public_cert = run('openssl', 'x509', '-in', str(cert), '-pubkey', '-noout')
    public_key = run('openssl', 'pkey', '-in', str(key), '-pubout')
    if public_cert != public_key:
        raise RuntimeError('Certificate and key do not match')


def generate_certificate(cert, key, host, ip):
    run('openssl', 'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-days', '365',
        '-subj', '/C=SC/O=CWS/OU=CX/CN=' + host,
        '-addext', 'subjectAltName=DNS:' + host + ',DNS:' + host.split('.')[0] + ',IP:' + ip,
        '-addext', 'basicConstraints=critical,CA:FALSE',
        '-addext', 'extendedKeyUsage=serverAuth',
        '-keyout', str(key), '-out', str(cert))
    os.chmod(key, 0o600)
    verify_certificate(cert, key, host, ip)


def https_get(host, context, route):
    connection = http.client.HTTPSConnection(host, context=context, timeout=15)
    try:
        connection.request('GET', route)
        response = connection.getresponse()
        return response.status, response.read(16 * 1024 * 1024)
    finally:
        connection.close()


def verify_https(host):
    context = ssl.create_default_context(cadata=CERT.read_text())
    status, html = https_get(host, context, '/dashboard/')
    if status != 200:
        raise RuntimeError('Dashboard HTTPS response failed')
    assets = re.findall(rb'<script[^>]+src=[\"\']([^\"\']+)[\"\']', html)
    if not assets or not assets[0].startswith(b'/dashboard/assets/'):
        raise RuntimeError('Dashboard release asset missing')
    asset = assets[0].decode('ascii')
    status, payload = https_get(host, context, asset)
    installed = ROOT / 'frontends-src/dashboard/dist/assets' / Path(asset).name
    if status != 200 or hashlib.sha256(payload).hexdigest() != digest(installed):
        raise RuntimeError('Served dashboard differs from installed asset')
    status, body = https_get(host, context, '/api/health')
    health = json.loads(body)
    if status != 200 or health.get('status') not in ('ok', 'ready') or health.get('checks', {}).get('database') != 'ok':
        raise RuntimeError('Proxied database health failed')
    if https_get(host, context, '/api/dashboard-visits/all')[0] != 401:
        raise RuntimeError('Anonymous internal API was not rejected')
    return {'tls_hostname_verified': True, 'dashboard_asset_verified': True, 'database_health': 'ok', 'anonymous_api': 401}


def verify_after_reload(host):
    # systemctl reload acknowledges the signal before old NGINX workers retire.
    # Retry only transient connection/certificate transitions; every attempt still
    # validates the exact new trust anchor, hostname, assets, health and auth.
    for attempt in range(10):
        try:
            proof = verify_https(host)
            proof['reload_tls_attempts'] = attempt + 1
            return proof
        except (ssl.SSLCertVerificationError, ConnectionRefusedError, ConnectionResetError):
            if attempt == 9:
                raise
            time.sleep(0.25)
    raise RuntimeError('Unreachable readiness state')


def repair(action, operation):
    if os.geteuid() != 0:
        raise RuntimeError('Approved repair must run as root')
    parent = CERT.parent.lstat()
    if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != 0 or parent.st_mode & 0o022:
        raise RuntimeError('Unsafe certificate/lock directory')
    fd = os.open(CERT.parent/'.analytics-host-repair.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        lock = os.fstat(fd)
        if lock.st_uid != 0 or lock.st_gid != 0 or lock.st_mode & 0o077 or not stat.S_ISREG(lock.st_mode):
            raise RuntimeError('Unsafe repair lock')
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another host repair holds the exclusive lock') from None
        return _repair_locked(action, operation)
    finally:
        os.close(fd)


def _repair_locked(action, operation):
    if os.geteuid() != 0:
        raise RuntimeError('Approved repair must run as root using existing deployment privileges')
    if action not in HOSTS or not re.fullmatch(r'analytics-repair-[A-Za-z0-9-]{1,100}', operation):
        raise RuntimeError('Invalid action/operation')
    short, ip = HOSTS[action]
    host = short + '.cwsey.com'
    if socket.gethostname().split('.')[0] != short or socket.gethostbyname(host) != ip:
        raise RuntimeError('Registered target identity/DNS mismatch')
    cert_info, key_info = regular_root_file(CERT), regular_root_file(KEY)
    if key_info.st_gid != 0 or stat.S_IMODE(key_info.st_mode) != 0o600:
        raise RuntimeError('Private key must be root:root 0600 before repair')
    parent_info = CERT.parent.lstat()
    if not stat.S_ISDIR(parent_info.st_mode) or parent_info.st_uid != 0 or parent_info.st_mode & 0o022:
        raise RuntimeError('Certificate/backup directory must be root-owned and not group/world writable')
    backup = CERT.parent / operation
    backup.mkdir(mode=0o700, exist_ok=False)
    os.chmod(backup, 0o700)
    before_cert = digest(CERT)
    before_key = digest(KEY)
    for source, name in [(CERT, 'previous.crt'), (KEY, 'previous.key')]:
        shutil.copyfile(source, backup / name)
        os.chmod(backup / name, 0o600)
    site = AVAILABLE / 'cwscx-staging'
    regular_root_file(site)
    original_site = site.read_bytes()
    (backup / 'previous-site.conf').write_bytes(original_site)
    os.chmod(backup / 'previous-site.conf', 0o600)
    if not (ENABLED / 'cwscx-staging').is_symlink() or (ENABLED / 'cwscx-staging').resolve() != site.resolve():
        raise RuntimeError('Unexpected original NGINX site link')
    original_link = os.readlink(ENABLED/'cwscx-staging')
    if any(p.exists() or p.is_symlink() for p in [AVAILABLE/'cwscx-production', ENABLED/'cwscx-production']):
        raise RuntimeError('Production site already exists; refuse overwrite')
    # Record every enabled site: staging TLS must not change any routing.
    original_routes = {p.name: digest(p) for p in ENABLED.iterdir() if p.is_file()}
    changed = False
    try:
        if action == 'staging_tls':
            with tempfile.TemporaryDirectory(prefix='.analytics-certificate-', dir=CERT.parent) as name:
                new_cert, new_key = Path(name)/'new.crt', Path(name)/'new.key'
                generate_certificate(new_cert, new_key, host, ip)
                changed = True
                atomic_copy(new_cert, CERT, stat.S_IMODE(cert_info.st_mode), cert_info.st_uid, cert_info.st_gid)
                atomic_copy(new_key, KEY, 0o600, 0, 0)
        else:
            old = 'cwscx-tst01.cwsey.com'
            text = original_site.decode()
            names = re.findall(r'^\s*server_name\s+([^;]+);', text, re.M)
            if not names or any(name.strip() != old for name in names):
                raise RuntimeError('Unexpected production site hostname contract')
            text = re.sub(r'(^\s*server_name\s+)' + re.escape(old) + r'(\s*;)', lambda m:m[1]+host+m[2], text, flags=re.M)
            generated = backup / 'corrected-site.conf'
            generated.write_text(text)
            changed = True
            atomic_copy(generated, AVAILABLE/'cwscx-production', 0o644)
            (ENABLED/'cwscx-staging').unlink()
            (ENABLED/'cwscx-production').symlink_to(AVAILABLE/'cwscx-production')
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        proof = verify_after_reload(host)
        if action == 'staging_tls':
            if original_routes != {p.name:digest(p) for p in ENABLED.iterdir() if p.is_file()}:
                raise RuntimeError('Unrelated NGINX routes changed')
        elif digest(CERT) != before_cert or digest(KEY) != before_key:
            raise RuntimeError('Production certificate unexpectedly changed')
        report = {'action':action,'host':host,'operation':operation,'backup':str(backup),'certificate_sha256':digest(CERT),'proof':proof}
        (backup/'result.json').write_text(json.dumps(report, indent=2))
        os.chmod(backup/'result.json', 0o600)
        return report
    except BaseException:
        if changed:
            if action == 'staging_tls':
                atomic_copy(backup/'previous.crt', CERT, stat.S_IMODE(cert_info.st_mode), cert_info.st_uid, cert_info.st_gid)
                atomic_copy(backup/'previous.key', KEY, stat.S_IMODE(key_info.st_mode), key_info.st_uid, key_info.st_gid)
            else:
                (ENABLED/'cwscx-production').unlink(missing_ok=True)
                (AVAILABLE/'cwscx-production').unlink(missing_ok=True)
                if not (ENABLED/'cwscx-staging').exists():
                    (ENABLED/'cwscx-staging').symlink_to(original_link)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=sorted(HOSTS))
    parser.add_argument('--operation', required=True)
    args = parser.parse_args()
    def interrupted(_signum, _frame):
        raise SystemExit('Repair interrupted')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        print(json.dumps(repair(args.action, args.operation), indent=2))
    except Exception as error:
        raise SystemExit('Repair stopped/restored; '+type(error).__name__+': '+str(error))
