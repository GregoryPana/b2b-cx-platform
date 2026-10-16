import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import json
from pathlib import Path
import socket
import ssl
import stat
import tempfile
import threading
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'analytics_host_repair.py'
spec = importlib.util.spec_from_file_location('repair', MODULE)
if spec is None or spec.loader is None:
    raise RuntimeError('Cannot load repair module')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class RepairTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = tempfile.TemporaryDirectory()
        cls.old_cert, cls.old_key = Path(cls.baseline.name)/'old.crt', Path(cls.baseline.name)/'old.key'
        m.generate_certificate(cls.old_cert, cls.old_key, 'cwscx-web01.cwsey.com', '172.17.0.200')

    @classmethod
    def tearDownClass(cls):
        cls.baseline.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.certdir = root/'tls'
        self.certdir.mkdir(mode=0o700)
        self.cert, self.key = self.certdir/'cwscx.crt', self.certdir/'cwscx.key'
        self.cert.write_bytes(self.old_cert.read_bytes())
        self.key.write_bytes(self.old_key.read_bytes())
        self.key.chmod(0o600)
        self.available, self.enabled = root/'available', root/'enabled'
        self.available.mkdir()
        self.enabled.mkdir()
        self.original = 'server {\n server_name cwscx-tst01.cwsey.com;\n # preserve extra routes\n}\nserver {\n server_name cwscx-tst01.cwsey.com;\n}\n'
        (self.available/'cwscx-staging').write_text(self.original)
        (self.enabled/'cwscx-staging').symlink_to(self.available/'cwscx-staging')
        (self.enabled/'default').write_text('unrelated-default-sentinel')
        self.app = root/'app'
        self.asset = self.app/'frontends-src/dashboard/dist/assets/index-test.js'
        self.asset.parent.mkdir(parents=True)
        self.asset.write_bytes(b'fixture-dashboard-code')
        for name, value in [('CERT',self.cert),('KEY',self.key),('AVAILABLE',self.available),('ENABLED',self.enabled),('ROOT',self.app)]:
            p = patch.object(m,name,value)
            p.start()
            self.addCleanup(p.stop)
        self.commands = []
        self.real_run = m.run
        def execute(*args, **kwargs):
            self.commands.append(args)
            if args[0] == 'openssl': return self.real_run(*args, **kwargs)
            return b''
        p = patch.object(m,'run',side_effect=execute)
        p.start()
        self.addCleanup(p.stop)

    def action(self, action, verifier=None):
        short, ip = m.HOSTS[action]
        with patch.object(m.socket,'gethostname',return_value=short), patch.object(m.socket,'gethostbyname',return_value=ip), patch.object(m,'verify_https',side_effect=verifier or (lambda host:{'verified':True})):
            return m.repair(action,'analytics-repair-test')

    def test_staging_certificate_and_routes(self):
        result = self.action('staging_tls')
        self.assertNotEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        m.verify_certificate(self.cert,self.key,'cwscx-tst01.cwsey.com','172.17.1.213')
        self.assertEqual((self.available/'cwscx-staging').read_text(),self.original)
        self.assertEqual((self.enabled/'default').read_text(),'unrelated-default-sentinel')
        backup = Path(result['backup'])
        self.assertEqual(stat.S_IMODE(backup.stat().st_mode),0o700)
        self.assertEqual(stat.S_IMODE((backup/'previous.key').stat().st_mode),0o600)
        self.assertEqual((backup/'previous.key').read_bytes(),self.old_key.read_bytes())

    def test_failed_tls_proof_restores_key_and_certificate(self):
        def fail(host): raise RuntimeError('injected post-reload failure')
        with self.assertRaisesRegex(RuntimeError,'injected'):
            self.action('staging_tls',fail)
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        self.assertEqual(self.key.read_bytes(),self.old_key.read_bytes())
        self.assertEqual(self.commands.count(('systemctl','reload','nginx')),2)

    def test_production_renames_site_not_certificate(self):
        self.action('production_site')
        self.assertFalse((self.enabled/'cwscx-staging').exists())
        self.assertTrue((self.enabled/'cwscx-production').is_symlink())
        self.assertEqual((self.available/'cwscx-production').read_text(),self.original.replace('cwscx-tst01.cwsey.com','cwscx-app01.cwsey.com'))
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        self.assertEqual(self.key.read_bytes(),self.old_key.read_bytes())
        self.assertEqual((self.enabled/'default').read_text(),'unrelated-default-sentinel')

    def test_production_failed_proof_restores_original_site(self):
        def fail(host): raise RuntimeError('injected production proof failure')
        with self.assertRaisesRegex(RuntimeError,'injected'):
            self.action('production_site',fail)
        self.assertTrue((self.enabled/'cwscx-staging').is_symlink())
        self.assertFalse((self.enabled/'cwscx-production').exists())
        self.assertFalse((self.available/'cwscx-production').exists())
        self.assertEqual((self.available/'cwscx-staging').read_text(),self.original)

    def test_wrong_host_rejected_before_backup(self):
        with patch.object(m.socket,'gethostname',return_value='cwscx-web01'):
            with self.assertRaisesRegex(RuntimeError,'identity'):
                m.repair('staging_tls','analytics-repair-test')
        self.assertFalse((self.certdir/'analytics-repair-test').exists())

    def test_mystery_action_and_unsafe_operation_rejected(self):
        for action, name in [('mystery','analytics-repair-test'),('staging_tls','../escape')]:
            with self.assertRaisesRegex(RuntimeError,'Invalid'):
                m.repair(action,name)
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())

    def test_existing_production_site_never_overwritten(self):
        (self.available/'cwscx-production').write_text('existing-other-site')
        with self.assertRaisesRegex(RuntimeError,'already exists'):
            self.action('production_site')
        self.assertEqual((self.available/'cwscx-production').read_text(),'existing-other-site')
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())

    def test_public_certificate_hostname_and_ip_validation(self):
        with self.assertRaises(RuntimeError):
            m.verify_certificate(self.cert,self.key,'cwscx-tst01.cwsey.com','172.17.1.213')

    def test_insecure_private_key_refused_before_backup(self):
        for mode in (0o644, 0o640):
            with self.subTest(mode=mode):
                self.key.chmod(mode)
                with self.assertRaisesRegex(RuntimeError,'root:root 0600'):
                    self.action('staging_tls')
                self.assertFalse((self.certdir/'analytics-repair-test').exists())
                self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        self.key.chmod(0o600)

    def test_second_operation_refused_under_exclusive_lock(self):
        import fcntl, os
        path = self.certdir/'.analytics-host-repair.lock'
        fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(RuntimeError,'exclusive lock'):
                self.action('staging_tls')
            self.assertFalse((self.certdir/'analytics-repair-test').exists())
        finally:
            os.close(fd)

    def test_wrong_dns_refused_before_backup(self):
        with patch.object(m.socket,'gethostname',return_value='cwscx-tst01'), patch.object(m.socket,'gethostbyname',return_value='172.17.0.200'):
            with self.assertRaisesRegex(RuntimeError,'identity/DNS'):
                m.repair('staging_tls','analytics-repair-test')
        self.assertFalse((self.certdir/'analytics-repair-test').exists())

    def test_second_tls_copy_failure_restores_original_pair(self):
        original = m.atomic_copy
        def copying(source,target,*args):
            if source.name == 'new.key':
                raise OSError('injected key install failure')
            return original(source,target,*args)
        with patch.object(m,'atomic_copy',side_effect=copying):
            with self.assertRaisesRegex(OSError,'injected'):
                self.action('staging_tls')
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        self.assertEqual(self.key.read_bytes(),self.old_key.read_bytes())

    def test_nginx_test_and_reload_failures_restore_pair(self):
        for command in [('nginx','-t'),('systemctl','reload','nginx')]:
            with self.subTest(command=command):
                # Independent fixture for each boundary.
                operation = 'analytics-repair-'+command[0]
                previous = m.run
                calls = []
                def execute(*args,**kwargs):
                    if args == command:
                        calls.append(args)
                        if len(calls) == 1: raise RuntimeError('injected command failure')
                    return previous(*args,**kwargs)
                short,ip = m.HOSTS['staging_tls']
                with patch.object(m,'run',side_effect=execute), patch.object(m.socket,'gethostname',return_value=short), patch.object(m.socket,'gethostbyname',return_value=ip):
                    with self.assertRaisesRegex(RuntimeError,'injected'):
                        m.repair('staging_tls',operation)
                self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
                self.assertEqual(self.key.read_bytes(),self.old_key.read_bytes())

    def test_result_publication_failure_restores_pair(self):
        original = Path.write_text
        def writing(path,*args,**kwargs):
            if path.name == 'result.json': raise OSError('injected result failure')
            return original(path,*args,**kwargs)
        with patch.object(Path,'write_text',writing):
            with self.assertRaisesRegex(OSError,'injected'):
                self.action('staging_tls')
        self.assertEqual(self.cert.read_bytes(),self.old_cert.read_bytes())
        self.assertEqual(self.key.read_bytes(),self.old_key.read_bytes())

    def test_relative_site_symlink_preserved_on_production_rollback(self):
        import os
        link = self.enabled/'cwscx-staging'
        link.unlink()
        link.symlink_to('../available/cwscx-staging')
        def fail(host): raise RuntimeError('injected proof failure')
        with self.assertRaisesRegex(RuntimeError,'injected'):
            self.action('production_site',fail)
        self.assertEqual(os.readlink(link),'../available/cwscx-staging')

    def test_reload_waits_for_strict_certificate_convergence(self):
        with patch.object(m,'verify_https',side_effect=[ssl.SSLCertVerificationError('old worker'),{'verified':True}]) as verifier, patch.object(m.time,'sleep'):
            proof = m.verify_after_reload('cwscx-tst01.cwsey.com')
        self.assertEqual(verifier.call_count,2)
        self.assertEqual(proof['reload_tls_attempts'],2)

    def test_permanent_certificate_failure_remains_fail_closed(self):
        with patch.object(m,'verify_https',side_effect=ssl.SSLCertVerificationError('wrong certificate')) as verifier, patch.object(m.time,'sleep'):
            with self.assertRaises(ssl.SSLCertVerificationError):
                m.verify_after_reload('cwscx-tst01.cwsey.com')
        self.assertEqual(verifier.call_count,10)

    def test_real_https_asset_health_and_auth_contract(self):
        m.generate_certificate(self.cert,self.key,'localhost','127.0.0.1')
        asset_bytes = self.asset.read_bytes()
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                payloads = {'/dashboard/':(200,b'<script src="/dashboard/assets/index-test.js"></script>'),'/dashboard/assets/index-test.js':(200,asset_bytes),'/api/health':(200,json.dumps({'status':'ok','checks':{'database':'ok'}}).encode()),'/api/dashboard-visits/all':(401,b'{}')}
                status,body = payloads.get(self.path,(404,b''))
                self.send_response(status)
                self.send_header('Content-Length',str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, format, *args): pass
        server = HTTPServer(('127.0.0.1',0),Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(self.cert,self.key)
        server.socket = context.wrap_socket(server.socket,server_side=True)
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        def local_get(host, context, route):
            connection = http.client.HTTPSConnection(host, port=server.server_port, context=context, timeout=5)
            try:
                connection.request('GET', route)
                response = connection.getresponse()
                return response.status, response.read()
            finally:
                connection.close()
        try:
            with patch.object(m,'https_get',side_effect=local_get):
                proof = m.verify_https('localhost')
                self.assertTrue(proof['tls_hostname_verified'])
                self.assertEqual(proof['anonymous_api'],401)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == '__main__': unittest.main()
